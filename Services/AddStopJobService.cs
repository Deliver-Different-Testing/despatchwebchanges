using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Services;

public class AddStopJobService(IJobRepository repository, ITenantInfoService infoService) : IAddStopJobService
{
    private const decimal ExtraStopAmount = 20m;
    private const decimal ExtraStopCourierPayment = 10m;
    private const int AirportSuburbId = 152;
    private const int JobRelationshipTypeId = 13;
    private const decimal ExtraStopFuel = 0m;

    public async Task<int> AddStopInsertJobAsync(AddStopRequest request)
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

        // Add packages to the job
        await CreateAndAddPackagesToJob(newStopJob.UcjbId, extras);
        
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

    private static string CleanShopRef(string shopRef) => string.IsNullOrWhiteSpace(shopRef) ? null : shopRef.Trim();

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

    private static PricingBreakdown CreatePricingBreakdown(int stopJobId) => CreatePricingBreakdownCore(stopJobId, isRecurring: false);

    private static PricingBreakdown CreateBookingPricingBreakdown(int stopJobId) => CreatePricingBreakdownCore(stopJobId, isRecurring: true);

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

    private async Task CreateAndAddPackagesToJob(int jobId, ShipmentDetails extras)
    {
        // Add parcels
        var parcels = new List<ParcelDimensions>();
        for (var x = 0; x < extras.Quantity; x++)
        {
            var parcel = new ParcelDimensions
            {
                ItemName = $"Package {x}",
                Depth = extras.Depth,
                Height = extras.Height,
                Length = extras.Length
            };
            parcels.Add(parcel);
        }

        await repository.UpdatePackagesForJobAsync(jobId, parcels);
    }
}
