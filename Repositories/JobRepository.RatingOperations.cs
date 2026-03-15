using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    /// <summary>
    /// Retrieves job details required for US tenant rating calculations from the active jobs table.
    /// </summary>
    /// <param name="jobId">The job ID to retrieve details for.</param>
    /// <returns>Job rating details including client, addresses, speed, and dimensional information.</returns>
    public async Task<JobRatingDetailsDto> GetJobDetailsForRatingAsync(int jobId)
    {
        try
        {
            var jobDetails = await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(job => new JobRatingDetailsDto
                {
                    // Map the entity properties to our model
                    JobId = job.UcjbId,
                    ClientId = job.UcjbClientId,
                    FromId = job.UcjbFrom,
                    ToId = job.UcjbTo,
                    SpeedId = job.UcjbSpeed,
                    IsPedal = job.UcjbCbd,
                    IsVan = job.UcjbVan,
                    IsReturnJob = job.UcjbReturn,
                    Weight = job.UcjbWeight,
                    SizeId = job.UcjbSize,
                    IncludeFuelSurcharge = false,
                    IsDirect = job.Direct,
                    AcceptedJobTypeId = job.AcceptedJobTypeId,
                    OurRef = job.UcjbOurRef,
                    RefA = job.UcjbClientRefa,
                    RefB = job.UcjbClientRefb,
                    Quantity = job.UcjbQty ?? 1,
                    BookedDate = job.UcjbDate,

                    // Coordinates
                    PickupLat = job.PickUpLatitude ?? 0,
                    PickupLong = job.PickUpLongitude ?? 0,
                    DeliveryLat = job.DeliveryLatitude ?? 0,
                    DeliveryLong = job.DeliveryLongitude ?? 0,

                    // US-specific properties
                    FromZip = job.PickupAddressLine7,
                    ToZip = job.DeliveryAddressLine7,
                    DangerousGoods = job.Dgdocument ?? false,
                    TotalPallets = job.TucJobItemJobs != null ? job.TucJobItemJobs.Count : 0,
                    ExtraStopOffs = 0,
                    DryIceWeight = job.DryIceWeight ?? 0,
                    WaitTime = 0,

                    // Flight-specific properties
                    FromAirportId = job.FromAirportId,
                    ToAirportId = job.ToAirportId,
                    FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
                    ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

                    // Client-specific rate information
                    ClientDiscount = job.UcjbClient != null ? job.UcjbClient.Discount : 0,
                    Cubic = job.TucJobItemJobs != null ? job.TucJobItemJobs.Sum(i => i.Cubic) : null,
                    IsManuallyRated = job.RatedManually
                })
                .FirstOrDefaultAsync();

            ArgumentNullException.ThrowIfNull(jobDetails);

            return jobDetails;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving job details for rating. Job ID: {JobId}", jobId);
            throw new ApplicationException($"Failed to retrieve job details for rating: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Retrieves job details required for NZ tenant rating calculations.
    /// Queries either active or archived jobs table based on the isArchived parameter.
    /// </summary>
    /// <param name="jobId">The job ID to retrieve details for.</param>
    /// <param name="isArchived">True to query archived jobs, false for active jobs.</param>
    /// <returns>NZ-specific job rating details including addresses, packages, and truck options.</returns>
    public async Task<JobRatingDetailsDtoNz> GetJobDetailsForRatingNzAsync(int jobId, bool isArchived)
    {
        try
        {
            if (isArchived)
            {
                var jobDetailsForRating = await Context.TucJobArchives
                    .Where(j => j.UcjbId == jobId)
                    .Select(job => new JobRatingDetailsDtoNz
                    {
                        JobId = job.UcjbId,
                        ClientId = job.UcjbClientId,
                        FromId = job.UcjbFrom,
                        ToId = job.UcjbTo,
                        SpeedId = job.UcjbSpeed,
                        IsPedal = job.UcjbCbd,
                        IsVan = job.UcjbVan,
                        IsReturnJob = job.UcjbReturn,
                        Weight = job.UcjbWeight,
                        SizeId = job.UcjbSize,
                        IncludeFuelSurcharge = false,
                        IsDirect = job.Direct,
                        AcceptedJobTypeId = job.AcceptedJobTypeId,
                        OurRef = job.UcjbOurRef,
                        RefA = job.UcjbClientRefa,
                        RefB = job.UcjbClientRefb,
                        Quantity = job.UcjbQty ?? 1,
                        BookedDate = job.UcjbDate.HasValue
                            ? new DateTime(
                                job.UcjbDate.Value.Year,
                                job.UcjbDate.Value.Month,
                                job.UcjbDate.Value.Day,
                                job.UcjbTime.HasValue ? job.UcjbTime.Value.Hour : 0,
                                job.UcjbTime.HasValue ? job.UcjbTime.Value.Minute : 0,
                                job.UcjbTime.HasValue ? job.UcjbTime.Value.Second : 0)
                            : DateTime.MinValue,

                        // Coordinates
                        PickupLat = job.PickUpLatitude ?? 0,
                        PickupLong = job.PickUpLongitude ?? 0,
                        DeliveryLat = job.DeliveryLatitude ?? 0,
                        DeliveryLong = job.DeliveryLongitude ?? 0,

                        DangerousGoods = job.Dgdocument ?? false,
                        TotalPallets = 0,
                        ExtraStopOffs = 0,
                        DryIceWeight = job.DryIceWeight ?? 0,
                        WaitTime = job.WaitedPickUp ?? 0,

                        // Flight-specific properties
                        FromAirportId = job.FromAirportId,
                        ToAirportId = job.ToAirportId,
                        FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
                        ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

                        // Client-specific rate information
                        ClientDiscount = job.UcjbClient != null ? job.UcjbClient.Discount : 0,
                        Cubic = job.TucJobItemsArchives != null ? job.TucJobItemsArchives.Sum(i => i.Cubic) : null,
                        IsManuallyRated = job.RatedManually,
                        IsPrebook = job.IsRecurringJob,

                        FromCompanyName = job.PickupAddressLine1,
                        FromBuildingName = job.PickupAddressLine2,
                        FromStreetAddress = job.PickupAddressLine3 + " " + job.PickupAddressLine4,
                        FromSuburb = job.PickupAddressLine5,
                        FromCity = job.PickupAddressLine6,
                        FromState = null,
                        FromPostCode = job.PickupAddressLine7,
                        FromCountryCode = job.PickupAddressLine8,

                        ToCompanyName = job.DeliveryAddressLine1,
                        ToBuildingName = job.DeliveryAddressLine2,
                        ToStreetAddress = job.DeliveryAddressLine3 + " " + job.DeliveryAddressLine4,
                        ToSuburb = job.DeliveryAddressLine5,
                        ToCity = job.DeliveryAddressLine6,
                        ToState = null,
                        ToPostCode = job.DeliveryAddressLine7,
                        ToCountryCode = job.DeliveryAddressLine8,

                        Packages = job.TucJobItemsArchives != null
                            ? job.TucJobItemsArchives.Select(item => new PackageDetailsDto
                            {
                                Name = item.Notes,
                                Length = item.Length,
                                Width = item.Depth,
                                Height = item.Height,
                                Cubic = item.Cubic.HasValue ? (double)item.Cubic : 0,
                                Kg = item.Weight,
                                Type = null,
                                PackageCode = null,
                                Units = item.Items
                            }).ToList()
                            : null,

                        PickupTailLift = job.TucJobItemsArchives != null &&
                                         job.TucJobItemsArchives.Any(i => i.Pu == true),
                        DropoffTailLift = job.TucJobItemsArchives != null &&
                                          job.TucJobItemsArchives.Any(i => i.Do == true),
                        PrivateRes = job.TucJobItemsArchives != null &&
                                     job.TucJobItemsArchives.Any(i => i.PrivateRes == true),
                        HasDgDocuments = job.Dgdocument,
                        TruckStartTime = job.TruckStartTime.HasValue ? job.TruckStartTime.ToString() : null,
                        TruckHours = job.TruckHours.HasValue ? (int)job.TruckHours : null,
                        JobType = JobType.Archived,
                        IsTruck = job.Truck ?? false
                    })
                    .FirstOrDefaultAsync();

                ArgumentNullException.ThrowIfNull(jobDetailsForRating);

                return jobDetailsForRating;
            }
            else
            {
                var jobDetailsForRating = await Context.TucJobs
                    .Where(j => j.UcjbId == jobId)
                    .Select(job => new JobRatingDetailsDtoNz
                    {
                        JobId = job.UcjbId,
                        ClientId = job.UcjbClientId,
                        FromId = job.UcjbFrom,
                        ToId = job.UcjbTo,
                        SpeedId = job.UcjbSpeed,
                        IsPedal = job.UcjbCbd,
                        IsVan = job.UcjbVan,
                        IsReturnJob = job.UcjbReturn,
                        Weight = job.UcjbWeight,
                        SizeId = job.UcjbSize,
                        IncludeFuelSurcharge = false,
                        IsDirect = job.Direct,
                        AcceptedJobTypeId = job.AcceptedJobTypeId,
                        OurRef = job.UcjbOurRef,
                        RefA = job.UcjbClientRefa,
                        RefB = job.UcjbClientRefb,
                        Quantity = job.UcjbQty ?? 1,
                        BookedDate = new DateTime(
                            job.UcjbDate.Year,
                            job.UcjbDate.Month,
                            job.UcjbDate.Day,
                            job.UcjbTime.HasValue ? job.UcjbTime.Value.Hour : 0,
                            job.UcjbTime.HasValue ? job.UcjbTime.Value.Minute : 0,
                            job.UcjbTime.HasValue ? job.UcjbTime.Value.Second : 0
                        ),

                        // Coordinates
                        PickupLat = job.PickUpLatitude ?? 0,
                        PickupLong = job.PickUpLongitude ?? 0,
                        DeliveryLat = job.DeliveryLatitude ?? 0,
                        DeliveryLong = job.DeliveryLongitude ?? 0,

                        DangerousGoods = job.Dgdocument ?? false,
                        TotalPallets = job.TucJobItemJobs != null ? job.TucJobItemJobs.Count : 0,
                        ExtraStopOffs = 0,
                        DryIceWeight = job.DryIceWeight ?? 0,
                        WaitTime = job.WaitedPickUp ?? 0,

                        // Flight-specific properties
                        FromAirportId = job.FromAirportId,
                        ToAirportId = job.ToAirportId,
                        FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
                        ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

                        // Client-specific rate information
                        ClientDiscount = job.UcjbClient != null ? job.UcjbClient.Discount : 0,
                        Cubic = job.TucJobItemJobs != null ? job.TucJobItemJobs.Sum(i => i.Cubic) : null,
                        IsManuallyRated = job.RatedManually,
                        IsPrebook = job.IsRecurringJob,

                        FromCompanyName = job.PickupAddressLine1,
                        FromBuildingName = job.PickupAddressLine2,
                        FromStreetAddress = job.PickupAddressLine3 + " " + job.PickupAddressLine4,
                        FromSuburb = job.PickupAddressLine5,
                        FromCity = job.PickupAddressLine6,
                        FromState = null,
                        FromPostCode = job.PickupAddressLine7,
                        FromCountryCode = job.PickupAddressLine8,

                        ToCompanyName = job.DeliveryAddressLine1,
                        ToBuildingName = job.DeliveryAddressLine2,
                        ToStreetAddress = job.DeliveryAddressLine3 + " " + job.DeliveryAddressLine4,
                        ToSuburb = job.DeliveryAddressLine5,
                        ToCity = job.DeliveryAddressLine6,
                        ToState = null,
                        ToPostCode = job.DeliveryAddressLine7,
                        ToCountryCode = job.DeliveryAddressLine8,

                        Packages = job.TucJobItemJobs != null
                            ? job.TucJobItemJobs.Select(item => new PackageDetailsDto
                            {
                                Name = item.Notes,
                                Length = item.Length,
                                Width = item.Depth,
                                Height = item.Height,
                                Cubic = item.Cubic.HasValue ? (double)item.Cubic : 0,
                                Kg = item.Weight,
                                Type = null,
                                PackageCode = null,
                                Units = item.Items
                            }).ToList()
                            : null,

                        PickupTailLift = job.TucJobItemJobs != null && job.TucJobItemJobs.Any(i => i.Pu == true),
                        DropoffTailLift = job.TucJobItemJobs != null && job.TucJobItemJobs.Any(i => i.Do == true),
                        PrivateRes = job.TucJobItemJobs != null && job.TucJobItemJobs.Any(i => i.PrivateRes == true),
                        HasDgDocuments = job.Dgdocument,
                        TruckStartTime = job.TruckStartTime.HasValue ? job.TruckStartTime.ToString() : null,
                        TruckHours = job.TruckHours.HasValue ? (int)job.TruckHours : null,
                        JobType = JobType.Active,
                        IsTruck = job.Truck ?? false
                    })
                    .FirstOrDefaultAsync();

                ArgumentNullException.ThrowIfNull(jobDetailsForRating);

                return jobDetailsForRating;
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving NZ job details for rating. Job ID: {JobId}", jobId);
            throw new ApplicationException($"Failed to retrieve NZ job details for rating: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Retrieves prebook job details required for US tenant rating calculations.
    /// </summary>
    /// <param name="jobId">The prebook job ID to retrieve details for.</param>
    /// <returns>Job rating details for the prebook/recurring job.</returns>
    public async Task<JobRatingDetailsDto> GetJobBookingDetailsForRatingAsync(int jobId)
    {
        try
        {
            var jobDetails = await Context.TucJobBookings
                .Where(j => j.UcbkId == jobId)
                .Select(job => new JobRatingDetailsDto
                {
                    JobId = job.UcbkId,
                    ClientId = job.UcbkClientId ?? 0,
                    FromId = (int)job.UcbkFrom,
                    ToId = (int)job.UcbkTo,
                    SpeedId = job.UcbkSpeed ?? 0,
                    IsPedal = job.UcbkCbd ?? false,
                    IsVan = job.UcbkVan,
                    IsReturnJob = job.UcbkReturn,
                    Weight = job.UcbkWeight ?? 0,
                    SizeId = job.UcbkSize ?? 0,
                    IncludeFuelSurcharge = false,
                    IsDirect = job.Direct,
                    AcceptedJobTypeId = job.AcceptedJobTypeId ?? 0,
                    OurRef = job.UcbkOurRef,
                    RefA = job.UcbkClientRefa,
                    RefB = job.UcbkClientRefb,
                    Quantity = job.Quantity.HasValue ? (int)job.Quantity : 0,
                    BookedDate = job.UcbkDate ?? DateTime.MinValue,
                    PreviousRate = job.UcbkAmount,

                    PickupLat = job.PickUpLatitude ?? 0,
                    PickupLong = job.PickUpLongitude ?? 0,
                    DeliveryLat = job.DeliveryLatitude ?? 0,
                    DeliveryLong = job.DeliveryLongitude ?? 0,

                    FromZip = job.PickupAddressLine7,
                    ToZip = job.DeliveryAddressLine7,
                    DangerousGoods = job.Dgdocument ?? false,
                    TotalPallets = job.TucJobBookingItemBookings != null ? job.TucJobBookingItemBookings.Count : 0,
                    ExtraStopOffs = 0,
                    DryIceWeight = job.DryIceWeight ?? 0,
                    WaitTime = 0,

                    FromAirportId = job.FromAirportId,
                    ToAirportId = job.ToAirportId,
                    FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
                    ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

                    ClientDiscount = job.UcbkClient != null ? job.UcbkClient.Discount : 0,
                    Cubic = job.TucJobBookingItemBookings != null
                        ? job.TucJobBookingItemBookings.Sum(i => i.Cubic)
                        : null,
                    CalculateDimsOncePerJob = job.DimensionsType == 1,
                    IsPrebook = true
                })
                .FirstOrDefaultAsync();

            ArgumentNullException.ThrowIfNull(jobDetails);

            return jobDetails;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving job details for rating. Job ID: {JobId}", jobId);
            throw new ApplicationException($"Failed to retrieve job details for rating: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Retrieves prebook job details required for NZ tenant rating calculations.
    /// </summary>
    /// <param name="jobId">The prebook job ID to retrieve details for.</param>
    /// <returns>NZ-specific job rating details for the prebook/recurring job.</returns>
    public async Task<JobRatingDetailsDtoNz> GetJobBookingDetailsForRatingNzAsync(int jobId)
    {
        try
        {
            var jobDetails = await Context.TucJobBookings
                .Where(j => j.UcbkId == jobId)
                .Select(job => new JobRatingDetailsDtoNz
                {
                    JobId = job.UcbkId,
                    ClientId = job.UcbkClientId ?? 0,
                    FromId = (int)job.UcbkFrom,
                    ToId = (int)job.UcbkTo,
                    SpeedId = job.UcbkSpeed ?? 0,
                    IsPedal = job.UcbkCbd ?? false,
                    IsVan = job.UcbkVan,
                    IsReturnJob = job.UcbkReturn,
                    Weight = job.UcbkWeight ?? 0,
                    SizeId = job.UcbkSize ?? 0,
                    IncludeFuelSurcharge = false,
                    IsDirect = job.Direct,
                    AcceptedJobTypeId = job.AcceptedJobTypeId ?? 0,
                    OurRef = job.UcbkOurRef,
                    RefA = job.UcbkClientRefa,
                    RefB = job.UcbkClientRefb,
                    Quantity = job.Quantity.HasValue ? (int)job.Quantity : 0,
                    BookedDate = job.UcbkDate.HasValue
                        ? new DateTime(
                            job.UcbkDate.Value.Year,
                            job.UcbkDate.Value.Month,
                            job.UcbkDate.Value.Day,
                            job.UcbkTime.HasValue ? job.UcbkTime.Value.Hour : 0,
                            job.UcbkTime.HasValue ? job.UcbkTime.Value.Minute : 0,
                            job.UcbkTime.HasValue ? job.UcbkTime.Value.Second : 0
                        )
                        : DateTime.MinValue,

                    PreviousRate = job.UcbkAmount,

                    PickupLat = job.PickUpLatitude ?? 0,
                    PickupLong = job.PickUpLongitude ?? 0,
                    DeliveryLat = job.DeliveryLatitude ?? 0,
                    DeliveryLong = job.DeliveryLongitude ?? 0,

                    FromZip = job.PickupAddressLine7,
                    ToZip = job.DeliveryAddressLine7,
                    DangerousGoods = job.Dgdocument ?? false,
                    TotalPallets = job.TucJobBookingItemBookings != null ? job.TucJobBookingItemBookings.Count : 0,
                    ExtraStopOffs = 0,
                    DryIceWeight = job.DryIceWeight ?? 0,
                    WaitTime = 0,

                    FromAirportId = job.FromAirportId,
                    ToAirportId = job.ToAirportId,
                    FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
                    ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

                    ClientDiscount = job.UcbkClient != null ? job.UcbkClient.Discount : 0,
                    Cubic = job.TucJobBookingItemBookings != null
                        ? job.TucJobBookingItemBookings.Sum(i => i.Cubic)
                        : null,
                    IsManuallyRated = job.RatedManually,
                    IsPrebook = true,
                    CalculateDimsOncePerJob = job.DimensionsType == 1,

                    FromCompanyName = job.PickupAddressLine1,
                    FromBuildingName = job.PickupAddressLine2,
                    FromStreetAddress = job.PickupAddressLine3 + " " + job.PickupAddressLine4,
                    FromSuburb = job.PickupAddressLine5,
                    FromCity = job.PickupAddressLine6,
                    FromState = null,
                    FromPostCode = job.PickupAddressLine7,
                    FromCountryCode = job.PickupAddressLine8,

                    ToCompanyName = job.DeliveryAddressLine1,
                    ToBuildingName = job.DeliveryAddressLine2,
                    ToStreetAddress = job.DeliveryAddressLine3 + " " + job.DeliveryAddressLine4,
                    ToSuburb = job.DeliveryAddressLine5,
                    ToCity = job.DeliveryAddressLine6,
                    ToState = null,
                    ToPostCode = job.DeliveryAddressLine7,
                    ToCountryCode = job.DeliveryAddressLine8,

                    Packages = job.TucJobBookingItemBookings != null
                        ? job.TucJobBookingItemBookings.Select(item => new PackageDetailsDto
                        {
                            Name = item.Notes,
                            Length = item.Length,
                            Width = item.Depth,
                            Height = item.Height,
                            Cubic = item.Cubic.HasValue ? (double)item.Cubic : 0,
                            Kg = item.Weight,
                            Type = null,
                            PackageCode = null,
                            Units = job.TucJobBookingItemBookings.Count
                        }).ToList()
                        : null,

                    // NEW Truck-specific properties
                    PickupTailLift = null,
                    DropoffTailLift = null,
                    PrivateRes = job.DeliverToPrivateBusiness == 1,
                    HasDgDocuments = job.Dgdocument,
                    TruckStartTime = job.TruckStartTime != null ? job.TruckStartTime.ToString() : null,
                    TruckHours = job.TruckHours != null ? (int)job.TruckHours : null,
                    JobType = JobType.Recurring,
                    IsTruck = job.Truck ?? false
                })
                .FirstOrDefaultAsync();

            ArgumentNullException.ThrowIfNull(jobDetails);

            return jobDetails;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving NZ job booking details for rating. Job ID: {JobId}", jobId);
            throw new ApplicationException($"Failed to retrieve NZ job booking details for rating: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Rates a US tenant job by calling the rating stored procedure and saving the pricing breakdown.
    /// Skips update if the calculated price matches the previous rate.
    /// </summary>
    /// <param name="dto">The rating parameters including distances, weights, and airport information.</param>
    public async Task RateJobUsAsync(RateJobUsDto dto)
    {
        var rate = new OutputParameter<decimal?>();
        var description = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        // Use pre-computed values when available, otherwise query the DB
        bool isFromAirport, isToAirport;
        if (dto.PrecomputedIsFromAddressAirport.HasValue && dto.PrecomputedIsToAddressAirport.HasValue)
        {
            isFromAirport = dto.PrecomputedIsFromAddressAirport.Value;
            isToAirport = dto.PrecomputedIsToAddressAirport.Value;
        }
        else
        {
            var isFromAirportTask = Context.DoesAddressMatchAirportAsync(dto.JobId, true);
            var isToAirportTask = Context.DoesAddressMatchAirportAsync(dto.JobId, false);
            await Task.WhenAll(isFromAirportTask, isToAirportTask);
            isFromAirport = isFromAirportTask.Result;
            isToAirport = isToAirportTask.Result;
        }

        await Context.Procedures.DD_stpJob_Rate_DescribedAsync(
            clientID: dto.ClientId,
            speedID: dto.Speed,
            fromZipCode: int.TryParse(dto.FromZip, out var fromZip) ? fromZip : null,
            fromState: null,
            fromLat: dto.FromLat,
            fromLong: dto.FromLong,
            toZipCode: int.TryParse(dto.ToZip, out var toZip) ? toZip : null,
            toState: null,
            toLat: dto.ToLat,
            toLong: dto.ToLong,
            totalDistance: dto.TotalMiles,
            fromMiles: dto.FromMiles,
            toMiles: dto.ToMiles,
            totalWeight: dto.Weight,
            quantity: dto.Quantity,
            cubic: dto.Cubic,
            totalPallets: dto.TotalPallets,
            extraStopOffs: dto.ExtraStopOffs,
            booked: dto.Booked,
            vehicleSizeID: dto.Size,
            dangerousGoods: dto.DangerousGoods,
            dryIceWeight: dto.DryIceWeight,
            waitTime: dto.WaitTime,
            fromAgentId: dto.FromAgentId,
            fromAirportId: dto.FromAirportId,
            toAgentId: dto.ToAgentId,
            toAirportId: dto.ToAirportId,
            isFromAddressAirport: isFromAirport,
            isToAddressAirport: isToAirport,
            dimensionsType: dto.CalculateDimsOncePerJob ? 1 : 0,
            description: description,
            rate: rate,
            returnValue: returnValue
        );

        if (dto.PreviousRate == rate.Value)
        {
            Log.Information("Price is unchanged. Not updating job {Job}", dto.JobId);
            return;
        }

        Log.Information("Pricing breakdown is: {DescriptionValue}", description.Value);

        if (dto.IsPrebook)
        {
            var effectiveJobBookingId = await Context.GetEffectiveJobBookingIdAsync(dto.JobId);
            await Context.Procedures.DD_InsertPricingBreakdownAsync(
                jobID: null,
                prebookJobID: effectiveJobBookingId,
                pricingBreakdown: description.Value,
                returnValue: returnValue
            );
        }
        else
        {
            var effectiveJobId = await Context.GetEffectiveJobIdAsync(dto.JobId);
            await Context.Procedures.DD_InsertPricingBreakdownAsync(
                jobID: effectiveJobId,
                prebookJobID: null,
                pricingBreakdown: description.Value,
                returnValue: returnValue
            );
        }

        var printableRate = rate.Value ?? 0;
        await SaveNoteAsync(dto.JobId, $"Repriced from {dto.PreviousRate} to {printableRate}", true);
    }

    /// <summary>
    /// Updates the rate amount for an NZ urgent job in the appropriate table based on job type.
    /// </summary>
    /// <param name="jobId">The job ID to update.</param>
    /// <param name="rate">The new rate amount.</param>
    /// <param name="jobType">The type of job (Active, Recurring, or Archived) determining which table to update.</param>
    public async Task UpdateUrgentJobRateAsync(int jobId, decimal rate, JobType jobType)
    {
        try
        {
            var rowsUpdated = jobType switch
            {
                JobType.Active => await Context.TucJobs.Where(j => j.UcjbId == jobId)
                    .ExecuteUpdateAsync(setter => setter.SetProperty(x => x.UcjbAmount, rate)),
                JobType.Recurring => await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(setter => setter.SetProperty(x => x.UcbkAmount, rate)),
                JobType.Archived => await Context.TucJobArchives.Where(j => j.UcjbId == jobId)
                    .ExecuteUpdateAsync(setter => setter.SetProperty(x => x.UcjbAmount, rate)),
                _ => 0
            };

            if (rowsUpdated == 0) throw new KeyNotFoundException($"Job with ID {jobId} not found");

            await SaveNoteAsync(jobId, $"Rate updated to {rate}", true, JobType.Recurring == jobType);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(UpdateUrgentJobRateAsync)));
            throw;
        }
    }

    /// <summary>
    /// Calculates a US tenant job rate without persisting it to the database.
    /// Used for rate preview functionality.
    /// </summary>
    /// <param name="dto">The rating parameters including distances, weights, and airport information.</param>
    /// <returns>The calculated rate amount.</returns>
    public async Task<decimal> GetJobRateUsAsync(RateJobUsDto dto)
    {
        var rate = new OutputParameter<decimal?>();
        var description = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        // Use pre-computed values when available, otherwise query the DB
        bool isFromAirport, isToAirport;
        if (dto.PrecomputedIsFromAddressAirport.HasValue && dto.PrecomputedIsToAddressAirport.HasValue)
        {
            isFromAirport = dto.PrecomputedIsFromAddressAirport.Value;
            isToAirport = dto.PrecomputedIsToAddressAirport.Value;
        }
        else
        {
            var isFromAirportPreviewTask = Context.DoesAddressMatchAirportAsync(dto.JobId, true);
            var isToAirportPreviewTask = Context.DoesAddressMatchAirportAsync(dto.JobId, false);
            await Task.WhenAll(isFromAirportPreviewTask, isToAirportPreviewTask);
            isFromAirport = isFromAirportPreviewTask.Result;
            isToAirport = isToAirportPreviewTask.Result;
        }

        await Context.Procedures.DD_stpJob_Rate_DescribedAsync(
            clientID: dto.ClientId,
            speedID: dto.Speed,
            fromZipCode: int.TryParse(dto.FromZip, out var fromZipPreview) ? fromZipPreview : null,
            fromState: null,
            fromLat: dto.FromLat,
            fromLong: dto.FromLong,
            toZipCode: int.TryParse(dto.ToZip, out var toZipPreview) ? toZipPreview : null,
            toState: null,
            toLat: dto.ToLat,
            toLong: dto.ToLong,
            totalDistance: dto.TotalMiles,
            fromMiles: dto.FromMiles,
            toMiles: dto.ToMiles,
            totalWeight: dto.Weight,
            quantity: dto.Quantity,
            cubic: dto.Cubic,
            totalPallets: dto.TotalPallets,
            extraStopOffs: dto.ExtraStopOffs,
            booked: dto.Booked,
            vehicleSizeID: dto.Size,
            dangerousGoods: dto.DangerousGoods,
            dryIceWeight: dto.DryIceWeight,
            waitTime: dto.WaitTime,
            fromAgentId: dto.FromAgentId,
            fromAirportId: dto.FromAirportId,
            toAgentId: dto.ToAgentId,
            toAirportId: dto.ToAirportId,
            isFromAddressAirport: isFromAirport,
            isToAddressAirport: isToAirport,
            dimensionsType: dto.CalculateDimsOncePerJob ? 1 : 0,
            description: description,
            rate: rate,
            returnValue: returnValue
        );

        Log.Information("Calculated price: {Rate}. Pricing breakdown: {DescriptionValue}",
            rate.Value ?? 0,
            description.Value);

        return rate.Value ?? 0;
    }
}