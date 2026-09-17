#nullable enable
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
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
    ICreateJobService createJobService,
    IPricingBreakdownAllocationService pricingBreakdownAllocationService) : ISplitJobService
{
    private const string ParentSystemName = "SplitParent";
    private const string ChildSystemName = "SplitChild";
    private const int HandOffLeaveType = 23;
    private const int PrivateResidenceDeliverTo = 1;

    /// <summary>
    /// Only date fields cascade across a family. Weight/size/speed and the like stay per-drop
    /// and keep the legacy <see cref="PropagateUpdateToChildrenAsync"/> behaviour.
    /// </summary>
    private static readonly JobProperty[] DateCascadeFields = [JobProperty.Date, JobProperty.BookedTime];

    /// <inheritdoc />
    public async Task<(int PickupJobId, int DeliveryJobId)> SplitJobAsync(
        int jobId,
        string userName,
        AddressViewModel meetingPointAddress,
        int? courierIdForLegB = null,
        IReadOnlyList<SplitPricingAllocationItem>? pricingAllocation = null,
        IReadOnlyList<SplitPricingLineAllocationItem>? lineAllocation = null,
        CancellationToken ct = default)
    {
        await using var context = await contextFactory.CreateDbContextAsync(ct);

        var strategy = context.Database.CreateExecutionStrategy();
        var (pickupJobId, deliveryJobId, originalCourierId) = await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await context.Database.BeginTransactionAsync(ct);

            try
            {
                Log.Information("Splitting job {JobId} by user {UserName} with meeting point address",
                    jobId, userName);

                var job = await context.TucJobs
                              .AsTracking()
                              .FirstOrDefaultAsync(j => j.UcjbId == jobId, ct)
                          ?? throw new SplitJobException($"Job {jobId} not found — it may have been archived.");

                var (parentRelTypeId, childRelTypeId) = await GetRelationshipTypeIdsAsync(context, ct);

                var hasFlightAssigned = await context.TucJobNationwides.AnyAsync(n => n.UcnwJobId == jobId, ct);
                if (hasFlightAssigned)
                {
                    throw new SplitJobException($"Job {jobId} has flights assigned and cannot be split.");
                }

                var parentJobCourierId = await GetParentJobCourierIdAsync(context, ct);

                var childNumbers = await GenerateChildJobNumbersAsync(context, job, ct);
                var (pickupJobNumber, deliveryJobNumber) =
                    (childNumbers.PickupJobNumber, childNumbers.DeliveryJobNumber);

                var (pickupMeetingPointSuburbId, deliveryMeetingPointSuburbId) =
                    await ResolveMeetingPointSuburbIdsAsync(context, job, ct);

                var originalCourier = job.UcjbCourierId;

                var bookedDate = job.UcjbDate;
                var bookedTime = job.UcjbTime;
                var bookedSpeed = job.UcjbSpeed;

                var parentPricing = ParentPricing.From(job);

                var rootParentId = job.RootParentId ?? job.UcjbId;

                var currentTenantTime = tenantClock.TenantNow;

                if (originalCourier.HasValue)
                {
                    await context.Procedures.UTL_stpJob_RestoreDeviceAsync(jobId, cancellationToken: ct);
                }

                job.JobRelationshipTypeId = parentRelTypeId;
                job.UcjbCourierId = parentJobCourierId;
                if (!job.ParentId.HasValue || job.ParentId == job.UcjbId)
                {
                    job.ParentId = jobId;
                }

                job.RootParentId ??= jobId;
                job.InformationParentId ??= job.RootParentId;
                job.DisplayInDespatch = false;

                var pickupJob = BuildChildJob(job, pickupJobNumber, childRelTypeId, rootParentId, 1);
                pickupJob.CreatedTimeUtc = tenantClock.UtcNow;
                pickupJob.UcjbCourierId = originalCourier;
                pickupJob.PickUpTime = job.PickUpTime;

                if (originalCourier.HasValue)
                {
                    pickupJob.UcjbDispTime = job.UcjbDispTime ?? currentTenantTime;
                    pickupJob.UcjbDispDate = job.UcjbDispDate ?? currentTenantTime;
                    pickupJob.UcjbDispId = job.UcjbDispId;
                }

                pickupJob.UcjbFrom = job.UcjbFrom;
                pickupJob.UcjbFromAddr = job.UcjbFromAddr;
                pickupJob.UcjbTo = pickupMeetingPointSuburbId;
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

                var deliveryJob = BuildChildJob(job, deliveryJobNumber, childRelTypeId, rootParentId, 2);
                deliveryJob.CreatedTimeUtc = tenantClock.UtcNow;
                deliveryJob.UcjbCourierId = courierIdForLegB;
                if (courierIdForLegB.HasValue)
                {
                    deliveryJob.UcjbDispTime = currentTenantTime;
                    deliveryJob.UcjbDispDate = currentTenantTime;
                    deliveryJob.UcjbDispId = job.UcjbDispId;
                }

                deliveryJob.UcjbFrom = deliveryMeetingPointSuburbId;
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

                await context.SaveChangesAsync(ct);

                pickupJob.UcjbId = await createJobService.InsertJobRawAsync(context, pickupJob, ct);
                deliveryJob.UcjbId = await createJobService.InsertJobRawAsync(context, deliveryJob, ct);

                await CreateSplitJobNotesAsync(context, pickupJob.UcjbId, deliveryJob.UcjbId, job.UcjbNotes, ct);

                await ConsolidateMarsInformationAsync(context, jobId, userName, ct);

                await AllocateSplitPricingAsync(
                    context,
                    job,
                    (pickupJob, childNumbers.PickupSuffix),
                    (deliveryJob, childNumbers.DeliverySuffix),
                    pricingAllocation,
                    lineAllocation,
                    ct);

                await ReassertLegBookingAsync(context, jobId, bookedDate, bookedTime, bookedSpeed,
                    [pickupJob.UcjbId, deliveryJob.UcjbId], ct);

                await ReassertParentPricingAsync(context, jobId, parentPricing, ct);

                await transaction.CommitAsync(ct);

                Log.Information("Successfully split job {JobId} into pickup {PickupId} and delivery {DeliveryId}",
                    jobId, pickupJob.UcjbId, deliveryJob.UcjbId);

                return (pickupJob.UcjbId, deliveryJob.UcjbId, originalCourier);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                Log.Error(ex, "Error splitting job {JobId}", jobId);
                throw;
            }
        });

        if (originalCourierId is not { } courierId)
        {
            return (pickupJobId, deliveryJobId);
        }

        try
        {
            await jobCommandRepository.ReSendAllJobsAsync(courierId);
        }
        catch (Exception ex)
        {
            Log.Warning(ex,
                "Split {JobId} committed but resending courier {CourierId}'s jobs to their device failed",
                jobId, courierId);
        }

        return (pickupJobId, deliveryJobId);
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
                j.UcjbVoid,
                Pricing = new ParentPricing(
                    j.UcjbAmount, j.FuelSurchargeAmount, j.CourierPayment, j.TotalDistance)
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
                await PropagateUpdateToSplitChildrenAsync(
                    context, parentJobId, parentInfo.RootParentId, parentInfo.Pricing, field, value, ct);
                break;
            case (int)JobRelationshipTypes.Multi:
                await ReRateMultiPartsAsync(context, parentJobId, field, ct);
                break;
            default:
                Log.Information(
                    "Propagate skipped — parent {ParentJobId} relType={RelType} (not Split=8/Multi=7), void={IsVoid}, field {Field}",
                    parentJobId, parentInfo.JobRelationshipTypeId, parentInfo.UcjbVoid, field);
                break;
        }
    }

    /// <inheritdoc />
    public async Task<DateCascadeFamily> GetDateCascadeFamilyAsync(
        int jobId,
        CancellationToken ct = default)
    {
        await using var context = await contextFactory.CreateDbContextAsync(ct);

        var parent = await context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new { j.JobRelationshipTypeId, j.RootParentId })
            .FirstOrDefaultAsync(ct);

        if (parent is null)
        {
            return DateCascadeFamily.Empty;
        }

        var members = await CascadeChildQuery(context, jobId, parent.RootParentId, parent.JobRelationshipTypeId)
            .Select(j => new DateCascadeFamilyMember(
                j.UcjbId,
                j.UcjbNumber,
                j.UcjbDate,
                j.UcjbTime,
                j.UcjbAmount,
                j.RatedManually,
                j.UcjbLocked ?? false,
                j.PartnerJobGuid != null))
            .ToListAsync(ct);

        return new DateCascadeFamily(parent.JobRelationshipTypeId, members);
    }

    /// <inheritdoc />
    public async Task<DateCascadeResult> PropagateDateToChildrenAsync(
        int parentJobId,
        JobProperty field,
        string value,
        CancellationToken ct = default)
    {
        if (!DateCascadeFields.Contains(field))
        {
            Log.Information(
                "Date cascade skipped — field {Field} is not a date field, parent {ParentJobId}",
                field, parentJobId);
            return DateCascadeResult.Empty;
        }

        var family = await GetDateCascadeFamilyAsync(parentJobId, ct);
        var targets = family.Members.Where(m => m.Cascadable).ToList();

        if (targets.Count == 0)
        {
            Log.Information(
                "Date cascade skipped — parent {ParentJobId} relType={RelType} has no cascadable children "
                + "({MemberCount} member(s) found), field {Field}",
                parentJobId, family.RelationshipTypeId, family.Members.Count, field);
            return DateCascadeResult.Empty;
        }

        const JobProperty childField = JobProperty.Date;

        Log.Information(
            "Date cascade starting — parent {ParentJobId} relType={RelType}, field {Field} -> {ChildField}, "
            + "{ChildCount} child(ren) {ChildJobIds}",
            parentJobId, family.RelationshipTypeId, field, childField,
            targets.Count, targets.Select(t => t.JobId));

        var updated = new List<int>(targets.Count);
        var failed = new List<int>();

        foreach (var target in targets)
        {
            try
            {
                await jobCommandRepository.UpdateJobAsync(target.JobId, childField, value);
                updated.Add(target.JobId);
            }
            catch (Exception ex)
            {
                failed.Add(target.JobId);
                Log.Warning(ex,
                    "Failed to cascade {Field} to child job {ChildId} of parent {ParentJobId}",
                    childField, target.JobId, parentJobId);
            }
        }

        Log.Information(
            "Date cascade finished — parent {ParentJobId}, {SuccessCount}/{ChildCount} children updated, "
            + "failed {FailedJobIds}",
            parentJobId, updated.Count, targets.Count, failed);

        return new DateCascadeResult(updated, failed);
    }

    /// <summary>
    /// The single authority on which jobs belong to a parent's cascadable family. Both the
    /// confirm dialog and the write path go through this, so the list the user approves is
    /// exactly the list that gets written.
    /// </summary>
    private static IQueryable<TucJob> CascadeChildQuery(
        DespatchContext context,
        int parentJobId,
        int? rootParentId,
        int? relationshipTypeId)
    {
        var live = context.TucJobs.Where(j => !j.UcjbVoid);

        var children = relationshipTypeId switch
        {
            (int)JobRelationshipTypes.SplitParent => live.Where(j =>
                j.RootParentId == (rootParentId ?? parentJobId) && j.UcjbId != (rootParentId ?? parentJobId)),

            (int)JobRelationshipTypes.Multi => live.Where(j => j.ParentId == parentJobId),

            (int)JobRelationshipTypes.BulkParent => live.Where(j =>
                j.ParentId == parentJobId
                && j.JobRelationshipTypeId == (int)JobRelationshipTypes.BulkChild),

            _ => live.Where(_ => false)
        };

        return children.OrderBy(j => j.Sequence);
    }

    /// <summary>
    /// Split-job propagation: copies the field to every non-void child, then redistributes the
    /// parent's fixed total across the legs in their existing proportions and rescales each leg's
    /// breakdown rows to match.
    /// </summary>
    private async Task PropagateUpdateToSplitChildrenAsync(
        DespatchContext context,
        int parentJobId,
        int? rootParentIdRaw,
        ParentPricing parentPricing,
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

        await RedistributeSplitJobAmountsAsync(context, parentJobId, parentPricing.Amount ?? 0m, ct);

        await ReassertParentPricingAsync(context, parentJobId, parentPricing, ct);
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
            UcjbAmount = 0m,
            UcjbStatus = JobStatusGroups.Completed.Contains(parent.UcjbStatus ?? (int)JobStatus.New)
                ? (int)JobStatus.New
                : parent.UcjbStatus,
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
                              ?? throw new SplitJobException(
                                  $"Splitting isn't set up on this system — the '{ParentSystemName}' job "
                                  + "relationship type is missing. Please contact support.");

        var childRelTypeId = relTypes.FirstOrDefault(r => r.SystemName == ChildSystemName)?.JobRelationshipTypeId
                             ?? throw new SplitJobException(
                                 $"Splitting isn't set up on this system — the '{ChildSystemName}' job "
                                 + "relationship type is missing. Please contact support.");

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
    /// Resolves the suburb both legs use for the meeting point, which has an address but no suburb
    /// of its own.
    /// </summary>
    /// <remarks>
    /// Prefers the "Unknown" suburb, mirroring DD_stpJob_Excelerator_Insert
    /// (<c>SELECT SuburbID FROM tblSuburb WHERE Name = N'Unknown'</c>) — that row exists on US
    /// tenants. NZ tenants run the gazetted suburb list and have no such row, so we fall back to the
    /// parent's own suburbs rather than leaving the meeting-point side null: the legacy tucJob insert
    /// triggers and NZ zone-based rating both reject a null suburb, which failed the whole split.
    /// The parent's pair is the combination it already rated and inserted with, so nothing downstream
    /// sees a value it hasn't already accepted, and leg amounts come from the pricing allocation
    /// rather than from re-rating. A parent with no suburb of its own leaves nothing to substitute,
    /// so that case keeps the previous null and is logged rather than blocked.
    /// </remarks>
    private static async Task<(int? Pickup, int? Delivery)> ResolveMeetingPointSuburbIdsAsync(
        DespatchContext context,
        TucJob job,
        CancellationToken ct)
    {
        var unknownSuburbId = await context.TucSuburbs
            .Where(s => s.UcsuName == "Unknown")
            .Select(s => (int?)s.UcsuId)
            .FirstOrDefaultAsync(ct);

        if (unknownSuburbId.HasValue)
        {
            return (unknownSuburbId, unknownSuburbId);
        }

        if (!job.UcjbTo.HasValue || !job.UcjbFrom.HasValue)
        {
            Log.Warning(
                "No \"Unknown\" suburb and job {JobId} has no suburb of its own "
                + "(from {FromSuburbId}, to {ToSuburbId}) — splitting with a null meeting-point suburb",
                job.UcjbId, job.UcjbFrom, job.UcjbTo);
        }

        return (job.UcjbTo, job.UcjbFrom);
    }

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

        await context.TucNotes.AddRangeAsync(
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
    /// Divides the parent's pricing breakdown lines across the two new legs by writing
    /// <c>PricingBreakdownAllocation</c> rows against the root's own (never-deleted) items, then
    /// sets each leg's header totals from the result.
    /// </summary>
    /// <remarks>
    /// The root's items are never touched — only allocation rows are written or replaced — so a
    /// split never flows through to the client invoice (docs/pricing/job-splitting-price-breakdown.md
    /// §5: splitting stops deleting the parent's price items). Runs on the caller's context so it
    /// participates in the split transaction.
    /// </remarks>
    private async Task AllocateSplitPricingAsync(
        DespatchContext context,
        TucJob parent,
        (TucJob Job, string Suffix) pickup,
        (TucJob Job, string Suffix) delivery,
        IReadOnlyList<SplitPricingAllocationItem>? confirmedAllocation,
        IReadOnlyList<SplitPricingLineAllocationItem>? confirmedLineAllocation,
        CancellationToken ct)
    {
        var parentAmount = parent.UcjbAmount ?? 0m;

        var effectiveParentId = parent.ParentId ?? parent.UcjbId;
        var isResplit = effectiveParentId != parent.UcjbId;

        var rootItems = await context.PricingBreakdowns
            .Where(p => p.JobId == effectiveParentId && p.ChildJobId == null)
            .ToListAsync(ct);

        if (rootItems.Count == 0)
        {
            var manualItem = new PricingBreakdown
            {
                JobId = effectiveParentId,
                ChargeName = SplitPricingAllocator.ManuallyRatedChargeName,
                ChargeAmount = parentAmount,
                CostAmount = parent.CourierPayment
            };
            context.PricingBreakdowns.Add(manualItem);
            await context.SaveChangesAsync(ct);
            rootItems = [manualItem];
        }

        var legJobs = new[] { pickup, delivery };
        var (legWeights, basis) = await ResolveLegWeightsAsync(
            context, pickup, delivery, confirmedAllocation, parentAmount);

        var lineOverrides = confirmedLineAllocation?
            .Select(a => new SplitPricingAllocator.LineShareOverride(
                a.PricingBreakdownId, a.Sequence, a.SharePercent, a.CostOverride))
            .ToList();

        var probeLines = rootItems
            .Select(p => new SplitPricingAllocator.ParentLine(p.PricingBreakdownId, p.ChargeName ?? string.Empty, 1m, null, p.IsAccessorial))
            .ToList();
        var resolvedShares = SplitPricingAllocator.Allocate(probeLines, legWeights, lineOverrides);

        var seeds = new Dictionary<(int, int), decimal>();
        var costOverrideSeeds = new Dictionary<(int, int), decimal>();
        IReadOnlyList<int>? currentLegIds = null;

        if (!isResplit)
        {
            foreach (var line in resolvedShares)
            {
                var legJob = legJobs.First(l => l.Suffix == line.LetterSuffix).Job;
                seeds[(line.PricingBreakdownId, legJob.UcjbId)] = line.SharePercent;
                if (line.CostOverride.HasValue)
                {
                    costOverrideSeeds[(line.PricingBreakdownId, legJob.UcjbId)] = line.CostOverride.Value;
                }
            }
        }
        else
        {
            var priorShareByItem = await context.PricingBreakdownAllocations
                .Where(a => a.LegJobId == parent.UcjbId)
                .ToDictionaryAsync(a => a.ParentPricingBreakdownId, a => a.SharePercent, ct);

            foreach (var line in resolvedShares)
            {
                if (!priorShareByItem.TryGetValue(line.PricingBreakdownId, out var priorShare))
                {
                    continue;
                }

                var legJob = legJobs.First(l => l.Suffix == line.LetterSuffix).Job;
                seeds[(line.PricingBreakdownId, legJob.UcjbId)] = priorShare * line.SharePercent / 100m;
            }

            var siblingLegIds = await context.TucJobs
                .Where(j => j.ParentId == effectiveParentId && j.UcjbId != effectiveParentId
                    && !j.UcjbVoid && j.UcjbId != parent.UcjbId)
                .Select(j => j.UcjbId)
                .ToListAsync(ct);
            currentLegIds = [.. siblingLegIds, pickup.Job.UcjbId, delivery.Job.UcjbId];
        }

        await pricingBreakdownAllocationService.RewriteAllocationsForParentAsync(
            context, effectiveParentId, seeds, currentLegIds, costOverrideSeeds, ct);

        foreach (var leg in legJobs)
        {
            var weight = legWeights.First(w => w.LetterSuffix == leg.Suffix);
            var distance = basis == SplitPricingAllocator.AllocationBasis.RoadMiles && weight.Miles > 0m
                ? weight.Miles
                : (decimal?)null;

            await context.TucJobs
                .Where(j => j.UcjbId == leg.Job.UcjbId)
                .ExecuteUpdateAsync(j => j
                    .SetProperty(x => x.RatedManually, false)
                    .SetProperty(x => x.TotalDistance, distance), ct);
        }

        Log.Information(
            "Allocated {ItemCount} root pricing items across the legs of parent {ParentJobId} on a {Basis} basis. "
            + "Parent amount: {ParentAmount}",
            rootItems.Count, parent.UcjbId, basis, parentAmount);
    }

    /// <summary>A leg's header figures, derived from the lines attributed to it.</summary>
    private readonly record struct LegHeaderTotals(decimal Revenue, decimal Fuel, decimal? Cost);

    /// <summary>
    /// Sums a leg's lines into the three header columns the leg carries. Fuel is recognised by
    /// charge name, the same way the rest of the pricing code classifies lines.
    /// </summary>
    private static LegHeaderTotals SummariseLegLines(
        IReadOnlyList<(string ChargeName, decimal ChargeAmount, decimal? CostAmount)> legLines) =>
        new(
            legLines.Sum(l => l.ChargeAmount),
            legLines
                .Where(l => PriceLineClassifier.Classify(l.ChargeName) == PriceLineClassifier.Bucket.Fuel)
                .Sum(l => l.ChargeAmount),
            legLines.Any(l => l.CostAmount.HasValue)
                ? legLines.Sum(l => l.CostAmount ?? 0m)
                : null);

    /// <summary>
    /// Writes an existing leg's header from its current breakdown rows. Leaves <c>TotalDistance</c>
    /// untouched — re-pricing a leg doesn't change how far it travels, and there is no basis here to
    /// justify a new value. (A newly created leg's distance is written separately, once, right after
    /// <see cref="AllocateSplitPricingAsync"/> — see its own TotalDistance step.)
    /// </summary>
    private static async Task ApplyLegHeaderFromRowsAsync(
        DespatchContext context,
        int legJobId,
        IReadOnlyList<PricingBreakdown> rows,
        CancellationToken ct)
    {
        var totals = SummariseLegLines(
            [.. rows.Select(r => (r.ChargeName ?? string.Empty, r.ChargeAmount, r.CostAmount))]);

        await context.TucJobs
            .Where(j => j.UcjbId == legJobId)
            .ExecuteUpdateAsync(j => j
                .SetProperty(x => x.RatedManually, false)
                .SetProperty(x => x.UcjbAmount, totals.Revenue)
                .SetProperty(x => x.FuelSurchargeAmount, totals.Fuel)
                .SetProperty(x => x.CourierPayment, totals.Cost), ct);
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

        for (var i = 0; i < legJobIds.Count; i++)
        {
            try
            {
                if (isUs)
                {
                    var details = await jobRepository.GetJobDetailsForRatingAsync(context, legJobIds[i]);
                    rates.Add((await rateJobService.GetJobRateUsAsync(details)).Rate);
                }
                else
                {
                    var details = await jobRepository.GetJobDetailsForRatingNzAsync(context, legJobIds[i], false);
                    rates.Add((await rateJobService.GetJobRateNzAsync(details)).Rate);
                }
            }
            catch (Exception ex) when (ex is not SplitJobException)
            {
                Log.Error(ex, "Failed to rate leg {LegNumber} ({LegJobId}) while splitting", i + 1, legJobIds[i]);
                throw new SplitJobException(
                    $"The rating engine couldn't price leg {i + 1} of this split, so nothing was split. "
                    + "Check the job's suburbs, speed and size, then try again.");
            }
        }

        return rates;
    }

    /// <summary>
    /// Redistributes <paramref name="parentAmount"/> across the immediate children of
    /// <paramref name="parentJobId"/> after a rate-affecting edit moved the parent's total, and
    /// rescales each leg's breakdown rows to match. The child amounts total parentAmount exactly
    /// (the last child absorbs the rounding remainder), and every leg's rows total its own amount.
    /// </summary>
    /// <remarks>
    /// Weights are each leg's current amount, so the division agreed when the job was split — trip
    /// miles, or the shares and per-line overrides the user confirmed in the split pricing dialog —
    /// survives the edit and only the total moves. Re-deriving the division from fresh leg rates
    /// would silently undo it.
    ///
    /// Runs on the caller's context. On the propagate path that context has no transaction, so each
    /// leg is committed as it is written.
    /// </remarks>
    private async Task RedistributeSplitJobAmountsAsync(
        DespatchContext context,
        int parentJobId,
        decimal parentAmount,
        CancellationToken ct)
    {
        if (parentAmount == 0m)
        {
            Log.Information("Parent job {ParentJobId} has zero amount. Skipping redistribution", parentJobId);
            return;
        }

        var effectiveParentId = await context.TucJobs
            .Where(j => j.UcjbId == parentJobId)
            .Select(j => j.ParentId ?? j.UcjbId)
            .FirstAsync(ct);

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
            Log.Warning("No non-void child jobs found for parent {ParentJobId}. Skipping redistribution",
                parentJobId);
            return;
        }

        var childJobIdsAll = children.Select(c => c.UcjbId).ToList();
        var hasAllocationRows = await context.PricingBreakdownAllocations
            .AnyAsync(a => childJobIdsAll.Contains(a.LegJobId), ct);

        if (hasAllocationRows)
        {
            await RedistributeSplitJobAmountsViaAllocationsAsync(
                context, effectiveParentId,
                children.Select(c => (c.UcjbId, c.RatedManually)).ToList(),
                parentAmount, ct);
            return;
        }

        var manualAmount = children.Where(c => c.RatedManually).Sum(c => c.UcjbAmount ?? 0m);
        var childJobIds = children.Where(c => !c.RatedManually).Select(c => c.UcjbId).ToList();

        if (childJobIds.Count == 0)
        {
            Log.Information(
                "All split children of parent {ParentJobId} are manually rated. Skipping redistribution",
                parentJobId);
            return;
        }

        var amountToDistribute = parentAmount - manualAmount;
        var autoLegs = children.Where(c => !c.RatedManually).ToList();

        var weights = autoLegs.Sum(c => c.UcjbAmount ?? 0m) > 0m
            ? autoLegs.Select(c => c.UcjbAmount ?? 0m).ToList()
            : autoLegs
                .Select(c => DistanceCalculator.MilesOrZero(
                    c.PickUpLatitude, c.PickUpLongitude, c.DeliveryLatitude, c.DeliveryLongitude))
                .ToList();

        var amounts = SplitPricingAllocator.DistributeAmount(
            amountToDistribute, SplitPricingAllocator.SharesFromWeights(weights));

        for (var i = 0; i < childJobIds.Count; i++)
        {
            await ApplyLegAmountFromExistingRowsAsync(
                context, effectiveParentId, childJobIds[i], amounts[i], ct);
        }

        Log.Information(
            "Redistributed {ParentAmount} across {Count} split children of parent {ParentJobId}",
            parentAmount, childJobIds.Count, parentJobId);
    }

    /// <summary>
    /// The allocation-backed counterpart to <see cref="RedistributeSplitJobAmountsAsync"/>, for a
    /// job split under the new model (real PricingBreakdownAllocation rows exist).
    /// </summary>
    /// <remarks>
    /// A manually-rated leg's DOLLAR amount for every item is kept exactly as it is — matching the
    /// legacy path's "leave its rows alone" behaviour — by recomputing that leg's SharePercent for
    /// each item so its ChargeAmount doesn't move even though the item's own total does. The
    /// remaining (auto) legs absorb <paramref name="parentAmount"/> minus the manual total, spread
    /// across items proportional to the auto legs' own existing per-item weight, and across multiple
    /// auto legs (if more than one) proportional to their existing relative shares of that item.
    /// Once every row's SharePercent is set, <see cref="IPricingBreakdownAllocationService"/> is the
    /// one thing that actually recomputes ChargeAmount/CostAmount and writes leg headers from it —
    /// this method only ever changes shares, never derives dollar amounts itself.
    /// </remarks>
    private async Task RedistributeSplitJobAmountsViaAllocationsAsync(
        DespatchContext context,
        int effectiveParentId,
        IReadOnlyList<(int LegJobId, bool RatedManually)> legs,
        decimal parentAmount,
        CancellationToken ct)
    {
        var manualLegIds = legs.Where(l => l.RatedManually).Select(l => l.LegJobId).ToHashSet();
        var autoLegIds = legs.Where(l => !l.RatedManually).Select(l => l.LegJobId).ToList();

        if (autoLegIds.Count == 0)
        {
            Log.Information(
                "All split legs of parent {ParentJobId} are manually rated. Skipping redistribution",
                effectiveParentId);
            return;
        }

        var items = await context.PricingBreakdowns
            .AsTracking()
            .Where(p => p.JobId == effectiveParentId && p.ChildJobId == null)
            .ToListAsync(ct);
        var itemIds = items.Select(i => i.PricingBreakdownId).ToList();

        var rows = await context.PricingBreakdownAllocations
            .AsTracking()
            .Where(a => itemIds.Contains(a.ParentPricingBreakdownId))
            .ToListAsync(ct);

        var manualAmount = rows.Where(r => manualLegIds.Contains(r.LegJobId)).Sum(r => r.ChargeAmount);
        var amountToDistribute = parentAmount - manualAmount;

        var itemWeights = items
            .Select(item => rows
                .Where(r => r.ParentPricingBreakdownId == item.PricingBreakdownId && autoLegIds.Contains(r.LegJobId))
                .Sum(r => r.ChargeAmount))
            .ToList();

        var newAutoItemTotals = PricingBreakdownAllocationCalculator.DistributeAmount(
            amountToDistribute, SplitPricingAllocator.SharesFromWeights(itemWeights));

        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var itemRows = rows.Where(r => r.ParentPricingBreakdownId == item.PricingBreakdownId).ToList();

            var manualItemAmount = itemRows.Where(r => manualLegIds.Contains(r.LegJobId)).Sum(r => r.ChargeAmount);
            var newItemAmount = manualItemAmount + newAutoItemTotals[i];
            item.ChargeAmount = newItemAmount;

            foreach (var row in itemRows.Where(r => manualLegIds.Contains(r.LegJobId)))
            {
                row.SharePercent = newItemAmount > 0m ? row.ChargeAmount / newItemAmount * 100m : 0m;
            }

            var autoItemRows = itemRows.Where(r => autoLegIds.Contains(r.LegJobId)).ToList();
            if (autoItemRows.Count == 0)
            {
                continue;
            }

            var autoWeights = autoItemRows.Select(r => r.ChargeAmount).ToList();
            var autoAmounts = PricingBreakdownAllocationCalculator.DistributeAmount(
                newAutoItemTotals[i], SplitPricingAllocator.SharesFromWeights(autoWeights));

            for (var j = 0; j < autoItemRows.Count; j++)
            {
                autoItemRows[j].SharePercent = newItemAmount > 0m ? autoAmounts[j] / newItemAmount * 100m : 0m;
            }
        }

        await context.SaveChangesAsync(ct);

        await pricingBreakdownAllocationService.RewriteAllocationsForParentAsync(
            context, effectiveParentId, ct: ct);

        Log.Information(
            "Redistributed {ParentAmount} across the allocation rows of parent {ParentJobId}",
            parentAmount, effectiveParentId);
    }

    /// <summary>
    /// Moves one leg to <paramref name="newAmount"/>, rescaling its breakdown rows in proportion to
    /// what they already are so the rows still total the header and the shape of the leg's pricing —
    /// including a charge the user pinned wholly to it — is preserved.
    /// </summary>
    /// <remarks>
    /// Only <c>ChargeAmount</c> is scaled. There is no new parent cost to divide on this path, so
    /// any factor applied to <c>CostAmount</c> would be invented; driver pay is instead recomputed
    /// from the unchanged cost rows, which at least leaves the header and the rows agreeing.
    /// </remarks>
    private static async Task ApplyLegAmountFromExistingRowsAsync(
        DespatchContext context,
        int effectiveParentId,
        int legJobId,
        decimal newAmount,
        CancellationToken ct)
    {
        var rows = await context.PricingBreakdowns
            .Where(p => p.JobId == effectiveParentId && p.ChildJobId == legJobId)
            .ToListAsync(ct);

        if (rows.Count == 0)
        {
            Log.Information(
                "Leg {LegJobId} of parent {ParentJobId} has no attributed pricing lines — "
                + "writing the header amount only",
                legJobId, effectiveParentId);

            await context.TucJobs
                .Where(j => j.UcjbId == legJobId)
                .ExecuteUpdateAsync(j => j
                    .SetProperty(x => x.RatedManually, false)
                    .SetProperty(x => x.UcjbAmount, newAmount), ct);
            return;
        }

        if (rows.Sum(r => r.ChargeAmount) == 0m)
        {
            Log.Warning(
                "Leg {LegJobId} of parent {ParentJobId} has {RowCount} pricing lines totalling zero — "
                + "rescaling to {NewAmount} by an even split, which will not preserve the lines' shape",
                legJobId, effectiveParentId, rows.Count, newAmount);
        }

        var lineAmounts = SplitPricingAllocator.DistributeAmount(
            newAmount, SplitPricingAllocator.SharesFromWeights([.. rows.Select(r => r.ChargeAmount)]));

        for (var i = 0; i < rows.Count; i++)
        {
            rows[i].ChargeAmount = lineAmounts[i];
        }

        await context.SaveChangesAsync(ct);
        await ApplyLegHeaderFromRowsAsync(context, legJobId, rows, ct);
    }

    internal static async Task<ChildJobNumbers> GenerateChildJobNumbersAsync(
        DespatchContext context,
        TucJob job,
        CancellationToken ct)
    {
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
            Log.Warning(ex, "Failed to consolidate MARS information for job {JobId}", jobId);
        }
    }

    /// <summary>
    /// The parent's customer-facing figures, captured before a split or re-price touches anything.
    /// </summary>
    internal readonly record struct ParentPricing(
        decimal? Amount,
        decimal Fuel,
        decimal? Cost,
        decimal? Distance)
    {
        public static ParentPricing From(TucJob job) =>
            new(job.UcjbAmount, job.FuelSurchargeAmount, job.CourierPayment, job.TotalDistance);
    }

    /// <summary>
    /// Verifies the parent job still carries the price and mileage it had before the split, and
    /// restores them if it does not. Returns the number of rows corrected.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Splitting is an internal dispatch operation: it must never change what the customer is
    /// charged, however the two legs' mileage compares to the original route. No C# on this path
    /// writes these columns — but the split deletes the parent's <c>PricingBreakdown</c> rows and
    /// re-inserts them as per-leg rows under the same <c>JobID</c>, which fires the legacy sync and
    /// recalculate triggers on that table and on <c>tucJob</c>. Their bodies live only on the
    /// server, so the parent is held to its snapshot rather than to an assumption about what they
    /// do, and any drift is logged by column so the culprit can be identified from production.
    /// </para>
    /// <para>
    /// Reads on <paramref name="context"/> — the split transaction's own connection — and
    /// <c>AsNoTracking</c>, for the same two reasons as <see cref="ReassertLegBookingAsync"/>: a
    /// tracked read is served from the identity map and could never observe a write made behind
    /// EF's back, and any other connection blocks on the uncommitted transaction (SQL error 258).
    /// </para>
    /// <para>
    /// Nothing is written when the parent is intact, which is the normal case — restoring only on
    /// drift keeps <c>tucJob_Update_UpdateBaggageJobFromPickupJob</c> (which mirrors columns onto
    /// related jobs for relationship types 8 and 11) out of the healthy path entirely. Once there
    /// is drift the columns go back in one statement; writing an undrifted column back to its own
    /// value is a no-op and is not worth a second round trip to avoid.
    /// </para>
    /// </remarks>
    internal static async Task<int> ReassertParentPricingAsync(
        DespatchContext context,
        int parentJobId,
        ParentPricing expected,
        CancellationToken ct)
    {
        try
        {
            var rows = await context.TucJobs
                .AsNoTracking()
                .Where(j => j.UcjbId == parentJobId)
                .Select(j => new ParentPricing(
                    j.UcjbAmount, j.FuelSurchargeAmount, j.CourierPayment, j.TotalDistance))
                .Take(1)
                .ToListAsync(ct);

            if (rows.Count == 0 || rows[0] == expected)
            {
                return 0;
            }

            var observed = rows[0];

            var drifted = new List<string>(4);
            Note(drifted, "ucjbAmount", expected.Amount, observed.Amount);
            Note(drifted, "FuelSurchargeAmount", expected.Fuel, observed.Fuel);
            Note(drifted, "CourierPayment", expected.Cost, observed.Cost);
            Note(drifted, "TotalDistance", expected.Distance, observed.Distance);

            Log.Warning(
                "Split {ParentJobId}: the parent's pricing drifted during the split — {Drift}. "
                + "Restoring. Splitting must not change what the customer is charged",
                parentJobId, string.Join("; ", drifted));

            return await context.TucJobs
                .Where(j => j.UcjbId == parentJobId)
                .ExecuteUpdateAsync(j => j
                    .SetProperty(x => x.UcjbAmount, expected.Amount)
                    .SetProperty(x => x.FuelSurchargeAmount, expected.Fuel)
                    .SetProperty(x => x.CourierPayment, expected.Cost)
                    .SetProperty(x => x.TotalDistance, expected.Distance), ct);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to verify the pricing on the parent of split {ParentJobId}", parentJobId);
            return 0;
        }

        static void Note(List<string> into, string column, decimal? expected, decimal? observed)
        {
            if (expected != observed)
            {
                into.Add($"{column} {observed} (was {expected})");
            }
        }
    }

    /// <summary>
    /// Verifies the new legs still carry the parent's booked window once every post-insert database
    /// object has run, and restores it if they do not. Returns the number of legs corrected.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Reads on <paramref name="context"/> — the split transaction's own connection. Reading these
    /// just-inserted rows on any other connection blocks on the uncommitted transaction until the
    /// command times out (SQL error 258).
    /// </para>
    /// <para>
    /// <c>ucjbSpeed</c> is reported but never rewritten: <c>tucJob_InsertJob</c> legitimately
    /// promotes speed 37 to 64 for one client, and undoing that would misprice the leg.
    /// </para>
    /// <para>
    /// Only leg rows are written. Writing <c>ucjbTime</c> to the SplitParent row would trip
    /// <c>tucJob_Update_UpdateBaggageJobFromPickupJob</c>, which mirrors the column onto related
    /// jobs for relationship types 8 and 11.
    /// </para>
    /// </remarks>
    internal static async Task<int> ReassertLegBookingAsync(
        DespatchContext context,
        int parentJobId,
        DateTime bookedDate,
        DateTime? bookedTime,
        int? bookedSpeed,
        IReadOnlyList<int> legJobIds,
        CancellationToken ct)
    {
        try
        {
            var legs = await context.TucJobs
                .AsNoTracking()
                .Where(j => legJobIds.Contains(j.UcjbId))
                .Select(j => new { j.UcjbId, j.UcjbNumber, j.UcjbDate, j.UcjbTime, j.UcjbSpeed })
                .ToListAsync(ct);

            var drifted = new List<int>(legs.Count);

            foreach (var leg in legs)
            {
                if (leg.UcjbSpeed != bookedSpeed)
                {
                    Log.Warning(
                        "Split {ParentJobId}: leg {LegJobId} ({LegJobNumber}) ucjbSpeed drifted after insert "
                        + "— observed {ObservedSpeed}, parent booked {ExpectedSpeed}. Left as-is",
                        parentJobId, leg.UcjbId, leg.UcjbNumber, leg.UcjbSpeed, bookedSpeed);
                }

                if (leg.UcjbDate == bookedDate && leg.UcjbTime == bookedTime)
                {
                    continue;
                }

                Log.Warning(
                    "Split {ParentJobId}: leg {LegJobId} ({LegJobNumber}) booked window drifted after insert "
                    + "— observed {ObservedDate} {ObservedTime}, parent booked {ExpectedDate} {ExpectedTime}. "
                    + "Restoring",
                    parentJobId, leg.UcjbId, leg.UcjbNumber, leg.UcjbDate, leg.UcjbTime, bookedDate, bookedTime);
                drifted.Add(leg.UcjbId);
            }

            if (drifted.Count == 0)
            {
                return 0;
            }

            return await context.TucJobs
                .Where(j => drifted.Contains(j.UcjbId))
                .ExecuteUpdateAsync(j => j
                    .SetProperty(x => x.UcjbDate, bookedDate)
                    .SetProperty(x => x.UcjbTime, bookedTime), ct);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to verify the booked window on the new legs of split {ParentJobId}",
                parentJobId);
            return 0;
        }
    }
}