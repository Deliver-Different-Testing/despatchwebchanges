using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Http;
using Serilog;

namespace DespatchWeb.Services;

public class RateJobService(
    IJobRepository jobRepository,
    HttpClient httpClient,
    ITenantInfoService infoService,
    IHttpContextAccessor contextAccessor)
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
            ArgumentNullException.ThrowIfNull(jobDetails.ClientId);
            ArgumentNullException.ThrowIfNull(jobDetails.FromId);
            ArgumentNullException.ThrowIfNull(jobDetails.ToId);
            ArgumentNullException.ThrowIfNull(jobDetails.SpeedId);
            ArgumentNullException.ThrowIfNull(jobDetails.SizeId);

            var rateResult = await RateUrgentJobAsync(jobDetails);
            if (rateResult is { Rate: > 0 }) {
                await jobRepository.UpdateUrgentJobRateAsync(jobDetails.JobId, rateResult.Rate, jobDetails.JobType);
            } else {
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
            ArgumentNullException.ThrowIfNull(jobDetails.SpeedId);
            ArgumentNullException.ThrowIfNull(jobDetails.ClientId);
            ArgumentNullException.ThrowIfNull(jobDetails.SizeId);

            // Get distances and airport info
            var distanceResult = await CalculateJobRateUsAsync(
                new JobRateRequest
                {
                    SpeedId = jobDetails.SpeedId.Value,
                    PickupLat = jobDetails.PickupLat,
                    PickupLong = jobDetails.PickupLong,
                    DeliveryLat = jobDetails.DeliveryLat,
                    DeliveryLong = jobDetails.DeliveryLong
                }
            );

            // Calculate final rate
            await jobRepository.RateJobUsAsync(new RateJobUsDto
            {
                JobId = jobDetails.JobId,
                ClientId = jobDetails.ClientId.Value,
                Speed = jobDetails.SpeedId.Value,
                FromZip = jobDetails.FromZip,
                ToZip = jobDetails.ToZip,
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
                PreviousRate = jobDetails.PreviousRate
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
    /// Calculates distances for US job rating. For non-flight jobs, calculates total road distance.
    /// For flight jobs, finds closest airports and calculates road distances to/from airports.
    /// </summary>
    /// <param name="request">The job rate request containing speed ID and pickup/delivery coordinates.</param>
    /// <returns>A result containing total miles, from/to miles, and airport information for flight jobs.</returns>
    private async Task<JobRateResult> CalculateJobRateUsAsync(JobRateRequest request)
    {
        var isUsCustomer = infoService.IsUsTenant();
        var speed = await jobRepository.GetJobTypeByIdAsync(request.SpeedId);
        var speedGrouping = speed.Grouping;

        var result = new JobRateResult
        {
            TotalMiles = 0,
            FromMiles = 0,
            ToMiles = 0
        };

        if (speedGrouping.GroupingId != (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight))
        {
            result.TotalMiles = await CalculateRoadDistance(
                request.PickupLat,
                request.PickupLong,
                request.DeliveryLat,
                request.DeliveryLong);
        }
        else
        {
            // Get closest airports
            var closestFromAirports = await jobRepository.GetClosestAirportsAsync(
                request.PickupLat ?? 0,
                request.PickupLong ?? 0);
            var closestToAirports = await jobRepository.GetClosestAirportsAsync(
                request.DeliveryLat ?? 0,
                request.DeliveryLong ?? 0);

            result.FromAirport = closestFromAirports.First();
            result.ToAirport = closestToAirports.First();

            result.FromMiles = await CalculateRoadDistance(
                request.PickupLat,
                request.PickupLong,
                result.FromAirport.Latitude,
                result.FromAirport.Longitude);

            result.ToMiles = await CalculateRoadDistance(
                result.ToAirport.Latitude,
                result.ToAirport.Longitude,
                request.DeliveryLat,
                request.DeliveryLong);
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
            return 0;

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
            return 0;

        var totalMeters = routeResponse.Routes[0].Sections
            .Where(s => s.Transport.Mode == "car")
            .Sum(s => s.Summary.Length);

        return Math.Round(totalMeters / 1609.344);
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
            var clientId = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "ClientID")
                ?.Value;
            ArgumentException.ThrowIfNullOrEmpty(clientId);
            var timeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
            ArgumentException.ThrowIfNullOrEmpty(timeZone);
            var userName = contextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value;
            ArgumentException.ThrowIfNullOrEmpty(userName);

            var token = AuthenticationExtensions.CreateApiToken(userName,
                int.Parse(tenantId),
                connectionString,
                timeZone,
                int.Parse(clientId));

            var requestToken = new JwtSecurityTokenHandler().WriteToken(token);

            // Call DFRNT API
            var baseUrl = Environment.GetEnvironmentVariable("WebAPIUrl");

            var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/rates/getRerateAmount");
            request.Headers.Add("Authorization", $"Bearer {requestToken}");
            request.Content = JsonContent.Create(jobObject);

            var response = await httpClient.SendAsync(request);
            var rawContent = await response.Content.ReadAsStringAsync();
            Log.Debug("Raw response: {RawContent}", rawContent);

            if (!response.IsSuccessStatusCode)
            {
                Log.Error("Request failed with status code {ResponseStatusCode}", response.StatusCode);
                Log.Error("Response content: {ReadAsStringAsync}", rawContent);
            }

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
    /// Gets the calculated rate for an NZ job without persisting it to the database.
    /// </summary>
    /// <param name="jobDetails">The job rating details including client, addresses, speed, and size information.</param>
    /// <returns>The calculated rate, or 0 if rating fails.</returns>
    public async Task<decimal> GetJobRateNzAsync(JobRatingDetailsDtoNz jobDetails)
{
    try
    {
        ArgumentNullException.ThrowIfNull(jobDetails);
        ArgumentNullException.ThrowIfNull(jobDetails.ClientId);
        ArgumentNullException.ThrowIfNull(jobDetails.FromId);
        ArgumentNullException.ThrowIfNull(jobDetails.ToId);
        ArgumentNullException.ThrowIfNull(jobDetails.SpeedId);
        ArgumentNullException.ThrowIfNull(jobDetails.SizeId);

        var rateResult = await RateUrgentJobAsync(jobDetails);
        if (rateResult is { Rate: > 0 }) return rateResult.Rate;
        
        Log.Warning("Job rating failed or returned invalid rate for JobId: {JobId}. Rate: {Rate}",
            jobDetails.JobId,
            rateResult?.Rate ?? 0);
        
        return 0;
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
public async Task<decimal> GetJobRateUsAsync(JobRatingDetailsDto jobDetails)
{
    try
    {
        ArgumentNullException.ThrowIfNull(jobDetails);
        ArgumentNullException.ThrowIfNull(jobDetails.SpeedId);
        ArgumentNullException.ThrowIfNull(jobDetails.ClientId);
        ArgumentNullException.ThrowIfNull(jobDetails.SizeId);

        // Get distances and airport info
        var distanceResult = await CalculateJobRateUsAsync(
            new JobRateRequest
            {
                SpeedId = jobDetails.SpeedId.Value,
                PickupLat = jobDetails.PickupLat,
                PickupLong = jobDetails.PickupLong,
                DeliveryLat = jobDetails.DeliveryLat,
                DeliveryLong = jobDetails.DeliveryLong
            }
        );

        // Get the rate without saving
        var rate = await jobRepository.GetJobRateUsAsync(new RateJobUsDto
        {
            JobId = jobDetails.JobId,
            ClientId = jobDetails.ClientId.Value,
            Speed = jobDetails.SpeedId.Value,
            FromZip = jobDetails.FromZip,
            ToZip = jobDetails.ToZip,
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
            PreviousRate = jobDetails.PreviousRate
        });

        return rate;
    }
    catch (Exception ex)
    {
        Log.Error(ex, "{ErrorMessage}",
            ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService), nameof(GetJobRateUsAsync)));
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
            DateTime = dto.BookedDate,
            Van = dto.IsVan,
            Bike = dto.IsPedal,
            Truck = dto.IsTruck ? CreateTruckObject(dto) : null,
            OurReference = dto.OurRef,
            ClientReferenceA = dto.RefA,
            ClientReferenceB = dto.RefB
        };
    }

    /// <summary>
    /// Maps package details DTOs to the DFRNT API package object format.
    /// </summary>
    /// <param name="packages">The list of package details.</param>
    /// <returns>A collection of UrgentPackageObjects, or empty if packages is null/empty.</returns>
    private static IEnumerable<UrgentPackageObject> MapPackages(List<PackageDetailsDto> packages)
    {
        if (packages == null || packages.Count == 0) return new List<UrgentPackageObject>();

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
    private static UrgentTruckObject CreateTruckObject(JobRatingDetailsDtoNz dto)
    {
        return new UrgentTruckObject
        {
            PickupTailLift = dto.PickupTailLift,
            DropoffTailLift = dto.DropoffTailLift,
            PrivateRes = dto.PrivateRes,
            HasDgDocuments = dto.HasDgDocuments,
            TruckStartTime = dto.TruckStartTime,
            TruckHours = dto.TruckHours ?? (dto.WaitTime > 0 ? dto.WaitTime : null)
        };
    }

    /// <summary>
    /// Calculates and updates courier payment fields for a job.
    /// </summary>
    public async Task CalculateCourierPaymentAsync(int jobId, bool isPrebook)
    {
        try
        {
            var data = await jobRepository.GetCourierPaymentCalculationDataAsync(jobId, isPrebook);
            if (data == null)
            {
                Log.Warning("Job not found for courier payment calculation. JobId: {JobId}, IsPrebook: {IsPrebook}",
                    jobId, isPrebook);
                return;
            }

            var result = CalculateCourierPaymentFields(data);
            await jobRepository.UpdateCourierPaymentFieldsAsync(jobId, isPrebook, result);

            Log.Debug("Courier payment calculated for JobId: {JobId}. Percentage: {Percentage}, Payment: {Payment}",
                jobId, result.CourierPercentage, result.CourierPayment);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{ErrorMessage}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RateJobService),
                    nameof(CalculateCourierPaymentAsync)));
            throw;
        }
    }

    /// <summary>
    /// Calculates courier payment fields based on the priority cascade:
    /// 1. If PostAmountToCourier = false → 0
    /// 2. If CourierId is NULL → 0
    /// 3. If Courier is internal → 0
    /// 4. CourierPercentageOverride (if set)
    /// 5. ClientAvailableSpeed.CourierPercentage (if set)
    /// 6. JobType.CourierPercentage (if set)
    /// 7. Client.CourierPercentage (if set)
    /// 8. Courier.uccrPercentage (if set)
    /// 9. Default: 0.4 (40%)
    /// </summary>
    private static CourierPaymentResult CalculateCourierPaymentFields(CourierPaymentCalculationData data)
    {
        const decimal defaultPercentage = 0.4m;
        const int subcontractorCourierTypeId = 3;

        // Calculate courier percentage using priority cascade
        var courierPercentage = CalculateCourierPercentage(data, defaultPercentage);

        // Calculate courier payment
        var rawBaseAmount = data.RawBaseAmount ?? 0;
        var courierPayment = Math.Round(rawBaseAmount * courierPercentage, 4);

        // If courier payment is 0, fuel and bonus are also 0
        var courierFuel = courierPayment == 0 ? 0 : (data.FuelSurchargeAmount ?? 0);
        var courierBonus = courierPayment == 0
            ? 0
            : Math.Round(rawBaseAmount * (data.CourierBonusPercentage ?? 0), 4);

        // Handle subcontractor fields
        int? masterCourierId = null;
        decimal? subContractorPercentage = null;
        decimal? subContractorFuelPercentage = null;
        decimal? subContractorBonusPercentage = null;

        if (data.CourierTypeId == subcontractorCourierTypeId)
        {
            masterCourierId = data.CourierMasterCourierId;

            if (data.CourierMasterCourierId.HasValue)
            {
                subContractorPercentage = data.CourierSubContractorPercentage ?? 0;
                subContractorFuelPercentage = data.CourierSubContractorFuelPercentage ?? 0;
                subContractorBonusPercentage = data.CourierSubContractorBonusPercentage ?? 0;
            }
        }

        return new CourierPaymentResult
        {
            CourierPercentage = courierPercentage,
            CourierPayment = courierPayment,
            CourierFuel = courierFuel,
            CourierBonus = courierBonus,
            MasterCourierId = masterCourierId,
            SubContractorPercentage = subContractorPercentage,
            SubContractorFuelPercentage = subContractorFuelPercentage,
            SubContractorBonusPercentage = subContractorBonusPercentage
        };
    }

    /// <summary>
    /// Calculates the courier percentage using the priority cascade rules.
    /// </summary>
    /// <param name="data">The courier payment calculation data.</param>
    /// <param name="defaultPercentage">The default percentage to use if no overrides are set.</param>
    /// <returns>The calculated courier percentage (0-1 scale).</returns>
    private static decimal CalculateCourierPercentage(CourierPaymentCalculationData data, decimal defaultPercentage)
    {
        // Rule 1: If PostAmountToCourier is false, return 0
        if (data.PostAmountToCourier == false)
            return 0;

        // Rule 2: If no courier assigned, return 0
        if (!data.CourierId.HasValue)
            return 0;

        // Rule 3: If the courier is internal, return 0
        if (data.CourierIsInternal == true)
            return 0;

        // Rule 4: CourierPercentageOverride takes priority
        if (data.CourierPercentageOverride.HasValue)
            return Math.Round(data.CourierPercentageOverride.Value, 4);

        // Rule 5: ClientAvailableSpeed.CourierPercentage
        if (data.ClientSpeedCourierPercentage.HasValue)
            return Math.Round(data.ClientSpeedCourierPercentage.Value, 4);

        // Rule 6: JobType.CourierPercentage
        if (data.JobTypeCourierPercentage.HasValue)
            return Math.Round(data.JobTypeCourierPercentage.Value, 4);

        // Rule 7: Client.CourierPercentage
        if (data.ClientCourierPercentage.HasValue)
            return Math.Round(data.ClientCourierPercentage.Value, 4);

        // Rule 8: Courier.uccrPercentage
        if (data.CourierPercentage.HasValue)
            return Math.Round(data.CourierPercentage.Value, 4);

        // Rule 9: Default 40%
        return Math.Round(defaultPercentage, 4);
    }
}