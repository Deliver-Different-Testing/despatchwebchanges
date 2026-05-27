using System.Data;
using System.Text;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for creating jobs via the Excelerator flow.
/// Inserts TucJob rows via raw SQL to bypass EF Core's PropagateResults issue
/// caused by tucJob INSERT triggers producing extra result sets.
/// </summary>
public sealed class CreateJobService(
    IDbContextFactory<DespatchContext> contextFactory) : ICreateJobService
{
    /// <inheritdoc />
    public async Task<CreateMinimalTucJobResponse> CreateJobAsync(
        CreateMinimalTucJobInputModel data,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var context = await contextFactory.CreateDbContextAsync(cancellationToken);
            return await CreateJobCoreAsync(data, context, cancellationToken);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error creating job via CreateJobService");
            return new CreateMinimalTucJobResponse { Success = false, Message = ex.Message };
        }
    }

    /// <inheritdoc />
    public async Task<int> InsertJobRawAsync(DespatchContext context, TucJob job, CancellationToken ct)
    {
        // SQLite (used in tests) doesn't have the INSERT trigger that causes
        // PropagateResults to break, so normal EF Core works fine.
        if (context.Database.ProviderName == "Microsoft.EntityFrameworkCore.Sqlite")
        {
            context.TucJobs.Add(job);
            await context.SaveChangesAsync(ct);
            return job.UcjbId;
        }

        var entityType = context.Model.FindEntityType(typeof(TucJob))!;
        var storeObject = StoreObjectIdentifier.Table(entityType.GetTableName()!, entityType.GetSchema());

        var columns = new List<string>();
        var paramNames = new List<string>();
        var parameters = new List<SqlParameter>();

        foreach (var property in entityType.GetProperties())
        {
            // Skip store-generated identity column
            if (property.IsPrimaryKey() && property.ValueGenerated != ValueGenerated.Never)
            {
                continue;
            }

            // Skip shadow properties (no CLR backing member)
            if (property.PropertyInfo == null && property.FieldInfo == null)
            {
                continue;
            }

            // Skip server-computed columns (always overwritten by the database)
            if (property.ValueGenerated == ValueGenerated.OnAddOrUpdate)
            {
                continue;
            }

            var columnName = property.GetColumnName(storeObject);
            if (columnName == null)
            {
                continue;
            }

            var value = property.PropertyInfo?.GetValue(job)
                        ?? property.FieldInfo?.GetValue(job);

            var paramName = $"@p{parameters.Count}";
            columns.Add($"[{columnName}]");
            paramNames.Add(paramName);
            var sqlParam = new SqlParameter(paramName, value ?? DBNull.Value);
            if (property.GetTypeMapping() is RelationalTypeMapping relMapping
                && string.Equals(relMapping.StoreType, "image", StringComparison.OrdinalIgnoreCase))
            {
                sqlParam.SqlDbType = SqlDbType.Image;
            }

            parameters.Add(sqlParam);
        }

        // OUTPUT parameter to capture the new identity without SqlQueryRaw composability issues
        var identityParam = new SqlParameter("@identity", SqlDbType.Int)
        {
            Direction = ParameterDirection.Output
        };
        parameters.Add(identityParam);

        var sql = new StringBuilder();
        sql.Append("SET NOCOUNT ON; INSERT INTO [tucJob] (");
        sql.Append(string.Join(", ", columns));
        sql.Append(") VALUES (");
        sql.Append(string.Join(", ", paramNames));
        sql.Append("); SET @identity = SCOPE_IDENTITY();");

        await context.Database.ExecuteSqlRawAsync(sql.ToString(), parameters.ToArray<object>(), ct);
        return (int)identityParam.Value!;
    }

    private async Task<CreateMinimalTucJobResponse> CreateJobCoreAsync(
        CreateMinimalTucJobInputModel data,
        DespatchContext context,
        CancellationToken cancellationToken)
    {
        var resolved = new ResolvedJobData();

        await ResolveInitialDataAsync(context, data, resolved, cancellationToken);
        await ResolveContactAsync(context, data, resolved, cancellationToken);
        ApplyNullFallbackDefaults(data, resolved);

        var validationError = await ValidateAsync(context, data, resolved, cancellationToken);
        if (validationError != null)
        {
            return new CreateMinimalTucJobResponse { Success = false, Message = validationError };
        }

        ParseRecurringBitmasks(data, resolved);

        var unknownSuburbId = await GetUnknownSuburbIdAsync(context, cancellationToken);
        var job = BuildJobFromInput(data, resolved, unknownSuburbId);

        var jobId = await InsertJobRawAsync(context, job, cancellationToken);

        return new CreateMinimalTucJobResponse
        {
            Success = true,
            JobId = jobId
        };
    }

    /// <summary>
    /// Builds a TucJob entity from the input model and resolved data.
    /// </summary>
    private static TucJob BuildJobFromInput(
        CreateMinimalTucJobInputModel data,
        ResolvedJobData resolved,
        int? unknownSuburbId)
    {
        var bookDate = data.Pickup ?? data.TenantCurrentTime;
        var fromAddress = data.FromAddress;
        var toAddress = data.ToAddress;

        return new TucJob
        {
            UcjbNumber = data.JobNumber,
            UcjbDate = bookDate,
            UcjbTime = bookDate,
            UcjbType = resolved.TypeId,
            UcjbClientId = resolved.ClientId,
            UcjbContact = data.BookedBy,
            UcjbChargeType = resolved.ChargeType,
            UcjbAmount = data.Amount,
            UcjbSpeed = resolved.JobTypeId,
            UcjbFrom = unknownSuburbId,
            UcjbFromAddr = fromAddress?.FullAddress,
            UcjbTo = unknownSuburbId,
            UcjbToAddr = toAddress?.FullAddress,
            UcjbSize = data.VehicleSizeId ?? resolved.Size,
            UcjbQty = (short?)resolved.Quantity,
            UcjbWeight = (double?)resolved.Weight,
            UcjbOpId = resolved.OperatorId,
            UcjbReturn = resolved.ReturnJob ?? false,
            UcjbPickUpFrom = (short?)resolved.PickUpFrom,
            UcjbClientRefa = resolved.ClientReferenceA,
            UcjbClientRefb = resolved.ClientReferenceB,
            UcjbOurRef = data.OurRef,
            UcjbNotes = resolved.CourierNotes,
            ClientNotes = resolved.ClientNotes,
            UcjbClientCode = resolved.ClientCode,
            ContactId = resolved.ContactId,
            DeliverToPrivateBusiness = resolved.DeliverToPrivateBusiness,
            DeliverToLeaveId = resolved.DeliverToLeaveId,
            ProofOfDelivery = resolved.ProofOfDelivery.HasValue
                ? resolved.ProofOfDelivery.Value ? 1 : 0
                : null,
            ProofOfDeliveryEmail = resolved.ProofOfDeliveryEmail,
            ProofOfDeliveryMobile = resolved.ProofOfDeliveryMobile,
            PickUpLatitude = data.PickUpLatitude,
            PickUpLongitude = data.PickUpLongitude,
            DeliveryLatitude = data.DeliveryLatitude,
            DeliveryLongitude = data.DeliveryLongitude,
            SourceId = (int)JobSource.DespatchWeb,
            FuelSurchargeAmount = data.FuelSurchargeAmount ?? 0,
            DryIceWeight = data.DryIceWeight,
            Cubic = (double?)data.Cubic,
            Dgclass = data.DgClass,
            Dgdocument = data.DgClass.HasValue,
            LoggedInContactId = data.LoggedInContactId,
            AccessorialChargeGroupId = data.AccessorialChargeGroupId,
            DeliverByTime = data.DeliverByDateTime,
            UcjbCourierId = data.AgentCourierId,
            DisplayInDespatch = true,
            UcjbVoid = false,
            UcjbJobDone = false,
            UcjbPaged = false,
            DesiredJobTypeId = resolved.JobTypeId,
            PickupAddressLine1 = fromAddress?.AddressLine1,
            PickupAddressLine2 = fromAddress?.AddressLine2,
            PickupAddressLine3 = fromAddress?.AddressLine3,
            PickupAddressLine4 = fromAddress?.AddressLine4,
            PickupAddressLine5 = fromAddress?.AddressLine5,
            PickupAddressLine6 = fromAddress?.AddressLine6,
            PickupAddressLine7 = fromAddress?.AddressLine7,
            PickupAddressLine8 = fromAddress?.AddressLine8,
            DeliveryAddressLine1 = toAddress?.AddressLine1,
            DeliveryAddressLine2 = toAddress?.AddressLine2,
            DeliveryAddressLine3 = toAddress?.AddressLine3,
            DeliveryAddressLine4 = toAddress?.AddressLine4,
            DeliveryAddressLine5 = toAddress?.AddressLine5,
            DeliveryAddressLine6 = toAddress?.AddressLine6,
            DeliveryAddressLine7 = toAddress?.AddressLine7,
            DeliveryAddressLine8 = toAddress?.AddressLine8,
            PickupFromContact = data.FromContactName,
            PickupFromPhone = data.FromPhoneNumber,
            DeliverToContact = data.ToContactName,
            DeliverToPhone = data.ToPhoneNumber,
            ScheduleName = data.RecurringName,
            IsRecurringJob = !string.IsNullOrWhiteSpace(data.RecurringName)
        };
    }

    /// <summary>
    /// Returns the "Unknown" suburb ID used as fallback.
    /// Mirrors DD_stpJob_Excelerator_Insert: SELECT SuburbID FROM tblSuburb WHERE Name = N'Unknown'
    /// </summary>
    private static async Task<int?> GetUnknownSuburbIdAsync(DespatchContext context, CancellationToken ct) =>
        await context.TucSuburbs
            .Where(s => s.UcsuName == "Unknown")
            .Select(s => (int?)s.UcsuId)
            .FirstOrDefaultAsync(ct);

    /// <summary>
    /// 2G: Combined client + defaults + settings lookup (saves 2 roundtrips per call).
    /// Parses Type, looks up client with defaults and settings in a single projected query,
    /// then handles bulk schedule detection and speed/job type resolution separately (conditional).
    /// </summary>
    private static async Task ResolveInitialDataAsync(
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

        // Parse input-derived values BEFORE defaults (so ??= in defaults respects input precedence)
        resolved.AddressType = ParseAddressType(data.ToAddressType);
        resolved.ProofOfDelivery = ParseProofOfDelivery(data);
        resolved.ProofOfDeliveryEmail = data.JobNotificationEmail;
        resolved.ProofOfDeliveryMobile = data.JobNotificationMobile;

        if (!string.IsNullOrWhiteSpace(data.JobNotificationType))
        {
            resolved.ProofOfDeliveryType = data.JobNotificationType.ToUpperInvariant() switch
            {
                "EMAIL" => 1,
                "SMS" => 2,
                "BOTH" => 3,
                _ => null
            };
        }

        // Combined client + defaults + settings query (single roundtrip).
        // Uses LEFT JOIN for defaults and scalar subqueries for settings to avoid SQL APPLY.
        if (data.ClientId > 0)
        {
            var initialData = await (
                from c in context.TucClients
                where c.UcclId == data.ClientId
                join d in context.TblJobDefaults on c.UcclCode equals d.Code into defaults
                from d in defaults.DefaultIfEmpty()
                select new
                {
                    ClientId = c.UcclId,
                    c.UcclGroupId,
                    c.UcclCode,
                    c.ReferenceAmandatory,
                    c.ReferenceAdefineList,
                    c.ReferenceAmessage,
                    c.ReferenceBmandatory,
                    c.ReferenceBdefineList,
                    c.ReferenceBmessage,
                    // Defaults (null when no matching row via LEFT JOIN)
                    HasDefaults = d != null,
                    DefaultContact = d!.Contact,
                    DefaultContactId = d.ContactId,
                    DefaultJobTypeId = d.JobTypeId,
                    DefaultDeliverToPrivateBusiness = d.DeliverToPrivateBusiness,
                    DefaultClientReferenceA = d.ClientReferenceA,
                    DefaultClientReferenceB = d.ClientReferenceB,
                    DefaultSize = d.Size,
                    DefaultWeight = d.Weight,
                    DefaultQuantity = d.Quantity,
                    DefaultCourierNotes = d.CourierNotes,
                    DefaultClientNotes = d.ClientNotes,
                    DefaultPickUpFrom = d.PickUpFrom,
                    DefaultDeliverToLeaveId = d.DeliverToLeaveId,
                    DefaultProofOfDelivery = d.ProofOfDelivery,
                    DefaultProofOfDeliveryEmail = d.ProofOfDeliveryEmail,
                    DefaultProofOfDeliveryMobile = d.ProofOfDeliveryMobile,
                    DefaultRtnJob = d.RtnJob,
                    DefaultType = d.Type,
                    // Settings as scalar subqueries
                    InternetJobChargeType = context.TblSettings
                        .Where(s => s.SettingId == 1).Select(s => s.InternetJobChargeType).FirstOrDefault(),
                    InternetJobStaffId = context.TblSettings
                        .Where(s => s.SettingId == 1).Select(s => s.InternetJobStaffId).FirstOrDefault()
                }).FirstOrDefaultAsync(ct);

            if (initialData != null)
            {
                resolved.ClientId = initialData.ClientId;
                resolved.ClientGroupId = initialData.UcclGroupId;
                resolved.ClientCode = initialData.UcclCode;
                resolved.ReferenceAmandatory = initialData.ReferenceAmandatory;
                resolved.ReferenceAdefineList = initialData.ReferenceAdefineList;
                resolved.ReferenceAmessage = initialData.ReferenceAmessage;
                resolved.ReferenceBmandatory = initialData.ReferenceBmandatory;
                resolved.ReferenceBdefineList = initialData.ReferenceBdefineList;
                resolved.ReferenceBmessage = initialData.ReferenceBmessage;

                // Apply client defaults (LEFT JOIN — fields are null when no defaults row)
                if (initialData.HasDefaults)
                {
                    resolved.Contact ??= initialData.DefaultContact;
                    resolved.ContactId ??= initialData.DefaultContactId;
                    resolved.JobTypeId ??= initialData.DefaultJobTypeId;
                    resolved.DeliverToPrivateBusiness ??= initialData.DefaultDeliverToPrivateBusiness;
                    resolved.ClientReferenceA ??= initialData.DefaultClientReferenceA;
                    resolved.ClientReferenceB ??= initialData.DefaultClientReferenceB;
                    resolved.Size ??= initialData.DefaultSize;
                    resolved.Weight ??= (decimal?)initialData.DefaultWeight;
                    resolved.Quantity ??= initialData.DefaultQuantity;
                    resolved.CourierNotes ??= initialData.DefaultCourierNotes;
                    resolved.ClientNotes ??= initialData.DefaultClientNotes;
                    resolved.PickUpFrom ??= initialData.DefaultPickUpFrom;
                    resolved.DeliverToLeaveId ??= initialData.DefaultDeliverToLeaveId;
                    resolved.ProofOfDelivery ??= initialData.DefaultProofOfDelivery is > 0;
                    resolved.ProofOfDeliveryEmail ??= initialData.DefaultProofOfDeliveryEmail;
                    resolved.ProofOfDeliveryMobile ??= initialData.DefaultProofOfDeliveryMobile;
                    resolved.ReturnJob ??= initialData.DefaultRtnJob;

                    if (string.IsNullOrWhiteSpace(data.Type) && initialData.DefaultType.HasValue)
                    {
                        resolved.TypeId = initialData.DefaultType.Value;
                    }
                }

                // Apply settings (scalar subqueries)
                resolved.ChargeType = initialData.InternetJobChargeType;
                resolved.OperatorId = initialData.InternetJobStaffId;
            }
        }
        else
        {
            // No client — still need settings
            var settings = await context.TblSettings
                .Where(s => s.SettingId == 1)
                .Select(s => new { s.InternetJobChargeType, s.InternetJobStaffId })
                .FirstOrDefaultAsync(ct);

            if (settings != null)
            {
                resolved.ChargeType = settings.InternetJobChargeType;
                resolved.OperatorId = settings.InternetJobStaffId;
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
                .Where(jt => jt.SystemName == data.Speed && jt.WebServiceEntry)
                .Select(jt => new { jt.UcjtId })
                .FirstOrDefaultAsync(ct);

            resolved.JobTypeId = jobType?.UcjtId;
        }

        // If we have a SpeedId but no JobTypeId resolved yet, use SpeedId directly as job type ID
        if (!resolved.JobTypeId.HasValue && resolved.SpeedId.HasValue && !resolved.IsBulkSchedule)
        {
            resolved.JobTypeId = resolved.SpeedId;
        }
    }

    private static int? ParseAddressType(string toAddressType)
    {
        if (string.IsNullOrWhiteSpace(toAddressType))
        {
            return null;
        }

        return toAddressType.ToUpperInvariant() switch
        {
            "PRIVATE" or "RESIDENTIAL" => 1,
            "BUSINESS" or "COMMERCIAL" => 0,
            _ => int.TryParse(toAddressType, out var val) ? val : null
        };
    }

    private static bool? ParseProofOfDelivery(CreateMinimalTucJobInputModel data)
    {
        if (!string.IsNullOrWhiteSpace(data.JobNotificationType))
        {
            return true;
        }

        return null; // Set by client defaults
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
        if (string.IsNullOrWhiteSpace(data.BookedBy) || !resolved.ClientId.HasValue)
        {
            return;
        }

        // Find the contact by matching BookedBy to contact first/last name via TucClientContact table
        var contact = await context.TucClientContacts
            .Where(c => c.UcctClientId == resolved.ClientId
                        && c.UcctFirstname + " " + c.UcctSurname == data.BookedBy)
            .Select(c => new { c.UcctId })
            .FirstOrDefaultAsync(ct);

        if (contact == null)
        {
            return;
        }

        // Look up the client-contact defaults
        var clientContact = await context.TblClientContacts
            .Where(cc => cc.ClientId == resolved.ClientId && cc.ContactId == contact.UcctId)
            .FirstOrDefaultAsync(ct);

        if (clientContact == null)
        {
            return;
        }

        resolved.ContactId ??= clientContact.ContactId;

        // Apply contact-level defaults (only where not already set)
        if (!string.IsNullOrWhiteSpace(clientContact.DefaultJobSpeed) && !resolved.JobTypeId.HasValue)
        {
            // Look up the speed from the default name
            var speedType = await context.TucJobTypes
                .Where(jt => jt.UcjtName == clientContact.DefaultJobSpeed && jt.WebServiceEntry)
                .Select(jt => new { jt.UcjtId })
                .FirstOrDefaultAsync(ct);

            if (speedType != null)
            {
                resolved.JobTypeId = speedType.UcjtId;
            }
        }

        if (clientContact.DefaultPod.HasValue && !resolved.ProofOfDelivery.HasValue)
        {
            resolved.ProofOfDelivery = clientContact.DefaultPod > 0;
            resolved.ProofOfDeliveryType = clientContact.DefaultPod;
        }

        if (!string.IsNullOrWhiteSpace(clientContact.DefaultPodemail))
        {
            resolved.ProofOfDeliveryEmail ??= clientContact.DefaultPodemail;
        }

        if (!string.IsNullOrWhiteSpace(clientContact.DefaultPodphone))
        {
            resolved.ProofOfDeliveryMobile ??= clientContact.DefaultPodphone;
        }
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
        {
            resolved.ClientReferenceA = data.Reference;
        }

        if (!string.IsNullOrWhiteSpace(data.ReferenceB))
        {
            resolved.ClientReferenceB = data.ReferenceB;
        }

        if (data.PrivateRes.HasValue)
        {
            resolved.DeliverToPrivateBusiness = data.PrivateRes.Value ? 1 : 0;
        }
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
        {
            return "Invalid Client ID.";
        }

        // BookedBy validation
        if (string.IsNullOrWhiteSpace(data.BookedBy))
        {
            return "Booked By is required.";
        }

        // Speed validation
        if (resolved.SpeedId is null or <= 0)
        {
            return "Invalid Speed.";
        }

        // From address validation
        if (data.FromAddress == null || string.IsNullOrWhiteSpace(data.FromAddress.FullAddress))
        {
            return "From Address is required.";
        }

        // To address validation
        if (data.ToAddress == null || string.IsNullOrWhiteSpace(data.ToAddress.FullAddress))
        {
            return "To Address is required.";
        }

        // Weight validation
        if (resolved.Weight < 0)
        {
            return "Weight cannot be negative.";
        }

        // Quantity validation
        if (resolved.Quantity < 0)
        {
            return "Quantity cannot be negative.";
        }

        // Reference A validation (mandatory check)
        if (resolved.ReferenceAmandatory && string.IsNullOrWhiteSpace(resolved.ClientReferenceA))
        {
            return !string.IsNullOrWhiteSpace(resolved.ReferenceAmessage)
                ? resolved.ReferenceAmessage
                : "Reference A is required.";
        }

        // Reference B validation (mandatory check) — checked before defined list queries
        if (resolved.ReferenceBmandatory && string.IsNullOrWhiteSpace(resolved.ClientReferenceB))
        {
            return !string.IsNullOrWhiteSpace(resolved.ReferenceBmessage)
                ? resolved.ReferenceBmessage
                : "Reference B is required.";
        }

        // 2I: Combine reference A + B defined list validation into one query (saves 0-1 roundtrip)
        var needRefA = resolved.ReferenceAdefineList && !string.IsNullOrWhiteSpace(resolved.ClientReferenceA);
        var needRefB = resolved.ReferenceBdefineList && !string.IsNullOrWhiteSpace(resolved.ClientReferenceB);

        if (!needRefA && !needRefB)
        {
            return null; // Valid
        }

        var matchedGroups = await context.TblReferences
            .Where(r => r.ClientId == resolved.ClientId && (
                (r.Grouping == "A" && r.Name == resolved.ClientReferenceA) ||
                (r.Grouping == "B" && r.Name == resolved.ClientReferenceB)))
            .Select(r => r.Grouping).ToListAsync(ct);

        // Return errors in same order (A before B) for consistent behaviour
        if (needRefA && !matchedGroups.Contains("A"))
        {
            return $"Reference A '{resolved.ClientReferenceA}' is not in the defined list.";
        }

        if (needRefB && !matchedGroups.Contains("B"))
        {
            return $"Reference B '{resolved.ClientReferenceB}' is not in the defined list.";
        }

        return null; // Valid
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
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        var bitmask = 0;
        for (var i = 0; i < input.Length && i < maxBits; i++)
        {
            if (input[i] == '1')
            {
                bitmask |= 1 << i;
            }
        }

        return bitmask;
    }

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
}