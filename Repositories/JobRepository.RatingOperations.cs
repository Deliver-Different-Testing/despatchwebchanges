using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    public async Task<JobRatingDetailsDto> GetJobDetailsForRatingAsync(int jobId)
    {
        try
        {
            var jobDetails = await Context.TucJobs
                .AsNoTracking()
                .Where(j => j.UcjbId == jobId)
                .Include(j => j.UcjbClient)
                .Include(j => j.UcjbSpeedNavigation)
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

    public async Task<JobRatingDetailsDtoNz> GetJobDetailsForRatingNzAsync(int jobId)
    {
        try
        {
            var jobDetailsForRating = await Context.TucJobs
                .AsNoTracking()
                .Where(j => j.UcjbId == jobId)
                .Include(j => j.UcjbClient)
                .Include(j => j.UcjbSpeedNavigation)
                .Include(j => j.TucJobItemJobs)
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
                    PrivateRes = job.TucJobItemJobs != null & job.TucJobItemJobs.Any(i => i.PrivateRes == true),
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
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving NZ job details for rating. Job ID: {JobId}", jobId);
            throw new ApplicationException($"Failed to retrieve NZ job details for rating: {ex.Message}", ex);
        }
    }

    public async Task<JobRatingDetailsDto> GetJobBookingDetailsForRatingAsync(int jobId)
    {
        try
        {
            var jobDetails = await Context.TucJobBookings
                .AsNoTracking()
                .Where(j => j.UcbkId == jobId)
                .Include(j => j.UcbkClient) // Include client info
                .Include(j => j.UcbkSpeedNavigation) // Include job type info
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
                    PreviousRate = job.PricingBreakdownPrebookJobs != null ? job.PricingBreakdownPrebookJobs.Sum(p => p.Charged) : null,

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
                    CalculateDimsOncePerJob = job.DimensionsType == 1
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

    public async Task<JobRatingDetailsDtoNz> GetJobBookingDetailsForRatingNzAsync(int jobId)
    {
        try
        {
            var jobDetails = await Context.TucJobBookings
                .AsNoTracking()
                .Where(j => j.UcbkId == jobId)
                .Include(j => j.UcbkClient)
                .Include(j => j.UcbkSpeedNavigation)
                .Include(j => j.TucJobBookingItemBookings)
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

                    PreviousRate = job.PricingBreakdownPrebookJobs != null ? job.PricingBreakdownPrebookJobs.Sum(p => p.Charged) : null,

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
                    FromStreetAddress = job.PickupAddressLine3,
                    FromCity = job.PickupAddressLine4,
                    FromState = job.PickupAddressLine5,
                    FromSuburb = job.PickupAddressLine6,
                    FromPostCode = job.PickupAddressLine7,
                    FromCountryCode = job.PickupAddressLine8,

                    ToCompanyName = job.DeliveryAddressLine1,
                    ToBuildingName = job.DeliveryAddressLine2,
                    ToStreetAddress = job.DeliveryAddressLine3,
                    ToCity = job.DeliveryAddressLine4,
                    ToState = job.DeliveryAddressLine5,
                    ToSuburb = job.DeliveryAddressLine6,
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

    public async Task RateJobUsAsync(RateJobUsDto dto)
    {
        var rate = new OutputParameter<decimal?>();
        var description = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await Context.Procedures.DD_stpJob_Rate_DescribedAsync(
            clientID: dto.ClientId,
            speedID: dto.Speed,
            fromZipCode: string.IsNullOrEmpty(dto.FromZip) ? null : int.Parse(dto.FromZip),
            fromState: null,
            toZipCode: string.IsNullOrEmpty(dto.ToZip) ? null : int.Parse(dto.ToZip),
            toState: null,
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
            isFromAddressAirport: await DoesAddressMatchAirportAsync(dto.JobId, true),
            isToAddressAirport: await DoesAddressMatchAirportAsync(dto.JobId, false),
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
            var effectiveJobBookingId = await GetJobBookingRelationshipInfoAsync(dto.JobId);
            await Context.Procedures.DD_InsertPricingBreakdownAsync(
                jobID: null,
                prebookJobID: effectiveJobBookingId,
                pricingBreakdown: description.Value,
                returnValue: returnValue
            );
        }
        else
        {
            var effectiveJobId = await GetJobRelationshipInfoAsync(dto.JobId);
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

    private async Task<bool> DoesAddressMatchAirportAsync(int jobId, bool isPickupAddress)
    {
        var hasMatchingAirport = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Where(j => Context.TblAirports
                .Any(a => a.AddressLine2 == (isPickupAddress ? j.PickupAddressLine2 : j.DeliveryAddressLine2)))
            .AsNoTracking()
            .AnyAsync();

        return hasMatchingAirport;
    }

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
    
    public async Task<decimal> GetJobRateUsAsync(RateJobUsDto dto)
    {
        var rate = new OutputParameter<decimal?>();
        var description = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await Context.Procedures.DD_stpJob_Rate_DescribedAsync(
            clientID: dto.ClientId,
            speedID: dto.Speed,
            fromZipCode: string.IsNullOrEmpty(dto.FromZip) ? null : int.Parse(dto.FromZip),
            fromState: null,
            toZipCode: string.IsNullOrEmpty(dto.ToZip) ? null : int.Parse(dto.ToZip),
            toState: null,
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
            isFromAddressAirport: await DoesAddressMatchAirportAsync(dto.JobId, true),
            isToAddressAirport: await DoesAddressMatchAirportAsync(dto.JobId, false),
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