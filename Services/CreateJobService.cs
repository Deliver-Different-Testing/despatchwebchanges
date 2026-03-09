using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for creating jobs via the Excelerator flow.
/// Replaces the stored procedure DD_stpJob_InsertExcelerator with C# implementation.
/// Inner INSERT stored procedures are called via scaffolded EF Core stored proc methods.
/// </summary>
public class CreateJobService(
    IDbContextFactory<DespatchContext> contextFactory) : ICreateJobService
{
    /// <summary>
    /// Intermediate state that replaces ~30 SQL local variables from the stored procedure.
    /// </summary>
    private class ResolvedJobData
    {
        // Input-derived
        public int TypeId { get; set; } = 1;
        public int? ClientGroupId { get; set; }
        public string ClientCode { get; set; }
        public bool IsBulkSchedule { get; set; }
        public int? BulkRunScheduleId { get; set; }
        public int? BulkJobTypeId { get; set; }
        public int? JobTypeId { get; set; }
        public int? SpeedId { get; set; }

        // Address type
        public int? AddressType { get; set; }
        public int? LeaveNotHomeId { get; set; }
        public bool? ReturnJob { get; set; }
        public int? ProofOfDeliveryType { get; set; }
        public bool? ProofOfDelivery { get; set; }
        public string ProofOfDeliveryEmail { get; set; }
        public string ProofOfDeliveryMobile { get; set; }

        // Defaults
        public string Contact { get; set; }
        public int? ContactId { get; set; }
        public int? DeliverToPrivateBusiness { get; set; }
        public string ClientReferenceA { get; set; }
        public string ClientReferenceB { get; set; }
        public int? Size { get; set; }
        public decimal? Weight { get; set; }
        public int? Quantity { get; set; }
        public string CourierNotes { get; set; }
        public string ClientNotes { get; set; }
        public int? PickUpFrom { get; set; }
        public int? DeliverToLeaveId { get; set; }

        // Settings
        public int ChargeType { get; set; }
        public int OperatorId { get; set; }

        // Client info
        public int? ClientId { get; set; }
        public bool ReferenceAmandatory { get; set; }
        public bool ReferenceAdefineList { get; set; }
        public string ReferenceAmessage { get; set; }
        public bool ReferenceBmandatory { get; set; }
        public bool ReferenceBdefineList { get; set; }
        public string ReferenceBmessage { get; set; }

        // Recurring
        public int? RecurringDaysBitmask { get; set; }
        public int? RecurringFrequencyBitmask { get; set; }

        // Bulk schedule info
        public TblBulkRunSchedule BulkSchedule { get; set; }
        public TblBulkRegion BulkRegion { get; set; }
    }

    /// <inheritdoc />
    public async Task<CreateMinimalTucJobResponse> CreateJobAsync(
        CreateMinimalTucJobInputModel data,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var context = await contextFactory.CreateDbContextAsync(cancellationToken);

            var resolved = new ResolvedJobData();

            await ResolveInputValuesAsync(context, data, resolved, cancellationToken);
            await ApplyClientDefaultsAsync(context, data, resolved, cancellationToken);
            await ResolveContactAsync(context, data, resolved, cancellationToken);
            ApplyNullFallbackDefaults(data, resolved);
            await LoadSettingsAsync(context, resolved, cancellationToken);

            var validationError = await ValidateAsync(context, data, resolved, cancellationToken);
            if (validationError != null)
                return new CreateMinimalTucJobResponse { Success = false, Message = validationError };

            ParseRecurringBitmasks(data, resolved);

            if (resolved.IsBulkSchedule)
                return await InsertBulkScheduleJobAsync(context, data, resolved, cancellationToken);

            return await InsertNormalJobAsync(context, data, resolved, cancellationToken);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error creating job via CreateJobService");
            return new CreateMinimalTucJobResponse { Success = false, Message = ex.Message };
        }
    }

    /// <summary>
    /// Parse @Type → TypeID, look up client, detect bulk schedule, resolve speed/job type.
    /// </summary>
    private static async Task ResolveInputValuesAsync(
        DespatchContext context,
        CreateMinimalTucJobInputModel data,
        ResolvedJobData resolved,
        CancellationToken ct)
    {
        // Parse Type string → TypeID
        resolved.TypeId = data.Type?.ToUpperInvariant() switch
        {
            "DELIVERTO" => 2,
            "THIRDPARTY" => 3,
            _ => 1
        };

        // Client lookup from the table entity (TucClient is the actual table; TblClient is a view)
        if (data.ClientId > 0)
        {
            var client = await context.TucClients
                .AsNoTracking()
                .Where(c => c.UcclId == data.ClientId)
                .Select(c => new
                {
                    ClientId = c.UcclId,
                    c.UcclGroupId,
                    c.UcclCode,
                    c.ReferenceAmandatory,
                    c.ReferenceAdefineList,
                    c.ReferenceAmessage,
                    c.ReferenceBmandatory,
                    c.ReferenceBdefineList,
                    c.ReferenceBmessage
                })
                .FirstOrDefaultAsync(ct);

            if (client != null)
            {
                resolved.ClientId = client.ClientId;
                resolved.ClientGroupId = client.UcclGroupId;
                resolved.ClientCode = client.UcclCode;
                resolved.ReferenceAmandatory = client.ReferenceAmandatory;
                resolved.ReferenceAdefineList = client.ReferenceAdefineList;
                resolved.ReferenceAmessage = client.ReferenceAmessage;
                resolved.ReferenceBmandatory = client.ReferenceBmandatory;
                resolved.ReferenceBdefineList = client.ReferenceBdefineList;
                resolved.ReferenceBmessage = client.ReferenceBmessage;
            }
        }

        // Bulk schedule detection: SpeedID >= 1000 encodes BulkRunScheduleId * 1000 + JobTypeId
        resolved.SpeedId = data.SpeedId;
        if (data.SpeedId >= 1000)
        {
            resolved.IsBulkSchedule = true;
            resolved.BulkRunScheduleId = data.SpeedId / 1000;
            resolved.BulkJobTypeId = data.SpeedId % 1000;

            // Load the bulk schedule and region
            resolved.BulkSchedule = await context.TblBulkRunSchedules
                .AsNoTracking()
                .Include(s => s.RegionNavigation)
                .FirstOrDefaultAsync(s => s.BulkRunScheduleId == resolved.BulkRunScheduleId, ct);

            if (resolved.BulkSchedule != null)
            {
                resolved.BulkRegion = resolved.BulkSchedule.RegionNavigation;
                // Override speed with the schedule's speed
                resolved.SpeedId = resolved.BulkSchedule.SpeedId;
            }
        }

        // Resolve JobTypeID from Speed name using TucJobType (SystemName match + WebServiceEntry)
        if (!string.IsNullOrWhiteSpace(data.Speed))
        {
            var jobType = await context.TucJobTypes
                .AsNoTracking()
                .Where(jt => jt.SystemName == data.Speed && jt.WebServiceEntry)
                .Select(jt => new { jt.UcjtId })
                .FirstOrDefaultAsync(ct);

            resolved.JobTypeId = jobType?.UcjtId;
        }

        // If we have a SpeedId but no JobTypeId resolved yet, use SpeedId directly as job type ID
        if (!resolved.JobTypeId.HasValue && resolved.SpeedId.HasValue && !resolved.IsBulkSchedule) resolved.JobTypeId = resolved.SpeedId;

        // Address type resolution
        resolved.AddressType = ParseAddressType(data.ToAddressType); 

        // POD type
        resolved.ProofOfDelivery = ParseProofOfDelivery(data);
        resolved.ProofOfDeliveryEmail = data.JobNotificationEmail;
        resolved.ProofOfDeliveryMobile = data.JobNotificationMobile;

        if (!string.IsNullOrWhiteSpace(data.JobNotificationType))
            resolved.ProofOfDeliveryType = data.JobNotificationType.ToUpperInvariant() switch
            {
                "EMAIL" => 1,
                "SMS" => 2,
                "BOTH" => 3,
                _ => null
            };
    }

    private static int? ParseAddressType(string toAddressType)
    {
        if (string.IsNullOrWhiteSpace(toAddressType)) return null;
        return toAddressType.ToUpperInvariant() switch
        {
            "PRIVATE" or "RESIDENTIAL" => 1,
            "BUSINESS" or "COMMERCIAL" => 0,
            _ => int.TryParse(toAddressType, out var val) ? val : null
        };
    }

    private static bool? ParseProofOfDelivery(CreateMinimalTucJobInputModel data)
    {
        if (!string.IsNullOrWhiteSpace(data.JobNotificationType)) return true;
        return null; // Set by client defaults
    }

    /// <summary>
    /// Query TblJobDefault joined on client Code, apply ISNULL coalescing.
    /// </summary>
    private static async Task ApplyClientDefaultsAsync(
        DespatchContext context,
        CreateMinimalTucJobInputModel data,
        ResolvedJobData resolved,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(resolved.ClientCode)) return;

        var defaults = await context.TblJobDefaults
            .AsNoTracking()
            .Where(d => d.Code == resolved.ClientCode)
            .FirstOrDefaultAsync(ct);

        if (defaults == null) return;

        // Apply ISNULL coalescing — input values take precedence, defaults fill gaps
        resolved.Contact ??= defaults.Contact;
        resolved.ContactId ??= defaults.ContactId;
        resolved.JobTypeId ??= defaults.JobTypeId;
        resolved.DeliverToPrivateBusiness ??= defaults.DeliverToPrivateBusiness;
        resolved.ClientReferenceA ??= defaults.ClientReferenceA;
        resolved.ClientReferenceB ??= defaults.ClientReferenceB;
        resolved.Size ??= defaults.Size;
        resolved.Weight ??= (decimal?)defaults.Weight;
        resolved.Quantity ??= defaults.Quantity;
        resolved.CourierNotes ??= defaults.CourierNotes;
        resolved.ClientNotes ??= defaults.ClientNotes;
        resolved.PickUpFrom ??= defaults.PickUpFrom;
        resolved.DeliverToLeaveId ??= defaults.DeliverToLeaveId;
        resolved.ProofOfDelivery ??= defaults.ProofOfDelivery is > 0;
        resolved.ProofOfDeliveryEmail ??= defaults.ProofOfDeliveryEmail;
        resolved.ProofOfDeliveryMobile ??= defaults.ProofOfDeliveryMobile;
        resolved.ReturnJob ??= defaults.RtnJob;

        // Type from defaults if not already resolved from input
        if (string.IsNullOrWhiteSpace(data.Type) && defaults.Type.HasValue) resolved.TypeId = defaults.Type.Value;
    }

    /// <summary>
    /// Match BookedBy name to TblContact/TblClientContact, apply contact defaults.
    /// </summary>
    private static async Task ResolveContactAsync(
        DespatchContext context,
        CreateMinimalTucJobInputModel data,
        ResolvedJobData resolved,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(data.BookedBy) || !resolved.ClientId.HasValue) return;

        // Find the contact by matching BookedBy to contact first/last name via TucClientContact table
        var contact = await context.TucClientContacts
            .AsNoTracking()
            .Where(c => c.UcctClientId == resolved.ClientId
                        && c.UcctFirstname + " " + c.UcctSurname == data.BookedBy)
            .Select(c => new { c.UcctId })
            .FirstOrDefaultAsync(ct);

        if (contact == null) return;

        // Look up the client-contact defaults
        var clientContact = await context.TblClientContacts
            .AsNoTracking()
            .Where(cc => cc.ClientId == resolved.ClientId && cc.ContactId == contact.UcctId)
            .FirstOrDefaultAsync(ct);

        if (clientContact == null) return;

        resolved.ContactId ??= clientContact.ContactId;

        // Apply contact-level defaults (only where not already set)
        if (!string.IsNullOrWhiteSpace(clientContact.DefaultJobSpeed) && !resolved.JobTypeId.HasValue)
        {
            // Look up the speed from the default name
            var speedType = await context.TucJobTypes
                .AsNoTracking()
                .Where(jt => jt.UcjtName == clientContact.DefaultJobSpeed && jt.WebServiceEntry)
                .Select(jt => new { jt.UcjtId })
                .FirstOrDefaultAsync(ct);

            if (speedType != null)
                resolved.JobTypeId = speedType.UcjtId;
        }

        if (clientContact.DefaultPod.HasValue && !resolved.ProofOfDelivery.HasValue)
        {
            resolved.ProofOfDelivery = clientContact.DefaultPod > 0;
            resolved.ProofOfDeliveryType = clientContact.DefaultPod;
        }

        if (!string.IsNullOrWhiteSpace(clientContact.DefaultPodemail))
            resolved.ProofOfDeliveryEmail ??= clientContact.DefaultPodemail;

        if (!string.IsNullOrWhiteSpace(clientContact.DefaultPodphone))
            resolved.ProofOfDeliveryMobile ??= clientContact.DefaultPodphone;
    }

    /// <summary>
    /// Apply null fallback defaults: TypeID=1, ReturnJob=false, DeliverTo=0, Weight=0, Quantity=1, etc.
    /// </summary>
    private static void ApplyNullFallbackDefaults(CreateMinimalTucJobInputModel data, ResolvedJobData resolved)
    {
        resolved.JobTypeId ??= 1;
        resolved.ReturnJob ??= false;
        resolved.DeliverToPrivateBusiness ??= 0;
        resolved.Weight ??= 0;
        resolved.Quantity ??= 1;
        resolved.LeaveNotHomeId ??= 1;
        resolved.Size ??= 2;
        resolved.PickUpFrom ??= 0;

        // Override with input data where provided
        if (!string.IsNullOrWhiteSpace(data.Notes))
        {
            resolved.CourierNotes = data.Notes;
            resolved.ClientNotes = data.Notes;
        }

        if (!string.IsNullOrWhiteSpace(data.Reference))
            resolved.ClientReferenceA = data.Reference;

        if (!string.IsNullOrWhiteSpace(data.ReferenceB))
            resolved.ClientReferenceB = data.ReferenceB;

        if (data.PrivateRes.HasValue)
            resolved.DeliverToPrivateBusiness = data.PrivateRes.Value ? 1 : 0;
    }

    /// <summary>
    /// Get InternetJobChargeType and InternetJobStaffId from TblSettings.
    /// </summary>
    private static async Task LoadSettingsAsync(
        DespatchContext context,
        ResolvedJobData resolved,
        CancellationToken ct)
    {
        var settings = await context.TblSettings
            .AsNoTracking()
            .Where(s => s.SettingId == 1)
            .Select(s => new { s.InternetJobChargeType, s.InternetJobStaffId })
            .FirstOrDefaultAsync(ct);
      
        if(settings is null) return;
        
        resolved.ChargeType = settings.InternetJobChargeType;
        resolved.OperatorId = settings.InternetJobStaffId;
    }

    /// <summary>
    /// Validate client, speed, bookedBy, addresses, type, weight, quantity, references.
    /// Returns null if valid, or the error message string.
    /// </summary>
    private static async Task<string> ValidateAsync(
        DespatchContext context,
        CreateMinimalTucJobInputModel data,
        ResolvedJobData resolved,
        CancellationToken ct)
    {
        // Client validation
        if (resolved.ClientId is null or <= 0)
            return "Invalid Client ID.";

        // BookedBy validation
        if (string.IsNullOrWhiteSpace(data.BookedBy))
            return "Booked By is required.";

        // Speed validation
        if (resolved.SpeedId is null or <= 0)
            return "Invalid Speed.";

        // From address validation
        if (data.FromAddress == null || string.IsNullOrWhiteSpace(data.FromAddress.FullAddress))
            return "From Address is required.";

        // To address validation
        if (data.ToAddress == null || string.IsNullOrWhiteSpace(data.ToAddress.FullAddress))
            return "To Address is required.";

        // Weight validation
        if (resolved.Weight < 0)
            return "Weight cannot be negative.";

        // Quantity validation
        if (resolved.Quantity < 0)
            return "Quantity cannot be negative.";

        // Reference A validation (mandatory check)
        if (resolved.ReferenceAmandatory && string.IsNullOrWhiteSpace(resolved.ClientReferenceA))
            return !string.IsNullOrWhiteSpace(resolved.ReferenceAmessage)
                ? resolved.ReferenceAmessage
                : "Reference A is required.";

        // Reference A defined list check
        if (resolved.ReferenceAdefineList && !string.IsNullOrWhiteSpace(resolved.ClientReferenceA))
        {
            var validRefA = await context.TblReferences
                .AsNoTracking()
                .AnyAsync(r => r.ClientId == resolved.ClientId
                               && r.Grouping == "A"
                               && r.Name == resolved.ClientReferenceA, ct);

            if (!validRefA)
                return $"Reference A '{resolved.ClientReferenceA}' is not in the defined list.";
        }

        // Reference B validation (mandatory check)
        if (resolved.ReferenceBmandatory && string.IsNullOrWhiteSpace(resolved.ClientReferenceB))
            return !string.IsNullOrWhiteSpace(resolved.ReferenceBmessage)
                ? resolved.ReferenceBmessage
                : "Reference B is required.";

        // Reference B defined list check
        if (!resolved.ReferenceBdefineList || string.IsNullOrWhiteSpace(resolved.ClientReferenceB))
            return null; // Valid
        
        var validRefB = await context.TblReferences
            .AsNoTracking()
            .AnyAsync(r => r.ClientId == resolved.ClientId
                           && r.Grouping == "B"
                           && r.Name == resolved.ClientReferenceB, ct);

        return !validRefB ? $"Reference B '{resolved.ClientReferenceB}' is not in the defined list." : null; // Valid
    }

    /// <summary>
    /// Convert recurring days string "1110000" → bitmask, frequency string → bitmask.
    /// </summary>
    private static void ParseRecurringBitmasks(CreateMinimalTucJobInputModel data, ResolvedJobData resolved)
    {
        resolved.RecurringDaysBitmask = ParseBitmask(data.RecurringDays, 7);
        resolved.RecurringFrequencyBitmask = ParseBitmask(data.RecurringFrequency, 5);
    }

    /// <summary>
    /// Converts a binary string (e.g. "1110000") to a bitmask integer.
    /// Each '1' at position i sets bit i in the result.
    /// </summary>
    internal static int? ParseBitmask(string input, int maxBits)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;

        var bitmask = 0;
        for (var i = 0; i < input.Length && i < maxBits; i++)
        {
            if (input[i] == '1')
                bitmask |= 1 << i;
        }
        return bitmask;
    }

    /// <summary>
    /// Normal job insert path — calls DD_stpJob_Excelerator_Insert via scaffolded stored proc.
    /// </summary>
    private static async Task<CreateMinimalTucJobResponse> InsertNormalJobAsync(
        DespatchContext context,
        CreateMinimalTucJobInputModel data,
        ResolvedJobData resolved,
        CancellationToken ct)
    {
        var fromAddress = data.FromAddress;
        var toAddress = data.ToAddress;

        var jobIdOutput = new OutputParameter<int?>();
        var jobNumberOutput = new OutputParameter<string>();
        var amountOutput = new OutputParameter<decimal?> { _value = data.Amount };
        var poaOutput = new OutputParameter<bool?>();

        await context.Procedures.DD_stpJob_Excelerator_InsertAsync(
            type: resolved.TypeId,
            clientID: resolved.ClientId,
            bookdate: data.TenantCurrentTime,
            contact: data.BookedBy,
            chargeType: resolved.ChargeType,
            toCity: toAddress?.AddressLine5,
            toState: toAddress?.AddressLine6,
            toZipCode: SafeParseZipCode(toAddress?.AddressLine7),
            toAddress: toAddress?.FullAddress,
            toStreet: BuildStreet(toAddress),
            toExtra: toAddress?.AddressLine2,
            toCompany: toAddress?.AddressLine1,
            fromCity: fromAddress?.AddressLine5,
            fromState: fromAddress?.AddressLine6,
            fromZipCode: SafeParseZipCode(fromAddress?.AddressLine7),
            fromAddress: fromAddress?.FullAddress,
            fromStreet: BuildStreet(fromAddress),
            fromExtra: fromAddress?.AddressLine2,
            fromCompany: fromAddress?.AddressLine1,
            vehicleSizeID: data.VehicleSizeId,
            qty: resolved.Quantity,
            totalWeight: (double?)resolved.Weight,
            totalDistance: null,
            clientRefa: resolved.ClientReferenceA,
            clientRefb: resolved.ClientReferenceB,
            opID: resolved.OperatorId,
            pickUpFrom: resolved.PickUpFrom,
            notes: resolved.CourierNotes,
            clientNotes: resolved.ClientNotes,
            pickupNotes: data.PickupNotes,
            deliveryNotes: data.DeliveryNotes,
            contactPhone: null,
            service: resolved.JobTypeId,
            fromContact: data.FromContactName,
            fromPhone: data.FromPhoneNumber,
            toContact: data.ToContactName,
            toPhone: data.ToPhoneNumber,
            contactID: resolved.ContactId,
            proofOfDelivery: resolved.ProofOfDelivery.HasValue
                ? resolved.ProofOfDelivery.Value ? 1 : 0
                : null,
            proofOfDeliveryEmail: resolved.ProofOfDeliveryEmail,
            proofOfDeliveryMobile: resolved.ProofOfDeliveryMobile,
            ourRef: data.OurRef,
            speed: resolved.SpeedId,
            parked: data.Hold,
            sigNotRequired: resolved.LeaveNotHomeId,
            pickUpLatitude: data.PickUpLatitude?.ToString(),
            pickUpLongitude: data.PickUpLongitude?.ToString(),
            deliveryLatitude: data.DeliveryLatitude?.ToString(),
            deliveryLongitude: data.DeliveryLongitude?.ToString(),
            sourceId: (int)JobSource.DespatchWeb,
            totalPallets: data.TotalPallets,
            extraStopOffs: null,
            dryIceWeight: data.DryIceWeight,
            cubic: data.Cubic,
            waitTime: null,
            dGClass: data.DgClass,
            dGDocs: data.DgClass.HasValue,
            loggedInContactId: data.LoggedInContactId,
            accessorialChargeGroupId: data.AccessorialChargeGroupId,
            deliverByDateTime: data.DeliverByDateTime,
            pickupTimeZone: data.PickupTimeZone,
            deliverByTimeZone: data.DeliverByTimeZone,
            recurringName: data.RecurringName,
            recurringDays: resolved.RecurringDaysBitmask?.ToString(),
            daysInt: resolved.RecurringDaysBitmask,
            frequencyInt: resolved.RecurringFrequencyBitmask,
            recurringHoliday: null,
            recurringInitialDays: data.RecurringInitialDays,
            courierID: data.AgentCourierId,
            dimensionsType: null,
            jobID: jobIdOutput,
            jobNumber: jobNumberOutput,
            amount: amountOutput,
            pOA: poaOutput,
            cancellationToken: ct
        );

        return new CreateMinimalTucJobResponse
        {
            Success = jobIdOutput.Value.HasValue,
            JobId = jobIdOutput.Value
        };
    }

    /// <summary>
    /// Bulk schedule insert path — calls DD_stpBulkScheduleJob_Insert via scaffolded stored proc.
    /// </summary>
    private static async Task<CreateMinimalTucJobResponse> InsertBulkScheduleJobAsync(
        DespatchContext context,
        CreateMinimalTucJobInputModel data,
        ResolvedJobData resolved,
        CancellationToken ct)
    {
        var fromAddress = data.FromAddress;
        var toAddress = data.ToAddress;

        var jobIdOutput = new OutputParameter<int?>();
        var jobNumberOutput = new OutputParameter<string>();
        var amountOutput = new OutputParameter<decimal?>();

        await context.Procedures.DD_stpBulkScheduleJob_InsertAsync(
            type: resolved.TypeId,
            dateTime: data.TenantCurrentTime,
            clientID: resolved.ClientId,
            contact: data.BookedBy,
            urgentScheduleSpeedID: resolved.SpeedId,
            fromCompany: fromAddress?.AddressLine1,
            fromAddress: fromAddress?.FullAddress,
            fromCity: fromAddress?.AddressLine5,
            fromState: fromAddress?.AddressLine6,
            fromZipCode: SafeParseZipCode(fromAddress?.AddressLine7),
            fromStreet: BuildStreet(fromAddress),
            fromExtra: fromAddress?.AddressLine2,
            fromContact: data.FromContactName,
            fromPhone: data.FromPhoneNumber,
            toCompany: toAddress?.AddressLine1,
            toAddress: toAddress?.FullAddress,
            toCity: toAddress?.AddressLine5,
            toState: toAddress?.AddressLine6,
            toZipCode: SafeParseZipCode(toAddress?.AddressLine7),
            toStreet: BuildStreet(toAddress),
            toExtra: toAddress?.AddressLine2,
            toContact: data.ToContactName,
            toContactPhone: data.ToPhoneNumber,
            vehicleSizeID: data.VehicleSizeId,
            opID: resolved.OperatorId,
            size: (short?)resolved.Size,
            qty: (short?)resolved.Quantity,
            weight: resolved.Weight,
            totalDistance: null,
            courierID: null,
            clientRefa: resolved.ClientReferenceA,
            clientRefb: resolved.ClientReferenceB,
            ourRef: data.OurRef,
            deliverToPrivateBusiness: resolved.DeliverToPrivateBusiness.HasValue
                ? resolved.DeliverToPrivateBusiness.Value > 0
                : null,
            deliverToLeaveID: resolved.DeliverToLeaveId,
            notes: resolved.CourierNotes,
            pickupNotes: data.PickupNotes,
            deliveryNotes: data.DeliveryNotes,
            clientNotes: resolved.ClientNotes,
            remoteJob: null,
            trackingMethod: null,
            trackingEmail: null,
            trackingMobile: null,
            proofOfDelivery: resolved.ProofOfDelivery.HasValue
                ? resolved.ProofOfDelivery.Value ? 1 : 0
                : null,
            proofOfDeliveryMobile: resolved.ProofOfDeliveryMobile,
            proofOfDeliveryEmail: resolved.ProofOfDeliveryEmail,
            pickUpLatitude: data.PickUpLatitude?.ToString(),
            pickUpLongitude: data.PickUpLongitude?.ToString(),
            deliveryLatitude: data.DeliveryLatitude?.ToString(),
            deliveryLongitude: data.DeliveryLongitude?.ToString(),
            prebookJob: null,
            onHold: data.Hold,
            orderRef: data.JobNumber,
            storageState: null,
            deliveryState: null,
            bookFromAddress: null,
            bookFromCompany: null,
            bookFromExtra: null,
            bookFromStreet: null,
            bookFromCity: null,
            bookFromState: null,
            bookFromZipCode: null,
            bookPickUpLatitude: null,
            bookPickUpLongitude: null,
            sourceId: (int)JobSource.DespatchWeb,
            pickupReadyDateTime: null,
            loggedInContactId: data.LoggedInContactId,
            accessorialChargeGroupId: data.AccessorialChargeGroupId,
            courierPercentageOverride: null,
            cubicList: data.CubicList,
            weightList: data.WeightList,
            barcodeList: data.BarcodeList,
            stockSizeId: null,
            deliverByDateTime: data.DeliverByDateTime,
            pickupTimeZone: data.PickupTimeZone,
            deliverByTimeZone: data.DeliverByTimeZone,
            dimensionsType: null,
            jobID: jobIdOutput,
            jobNumber: jobNumberOutput,
            amount: amountOutput,
            cancellationToken: ct
        );

        return new CreateMinimalTucJobResponse
        {
            Success = jobIdOutput.Value.HasValue,
            JobId = jobIdOutput.Value
        };
    }

    private static string BuildStreet(AddressViewModel addr) =>
        addr != null ? (addr.AddressLine3 + " " + addr.AddressLine4).Trim() : null;

    private static int? SafeParseZipCode(string zipCode)
    {
        if (string.IsNullOrWhiteSpace(zipCode) || !int.TryParse(zipCode, out var result))
            return null;
        return result;
    }
}
