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
public sealed class AddStopJobService(
    IJobQueryRepository queryRepository,
    IJobCommandRepository commandRepository,
    ITenantInfoService infoService,
    ITenantClock clock) : IAddStopJobService
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

            var job = await queryRepository.GetByIdAsync<TucJob>(request.JobId);
            ArgumentNullException.ThrowIfNull(job);

            var newStopJobNumber = await GenerateNewStopJobNumberAsync(job.UcjbNumber);
            var parentId = job.ParentId ?? job.UcjbId;
            var extras = request.PickUpAddress?.ShipmentDetails ?? request.DeliveryAddress?.ShipmentDetails;
            ArgumentNullException.ThrowIfNull(extras);

            // Create stop job via stored procedure
            var stopInput = BuildStopJobInputModel(job, newStopJobNumber, request, extras);
            var stopResult = await commandRepository.CreateMinimalTucJobAsync(stopInput);
            if (!stopResult.Success || !stopResult.JobId.HasValue)
            {
                throw new InvalidOperationException($"Failed to create stop job: {stopResult.Message}");
            }

            // Load created job to update remaining fields
            var newStopJob = await queryRepository.GetByIdAsync<TucJob>(stopResult.JobId.Value);

            // Update fields not handled by the stored procedure
            newStopJob.UcjbDate = job.UcjbDate;
            newStopJob.UcjbTime = job.UcjbTime;
            newStopJob.UcjbType = job.UcjbType;
            newStopJob.UcjbContact = job.UcjbContact;
            newStopJob.UcjbChargeType = job.UcjbChargeType;
            newStopJob.UcjbFrom = job.UcjbFrom;
            newStopJob.UcjbFromAddr =
                AddressFormatter.GetSafeAddress(request.PickUpAddress?.FullAddress, job.UcjbFromAddr);
            newStopJob.UcjbTo = AirportSuburbId;
            newStopJob.UcjbToSpecial = null;
            newStopJob.UcjbToAddr =
                AddressFormatter.GetSafeAddress(request.DeliveryAddress?.FullAddress, job.UcjbFromAddr);
            newStopJob.UcjbSize = job.UcjbSize;
            newStopJob.UcjbCbd = false;
            newStopJob.UcjbKm = 0;
            newStopJob.UcjbFlightDetails = null;
            newStopJob.UcjbWeight = extras.Weight;
            newStopJob.UcjbStatus = job.UcjbStatus;
            newStopJob.UcjbCourierId = null;
            newStopJob.UcjbJobDone = false;
            newStopJob.UcjbOpId = job.UcjbOpId;
            newStopJob.UcjbDispId = null;
            newStopJob.UcjbVan = job.UcjbVan;
            newStopJob.UcjbReturn = job.UcjbReturn;
            newStopJob.UcjbVoid = false;
            newStopJob.UcjbAttention = true;
            newStopJob.UcjbPickUpFrom = job.UcjbPickUpFrom;
            newStopJob.UcjbPaged = false;
            newStopJob.UcjbClientCode = job.UcjbClientCode;
            newStopJob.UcjbRefJobId = job.UcjbId;
            newStopJob.UcjbDispDate = null;
            newStopJob.UcjbDispTime = null;
            newStopJob.SaturdayDelivery = false;
            newStopJob.ClientNotes = job.ClientNotes;
            newStopJob.UcjbContactPhone = job.UcjbContactPhone;
            newStopJob.ContactId = job.ContactId;
            newStopJob.DeliverToPrivateBusiness = null;
            newStopJob.DeliverToLeaveId = null;
            newStopJob.ProofOfDelivery = null;
            newStopJob.ProofOfDeliveryEmail = null;
            newStopJob.ParentId = parentId;
            newStopJob.JobRelationshipTypeId = JobRelationshipTypeId;
            newStopJob.Dgdocument = job.Dgdocument;
            newStopJob.RawAmount = await CalculateRawAmountAsync(job);
            newStopJob.CourierPayment = ExtraStopCourierPayment;
            newStopJob.CourierFuel = ExtraStopFuel;
            newStopJob.ShopId = job.ShopId;
            newStopJob.ShopRef1 = CleanShopRef(job.ShopRef1);
            newStopJob.ShopRef2 = CleanShopRef(job.ShopRef2);
            newStopJob.ShopRef3 = CleanShopRef(job.ShopRef3);
            newStopJob.ShopRef4 = CleanShopRef(job.ShopRef4);
            newStopJob.ShopRef5 = CleanShopRef(job.ShopRef5);
            newStopJob.CourierPercentageOverride = job.CourierPercentageOverride;
            newStopJob.FromAirportId = job.FromAirportId;
            newStopJob.ToAirportId = job.ToAirportId;
            newStopJob.DeliverByTime = job.DeliverByTime;
            newStopJob.InternalStatus = job.InternalStatus;
            newStopJob.PickupTimeZoneId = job.PickupTimeZoneId;
            newStopJob.DeliverByTimeZoneId = job.DeliverByTimeZoneId;
            newStopJob.TotalDistance = null;
            newStopJob.RatedManually = true;
            newStopJob.DisplayInDespatch = false;
            newStopJob.PickupAddressLine1 = request.PickUpAddress?.AddressLine1 ?? job.PickupAddressLine1;
            newStopJob.PickupAddressLine2 = request.PickUpAddress?.AddressLine2 ?? job.PickupAddressLine2;
            newStopJob.PickupAddressLine3 = request.PickUpAddress?.AddressLine3 ?? job.PickupAddressLine3;
            newStopJob.PickupAddressLine4 = request.PickUpAddress?.AddressLine4 ?? job.PickupAddressLine4;
            newStopJob.PickupAddressLine5 = request.PickUpAddress?.AddressLine5 ?? job.PickupAddressLine5;
            newStopJob.PickupAddressLine6 = request.PickUpAddress?.AddressLine6 ?? job.PickupAddressLine6;
            newStopJob.PickupAddressLine7 = request.PickUpAddress?.AddressLine7 ?? job.PickupAddressLine7;
            newStopJob.PickupAddressLine8 = request.PickUpAddress?.AddressLine8 ?? job.PickupAddressLine8;
            newStopJob.PickUpLatitude = job.PickUpLatitude;
            newStopJob.PickUpLongitude = job.PickUpLongitude;
            newStopJob.DeliveryAddressLine1 = request.DeliveryAddress?.AddressLine1 ?? job.DeliveryAddressLine1;
            newStopJob.DeliveryAddressLine2 = request.DeliveryAddress?.AddressLine2 ?? job.DeliveryAddressLine2;
            newStopJob.DeliveryAddressLine3 = request.DeliveryAddress?.AddressLine3 ?? job.DeliveryAddressLine3;
            newStopJob.DeliveryAddressLine4 = request.DeliveryAddress?.AddressLine4 ?? job.DeliveryAddressLine4;
            newStopJob.DeliveryAddressLine5 = request.DeliveryAddress?.AddressLine5 ?? job.DeliveryAddressLine5;
            newStopJob.DeliveryAddressLine6 = request.DeliveryAddress?.AddressLine6 ?? job.DeliveryAddressLine6;
            newStopJob.DeliveryAddressLine7 = request.DeliveryAddress?.AddressLine7 ?? job.DeliveryAddressLine7;
            newStopJob.DeliveryLatitude = job.DeliveryLatitude;
            newStopJob.DeliveryLongitude = job.DeliveryLongitude;

            await commandRepository.SaveChangesAsync();

            // Save packages
            await CreateAndAddPackagesToJob(job.ParentId ?? job.UcjbId, newStopJob.UcjbId, extras);

            var staffId = infoService.GetStaffId();
            var currentDate = clock.TenantNow;

            // Pricing Breakdown
            var pricingBreakdown = CreatePricingBreakdown(newStopJob.UcjbId);
            await commandRepository.AddEntityAsync(pricingBreakdown);

            // Add note
            if (!string.IsNullOrEmpty(extras.JobNotes))
            {
                var note = CreateNote(job.UcjbId, extras.JobNotes, staffId, currentDate, clock.UtcNow);
                await commandRepository.AddEntityAsync(note);
            }

            // Save changes to a database
            await commandRepository.SaveChangesAsync();

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

        var job = await queryRepository.GetByIdAsync<TucJobBooking>(request.JobId);
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
        await commandRepository.AddEntityAsync(newStopJob);
        await commandRepository.SaveChangesAsync();

        var staffId = infoService.GetStaffId();
        var currentDate = clock.TenantNow;

        // Pricing Breakdown
        var pricingBreakdown = CreateBookingPricingBreakdown(newStopJob.UcbkId);
        await commandRepository.AddEntityAsync(pricingBreakdown);

        // Add note
        if (!string.IsNullOrEmpty(extras.JobNotes))
        {
            var note = CreateBookingNote(job.UcbkId, extras.JobNotes, staffId, currentDate, clock.UtcNow);
            await commandRepository.AddEntityAsync(note);
        }

        // Save changes to a database
        await commandRepository.SaveChangesAsync();

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

            if (!await queryRepository.JobNumberExistsAsync(newJobNumber))
            {
                return newJobNumber;
            }

            letter++;
        }

        throw new InvalidOperationException("Unable to generate unique job number - all suffixes exhausted");
    }

    private CreateMinimalTucJobInputModel BuildStopJobInputModel(
        TucJob job,
        string newStopJobNumber,
        AddStopRequest request,
        ShipmentDetails extras) =>
        new()
        {
            JobNumber = newStopJobNumber,
            ClientId = job.UcjbClientId ?? 0,
            SpeedId = job.UcjbSpeed ?? 0,
            Amount = ExtraStopAmount,
            FromAddress = new AddressViewModel
            {
                AddressLine1 = request.PickUpAddress?.AddressLine1 ?? job.PickupAddressLine1,
                AddressLine2 = request.PickUpAddress?.AddressLine2 ?? job.PickupAddressLine2,
                AddressLine3 = request.PickUpAddress?.AddressLine3 ?? job.PickupAddressLine3,
                AddressLine4 = request.PickUpAddress?.AddressLine4 ?? job.PickupAddressLine4,
                AddressLine5 = request.PickUpAddress?.AddressLine5 ?? job.PickupAddressLine5,
                AddressLine6 = request.PickUpAddress?.AddressLine6 ?? job.PickupAddressLine6,
                AddressLine7 = request.PickUpAddress?.AddressLine7 ?? job.PickupAddressLine7,
                AddressLine8 = request.PickUpAddress?.AddressLine8 ?? job.PickupAddressLine8,
                Latitude = job.PickUpLatitude,
                Longitude = job.PickUpLongitude
            },
            ToAddress = new AddressViewModel
            {
                AddressLine1 = request.DeliveryAddress?.AddressLine1 ?? job.DeliveryAddressLine1,
                AddressLine2 = request.DeliveryAddress?.AddressLine2 ?? job.DeliveryAddressLine2,
                AddressLine3 = request.DeliveryAddress?.AddressLine3 ?? job.DeliveryAddressLine3,
                AddressLine4 = request.DeliveryAddress?.AddressLine4 ?? job.DeliveryAddressLine4,
                AddressLine5 = request.DeliveryAddress?.AddressLine5 ?? job.DeliveryAddressLine5,
                AddressLine6 = request.DeliveryAddress?.AddressLine6 ?? job.DeliveryAddressLine6,
                AddressLine7 = request.DeliveryAddress?.AddressLine7 ?? job.DeliveryAddressLine7,
                Latitude = job.DeliveryLatitude,
                Longitude = job.DeliveryLongitude
            },
            Reference = job.UcjbClientRefa,
            ReferenceB = job.UcjbClientRefb,
            OurRef = job.UcjbNumber,
            FromContactName = extras.ContactName,
            FromPhoneNumber = extras.ContactMobile,
            ToContactName = extras.ContactName,
            ToPhoneNumber = extras.ContactMobile,
            PickUpLatitude = job.PickUpLatitude,
            PickUpLongitude = job.PickUpLongitude,
            DeliveryLatitude = job.DeliveryLatitude,
            DeliveryLongitude = job.DeliveryLongitude,
            DgClass = job.Dgclass,
            DryIceWeight = job.DryIceWeight,
            FuelSurchargeAmount = 0,
            BookedBy = job.UcjbContact,
            LoggedInContactId = infoService.GetContactId(),
            TenantCurrentTime = clock.TenantNow
        };

    /// <summary>
    /// Calculates the raw amount for a stop job based on the parent job's client and service parameters.
    /// </summary>
    private async Task<decimal> CalculateRawAmountAsync(TucJob job) =>
        await queryRepository.GetNationwideServiceRawPriceAsync(
            job.UcjbClientId,
            job.UcjbFrom,
            AirportSuburbId,
            job.UcjbSpeed,
            job.UcjbSize,
            job.UcjbWeight.HasValue ? (float)job.UcjbWeight.Value : null,
            job.UcjbQty,
            job.UcjbType.HasValue ? (int)job.UcjbType.Value : null
        );

    /// <summary>
    /// Cleans a shop reference string by trimming whitespace or returning null if empty.
    /// </summary>
    private static string CleanShopRef(string shopRef) => string.IsNullOrWhiteSpace(shopRef) ? null : shopRef.Trim();

    /// <summary>
    /// Creates a note entity for a live job.
    /// </summary>
    private static TucNote CreateNote(int jobId, string noteText, int staffId, DateTime currentDate,
        DateTime currentDateUtc) =>
        new()
        {
            JobId = jobId,
            NoteText = noteText,
            CreatedBy = staffId,
            CreatedDate = currentDate,
            CreatedDateUtc = currentDateUtc,
            NoteTypeId = (int)NoteType.InternalNote,
            UpdatedBy = staffId,
            UpdatedDate = currentDate,
            UpdatedDateUtc = currentDateUtc
        };

    /// <summary>
    /// Creates a note entity for a recurring job booking.
    /// </summary>
    private static TucNote CreateBookingNote(int jobBookingId, string noteText, int staffId, DateTime currentDate,
        DateTime currentDateUtc) =>
        new()
        {
            JobBookingId = jobBookingId,
            NoteText = noteText,
            CreatedBy = staffId,
            CreatedDate = currentDate,
            CreatedDateUtc = currentDateUtc,
            NoteTypeId = (int)NoteType.InternalNote,
            UpdatedBy = staffId,
            UpdatedDate = currentDate,
            UpdatedDateUtc = currentDateUtc
        };

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
        {
            breakdown.PrebookJobId = stopJobId;
        }
        else
        {
            breakdown.JobId = stopJobId;
        }

        return breakdown;
    }

    /// <summary>
    /// Creates package entities for the stop job based on the shipment details quantity.
    /// </summary>
    private async Task CreateAndAddPackagesToJob(int effectiveJobId, int stopJobId, ShipmentDetails extras)
    {
        var quantity = extras.Quantity ?? 0;
        if (quantity <= 0)
        {
            return;
        }

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

        await commandRepository.AddPackagesToJobAsync(effectiveJobId, parcels);
    }
}