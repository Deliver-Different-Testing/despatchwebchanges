#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Reporting;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Splits a parent job into pickup and delivery child legs.
/// Child rows are inserted via raw SQL to work around tucJob INSERT triggers
/// that break EF Core's PropagateResults identity read-back.
/// </summary>
public class SplitJobService(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService tenantInfoService,
    ITenantClock tenantClock,
    IRateJobService rateJobService,
    IJobQueryRepository jobRepository,
    IJobCommandRepository jobCommandRepository,
    ICreateJobService createJobService) : ISplitJobService
{
    private const string ParentSystemName = "SplitParent";
    private const string ChildSystemName = "SplitChild";
    private const int HandOffLeaveType = 23;
    private const int PrivateResidenceDeliverTo = 1;

    /// <inheritdoc />
    public async Task<(int PickupJobId, int DeliveryJobId)> SplitJobAsync(
        int jobId,
        string userName,
        AddressViewModel meetingPointAddress,
        int? courierIdForLegB = null,
        IReadOnlyList<SplitPricingAllocationItem>? pricingAllocation = null,
        CancellationToken ct = default)
    {
        await using var context = await contextFactory.CreateDbContextAsync(ct);

        var strategy = context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await context.Database.BeginTransactionAsync(ct);

            try
            {
                Log.Information("Splitting job {JobId} by user {UserName} with meeting point address",
                    jobId, userName);

                // Load the parent job (no speed navigation needed — we use UcjbSpeed directly)
                var job = await context.TucJobs
                              .AsTracking()
                              .FirstOrDefaultAsync(j => j.UcjbId == jobId, ct)
                          ?? throw new InvalidOperationException($"Job {jobId} not found");

                var (parentRelTypeId, childRelTypeId) = await GetRelationshipTypeIdsAsync(context, ct);

                var hasFlightAssigned = await context.TucJobNationwides.AnyAsync(n => n.UcnwJobId == jobId, ct);
                if (hasFlightAssigned)
                {
                    throw new InvalidOperationException($"Job {jobId} has flights assigned and cannot be split");
                }

                var parentJobCourierId = await GetParentJobCourierIdAsync(context, ct);

                // Generate child job numbers using letter suffixes (no SP = no speed suffix appended)
                var childNumbers = await GenerateChildJobNumbersAsync(context, job, ct);
                var (pickupJobNumber, deliveryJobNumber) =
                    (childNumbers.PickupJobNumber, childNumbers.DeliveryJobNumber);

                // For US tenants, the tucJob INSERT triggers require non-null suburb IDs
                // (UTL_fncFuelSurcharge_InclusiveAmount, UTL_fncJob_IsValid, etc.).
                // Mirror DD_stpJob_Excelerator_Insert which uses the "Unknown" suburb as fallback.
                var meetingPointSuburbId = await GetUnknownSuburbIdAsync(context, ct);

                // Capture original courier ID before modifying parent
                var originalCourierId = job.UcjbCourierId;

                // Determine root parent ID - preserve existing if job is already a child
                var rootParentId = job.RootParentId ?? job.UcjbId;

                // Current tenant time
                var currentTenantTime = tenantClock.TenantNow;

                // Update parent job
                job.JobRelationshipTypeId = parentRelTypeId;
                job.UcjbCourierId = parentJobCourierId;
                if (!job.ParentId.HasValue || job.ParentId == job.UcjbId)
                {
                    job.ParentId = jobId;
                }

                job.RootParentId ??= jobId;
                job.InformationParentId ??= job.RootParentId;
                job.DisplayInDespatch = false;

                // Build pickup child job via direct entity insert
                var pickupJob = BuildChildJob(job, pickupJobNumber, childRelTypeId, rootParentId, 1);
                pickupJob.CreatedTimeUtc = tenantClock.UtcNow;
                pickupJob.UcjbCourierId = originalCourierId;
                pickupJob.UcjbDispTime = currentTenantTime;
                pickupJob.UcjbDispDate = currentTenantTime;
                pickupJob.UcjbDispId = job.UcjbDispId;
                pickupJob.UcjbFrom = job.UcjbFrom;
                pickupJob.UcjbFromAddr = job.UcjbFromAddr;
                pickupJob.UcjbTo = meetingPointSuburbId;
                pickupJob.UcjbToAddr = meetingPointAddress.FullAddress;
                pickupJob.DeliverToPrivateBusiness = PrivateResidenceDeliverTo;
                pickupJob.DeliverToLeaveId = HandOffLeaveType;
                pickupJob.FromAirportId = job.FromAirportId;
                pickupJob.ToAirportId = null;
                pickupJob.UcjbAttention = job.UcjbAttention;
                pickupJob.PickupFromContact = job.PickupFromContact;
                pickupJob.PickupFromPhone = job.PickupFromPhone;
                pickupJob.PickupAddressLine1 = job.PickupAddressLine1;
                pickupJob.PickupAddressLine2 = job.PickupAddressLine2;
                pickupJob.PickupAddressLine3 = job.PickupAddressLine3;
                pickupJob.PickupAddressLine4 = job.PickupAddressLine4;
                pickupJob.PickupAddressLine5 = job.PickupAddressLine5;
                pickupJob.PickupAddressLine6 = job.PickupAddressLine6;
                pickupJob.PickupAddressLine7 = job.PickupAddressLine7;
                pickupJob.PickupAddressLine8 = job.PickupAddressLine8;
                pickupJob.PickUpLatitude = job.PickUpLatitude;
                pickupJob.PickUpLongitude = job.PickUpLongitude;
                pickupJob.DeliveryAddressLine1 = meetingPointAddress.AddressLine1;
                pickupJob.DeliveryAddressLine2 = meetingPointAddress.AddressLine2;
                pickupJob.DeliveryAddressLine3 = meetingPointAddress.AddressLine3;
                pickupJob.DeliveryAddressLine4 = meetingPointAddress.AddressLine4;
                pickupJob.DeliveryAddressLine5 = meetingPointAddress.AddressLine5;
                pickupJob.DeliveryAddressLine6 = meetingPointAddress.AddressLine6;
                pickupJob.DeliveryAddressLine7 = meetingPointAddress.AddressLine7;
                pickupJob.DeliveryAddressLine8 = meetingPointAddress.AddressLine8;
                pickupJob.DeliveryLatitude = meetingPointAddress.Latitude;
                pickupJob.DeliveryLongitude = meetingPointAddress.Longitude;

                // Build delivery child job via direct entity insert
                var deliveryJob = BuildChildJob(job, deliveryJobNumber, childRelTypeId, rootParentId, 2);
                deliveryJob.CreatedTimeUtc = tenantClock.UtcNow;
                deliveryJob.UcjbCourierId = courierIdForLegB;
                if (courierIdForLegB.HasValue)
                {
                    deliveryJob.UcjbDispTime = currentTenantTime;
                    deliveryJob.UcjbDispDate = currentTenantTime;
                    deliveryJob.UcjbDispId = job.UcjbDispId;
                }

                deliveryJob.UcjbFrom = meetingPointSuburbId;
                deliveryJob.UcjbFromAddr = meetingPointAddress.FullAddress;
                deliveryJob.UcjbTo = job.UcjbTo;
                deliveryJob.UcjbToAddr = job.UcjbToAddr;
                deliveryJob.DeliverToPrivateBusiness = job.DeliverToPrivateBusiness;
                deliveryJob.DeliverToLeaveId = job.DeliverToLeaveId;
                deliveryJob.FromAirportId = null;
                deliveryJob.ToAirportId = job.ToAirportId;
                deliveryJob.DeliverToContact = job.DeliverToContact;
                deliveryJob.DeliverToPhone = job.DeliverToPhone;
                deliveryJob.PickupAddressLine1 = meetingPointAddress.AddressLine1;
                deliveryJob.PickupAddressLine2 = meetingPointAddress.AddressLine2;
                deliveryJob.PickupAddressLine3 = meetingPointAddress.AddressLine3;
                deliveryJob.PickupAddressLine4 = meetingPointAddress.AddressLine4;
                deliveryJob.PickupAddressLine5 = meetingPointAddress.AddressLine5;
                deliveryJob.PickupAddressLine6 = meetingPointAddress.AddressLine6;
                deliveryJob.PickupAddressLine7 = meetingPointAddress.AddressLine7;
                deliveryJob.PickupAddressLine8 = meetingPointAddress.AddressLine8;
                deliveryJob.PickUpLatitude = meetingPointAddress.Latitude;
                deliveryJob.PickUpLongitude = meetingPointAddress.Longitude;
                deliveryJob.DeliveryAddressLine1 = job.DeliveryAddressLine1;
                deliveryJob.DeliveryAddressLine2 = job.DeliveryAddressLine2;
                deliveryJob.DeliveryAddressLine3 = job.DeliveryAddressLine3;
                deliveryJob.DeliveryAddressLine4 = job.DeliveryAddressLine4;
                deliveryJob.DeliveryAddressLine5 = job.DeliveryAddressLine5;
                deliveryJob.DeliveryAddressLine6 = job.DeliveryAddressLine6;
                deliveryJob.DeliveryAddressLine7 = job.DeliveryAddressLine7;
                deliveryJob.DeliveryAddressLine8 = job.DeliveryAddressLine8;
                deliveryJob.DeliveryLatitude = job.DeliveryLatitude;
                deliveryJob.DeliveryLongitude = job.DeliveryLongitude;

                // Save the parent update first (UPDATE doesn't hit the identity read-back issue)
                await context.SaveChangesAsync(ct);

                // INSERT child jobs via raw SQL — tucJob INSERT triggers produce extra
                // result sets that break EF Core's PropagateResults identity read-back.
                pickupJob.UcjbId = await createJobService.InsertJobRawAsync(context, pickupJob, ct);
                deliveryJob.UcjbId = await createJobService.InsertJobRawAsync(context, deliveryJob, ct);

                // Create notes (requires child job IDs)
                await CreateSplitJobNotesAsync(context, pickupJob.UcjbId, deliveryJob.UcjbId, job.UcjbNotes, ct);

                // Consolidate MARS information
                await ConsolidateMarsInformationAsync(context, jobId, userName, ct);

                // Divide the parent's pricing lines across the two legs inside the transaction, so
                // each leg carries its own itemised breakdown before commit. A rating failure rolls
                // back the whole split — better than committing two children at the full parent
                // amount and double-charging the client.
                await AllocateSplitPricingAsync(
                    context,
                    job,
                    (pickupJob, childNumbers.PickupSuffix),
                    (deliveryJob, childNumbers.DeliverySuffix),
                    pricingAllocation,
                    ct);

                await transaction.CommitAsync(ct);

                Log.Information("Successfully split job {JobId} into pickup {PickupId} and delivery {DeliveryId}",
                    jobId, pickupJob.UcjbId, deliveryJob.UcjbId);

                return (pickupJob.UcjbId, deliveryJob.UcjbId);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                Log.Error(ex, "Error splitting job {JobId}", jobId);
                throw;
            }
        });
    }

    /// <inheritdoc />
    public async Task PropagateUpdateToChildrenAsync(
        int parentJobId,
        JobProperty field,
        string value,
        CancellationToken ct = default)
    {
        await using var context = await contextFactory.CreateDbContextAsync(ct);

        var parentInfo = await context.TucJobs
            .Where(j => j.UcjbId == parentJobId)
            .Select(j => new
            {
                j.JobRelationshipTypeId,
                j.RootParentId,
                j.UcjbAmount,
                j.UcjbVoid
            })
            .FirstOrDefaultAsync(ct);

        if (parentInfo is null)
        {
            Log.Information(
                "Propagate skipped — parent {ParentJobId} not found: field {Field}",
                parentJobId, field);
            return;
        }

        switch (parentInfo.JobRelationshipTypeId)
        {
            case (int)JobRelationshipTypes.SplitParent:
                // Split job: one fixed total divided across the legs.
                await PropagateUpdateToSplitChildrenAsync(
                    context, parentJobId, parentInfo.RootParentId, parentInfo.UcjbAmount ?? 0m, field, value, ct);
                break;
            case (int)JobRelationshipTypes.Multi:
                // Multi-drop: each part is priced on its own, so the total moves with the change.
                await ReRateMultiPartsAsync(context, parentJobId, field, ct);
                break;
            default:
                Log.Information(
                    "Propagate skipped — parent {ParentJobId} relType={RelType} (not Split=8/Multi=7), void={IsVoid}, field {Field}",
                    parentJobId, parentInfo.JobRelationshipTypeId, parentInfo.UcjbVoid, field);
                break;
        }
    }

    /// <summary>
    /// Split-job propagation: copies the field to every non-void child and redistributes the
    /// parent's fixed total proportionally across the children based on recalculated rates.
    /// </summary>
    private async Task PropagateUpdateToSplitChildrenAsync(
        DespatchContext context,
        int parentJobId,
        int? rootParentIdRaw,
        decimal parentAmount,
        JobProperty field,
        string value,
        CancellationToken ct)
    {
        var rootParentId = rootParentIdRaw ?? parentJobId;

        var childJobIds = await context.TucJobs
            .Where(j => j.RootParentId == rootParentId && j.UcjbId != rootParentId && !j.UcjbVoid)
            .OrderBy(j => j.Sequence)
            .Select(j => j.UcjbId)
            .ToListAsync(ct);

        if (childJobIds.Count == 0)
        {
            Log.Information(
                "Propagate skipped — no non-void children of parent {ParentJobId} (root {RootParentId}), field {Field}",
                parentJobId, rootParentId, field);
            return;
        }

        Log.Information(
            "Propagate starting — parent {ParentJobId}, {ChildCount} child(ren) {ChildJobIds}, field {Field}",
            parentJobId, childJobIds.Count, childJobIds, field);

        // Propagate the field update to each child job
        var failures = 0;
        foreach (var childId in childJobIds)
        {
            try
            {
                await jobCommandRepository.UpdateJobAsync(childId, field, value);
            }
            catch (Exception ex)
            {
                failures++;
                Log.Warning(ex, "Failed to propagate {Field} update to child job {ChildId}", field, childId);
            }
        }

        Log.Information(
            "Propagate finished — parent {ParentJobId}, field {Field}, {SuccessCount}/{ChildCount} children updated",
            parentJobId, field, childJobIds.Count - failures, childJobIds.Count);

        // Redistribute the parent's current amount across its immediate children
        await ReRateSplitJobsAsync(context, parentJobId, parentAmount, ct);
    }

    /// <summary>
    /// Re-rates every part of a Multi (multi-drop) job independently after a rate-affecting field
    /// change on the parent. Unlike split jobs — where one fixed parent total is re-divided — each
    /// multi-drop part is priced on its own, so the total moves with the new vehicle/speed/etc.
    /// The field value is already written to every part by the preceding entity update (e.g.
    /// <c>UpdateJobSize</c>), so we only need to recompute prices here. Parts flagged
    /// <c>RatedManually</c> are left untouched so manual overrides are preserved.
    /// </summary>
    private async Task ReRateMultiPartsAsync(
        DespatchContext context,
        int parentJobId,
        JobProperty field,
        CancellationToken ct)
    {
        // The parent leg plus all its non-void children — every part is an independently priced job.
        // Manually-rated parts are excluded so we never clobber a hand-set price.
        var partIds = await context.TucJobs
            .Where(j => (j.UcjbId == parentJobId || j.ParentId == parentJobId) && !j.UcjbVoid && !j.RatedManually)
            .OrderBy(j => j.Sequence)
            .Select(j => j.UcjbId)
            .ToListAsync(ct);

        if (partIds.Count == 0)
        {
            Log.Information(
                "Re-rate skipped — multi parent {ParentJobId} has no rateable parts, field {Field}",
                parentJobId, field);
            return;
        }

        var isUs = tenantInfoService.IsUsTenant();
        var succeeded = 0;

        // Re-rate each part independently. A single part failing must not strand the others, but a
        // mis-priced part is a real problem, so failures are logged loudly rather than swallowed.
        foreach (var partId in partIds)
        {
            try
            {
                if (isUs)
                {
                    var details = await jobRepository.GetJobDetailsForRatingAsync(partId);
                    await rateJobService.RateJobUsAsync(details);
                }
                else
                {
                    var isArchived = await jobRepository.IsJobArchived(partId);
                    var details = await jobRepository.GetJobDetailsForRatingNzAsync(partId, isArchived);
                    await rateJobService.RateJobNzAsync(details);
                }

                succeeded++;
            }
            catch (Exception ex)
            {
                Log.Error(ex,
                    "Failed to re-rate multi part {PartId} of parent {ParentJobId}, field {Field}",
                    partId, parentJobId, field);
            }
        }

        Log.Information(
            "Re-rated multi parts of parent {ParentJobId}, field {Field}, {SuccessCount}/{PartCount} parts",
            parentJobId, field, succeeded, partIds.Count);
    }

    /// <summary>
    /// Creates a child TucJob entity with all common fields copied from the parent.
    /// Address fields and courier/status overrides are set by the caller.
    /// </summary>
    private static TucJob BuildChildJob(
        TucJob parent,
        string jobNumber,
        int childRelTypeId,
        int rootParentId,
        int sequence) =>
        new()
        {
            UcjbNumber = jobNumber,
            UcjbDate = parent.UcjbDate,
            UcjbTime = parent.UcjbTime,
            UcjbType = parent.UcjbType,
            UcjbContact = parent.UcjbContact,
            UcjbChargeType = parent.UcjbChargeType,
            UcjbSize = parent.UcjbSize,
            UcjbQty = parent.UcjbQty,
            UcjbCbd = parent.UcjbCbd,
            UcjbWeight = parent.UcjbWeight,
            UcjbSpeed = parent.UcjbSpeed,
            UcjbClientId = parent.UcjbClientId,
            // Children start at 0 — ReRateSplitJobsAsync redistributes the parent amount
            // proportionally before the split transaction commits. Initialising at the parent
            // amount would silently double-charge if re-rate failed.
            UcjbAmount = 0m,
            UcjbStatus = parent.UcjbStatus,
            UcjbOpId = parent.UcjbOpId,
            UcjbReturn = parent.UcjbReturn,
            UcjbPickUpFrom = parent.UcjbPickUpFrom,
            UcjbClientRefa = parent.UcjbClientRefa,
            UcjbClientRefb = parent.UcjbClientRefb,
            UcjbOurRef = parent.UcjbOurRef,
            ClientNotes = parent.ClientNotes,
            UcjbContactPhone = parent.UcjbContactPhone,
            ContactId = parent.ContactId,
            ProofOfDelivery = parent.ProofOfDelivery,
            ProofOfDeliveryEmail = parent.ProofOfDeliveryEmail,
            ProofOfDeliveryMobile = parent.ProofOfDeliveryMobile,
            AcceptedJobTypeId = parent.AcceptedJobTypeId,
            DesiredJobTypeId = parent.DesiredJobTypeId,
            Direct = parent.Direct,
            JobRelationshipTypeId = childRelTypeId,
            DisplayInDespatch = true,
            ShopId = parent.ShopId,
            ShopRef1 = parent.ShopRef1,
            ShopRef2 = parent.ShopRef2,
            ShopRef3 = parent.ShopRef3,
            ShopRef4 = parent.ShopRef4,
            ShopRef5 = parent.ShopRef5,
            CourierPercentageOverride = parent.CourierPercentageOverride,
            UcjbClientCode = parent.UcjbClientCode,
            UcjbVoid = false,
            UcjbJobDone = false,
            UcjbPaged = false,
            SaturdayDelivery = parent.SaturdayDelivery,
            Dgdocument = parent.Dgdocument,
            Dgclass = parent.Dgclass,
            DryIceWeight = parent.DryIceWeight,
            InternalStatus = parent.InternalStatus,
            PickupTimeZoneId = parent.PickupTimeZoneId,
            DeliverByTimeZoneId = parent.DeliverByTimeZoneId,
            DeliverByTime = parent.DeliverByTime,
            FuelSurchargeAmount = 0,
            CourierFuel = 0,
            TotalDistance = null,
            ParentId = parent.UcjbId,
            RootParentId = rootParentId,
            InformationParentId = rootParentId,
            Sequence = sequence,
            UcjbVan = parent.UcjbVan,
            Truck = parent.Truck,
            TruckStartTime = parent.TruckStartTime,
            TruckHours = parent.TruckHours
        };

    private static async Task<(int ParentRelTypeId, int ChildRelTypeId)> GetRelationshipTypeIdsAsync(
        DespatchContext context,
        CancellationToken ct)
    {
        var relTypes = await context.TblJobRelationshipTypes
            .Where(r => r.SystemName == ParentSystemName || r.SystemName == ChildSystemName)
            .Select(r => new { r.SystemName, r.JobRelationshipTypeId })
            .ToListAsync(ct);

        var parentRelTypeId = relTypes.FirstOrDefault(r => r.SystemName == ParentSystemName)?.JobRelationshipTypeId
                              ?? throw new InvalidOperationException(
                                  $"Job relationship type '{ParentSystemName}' not found");

        var childRelTypeId = relTypes.FirstOrDefault(r => r.SystemName == ChildSystemName)?.JobRelationshipTypeId
                             ?? throw new InvalidOperationException(
                                 $"Job relationship type '{ChildSystemName}' not found");

        return (parentRelTypeId, childRelTypeId);
    }

    private static async Task<int?> GetParentJobCourierIdAsync(
        DespatchContext context,
        CancellationToken ct) =>
        await context.TblSettings
            .Where(s => s.SettingId == 1)
            .Select(s => s.ParentJobCourierId != null
                         && context.TucCouriers.Any(c => c.UccrId == s.ParentJobCourierId)
                ? s.ParentJobCourierId
                : null)
            .FirstOrDefaultAsync(ct);

    /// <summary>
    /// Returns the "Unknown" suburb ID used as fallback for US tenants.
    /// Mirrors DD_stpJob_Excelerator_Insert: SELECT SuburbID FROM tblSuburb WHERE Name = N'Unknown'
    /// </summary>
    private static async Task<int?> GetUnknownSuburbIdAsync(DespatchContext context, CancellationToken ct) =>
        await context.TucSuburbs
            .Where(s => s.UcsuName == "Unknown")
            .Select(s => (int?)s.UcsuId)
            .FirstOrDefaultAsync(ct);

    private async Task CreateSplitJobNotesAsync(
        DespatchContext context,
        int pickupJobId,
        int deliveryJobId,
        string parentNotes,
        CancellationToken ct)
    {
        var staffId = tenantInfoService.GetStaffId();
        var now = tenantClock.UtcNow;
        var parentNotesText = string.IsNullOrWhiteSpace(parentNotes) ? string.Empty : $"  {parentNotes}";

        context.TucNotes.AddRange(
            new TucNote
            {
                JobId = pickupJobId,
                NoteTypeId = (int)NoteType.InternalNote,
                NoteText = $"SPLIT Part 1 of 2. {parentNotesText}",
                CreatedBy = staffId,
                CreatedDate = now,
                CreatedDateUtc = now
            },
            new TucNote
            {
                JobId = deliveryJobId,
                NoteTypeId = (int)NoteType.InternalNote,
                NoteText = $"SPLIT Part 2 of 2. {parentNotesText}",
                CreatedBy = staffId,
                CreatedDate = now,
                CreatedDateUtc = now
            });

        await context.SaveChangesAsync(ct);
    }

    /// <summary>
    /// The job numbers and letter suffixes generated for a split's two new legs.
    /// </summary>
    internal sealed record ChildJobNumbers(
        string PickupJobNumber,
        string PickupSuffix,
        string DeliveryJobNumber,
        string DeliverySuffix);

    /// <summary>
    /// Divides the parent's pricing breakdown lines across the two new legs, attributing each new
    /// row to its leg via <c>PricingBreakdown.ChildJobId</c>, then sets each leg's header totals
    /// from its own rows.
    /// </summary>
    /// <remarks>
    /// The parent's line total is unchanged — each source line is replaced by per-leg rows summing
    /// back to it — so a split never flows through to the client invoice. Runs on the caller's
    /// context so it participates in the split transaction.
    /// </remarks>
    private async Task AllocateSplitPricingAsync(
        DespatchContext context,
        TucJob parent,
        (TucJob Job, string Suffix) pickup,
        (TucJob Job, string Suffix) delivery,
        IReadOnlyList<SplitPricingAllocationItem>? confirmedAllocation,
        CancellationToken ct)
    {
        var parentAmount = parent.UcjbAmount ?? 0m;

        // Breakdown lines always hang off the effective (root) job. When a leg is itself being
        // re-split, the rows to divide are that leg's own child-attributed rows, not the root's.
        var effectiveParentId = parent.ParentId ?? parent.UcjbId;
        var sourceChildJobId = effectiveParentId == parent.UcjbId ? (int?)null : parent.UcjbId;

        var sourceRows = await context.PricingBreakdowns
            .Where(p => p.JobId == effectiveParentId && p.ChildJobId == sourceChildJobId)
            .ToListAsync(ct);

        var sourceLines = sourceRows
            .Select(p => new SplitPricingAllocator.ParentLine(
                p.PricingBreakdownId, p.ChargeName ?? string.Empty, p.ChargeAmount, p.CostAmount,
                p.IsAccessorial))
            .ToList();

        // A flat or manually-priced parent has nothing itemised to divide — synthesise a single
        // line so each leg still gets a row and a self-consistent header.
        var linesToDivide = SplitPricingAllocator.EnsureLines(
            sourceLines, parentAmount, parent.CourierPayment);

        var legJobs = new[] { pickup, delivery };
        var (legWeights, basis) = await ResolveLegWeightsAsync(
            context, pickup, delivery, confirmedAllocation, parentAmount);

        var allocated = SplitPricingAllocator.Allocate(linesToDivide, legWeights);

        if (sourceRows.Count > 0)
        {
            context.PricingBreakdowns.RemoveRange(sourceRows);
        }

        foreach (var line in allocated)
        {
            var legJob = legJobs.First(l => l.Suffix == line.LetterSuffix).Job;
            context.PricingBreakdowns.Add(new PricingBreakdown
            {
                JobId = effectiveParentId,
                PrebookJobId = null,
                ChildJobId = legJob.UcjbId,
                ChargeName = line.ChargeName,
                ChargeAmount = line.ChargeAmount,
                CostAmount = line.CostAmount,
                IsAccessorial = line.IsAccessorial
            });
        }

        await context.SaveChangesAsync(ct);

        foreach (var leg in legJobs)
        {
            var weight = legWeights.First(w => w.LetterSuffix == leg.Suffix);
            var legLines = allocated.Where(l => l.LetterSuffix == leg.Suffix).ToList();
            await ApplyLegHeaderAsync(context, leg.Job.UcjbId, legLines, weight.Miles, basis, ct);
        }

        Log.Information(
            "Allocated {LineCount} pricing lines across the legs of parent {ParentJobId} on a {Basis} basis. "
            + "Parent amount: {ParentAmount}",
            allocated.Count, parent.UcjbId, basis, parentAmount);
    }

    /// <summary>
    /// Writes a leg's header totals from the lines just allocated to it: amount, client fuel, driver
    /// pay, and — when the shares came from real road miles — the leg's distance.
    /// </summary>
    private static async Task ApplyLegHeaderAsync(
        DespatchContext context,
        int legJobId,
        IReadOnlyList<SplitPricingAllocator.AllocatedLine> legLines,
        decimal legMiles,
        SplitPricingAllocator.AllocationBasis basis,
        CancellationToken ct)
    {
        var revenue = legLines.Sum(l => l.ChargeAmount);
        var fuel = legLines
            .Where(l => PriceLineClassifier.Classify(l.ChargeName) == PriceLineClassifier.Bucket.Fuel)
            .Sum(l => l.ChargeAmount);

        // Leave driver pay null rather than inventing a zero when no source line carried a cost.
        var cost = legLines.Any(l => l.CostAmount.HasValue)
            ? legLines.Sum(l => l.CostAmount ?? 0m)
            : (decimal?)null;

        // TotalDistance is a road-miles column — only populate it from a road-miles basis, never
        // from a straight-line estimate.
        var distance = basis == SplitPricingAllocator.AllocationBasis.RoadMiles && legMiles > 0m
            ? legMiles
            : (decimal?)null;

        await context.TucJobs
            .Where(j => j.UcjbId == legJobId)
            .ExecuteUpdateAsync(j => j
                .SetProperty(x => x.RatedManually, false)
                .SetProperty(x => x.UcjbAmount, revenue)
                .SetProperty(x => x.FuelSurchargeAmount, fuel)
                .SetProperty(x => x.CourierPayment, cost)
                .SetProperty(x => x.TotalDistance, distance), ct);
    }

    /// <summary>
    /// Resolves each leg's weighting, in priority order: shares the user confirmed, then per-leg
    /// road miles, then straight-line miles, then each leg's calculated rate, then an even split.
    /// </summary>
    private async Task<(IReadOnlyList<SplitPricingAllocator.LegWeight> Legs,
        SplitPricingAllocator.AllocationBasis Basis)> ResolveLegWeightsAsync(
        DespatchContext context,
        (TucJob Job, string Suffix) pickup,
        (TucJob Job, string Suffix) delivery,
        IReadOnlyList<SplitPricingAllocationItem>? confirmedAllocation,
        decimal parentAmount)
    {
        var legs = new[] { (Sequence: 1, pickup.Job, pickup.Suffix), (Sequence: 2, delivery.Job, delivery.Suffix) };

        // 1. The user already agreed a split in the dialog — take it verbatim and skip any
        //    distance or rating call entirely.
        var confirmed = confirmedAllocation?.Where(a => a.SharePercent > 0m).ToList();
        if (confirmed is { Count: > 0 } && confirmed.Sum(a => a.SharePercent) > 0m)
        {
            var weights = legs
                .Select(l => new SplitPricingAllocator.LegWeight(
                    l.Sequence, l.Suffix, 0m,
                    confirmed.FirstOrDefault(a => a.Sequence == l.Sequence)?.SharePercent ?? 0m))
                .ToList();

            if (weights.Sum(w => w.SharePercentOverride ?? 0m) > 0m)
            {
                return (weights, SplitPricingAllocator.AllocationBasis.UserConfirmed);
            }
        }

        // 2/3. Distance — road miles first, then straight-line as a no-network fallback. Both give
        //      the "% of total trip miles" share the split is meant to express.
        var roadMiles = new List<decimal>();
        foreach (var leg in legs)
        {
            roadMiles.Add((decimal)await rateJobService.GetRoadDistanceMilesAsync(
                leg.Job.PickUpLatitude, leg.Job.PickUpLongitude,
                leg.Job.DeliveryLatitude, leg.Job.DeliveryLongitude));
        }

        if (roadMiles.Sum() > 0m)
        {
            return (Weights(roadMiles), SplitPricingAllocator.AllocationBasis.RoadMiles);
        }

        var straightLineMiles = legs
            .Select(l => DistanceCalculator.MilesOrZero(
                l.Job.PickUpLatitude, l.Job.PickUpLongitude,
                l.Job.DeliveryLatitude, l.Job.DeliveryLongitude))
            .ToList();

        if (straightLineMiles.Sum() > 0m)
        {
            return (Weights(straightLineMiles), SplitPricingAllocator.AllocationBasis.StraightLine);
        }

        // 4/5. No usable distance: fall back to the historic rate-proportional split, then even.
        var rates = await RateLegsAsync(context, [.. legs.Select(l => l.Job.UcjbId)], parentAmount);
        return rates.Sum() > 0m
            ? (Weights(rates), SplitPricingAllocator.AllocationBasis.LegRates)
            : (Weights([1m, 1m]), SplitPricingAllocator.AllocationBasis.EvenSplit);

        List<SplitPricingAllocator.LegWeight> Weights(IReadOnlyList<decimal> byLeg) =>
            [.. legs.Select((l, i) => new SplitPricingAllocator.LegWeight(l.Sequence, l.Suffix, byLeg[i]))];
    }

    /// <summary>
    /// Asks the rating engine for each leg's rate, reading on the split transaction's own
    /// connection. Returns all-zero rates when the parent has no amount to divide.
    /// </summary>
    private async Task<List<decimal>> RateLegsAsync(
        DespatchContext context,
        IReadOnlyList<int> legJobIds,
        decimal parentAmount)
    {
        if (parentAmount == 0m)
        {
            return [.. legJobIds.Select(_ => 0m)];
        }

        var isUs = tenantInfoService.IsUsTenant();
        var rates = new List<decimal>(legJobIds.Count);

        // Rated sequentially, and failures propagate: catching and substituting 0 would silently
        // reassign the failed leg's share to the others.
        foreach (var legJobId in legJobIds)
        {
            if (isUs)
            {
                // Read on the split transaction's own connection — the legs were just inserted in
                // this uncommitted transaction, so a read on a separate connection would block on
                // its locks until the command timeout (SQL error 258).
                var details = await jobRepository.GetJobDetailsForRatingAsync(context, legJobId);
                rates.Add((await rateJobService.GetJobRateUsAsync(details)).Rate);
            }
            else
            {
                var details = await jobRepository.GetJobDetailsForRatingNzAsync(context, legJobId, false);
                rates.Add((await rateJobService.GetJobRateNzAsync(details)).Rate);
            }
        }

        return rates;
    }

    /// <summary>
    /// Rates the immediate children of <paramref name="parentJobId"/> and distributes
    /// <paramref name="parentAmount"/> across them in proportion to each leg's calculated rate.
    /// The total of all child UcjbAmount values after this method runs equals parentAmount exactly
    /// (the last child absorbs the rounding remainder).
    ///
    /// Uses the caller's context so the updates participate in the caller's transaction —
    /// a rating failure rolls back the split rather than leaving children mis-priced.
    /// </summary>
    private async Task ReRateSplitJobsAsync(
        DespatchContext context,
        int parentJobId,
        decimal parentAmount,
        CancellationToken ct)
    {
        if (parentAmount == 0m)
        {
            Log.Information("Parent job {ParentJobId} has zero amount. Skipping re-rate.", parentJobId);
            return;
        }

        // Only the IMMEDIATE children of the parent being split — using RootParentId here would
        // pull in unrelated siblings from earlier splits when re-splitting a leg, and redistribute
        // this parent's amount across them too.
        var children = await context.TucJobs
            .Where(j => j.ParentId == parentJobId && j.UcjbId != parentJobId && !j.UcjbVoid)
            .OrderBy(j => j.Sequence)
            .Select(j => new
            {
                j.UcjbId,
                j.RatedManually,
                j.UcjbAmount,
                j.PickUpLatitude,
                j.PickUpLongitude,
                j.DeliveryLatitude,
                j.DeliveryLongitude
            })
            .Take(100)
            .ToListAsync(ct);

        if (children.Count == 0)
        {
            Log.Warning("No non-void child jobs found for parent {ParentJobId}. Skipping re-rate.", parentJobId);
            return;
        }

        // Manually-priced legs keep their existing amount and are excluded from redistribution —
        // only the remaining amount (parent total minus what's already fixed manually) is spread
        // across the auto-rated legs.
        var manualAmount = children.Where(c => c.RatedManually).Sum(c => c.UcjbAmount ?? 0m);
        var childJobIds = children.Where(c => !c.RatedManually).Select(c => c.UcjbId).ToList();

        if (childJobIds.Count == 0)
        {
            Log.Information(
                "All split children of parent {ParentJobId} are manually rated. Skipping re-rate.", parentJobId);
            return;
        }

        var amountToDistribute = parentAmount - manualAmount;

        var isUs = tenantInfoService.IsUsTenant();

        // Rate each child sequentially. A rating failure propagates — the alternative
        // (catch + rate=0) silently mis-prices the surviving legs because the failed leg's
        // share of the parent amount gets reassigned to the others.
        var rates = new List<(int JobId, decimal Rate)>();
        foreach (var childId in childJobIds)
        {
            decimal rate;
            if (isUs)
            {
                // Read on the split transaction's own connection — the children were just
                // inserted in this uncommitted transaction, so a read on a separate connection
                // would block on its locks until the command timeout (SQL error 258).
                var details = await jobRepository.GetJobDetailsForRatingAsync(context, childId);
                rate = (await rateJobService.GetJobRateUsAsync(details)).Rate;
            }
            else
            {
                var details = await jobRepository.GetJobDetailsForRatingNzAsync(context, childId, false);
                rate = (await rateJobService.GetJobRateNzAsync(details)).Rate;
            }

            rates.Add((childId, rate));
        }

        // Distribute the remaining (non-manual) amount proportionally based on calculated rates.
        // When no leg rates — a zone/flat parent, where the engine returns 0 for both legs — fall
        // back to each leg's share of trip miles before an even split: a driver covering 90% of the
        // trip should carry 90% of the total.
        var weights = rates.Sum(r => r.Rate) > 0m
            ? rates.Select(r => r.Rate).ToList()
            : rates
                .Select(r => children.First(c => c.UcjbId == r.JobId))
                .Select(c => DistanceCalculator.MilesOrZero(
                    c.PickUpLatitude, c.PickUpLongitude, c.DeliveryLatitude, c.DeliveryLongitude))
                .ToList();

        var amounts = SplitPricingAllocator.DistributeAmount(
            amountToDistribute, SplitPricingAllocator.SharesFromWeights(weights));

        for (var i = 0; i < rates.Count; i++)
        {
            var jobId = rates[i].JobId;
            var amount = amounts[i];

            await context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .ExecuteUpdateAsync(j => j
                    .SetProperty(x => x.RatedManually, false)
                    .SetProperty(x => x.UcjbAmount, amount), ct);
        }

        Log.Information(
            "Re-rated {Count} split children of parent {ParentJobId}. Parent amount: {ParentAmount}",
            rates.Count, parentJobId, parentAmount);
    }

    internal static async Task<ChildJobNumbers> GenerateChildJobNumbersAsync(
        DespatchContext context,
        TucJob job,
        CancellationToken ct)
    {
        // Find root parent ID - use existing RootParentId if present, otherwise this job is the root
        var rootParentId = job.RootParentId ?? job.UcjbId;

        string mainJobNumber;
        int existingChildCount;
        if (rootParentId == job.UcjbId)
        {
            mainJobNumber = job.UcjbNumber;
            existingChildCount = await context.TucJobs
                .CountAsync(j => j.RootParentId == rootParentId && j.UcjbId != rootParentId, ct);
        }
        else
        {
            var data = await context.TucJobs
                .Where(j => j.UcjbId == rootParentId)
                .Select(j => new
                {
                    MainJobNumber = j.UcjbNumber,
                    ExistingChildCount =
                        context.TucJobs.Count(c => c.RootParentId == rootParentId && c.UcjbId != rootParentId)
                }).FirstOrDefaultAsync(ct);

            mainJobNumber = data?.MainJobNumber ?? job.UcjbNumber;
            existingChildCount = data?.ExistingChildCount ?? 0;
        }

        // Generate letter suffixes for the two new jobs
        var pickupSuffix = SplitPricingAllocator.LetterSuffix(existingChildCount);
        var deliverySuffix = SplitPricingAllocator.LetterSuffix(existingChildCount + 1);

        return new ChildJobNumbers(
            $"{mainJobNumber}{pickupSuffix}", pickupSuffix,
            $"{mainJobNumber}{deliverySuffix}", deliverySuffix);
    }

    private static async Task ConsolidateMarsInformationAsync(
        DespatchContext context,
        int jobId,
        string despatcher,
        CancellationToken ct)
    {
        try
        {
            await context.Procedures.DES_stpJob_ColsolidateMarsInformationAsync(
                jobId, false, despatcher, null, cancellationToken: ct);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to consolidate MARS information for job {JobId}.", jobId);
        }
    }

}