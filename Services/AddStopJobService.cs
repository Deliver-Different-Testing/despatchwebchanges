using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for creating additional stop jobs (extra pickups or deliveries) as child jobs linked to parent jobs.
/// </summary>
public class AddStopJobService(IJobRepository repository, ITenantInfoService infoService) : IAddStopJobService
{
    private const decimal ExtraStopAmount = 20m;
    private const decimal ExtraStopCourierPayment = 10m;
    private const int AirportSuburbId = 152;
    private const int JobRelationshipTypeId = 13;
    private const decimal ExtraStopFuel = 0m;

    /// <summary>
    /// Creates a new stop job as a child of an existing live job.
    /// Copies relevant data from the parent job, adds packages, notes, and pricing breakdown.
    /// </summary>
    /// <param name="request">The request containing job ID and pickup/delivery address details.</param>
    /// <returns>The ID of the newly created stop job.</returns>
    public async Task<int> AddStopInsertJobAsync(AddStopRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);

            var job = await repository.GetByIdAsync<TucJob>(request.JobId);
            ArgumentNullException.ThrowIfNull(job);

            var newStopJobNumber = await GenerateNewStopJobNumberAsync(job.UcjbNumber);
            var parentId = job.ParentId ?? job.UcjbId;
            var extras = request.PickUpAddress?.ShipmentDetails ?? request.DeliveryAddress?.ShipmentDetails;
            ArgumentNullException.ThrowIfNull(extras);

            var newStopJob = new TucJob
            {
                UcjbNumber = newStopJobNumber,
                UcjbDate = job.UcjbDate,
                UcjbTime = job.UcjbTime,
                UcjbType = job.UcjbType,
                UcjbClientId = job.UcjbClientId,
                UcjbContact = job.UcjbContact,
                UcjbChargeType = job.UcjbChargeType,
                UcjbAmount = ExtraStopAmount,
                CourierPayment = ExtraStopCourierPayment,
                UcjbSpeed = job.UcjbSpeed,
                UcjbFrom = job.UcjbFrom,
                UcjbFromAddr = AddressFormatter.GetSafeAddress(request.PickUpAddress?.FullAddress, job.UcjbFromAddr),
                UcjbTo = AirportSuburbId,
                UcjbToSpecial = null,
                UcjbToAddr = AddressFormatter.GetSafeAddress(request.DeliveryAddress?.FullAddress, job.UcjbFromAddr),
                UcjbSize = job.UcjbSize,
                UcjbCbd = false,
                UcjbKm = 0,
                UcjbFlightDetails = null,
                UcjbWeight = extras.Weight,
                UcjbStatus = job.UcjbStatus,
                UcjbCourierId = null,
                UcjbJobDone = false,
                UcjbClientRefa = job.UcjbClientRefa,
                UcjbClientRefb = job.UcjbClientRefb,
                UcjbOurRef = job.UcjbNumber,
                UcjbOpId = job.UcjbOpId,
                UcjbDispId = null,
                UcjbVan = job.UcjbVan,
                UcjbReturn = job.UcjbReturn,
                UcjbVoid = false,
                UcjbAttention = true,
                UcjbPickUpFrom = job.UcjbPickUpFrom,
                UcjbPaged = false,
                UcjbClientCode = job.UcjbClientCode,
                UcjbRefJobId = job.UcjbId,
                UcjbDispDate = null,
                UcjbDispTime = null,
                SaturdayDelivery = false,
                ClientNotes = job.ClientNotes,
                UcjbContactPhone = job.UcjbContactPhone,
                ContactId = job.ContactId,
                DeliverToPrivateBusiness = null,
                DeliverToLeaveId = null,
                ProofOfDelivery = null,
                ProofOfDeliveryEmail = null,
                ParentId = parentId,
                JobRelationshipTypeId = JobRelationshipTypeId,
                PickupFromContact = extras.ContactName,
                PickupFromPhone = extras.ContactMobile,
                DeliverToContact = extras.ContactName,
                DeliverToPhone = extras.ContactMobile,
                Dgclass = job.Dgclass,
                Dgdocument = job.Dgdocument,
                RawAmount = await CalculateRawAmountAsync(job),
                PickUpLatitude = job.PickUpLatitude,
                PickUpLongitude = job.PickUpLongitude,
                DeliveryLatitude = job.DeliveryLatitude,
                DeliveryLongitude = job.DeliveryLongitude,
                FuelSurchargeAmount = 0,
                CourierFuel = ExtraStopFuel,
                ShopId = job.ShopId,
                ShopRef1 = CleanShopRef(job.ShopRef1),
                ShopRef2 = CleanShopRef(job.ShopRef2),
                ShopRef3 = CleanShopRef(job.ShopRef3),
                ShopRef4 = CleanShopRef(job.ShopRef4),
                ShopRef5 = CleanShopRef(job.ShopRef5),
                CourierPercentageOverride = job.CourierPercentageOverride,
                DryIceWeight = job.DryIceWeight,
                PickupAddressLine1 = request.PickUpAddress?.AddressLine1 ?? job.PickupAddressLine1,
                PickupAddressLine2 = request.PickUpAddress?.AddressLine2 ?? job.PickupAddressLine2,
                PickupAddressLine3 = request.PickUpAddress?.AddressLine3 ?? job.PickupAddressLine3,
                PickupAddressLine4 = request.PickUpAddress?.AddressLine4 ?? job.PickupAddressLine4,
                PickupAddressLine5 = request.PickUpAddress?.AddressLine5 ?? job.PickupAddressLine5,
                PickupAddressLine6 = request.PickUpAddress?.AddressLine6 ?? job.PickupAddressLine6,
                PickupAddressLine7 = request?.PickUpAddress?.AddressLine7 ?? job.PickupAddressLine7,
                PickupAddressLine8 = request?.PickUpAddress?.AddressLine8 ?? job.PickupAddressLine8,
                DeliveryAddressLine1 = request?.DeliveryAddress?.AddressLine1 ?? job.DeliveryAddressLine1,
                DeliveryAddressLine2 = request?.DeliveryAddress?.AddressLine2 ?? job.DeliveryAddressLine2,
                DeliveryAddressLine3 = request?.DeliveryAddress?.AddressLine3 ?? job.DeliveryAddressLine3,
                DeliveryAddressLine4 = request?.DeliveryAddress?.AddressLine4 ?? job.DeliveryAddressLine4,
                DeliveryAddressLine5 = request?.DeliveryAddress?.AddressLine5 ?? job.DeliveryAddressLine5,
                DeliveryAddressLine6 = request?.DeliveryAddress?.AddressLine6 ?? job.DeliveryAddressLine6,
                DeliveryAddressLine7 = request?.DeliveryAddress?.AddressLine7 ?? job.DeliveryAddressLine7,
                FromAirportId = job.FromAirportId,
                ToAirportId = job.ToAirportId,
                DeliverByTime = job.DeliverByTime,
                InternalStatus = job.InternalStatus,
                PickupTimeZoneId = job.PickupTimeZoneId,
                DeliverByTimeZoneId = job.DeliverByTimeZoneId,
                TotalDistance = null,
                RatedManually = true,
                DisplayInDespatch = false
            };

            // Insert the new job stop
            await repository.AddEntityAsync(newStopJob);
            await repository.SaveChangesAsync();
            
            // Save packages
            await CreateAndAddPackagesToJob(job.ParentId ?? job.UcjbId, newStopJob.UcjbId, extras);
            
            var staffId = infoService.GetStaffId();
            var currentDate = infoService.GetCurrentTenantTime();

            // Pricing Breakdown
            var pricingBreakdown = CreatePricingBreakdown(newStopJob.UcjbId);
            await repository.AddEntityAsync(pricingBreakdown);

            // Add note
            if (!string.IsNullOrEmpty(extras.JobNotes))
            {
                var note = CreateNote(job.UcjbId, extras.JobNotes, staffId, currentDate);
                await repository.AddEntityAsync(note);
            }

            // Save changes to a database
            await repository.SaveChangesAsync();

            return newStopJob.UcjbId;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(AddStopJobService),
                    nameof(AddStopInsertJobAsync)));
            throw;
        }
    }

    /// <summary>
    /// Creates a new stop job as a child of an existing recurring (prebook) job.
    /// Copies relevant data from the parent booking, adds notes and pricing breakdown.
    /// </summary>
    /// <param name="request">The request containing job ID and pickup/delivery address details.</param>
    /// <returns>The ID of the newly created stop job booking.</returns>
    public async Task<int> AddStopInsertRecurringJobAsync(AddStopRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var job = await repository.GetByIdAsync<TucJobBooking>(request.JobId);
        ArgumentNullException.ThrowIfNull(job);

        var newStopJobNumber = await GenerateNewStopJobNumberAsync(job.UcbkJobNumber);
        var parentId = job.ParentId ?? job.UcbkId;
        var extras = request.PickUpAddress?.ShipmentDetails ?? request.DeliveryAddress?.ShipmentDetails;

        var newStopJob = new TucJobBooking
        {
            UcbkJobNumber = newStopJobNumber,
            UcbkDate = job.UcbkDate,
            UcbkTime = job.UcbkTime,
            UcbkType = job.UcbkType,
            UcbkClientId = job.UcbkClientId,
            UcbkContact = job.UcbkContact,
            UcbkChargeType = job.UcbkChargeType,
            UcbkAmount = ExtraStopAmount,
            CourierPayment = ExtraStopCourierPayment,
            UcbkSpeed = job.UcbkSpeed,
            UcbkFrom = job.UcbkFrom,
            UcbkFromAddr = AddressFormatter.GetSafeAddress(request.PickUpAddress?.FullAddress, job.UcbkFromAddr),
            UcbkTo = AirportSuburbId,
            UcbkToSpecial = null,
            UcbkToAddr = AddressFormatter.GetSafeAddress(request.DeliveryAddress?.FullAddress, job.UcbkFromAddr),
            UcbkSize = job.UcbkSize,
            Quantity = extras is { Quantity: not null } ? (short)extras.Quantity : job.Quantity,
            UcbkCbd = false,
            UcbkKm = 0,
            UcbkWeight = extras?.Weight != null ? (int)extras.Weight : job.UcbkWeight,
            CourierId = null,
            UcbkDone = false,
            UcbkClientRefa = job.UcbkClientRefa,
            UcbkClientRefb = job.UcbkClientRefb,
            UcbkOurRef = job.UcbkJobNumber,
            UcbkVan = job.UcbkVan,
            UcbkReturn = job.UcbkReturn,
            UcbkAttention = true,
            UcbkPickUpFrom = job.UcbkPickUpFrom,
            UcbkClientCode = job.UcbkClientCode,
            RefJobId = job.UcbkId,
            SaturdayDelivery = false,
            ClientNotes = job.ClientNotes,
            ContactId = job.ContactId,
            DeliverToPrivateBusiness = null,
            DeliverToLeaveId = null,
            ProofOfDelivery = null,
            ProofOfDeliveryEmail = null,
            ParentId = parentId,
            JobRelationshipTypeId = JobRelationshipTypeId,
            PickupFromContact = extras?.ContactName ?? job.PickupFromContact,
            PickupFromPhone = extras?.ContactMobile ?? job.PickupFromPhone,
            DeliverToContact = extras?.ContactName ?? job.DeliverToContact,
            DeliverToPhone = extras?.ContactMobile ?? job.DeliverToPhone,
            Dgclass = job.Dgclass,
            Dgdocument = job.Dgdocument,
            // RawAmount = await CalculateRawAmountAsync(job),
            PickUpLatitude = job.PickUpLatitude,
            PickUpLongitude = job.PickUpLongitude,
            DeliveryLatitude = job.DeliveryLatitude,
            DeliveryLongitude = job.DeliveryLongitude,
            FuelSurchargeAmount = 0,
            CourierFuel = ExtraStopFuel,
            ShopId = job.ShopId,
            ShopRef1 = CleanShopRef(job.ShopRef1),
            ShopRef2 = CleanShopRef(job.ShopRef2),
            ShopRef3 = CleanShopRef(job.ShopRef3),
            ShopRef4 = CleanShopRef(job.ShopRef4),
            ShopRef5 = CleanShopRef(job.ShopRef5),
            CourierPercentageOverride = job.CourierPercentageOverride,
            DryIceWeight = job.DryIceWeight,
            PickupAddressLine1 = request?.PickUpAddress?.AddressLine1 ?? job.PickupAddressLine1,
            PickupAddressLine2 = request?.PickUpAddress?.AddressLine2 ?? job.PickupAddressLine2,
            PickupAddressLine3 = request?.PickUpAddress?.AddressLine3 ?? job.PickupAddressLine3,
            PickupAddressLine4 = request?.PickUpAddress?.AddressLine4 ?? job.PickupAddressLine4,
            PickupAddressLine5 = request?.PickUpAddress?.AddressLine5 ?? job.PickupAddressLine5,
            PickupAddressLine6 = request?.PickUpAddress?.AddressLine6 ?? job.PickupAddressLine6,
            PickupAddressLine7 = request?.PickUpAddress?.AddressLine7 ?? job.PickupAddressLine7,
            PickupAddressLine8 = request?.PickUpAddress?.AddressLine8 ?? job.PickupAddressLine8,
            DeliveryAddressLine1 = request?.DeliveryAddress?.AddressLine1 ?? job.DeliveryAddressLine1,
            DeliveryAddressLine2 = request?.DeliveryAddress?.AddressLine2 ?? job.DeliveryAddressLine2,
            DeliveryAddressLine3 = request?.DeliveryAddress?.AddressLine3 ?? job.DeliveryAddressLine3,
            DeliveryAddressLine4 = request?.DeliveryAddress?.AddressLine4 ?? job.DeliveryAddressLine4,
            DeliveryAddressLine5 = request?.DeliveryAddress?.AddressLine5 ?? job.DeliveryAddressLine5,
            DeliveryAddressLine6 = request?.DeliveryAddress?.AddressLine6 ?? job.DeliveryAddressLine6,
            DeliveryAddressLine7 = request?.DeliveryAddress?.AddressLine7 ?? job.DeliveryAddressLine7,
            FromAirportId = job.FromAirportId,
            ToAirportId = job.ToAirportId,
            DeliverByTime = job.DeliverByTime,
            PickupTimeZoneId = job.PickupTimeZoneId,
            DeliverByTimeZoneId = job.DeliverByTimeZoneId,
            TotalDistance = null,
            RatedManually = true
        };

        // Insert the new job stop
        await repository.AddEntityAsync(newStopJob);
        await repository.SaveChangesAsync();

        var staffId = infoService.GetStaffId();
        var currentDate = infoService.GetCurrentTenantTime();

        // Pricing Breakdown
        var pricingBreakdown = CreateBookingPricingBreakdown(newStopJob.UcbkId);
        await repository.AddEntityAsync(pricingBreakdown);

        // Add note
        if (!string.IsNullOrEmpty(extras.JobNotes))
        {
            var note = CreateBookingNote(job.UcbkId, extras.JobNotes, staffId, currentDate);
            await repository.AddEntityAsync(note);
        }

        // Save changes to a database
        await repository.SaveChangesAsync();

        return newStopJob.UcbkId;
    }

    /// <summary>
    /// Generates a unique job number for a stop job by appending a-z suffix to the base job number.
    /// </summary>
    /// <param name="baseJobNumber">The parent job number to use as a base.</param>
    /// <returns>A unique job number with alphabetic suffix.</returns>
    private async Task<string> GenerateNewStopJobNumberAsync(string baseJobNumber)
    {
        var letter = 'a';

        while (letter <= 'z')
        {
            var newJobNumber = baseJobNumber + letter;

            if (!await repository.JobNumberExistsAsync(newJobNumber)) return newJobNumber;

            letter++;
        }

        throw new InvalidOperationException("Unable to generate unique job number - all suffixes exhausted");
    }

    /// <summary>
    /// Calculates the raw amount for a stop job based on the parent job's client and service parameters.
    /// </summary>
    private async Task<decimal> CalculateRawAmountAsync(TucJob job)
    {
        return await repository.GetNationwideServiceRawPriceAsync(
            job.UcjbClientId,
            job.UcjbFrom,
            AirportSuburbId,
            job.UcjbSpeed,
            job.UcjbSize,
            job.UcjbWeight.HasValue ? (float)job.UcjbWeight.Value : null,
            job.UcjbQty,
            job.UcjbType.HasValue ? (int)job.UcjbType.Value : null
        );
    }

    /// <summary>
    /// Cleans a shop reference string by trimming whitespace or returning null if empty.
    /// </summary>
    private static string CleanShopRef(string shopRef) => string.IsNullOrWhiteSpace(shopRef) ? null : shopRef.Trim();

    /// <summary>
    /// Creates a note entity for a live job.
    /// </summary>
    private static TucNote CreateNote(int jobId, string noteText, int staffId, DateTime currentDate)
    {
        return new TucNote
        {
            JobId = jobId,
            NoteText = noteText,
            CreatedBy = staffId,
            CreatedDate = currentDate,
            NoteTypeId = (int)NoteType.InternalNote,
            UpdatedBy = staffId,
            UpdatedDate = currentDate
        };
    }

    /// <summary>
    /// Creates a note entity for a recurring job booking.
    /// </summary>
    private static TucNote CreateBookingNote(int jobBookingId, string noteText, int staffId, DateTime currentDate)
    {
        return new TucNote
        {
            JobBookingId = jobBookingId,
            NoteText = noteText,
            CreatedBy = staffId,
            CreatedDate = currentDate,
            NoteTypeId = (int)NoteType.InternalNote,
            UpdatedBy = staffId,
            UpdatedDate = currentDate
        };
    }

    /// <summary>
    /// Creates a pricing breakdown for a live job stop.
    /// </summary>
    private static PricingBreakdown CreatePricingBreakdown(int stopJobId) =>
        CreatePricingBreakdownCore(stopJobId, isRecurring: false);

    /// <summary>
    /// Creates a pricing breakdown for a recurring job booking stop.
    /// </summary>
    private static PricingBreakdown CreateBookingPricingBreakdown(int stopJobId) =>
        CreatePricingBreakdownCore(stopJobId, isRecurring: true);

    /// <summary>
    /// Creates a pricing breakdown with extra stop charges.
    /// </summary>
    private static PricingBreakdown CreatePricingBreakdownCore(int stopJobId, bool isRecurring)
    {
        var breakdown = new PricingBreakdown
        {
            ChargeAmount = ExtraStopAmount,
            CostAmount = ExtraStopCourierPayment,
            Total = ExtraStopAmount - ExtraStopCourierPayment,
            ChargeName = "Extra Stop"
        };

        if (isRecurring)
            breakdown.PrebookJobId = stopJobId;
        else
            breakdown.JobId = stopJobId;

        return breakdown;
    }
    
    /// <summary>
    /// Creates package entities for the stop job based on the shipment details quantity.
    /// </summary>
    private async Task CreateAndAddPackagesToJob(int effectiveJobId, int stopJobId, ShipmentDetails extras)
    {
        var quantity = extras.Quantity ?? 0;
        if (quantity <= 0) return;

        var parcels = new List<TucJobItem>();
        for (var x = 1; x < quantity + 1; x++)
        {
            var parcel = new TucJobItem
            {
                JobId = effectiveJobId,
                ChildJobId = stopJobId,
                Notes = $"Package {x}",
                Items = 1,
                Depth = extras.Depth,
                Height = extras.Height,
                Length = extras.Length,
                Weight = extras.Weight
            };
            parcels.Add(parcel);
        }

        await repository.AddPackagesToJobAsync(effectiveJobId, parcels);
    }
}