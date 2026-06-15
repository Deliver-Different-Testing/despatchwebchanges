using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
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
                var (pickupJobNumber, deliveryJobNumber) = await GenerateChildJobNumbersAsync(context, job, ct);

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

                // Re-rate the immediate children inside the transaction so the parent amount
                // is divided across the two legs before commit. A rating failure rolls back
                // the whole split — better than committing two children at the full parent
                // amount and double-charging the client.
                await ReRateSplitJobsAsync(context, jobId, job.UcjbAmount ?? 0m, ct);

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
    public async Task PropagateUpdateToSplitChildrenAsync(
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

        if (parentInfo.JobRelationshipTypeId != (int)JobRelationshipTypes.SplitParent)
        {
            Log.Information(
                "Propagate skipped — parent {ParentJobId} relType={RelType} (not SplitParent=8), void={IsVoid}, field {Field}",
                parentJobId, parentInfo.JobRelationshipTypeId, parentInfo.UcjbVoid, field);
            return;
        }

        var rootParentId = parentInfo.RootParentId ?? parentJobId;

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
        var parentAmount = parentInfo.UcjbAmount ?? 0m;
        await ReRateSplitJobsAsync(context, parentJobId, parentAmount, ct);
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
                CreatedDate = now
            },
            new TucNote
            {
                JobId = deliveryJobId,
                NoteTypeId = (int)NoteType.InternalNote,
                NoteText = $"SPLIT Part 2 of 2. {parentNotesText}",
                CreatedBy = staffId,
                CreatedDate = now
            });

        await context.SaveChangesAsync(ct);
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
        var childJobIds = await context.TucJobs
            .Where(j => j.ParentId == parentJobId && j.UcjbId != parentJobId && !j.UcjbVoid)
            .OrderBy(j => j.Sequence)
            .Select(j => j.UcjbId)
            .Take(100)
            .ToListAsync(ct);

        if (childJobIds.Count == 0)
        {
            Log.Warning("No non-void child jobs found for parent {ParentJobId}. Skipping re-rate.", parentJobId);
            return;
        }

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
                var details = await jobRepository.GetJobDetailsForRatingAsync(childId);
                rate = (await rateJobService.GetJobRateUsAsync(details)).Rate;
            }
            else
            {
                var details = await jobRepository.GetJobDetailsForRatingNzAsync(childId, false);
                rate = (await rateJobService.GetJobRateNzAsync(details)).Rate;
            }

            rates.Add((childId, rate));
        }

        // Distribute parent amount proportionally based on calculated rates
        var totalRate = rates.Sum(r => r.Rate);
        var runningTotal = 0m;

        for (var i = 0; i < rates.Count; i++)
        {
            decimal amount;
            if (i == rates.Count - 1)
            {
                // Last job absorbs rounding difference to ensure exact balance
                amount = parentAmount - runningTotal;
            }
            else if (totalRate == 0m)
            {
                // All rates are 0: distribute evenly so the parent total is still preserved
                amount = Math.Round(parentAmount / rates.Count, 2, MidpointRounding.AwayFromZero);
            }
            else
            {
                var percentage = rates[i].Rate / totalRate;
                amount = Math.Round(percentage * parentAmount, 2, MidpointRounding.AwayFromZero);
            }

            runningTotal += amount;

            var i1 = i;
            await context.TucJobs
                .Where(j => j.UcjbId == rates[i1].JobId)
                .ExecuteUpdateAsync(j => j
                    .SetProperty(x => x.RatedManually, false)
                    .SetProperty(x => x.UcjbAmount, amount), ct);
        }

        Log.Information(
            "Re-rated {Count} split children of parent {ParentJobId}. Parent amount: {ParentAmount}",
            rates.Count, parentJobId, parentAmount);
    }

    /// <summary>
    /// Converts a 0-based index to Excel-style letter suffix (0=A, 25=Z, 26=AA, 27=AB, etc.)
    /// </summary>
    private static string GetLetterSuffix(int index)
    {
        var result = string.Empty;
        var n = index;

        do
        {
            result = (char)('A' + n % 26) + result;
            n = n / 26 - 1;
        } while (n >= 0);

        return result;
    }

    private static async Task<(string PickupJobNumber, string DeliveryJobNumber)> GenerateChildJobNumbersAsync(
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
        var pickupSuffix = GetLetterSuffix(existingChildCount);
        var deliverySuffix = GetLetterSuffix(existingChildCount + 1);

        return ($"{mainJobNumber}{pickupSuffix}", $"{mainJobNumber}{deliverySuffix}");
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