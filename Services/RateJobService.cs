using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for calculating job rates for NZ and US tenants, including distance calculations, DFRNT API integration, and courier payment processing.
/// </summary>
public sealed class RateJobService(
    IJobQueryRepository jobQueryRepository,
    IJobCommandRepository jobCommandRepository,
    HttpClient httpClient,
    ITenantInfoService infoService,
    IHttpContextAccessor contextAccessor,
    IJobReportService jobReportService,
    IPricingPermissionService pricingPermissionService)
    : IRateJobService
{
    private const string HereMapsApiBaseUrl = "https://router.hereapi.com/v8";

    /// <summary>
    /// Rates a job for NZ tenant by calling the DFRNT API and updating the job with the calculated rate.
    /// </summary>
    /// <param name="jobDetails">The job rating details including client, addresses, speed, and size information.</param>
    public async Task RateJobNzAsync(JobRatingDetailsDtoNz jobDetails)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(jobDetails);
          
            if (!jobDetails.ClientId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "ClientId is required.");
            }

            if (!jobDetails.FromId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "FromId is required.");
            }

            if (!jobDetails.ToId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "ToId is required.");
            }

            if (!jobDetails.SpeedId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "SpeedId is required.");
            }

            if (!jobDetails.SizeId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "SizeId is required.");
            }

            var rateResult = await RateUrgentJobAsync(jobDetails);
            if (rateResult is { Rate: > 0 })
            {
                await jobCommandRepository.UpdateUrgentJobRateAsync(jobDetails.JobId, rateResult.Rate, jobDetails.JobType, rateResult.Description);
            }
            else
            {
                Log.Warning("Job rating failed or returned invalid rate for JobId: {JobId}. Rate: {Rate}",
                    jobDetails.JobId,
                    rateResult?.Rate ?? 0);
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(RateJobNzAsync)));
            throw;
        }
    }

    /// <summary>
    /// Rates a job for US tenant by calculating distances (road or flight) and updating the job with the calculated rate.
    /// </summary>
    /// <param name="jobDetails">The job rating details including client, addresses, speed, size, and weight information.</param>
    public async Task RateJobUsAsync(JobRatingDetailsDto jobDetails)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(jobDetails);
            if (!jobDetails.SpeedId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "SpeedId is required.");
            }

            if (!jobDetails.ClientId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "ClientId is required.");
            }

            if (!jobDetails.SizeId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "SizeId is required.");
            }

            // Get distances and airport info
            var distanceResult = await CalculateJobRateUsAsync(
                new JobRateRequest
                {
                    SpeedId = jobDetails.SpeedId.Value,
                    PickupLat = jobDetails.PickupLat,
                    PickupLong = jobDetails.PickupLong,
                    DeliveryLat = jobDetails.DeliveryLat,
                    DeliveryLong = jobDetails.DeliveryLong,
                    IsFlightSpeed = jobDetails.IsFlightSpeed
                }
            );

            // Calculate final rate
            await jobCommandRepository.RateJobUsAsync(new RateJobUsDto
            {
                JobId = jobDetails.JobId,
                ClientId = jobDetails.ClientId.Value,
                Speed = jobDetails.SpeedId.Value,
                FromZip = jobDetails.FromZip,
                FromLat = jobDetails.PickupLat,
                FromLong = jobDetails.PickupLong,
                ToZip = jobDetails.ToZip,
                ToLat = jobDetails.DeliveryLat,
                ToLong = jobDetails.DeliveryLong,
                TotalMiles = (decimal)distanceResult.TotalMiles, // Used for non-flight jobs
                FromMiles = (decimal)distanceResult.FromMiles, // Used for flight jobs
                ToMiles = (decimal)distanceResult.ToMiles, // Used for flight jobs
                Weight = jobDetails.Weight.HasValue ? (int)jobDetails.Weight : 0,
                Booked = jobDetails.BookedDate,
                Size = jobDetails.SizeId.Value,
                DangerousGoods = jobDetails.DangerousGoods,
                TotalPallets = jobDetails.TotalPallets,
                ExtraStopOffs = jobDetails.ExtraStopOffs,
                DryIceWeight = (int)jobDetails.DryIceWeight,
                WaitTime = jobDetails.WaitTime,
                FromAgentId = distanceResult.FromAirport?.AgentId ?? jobDetails.FromAgentId,
                FromAirportId = distanceResult.FromAirport?.AirportId ?? jobDetails.FromAirportId,
                ToAgentId = distanceResult.ToAirport?.AgentId ?? jobDetails.ToAgentId,
                ToAirportId = distanceResult.ToAirport?.AirportId ?? jobDetails.ToAirportId,
                Quantity = jobDetails.Quantity,
                Cubic = jobDetails.Cubic,
                IsPrebook = jobDetails.IsPrebook ?? false,
                CalculateDimsOncePerJob = jobDetails.CalculateDimsOncePerJob,
                PreviousRate = jobDetails.PreviousRate,
                PrecomputedIsFromAddressAirport = jobDetails.PrecomputedIsFromAddressAirport,
                PrecomputedIsToAddressAirport = jobDetails.PrecomputedIsToAddressAirport
            });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(RateJobUsAsync)));
            throw;
        }
    }

    /// <summary>
    /// Gets the calculated rate for an NZ job without persisting it to the database.
    /// </summary>
    /// <param name="jobDetails">The job rating details including client, addresses, speed, and size information.</param>
    /// <returns>The calculated rate, or 0 if rating fails.</returns>
    public async Task<ApiRerate> GetJobRateNzAsync(JobRatingDetailsDtoNz jobDetails)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(jobDetails);

            if (!jobDetails.ClientId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "ClientId is required.");
            }

            if (!jobDetails.FromId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "FromId is required.");
            }

            if (!jobDetails.ToId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "ToId is required.");
            }

            if (!jobDetails.SpeedId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "SpeedId is required.");
            }

            if (!jobDetails.SizeId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "SizeId is required.");
            }

            var rateResult = await RateUrgentJobAsync(jobDetails);
            if (rateResult is { Rate: > 0 })
            {
                return rateResult;
            }

            Log.Warning("Job rating failed or returned invalid rate for JobId: {JobId}. Rate: {Rate}",
                jobDetails.JobId,
                rateResult?.Rate ?? 0);

            return new ApiRerate();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(GetJobRateNzAsync)));
            throw;
        }
    }

    /// <summary>
    /// Gets the calculated rate for a US job without persisting it to the database.
    /// </summary>
    /// <param name="jobDetails">The job rating details including client, addresses, speed, size, and weight information.</param>
    /// <returns>The calculated rate.</returns>
    public async Task<ApiRerate> GetJobRateUsAsync(JobRatingDetailsDto jobDetails)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(jobDetails);
            
            if (!jobDetails.SpeedId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "SpeedId is required.");
            }

            if (!jobDetails.ClientId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "ClientId is required.");
            }

            if (!jobDetails.SizeId.HasValue)
            {
                throw new ArgumentNullException(nameof(jobDetails), "SizeId is required.");
            }

            // Get distances and airport info
            var distanceResult = await CalculateJobRateUsAsync(
                new JobRateRequest
                {
                    SpeedId = jobDetails.SpeedId.Value,
                    PickupLat = jobDetails.PickupLat,
                    PickupLong = jobDetails.PickupLong,
                    DeliveryLat = jobDetails.DeliveryLat,
                    DeliveryLong = jobDetails.DeliveryLong,
                    IsFlightSpeed = jobDetails.IsFlightSpeed
                }
            );

            // Get the rate without saving
            var rate = await jobQueryRepository.GetJobRateUsAsync(new RateJobUsDto
            {
                JobId = jobDetails.JobId,
                ClientId = jobDetails.ClientId.Value,
                Speed = jobDetails.SpeedId.Value,
                FromZip = jobDetails.FromZip,
                FromLat = jobDetails.PickupLat,
                FromLong = jobDetails.PickupLong,
                ToZip = jobDetails.ToZip,
                ToLat = jobDetails.DeliveryLat,
                ToLong = jobDetails.DeliveryLong,
                TotalMiles = (decimal)distanceResult.TotalMiles,
                FromMiles = (decimal)distanceResult.FromMiles,
                ToMiles = (decimal)distanceResult.ToMiles,
                Weight = jobDetails.Weight.HasValue ? (int)jobDetails.Weight : 0,
                Booked = jobDetails.BookedDate,
                Size = jobDetails.SizeId.Value,
                DangerousGoods = jobDetails.DangerousGoods,
                TotalPallets = jobDetails.TotalPallets,
                ExtraStopOffs = jobDetails.ExtraStopOffs,
                DryIceWeight = (int)jobDetails.DryIceWeight,
                WaitTime = jobDetails.WaitTime,
                FromAgentId = distanceResult.FromAirport?.AgentId ?? jobDetails.FromAgentId,
                FromAirportId = distanceResult.FromAirport?.AirportId ?? jobDetails.FromAirportId,
                ToAgentId = distanceResult.ToAirport?.AgentId ?? jobDetails.ToAgentId,
                ToAirportId = distanceResult.ToAirport?.AirportId ?? jobDetails.ToAirportId,
                Quantity = jobDetails.Quantity,
                Cubic = jobDetails.Cubic,
                IsPrebook = jobDetails.IsPrebook ?? false,
                CalculateDimsOncePerJob = jobDetails.CalculateDimsOncePerJob,
                PreviousRate = jobDetails.PreviousRate,
                PrecomputedIsFromAddressAirport = jobDetails.PrecomputedIsFromAddressAirport,
                PrecomputedIsToAddressAirport = jobDetails.PrecomputedIsToAddressAirport
            });

            return new ApiRerate { Rate = rate };
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(GetJobRateUsAsync)));
            throw;
        }
    }

    /// <summary>
    /// Applies bulk price updates from an uploaded spreadsheet and returns the results.
    /// Supports recalculate, base amount, and gross amount pricing modes.
    /// </summary>
    /// <param name="file">The uploaded spreadsheet file (xls, xlsx, or csv).</param>
    /// <param name="pricingMode">The pricing mode: 'recalculate', 'base', or 'gross'.</param>
    /// <returns>Response containing updated job prices and summary statistics.</returns>
    public async Task<BulkPricePreviewResponse> ApplyBulkPriceUpdateAsync(IFormFile file, string pricingMode)
    {
        // Parse the file using JobReportService
        var parsedData = await jobReportService.ParseBulkPriceFileAsync(file);
        if (parsedData.Count == 0)
        {
            return new BulkPricePreviewResponse();
        }

        // Get current amounts for all jobs before update
        var jobIds = parsedData.Select(d => d.Id).Distinct().ToList();

        // Validate user has access to ALL jobs in the bulk update
        var inaccessibleJobs = await pricingPermissionService.ValidateJobsAccessAsync(jobIds);
        if (inaccessibleJobs.Count > 0)
        {
            var jobList = string.Join(", ", inaccessibleJobs.Take(10));
            var message = inaccessibleJobs.Count > 10
                ? $"You do not have access to the following jobs (and {inaccessibleJobs.Count - 10} more): {jobList}"
                : $"You do not have access to the following jobs: {jobList}";
            throw new UnauthorizedAccessException(message);
        }

        var currentAmounts = await jobQueryRepository.GetJobCurrentAmountsAsync(jobIds);

        var resultRows = new List<BulkPricePreviewRow>();

        // Reason shown when a job in the file could not actually be updated, so the UI surfaces it
        // instead of reporting a false success.
        const string notUpdatedReason =
            "Could not be updated — the job was not found, is locked, or has already been invoiced.";

        static BulkPricePreviewRow SkippedRow(int jobId, string jobNo, decimal oldAmount, bool isPrebook, string reason) =>
            new()
            {
                JobId = jobId,
                JobNo = jobNo,
                Field = "Amount",
                OldAmount = oldAmount,
                NewAmount = oldAmount,
                IsPrebook = isPrebook,
                Skipped = true,
                Error = reason
            };

        switch (pricingMode)
        {
            // Apply updates based on mode
            case "recalculate":
            {
                foreach (var data in parsedData)
                {
                    if (!currentAmounts.TryGetValue(data.Id, out var jobInfo))
                    {
                        resultRows.Add(SkippedRow(data.Id, $"#{data.Id}", 0, false, notUpdatedReason));
                        continue;
                    }

                    var oldAmount = jobInfo.Amount;
                    var newAmount = oldAmount;
                    string error = null;

                    try
                    {
                        await RecalculateJobRateInternalAsync(data.Id, jobInfo.IsPrebook);
                        // Get the new amount after recalculation
                        var updatedAmounts = await jobQueryRepository.GetJobCurrentAmountsAsync([data.Id]);
                        if (updatedAmounts.TryGetValue(data.Id, out var updated))
                        {
                            newAmount = updated.Amount;
                        }
                    }
                    catch (Exception ex)
                    {
                        Log.Warning(ex, "Failed to recalculate rate for job {JobId}", data.Id);
                        error = "Could not recalculate price.";
                    }

                    resultRows.Add(new BulkPricePreviewRow
                    {
                        JobId = data.Id,
                        JobNo = jobInfo.JobNo,
                        Field = "Amount",
                        OldAmount = oldAmount,
                        NewAmount = error == null ? newAmount : oldAmount,
                        IsPrebook = jobInfo.IsPrebook,
                        Skipped = error != null,
                        Error = error
                    });
                }

                break;
            }
            case "base":
            {
                // For base mode, calculate fuel surcharge and update all pricing fields
                var updateModels = new List<JobManualPriceModel>();
                // Non-prebook rows are pending until the batch update reports which jobs it touched.
                var pendingBaseRows = new List<BulkPricePreviewRow>();

                foreach (var data in parsedData)
                {
                    if (!currentAmounts.TryGetValue(data.Id, out var jobInfo))
                    {
                        resultRows.Add(SkippedRow(data.Id, $"#{data.Id}", 0, false, notUpdatedReason));
                        continue;
                    }

                    var oldAmount = jobInfo.Amount;
                    var baseAmount = data.RawBaseAmount ?? 0;
                    decimal newAmount;

                    try
                    {
                        // Calculate total amount with fuel surcharge using DB function
                        newAmount = await jobQueryRepository.GetTotalAmountFromBaseAsync(data.Id, baseAmount);
                    }
                    catch (Exception ex)
                    {
                        Log.Warning(ex, "Failed to calculate total from base amount for job {JobId}", data.Id);
                        newAmount = baseAmount; // Fallback to base amount if calculation fails
                    }

                    var fuelAmount = newAmount - baseAmount;

                    // For prebook jobs, use existing RepriceJobWithBaseAmountAsync (TucJobBooking lacks RawBaseAmount field)
                    if (jobInfo.IsPrebook)
                    {
                        string error = null;
                        try
                        {
                            newAmount = await jobCommandRepository.RepriceJobWithBaseAmountAsync(
                                new RepriceJobWithBaseAmountModel
                                {
                                    JobId = data.Id,
                                    IsPrebook = true,
                                    BaseAmount = baseAmount
                                });
                        }
                        catch (Exception ex)
                        {
                            Log.Warning(ex, "Failed to reprice prebook job with base amount for job {JobId}", data.Id);
                            error = "Could not reprice prebook job.";
                        }

                        resultRows.Add(new BulkPricePreviewRow
                        {
                            JobId = data.Id,
                            JobNo = jobInfo.JobNo,
                            Field = "Amount",
                            OldAmount = oldAmount,
                            NewAmount = error == null ? newAmount : oldAmount,
                            IsPrebook = true,
                            Skipped = error != null,
                            Error = error
                        });
                    }
                    else
                    {
                        // Build update model for non-prebook jobs with all fields populated
                        updateModels.Add(new JobManualPriceModel
                        {
                            Id = data.Id,
                            Amount = newAmount,
                            RawBaseAmount = baseAmount,
                            Fuel = fuelAmount,
                            Ppd = 0,
                            // Use courier values from file if provided, otherwise preserve existing values
                            CourierPayment = data.CourierPayment ?? jobInfo.CourierPayment,
                            CourierFuel = data.CourierFuel ?? jobInfo.CourierFuel,
                            CourierBonus = data.CourierBonus ?? jobInfo.CourierBonus
                        });

                        pendingBaseRows.Add(new BulkPricePreviewRow
                        {
                            JobId = data.Id,
                            JobNo = jobInfo.JobNo,
                            Field = "Amount",
                            OldAmount = oldAmount,
                            NewAmount = newAmount,
                            IsPrebook = false
                        });
                    }
                }

                // Batch update non-prebook jobs using existing robust logic, then resolve each
                // pending row against the set of jobs that were actually updated.
                var updatedIds = updateModels.Count > 0
                    ? await jobCommandRepository.UpdateManualPriceAsync(updateModels)
                    : new HashSet<int>();

                resultRows.AddRange(pendingBaseRows.Select(row => updatedIds.Contains(row.JobId)
                    ? row
                    : row with { Skipped = true, NewAmount = row.OldAmount, Error = notUpdatedReason }));

                break;
            }
            default:
            {
                // Gross mode: amounts are applied directly. The update covers live AND archived
                // jobs, so drive the rows off what was actually updated rather than the live-only
                // preview snapshot.
                var updatedIds = await jobCommandRepository.UpdateManualPriceAsync(parsedData);

                foreach (var data in parsedData)
                {
                    currentAmounts.TryGetValue(data.Id, out var jobInfo);
                    var updated = updatedIds.Contains(data.Id);

                    var oldAmount = jobInfo?.Amount ?? 0;
                    var newAmount = updated ? data.Amount ?? oldAmount : oldAmount;

                    resultRows.Add(new BulkPricePreviewRow
                    {
                        JobId = data.Id,
                        JobNo = jobInfo?.JobNo ?? $"#{data.Id}",
                        Field = "Amount",
                        OldAmount = oldAmount,
                        NewAmount = newAmount,
                        IsPrebook = jobInfo?.IsPrebook ?? false,
                        Skipped = !updated,
                        Error = updated ? null : notUpdatedReason
                    });
                }

                break;
            }
        }

        // Handle Void field for all pricing modes - apply void status regardless of pricing mode selected
        var jobsToVoid = parsedData.Where(d => d.Void == true).Select(d => d.Id).ToList();
        if (jobsToVoid.Count > 0)
        {
            await jobCommandRepository.UpdateJobVoidStatusAsync(jobsToVoid);
            Log.Information("Voided {Count} jobs via bulk upload", jobsToVoid.Count);
        }

        var updatedRows = resultRows.Where(r => !r.Skipped).ToList();
        return new BulkPricePreviewResponse
        {
            Rows = resultRows,
            TotalJobs = updatedRows.Count,
            SkippedJobs = resultRows.Count - updatedRows.Count,
            TotalOldAmount = updatedRows.Sum(r => r.OldAmount),
            TotalNewAmount = updatedRows.Sum(r => r.NewAmount)
        };
    }

    /// <summary>
    /// Calculates distances for US job rating. For non-flight jobs, calculates total road distance.
    /// For flight jobs, finds closest airports and calculates road distances to/from airports.
    /// </summary>
    /// <param name="request">The job rate request containing speed ID and pickup/delivery coordinates.</param>
    /// <returns>A result containing total miles, from/to miles, and airport information for flight jobs.</returns>
    private async Task<JobRateResult> CalculateJobRateUsAsync(JobRateRequest request)
    {
        var isUsCustomer = infoService.IsUsTenant();

        // Use pre-computed flight speed flag when available (e.g. split job re-rating),
        // otherwise look up from DB
        bool isFlight;
        if (request.IsFlightSpeed.HasValue)
        {
            isFlight = request.IsFlightSpeed.Value;
        }
        else
        {
            var speed = await jobQueryRepository.GetJobTypeByIdAsync(request.SpeedId);
            isFlight = speed.Grouping.GroupingId == (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight);
        }

        var result = new JobRateResult
        {
            TotalMiles = 0,
            FromMiles = 0,
            ToMiles = 0
        };

        if (!isFlight)
        {
            result.TotalMiles = await CalculateRoadDistance(
                request.PickupLat,
                request.PickupLong,
                request.DeliveryLat,
                request.DeliveryLong);
        }
        else
        {
            // Get the closest airports in parallel — these are independent stored procedure calls
            var fromAirportsTask = jobQueryRepository.GetClosestAirportsAsync(
                request.PickupLat ?? 0,
                request.PickupLong ?? 0);
            var toAirportsTask = jobQueryRepository.GetClosestAirportsAsync(
                request.DeliveryLat ?? 0,
                request.DeliveryLong ?? 0);
            await Task.WhenAll(fromAirportsTask, toAirportsTask);
            var closestFromAirports = fromAirportsTask.Result;
            var closestToAirports = toAirportsTask.Result;

            result.FromAirport = closestFromAirports[0];
            result.ToAirport = closestToAirports[0];

            // Calculate road distances to/from airports in parallel
            var fromMilesTask = CalculateRoadDistance(
                request.PickupLat,
                request.PickupLong,
                result.FromAirport.Latitude,
                result.FromAirport.Longitude);
            var toMilesTask = CalculateRoadDistance(
                result.ToAirport.Latitude,
                result.ToAirport.Longitude,
                request.DeliveryLat,
                request.DeliveryLong);
            await Task.WhenAll(fromMilesTask, toMilesTask);

            result.FromMiles = fromMilesTask.Result;
            result.ToMiles = toMilesTask.Result;
        }

        return result;
    }

    /// <summary>
    /// Calculates the road distance in miles between two coordinates using the HERE Maps API.
    /// </summary>
    /// <param name="fromLatitude">Origin latitude.</param>
    /// <param name="fromLongitude">Origin longitude.</param>
    /// <param name="toLatitude">Destination latitude.</param>
    /// <param name="toLongitude">Destination longitude.</param>
    /// <returns>The road distance in miles, or 0 if coordinates are invalid.</returns>
    private async Task<double> CalculateRoadDistance(decimal? fromLatitude, decimal? fromLongitude, decimal? toLatitude,
        decimal? toLongitude)
    {
        if (!AreValidCoordinates(fromLatitude, fromLongitude, toLatitude, toLongitude))
        {
            return 0;
        }

        var fromLatLng = $"{fromLatitude},{fromLongitude}";
        var toLatLng = $"{toLatitude},{toLongitude}";

        var routeResponse = await GetHereMapRoute(fromLatLng, toLatLng);
        return CalculateMilesFromRoute(routeResponse);
    }

    /// <summary>
    /// Validates that all coordinate values are present and non-zero.
    /// </summary>
    private static bool AreValidCoordinates(decimal? fromLat, decimal? fromLong, decimal? toLat, decimal? toLong) =>
        fromLat.HasValue && fromLat != 0 &&
        fromLong.HasValue && fromLong != 0 &&
        toLat.HasValue && toLat != 0 &&
        toLong.HasValue && toLong != 0;

    /// <summary>
    /// Calls the HERE Maps Routing API v8 to get route information between two points.
    /// </summary>
    /// <param name="fromLatLng">Origin coordinates as "latitude,longitude" string.</param>
    /// <param name="toLatLng">Destination coordinates as "latitude,longitude" string.</param>
    /// <returns>The route response containing sections with distance summaries.</returns>
    private async Task<HereMapRouteResponseV8> GetHereMapRoute(string fromLatLng, string toLatLng)
    {
        var queryParams = new Dictionary<string, string>
        {
            { "apiKey", Environment.GetEnvironmentVariable("HereMapsAPIKey") },
            { "origin", fromLatLng },
            { "destination", toLatLng },
            { "routingMode", "fast" },
            { "transportMode", "car" },
            { "departureTime", "any" },
            { "return", "summary" }
        };

        var queryString = string.Join("&", queryParams.Select(p =>
            $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

        try
        {
            var response = await httpClient.GetAsync($"{HereMapsApiBaseUrl}/routes?{queryString}");
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<HereMapRouteResponseV8>();
            return result ?? throw new ApplicationException("Failed to deserialize HERE Maps API response");
        }
        catch (HttpRequestException ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(RateJobUsAsync)));
            throw new ApplicationException("HERE Maps API request failed", ex);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(RateJobUsAsync)));
            throw new ApplicationException("Failed to get route from HERE Maps API", ex);
        }
    }

    /// <summary>
    /// Extracts the total distance in miles from a HERE Maps route response by summing car transport sections.
    /// </summary>
    /// <param name="routeResponse">The HERE Maps route response.</param>
    /// <returns>The total distance in miles, rounded to the nearest whole number.</returns>
    private static double CalculateMilesFromRoute(HereMapRouteResponseV8 routeResponse)
    {
        if (routeResponse?.Routes == null || routeResponse.Routes.Count == 0)
        {
            return 0;
        }

        var totalMeters = routeResponse.Routes[0].Sections
            .Where(s => s.Transport.Mode == "car")
            .Sum(s => s.Summary.Length);

        return Math.Round(totalMeters / 1609.344, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// Calls the DFRNT API to get a rate for an urgent (NZ) job.
    /// </summary>
    /// <param name="jobDetails">The job rating details to send to the API.</param>
    /// <returns>The rate result from the DFRNT API.</returns>
    public async Task<ApiRerate> RateUrgentJobAsync(JobRatingDetailsDtoNz jobDetails)
    {
        try
        {
            // Map Job Object
            var jobObject = MapToUrgentRerateObject(jobDetails);

            // Generate DFRNT Api Token
            var connectionString =
                contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
            ArgumentException.ThrowIfNullOrEmpty(connectionString);
            var tenantId = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")
                ?.Value;
            ArgumentException.ThrowIfNullOrEmpty(tenantId);
            var timeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
            ArgumentException.ThrowIfNullOrEmpty(timeZone);
            var userName = contextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value;
            ArgumentException.ThrowIfNullOrEmpty(userName);

            var token = AuthenticationExtensions.CreateApiToken(userName,
                int.Parse(tenantId),
                connectionString,
                timeZone,
                jobDetails.ClientId.Value);

            var requestToken = new JwtSecurityTokenHandler().WriteToken(token);

            // Call DFRNT API
            var baseUrl = Environment.GetEnvironmentVariable("WebAPIUrl");

            var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/rates/getRerateAmount");
            request.Headers.Add("Authorization", $"Bearer {requestToken}");
            request.Content = JsonContent.Create(jobObject);

            var response = await httpClient.SendAsync(request);
            var rawContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Log.Error("DFRNT API returned {StatusCode}: {RawContent}", response.StatusCode, rawContent);
                throw new ApplicationException($"DFRNT API returned {(int)response.StatusCode} {response.StatusCode}: {rawContent}");
            }

            Log.Debug("Raw response: {RawContent}", rawContent);
            var rerateResponse = await response.Content.ReadFromJsonAsync<RerateApiResponse>();
            return rerateResponse.Rerate ?? throw new ApplicationException("Failed to get rate from DFRNT API");
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(RateJobService), nameof(RateUrgentJobAsync)));
            throw;
        }
    }

    /// <summary>
    /// Maps job rating details DTO to the DFRNT API request object format.
    /// </summary>
    /// <param name="dto">The job rating details DTO.</param>
    /// <returns>An UrgentRerateObject ready for the DFRNT API.</returns>
    private static UrgentRerateObject MapToUrgentRerateObject(JobRatingDetailsDtoNz dto)
    {
        ArgumentNullException.ThrowIfNull(dto);

        return new UrgentRerateObject
        {
            SpeedId = dto.SpeedId ?? throw new NullReferenceException("'SpeedId' cannot be null"),
            SizeId = dto.SizeId ?? throw new NullReferenceException("'SizeId' cannot be null"),
            From = new UrgentRerateAddressObject
            {
                CompanyName = dto.FromCompanyName,
                BuildingName = dto.FromBuildingName,
                StreetAddress = dto.FromStreetAddress,
                City = dto.FromCity,
                State = dto.FromState,
                Suburb = dto.FromSuburb,
                SuburbId = dto.FromId,
                ZipCode = dto.FromZip ?? dto.FromPostCode,
                PostCode = dto.FromPostCode ?? dto.FromZip,
                CountryCode = dto.FromCountryCode,
                Latitude = dto.PickupLat,
                Longitude = dto.PickupLong
            },
            To = new UrgentRerateAddressObject
            {
                CompanyName = dto.ToCompanyName,
                BuildingName = dto.ToBuildingName,
                StreetAddress = dto.ToStreetAddress,
                City = dto.ToCity,
                State = dto.ToState,
                Suburb = dto.ToSuburb,
                SuburbId = dto.ToId,
                ZipCode = dto.ToZip ?? dto.ToPostCode,
                PostCode = dto.ToPostCode ?? dto.ToZip,
                CountryCode = dto.ToCountryCode,
                Latitude = dto.DeliveryLat,
                Longitude = dto.DeliveryLong
            },
            Packages = MapPackages(dto.Packages),
            Weight = dto.Weight.HasValue ? (int)(dto.Weight ?? 0) : 0,
            Quantity = dto.Quantity,
            IsDangerousGoods = dto.DangerousGoods,
            IsPrebook = dto.IsPrebook,
            DateTime = dto.BulkScheduleId.HasValue && dto.CreatedTime.HasValue ? dto.CreatedTime : dto.BookedDate,
            Van = dto.IsVan,
            Bike = dto.IsPedal,
            Truck = dto.IsTruck ? CreateTruckObject(dto) : null,
            OurReference = dto.OurRef,
            ClientReferenceA = dto.RefA,
            ClientReferenceB = dto.RefB,
            BulkScheduleId = dto.BulkScheduleId
        };
    }

    /// <summary>
    /// Maps package details DTOs to the DFRNT API package object format.
    /// </summary>
    /// <param name="packages">The list of package details.</param>
    /// <returns>A collection of UrgentPackageObjects, or empty if packages is null/empty.</returns>
    private static IEnumerable<UrgentPackageObject> MapPackages(IReadOnlyList<PackageDetailsDto> packages)
    {
        if (packages == null || packages.Count == 0)
        {
            return new List<UrgentPackageObject>();
        }

        return packages.Select(p => new UrgentPackageObject
        {
            Name = p.Name,
            Length = p.Length,
            Width = p.Width,
            Height = p.Height,
            Cubic = p.Cubic,
            Kg = p.Kg,
            Type = p.Type,
            PackageCode = p.PackageCode,
            Units = p.Units
        });
    }

    /// <summary>
    /// Creates a truck object for the DFRNT API request with tail lift and timing details.
    /// </summary>
    /// <param name="dto">The job rating details DTO containing truck-specific fields.</param>
    /// <returns>An UrgentTruckObject with truck delivery options.</returns>
    private static UrgentTruckObject CreateTruckObject(JobRatingDetailsDtoNz dto) =>
        new()
        {
            PickupTailLift = dto.PickupTailLift,
            DropoffTailLift = dto.DropoffTailLift,
            PrivateRes = dto.PrivateRes,
            HasDgDocuments = dto.HasDgDocuments,
            TruckStartTime = dto.TruckStartTime,
            TruckHours = dto.TruckHours ?? (dto.WaitTime > 0 ? dto.WaitTime : null)
        };

    /// <summary>
    /// Internal method to recalculate job rate based on tenant type.
    /// </summary>
    private async Task RecalculateJobRateInternalAsync(int jobId, bool isBooking)
    {
        var isArchived = !isBooking && await jobQueryRepository.IsJobArchived(jobId);
        var isUsCustomer = infoService.IsUsTenant();

        if (isUsCustomer)
        {
            var jobDetailsUs = isBooking
                ? await jobQueryRepository.GetJobBookingDetailsForRatingAsync(jobId)
                : await jobQueryRepository.GetJobDetailsForRatingAsync(jobId);

            await RateJobUsAsync(jobDetailsUs);
            return;
        }

        var jobDetailsNz = isBooking
            ? await jobQueryRepository.GetJobBookingDetailsForRatingNzAsync(jobId)
            : await jobQueryRepository.GetJobDetailsForRatingNzAsync(jobId, isArchived);

        await RateJobNzAsync(jobDetailsNz);
    }
}