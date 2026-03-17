using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for splitting jobs into pickup (leg A) and delivery (leg B) child jobs.
/// Uses direct EF Core inserts instead of the stored procedure to avoid
/// unwanted side effects (speed suffix appending, suburb lookups, etc.).
/// </summary>
public class SplitJobService(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService tenantInfoService,
    IRateJobService rateJobService,
    IJobRepository jobRepository) : ISplitJobService
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
        int? courierIdForLegB = null)
    {
        var currentTenantTime = tenantInfoService.GetCurrentTenantTime();

        await using var context = await contextFactory.CreateDbContextAsync();
        await using var transaction = await context.Database.BeginTransactionAsync();

        try
        {
            Log.Information("Splitting job {JobId} by user {UserName} with meeting point address. LegB courier: {LegBCourier}",
                jobId, userName, courierIdForLegB);

            // Get relationship type IDs
            var (parentRelTypeId, childRelTypeId) = await GetRelationshipTypeIdsAsync(context);

            // Get parent job courier ID from settings (system courier for parent shell)
            var parentJobCourierId = await GetParentJobCourierIdAsync(context);

            // Load the job
            var job = await context.TucJobs
                          .AsSplitQuery()
                          .Include(j => j.UcjbSpeedNavigation)
                          .FirstOrDefaultAsync(j => j.UcjbId == jobId)
                      ?? throw new InvalidOperationException($"Job {jobId} not found");

            // Validate the job can be split - only restriction is flight assignment
            var hasFlightAssigned = await context.TucJobNationwides
                .AnyAsync(n => n.UcnwJobId == jobId);
            if (hasFlightAssigned)
                throw new InvalidOperationException($"Job {jobId} has flights assigned and cannot be split");

            // Generate child job numbers using letter suffixes (no speed suffix!)
            var (pickupJobNumber, deliveryJobNumber) = await GenerateChildJobNumbersAsync(context, job);

            // Capture original courier ID before modifying parent
            var originalCourierId = job.UcjbCourierId;

            // Determine root parent ID - preserve existing if job is already a child
            var rootParentId = job.RootParentId ?? job.UcjbId;

            // ── Update parent job ──
            // Parent becomes a shell: retains client-facing info, loses courier
            job.JobRelationshipTypeId = parentRelTypeId;
            job.UcjbCourierId = parentJobCourierId; // System courier 1889
            if (!job.ParentId.HasValue || job.ParentId == job.UcjbId) job.ParentId = jobId;
            job.RootParentId ??= jobId;
            job.InformationParentId ??= job.RootParentId;

            // ── Create Child A (Pickup leg: Origin → Meeting Point) ──
            var pickupJob = BuildChildJob(job, pickupJobNumber, meetingPointAddress,
                isPickupLeg: true, childRelTypeId, rootParentId, jobId, currentTenantTime, userName);

            // Child A gets the original courier and the parent's EXACT status
            pickupJob.UcjbCourierId = originalCourierId;
            pickupJob.UcjbStatus = job.UcjbStatus; // Bug fix #2: was hardcoded to Acknowledge
            pickupJob.Sequence = 1;

            // Pickup-specific delivery point overrides (meeting point = handoff)
            pickupJob.DeliverToPrivateBusiness = PrivateResidenceDeliverTo;
            pickupJob.DeliverToLeaveId = HandOffLeaveType;

            context.TucJobs.Add(pickupJob);

            // ── Create Child B (Delivery leg: Meeting Point → Final Destination) ──
            var deliveryJob = BuildChildJob(job, deliveryJobNumber, meetingPointAddress,
                isPickupLeg: false, childRelTypeId, rootParentId, jobId, currentTenantTime, userName);

            // Child B: unallocated unless dispatcher specified a courier for leg B
            deliveryJob.UcjbCourierId = courierIdForLegB; // Bug fix #3: new optional field
            deliveryJob.UcjbStatus = courierIdForLegB.HasValue ? job.UcjbStatus : (int)JobStatus.Unallocated;
            deliveryJob.Sequence = 2;

            // Delivery leg keeps parent's original deliver-to settings
            deliveryJob.DeliverToPrivateBusiness = job.DeliverToPrivateBusiness;
            deliveryJob.DeliverToLeaveId = job.DeliverToLeaveId;

            context.TucJobs.Add(deliveryJob);

            // Save to generate IDs for the new jobs
            await context.SaveChangesAsync();

            // Create notes for the split jobs
            var staffId = tenantInfoService.GetStaffId();
            await CreateSplitJobNotesAsync(context, currentTenantTime, pickupJob.UcjbId, deliveryJob.UcjbId,
                job.UcjbNotes, staffId);

            // Re-rate the split jobs (distributes parent amount proportionally)
            await ReRateSplitJobsAsync(context, jobId);

            // Consolidate MARS information
            await ConsolidateMarsInformationAsync(context, jobId, userName);

            // Make children visible in dispatch
            await UpdateJobDisplayInDespatchAsync(context, rootParentId);

            await transaction.CommitAsync();

            Log.Information("Successfully split job {JobId} into pickup {PickupId} ({PickupNum}) and delivery {DeliveryId} ({DeliveryNum})",
                jobId, pickupJob.UcjbId, pickupJobNumber, deliveryJob.UcjbId, deliveryJobNumber);

            return (pickupJob.UcjbId, deliveryJob.UcjbId);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Log.Error(ex, "Error splitting job {JobId}", jobId);
            throw;
        }
    }

    /// <summary>
    /// Builds a complete TucJob entity for a child leg, copying all relevant fields from the parent.
    /// Uses direct EF Core insert — no stored procedure — to avoid speed suffix appending (Bug #1).
    /// </summary>
    private TucJob BuildChildJob(
        TucJob parent,
        string jobNumber,
        AddressViewModel meetingPoint,
        bool isPickupLeg,
        int childRelTypeId,
        int rootParentId,
        int parentJobId,
        DateTime currentTenantTime,
        string userName)
    {
        var child = new TucJob
        {
            // ── Identity ──
            UcjbNumber = jobNumber, // Bug fix #1: clean number, no speed suffix
            UcjbClientId = parent.UcjbClientId,
            UcjbClientCode = parent.UcjbClientCode,

            // ── Speed: use parent's speed directly (Bug fix #4: no GetValidSpeedIdAsync) ──
            UcjbSpeed = parent.UcjbSpeed,

            // ── Dates/times ──
            UcjbDate = parent.UcjbDate,
            UcjbTime = parent.UcjbTime,
            UcjbBookedDate = currentTenantTime,
            DeliverByTime = parent.DeliverByTime,
            PickupTimeZoneId = parent.PickupTimeZoneId,
            DeliverByTimeZoneId = parent.DeliverByTimeZoneId,

            // ── Job details ──
            UcjbType = parent.UcjbType,
            UcjbContact = parent.UcjbContact,
            UcjbContactPhone = parent.UcjbContactPhone,
            ContactId = parent.ContactId,
            UcjbChargeType = parent.UcjbChargeType,
            UcjbSize = parent.UcjbSize,
            UcjbQty = parent.UcjbQty,
            UcjbCbd = parent.UcjbCbd,
            UcjbWeight = parent.UcjbWeight,
            UcjbOpId = parent.UcjbOpId,
            UcjbReturn = parent.UcjbReturn,
            UcjbPickUpFrom = parent.UcjbPickUpFrom,
            UcjbVan = parent.UcjbVan,
            UcjbAttention = parent.UcjbAttention,

            // ── References ──
            UcjbClientRefa = parent.UcjbClientRefa,
            UcjbClientRefb = parent.UcjbClientRefb,
            UcjbOurRef = parent.UcjbOurRef,
            ClientNotes = parent.ClientNotes,

            // ── Shop/account ──
            ShopId = parent.ShopId,
            ShopRef1 = parent.ShopRef1,
            ShopRef2 = parent.ShopRef2,
            ShopRef3 = parent.ShopRef3,
            ShopRef4 = parent.ShopRef4,
            ShopRef5 = parent.ShopRef5,

            // ── Proof of delivery ──
            ProofOfDelivery = parent.ProofOfDelivery,
            ProofOfDeliveryEmail = parent.ProofOfDeliveryEmail,
            ProofOfDeliveryMobile = parent.ProofOfDeliveryMobile,

            // ── Job type ──
            AcceptedJobTypeId = parent.AcceptedJobTypeId,
            DesiredJobTypeId = parent.DesiredJobTypeId,
            Direct = parent.Direct,

            // ── Pricing (will be re-rated after creation) ──
            UcjbAmount = parent.UcjbAmount ?? 0m,
            CourierPercentageOverride = parent.CourierPercentageOverride,
            FuelSurchargeAmount = 0,
            CourierFuel = 0,

            // ── Flags ──
            UcjbVoid = false,
            UcjbJobDone = false,
            UcjbPaged = false,
            DisplayInDespatch = false, // Set true later via UpdateJobDisplayInDespatchAsync
            SaturdayDelivery = parent.SaturdayDelivery,

            // ── DG ──
            Dgdocument = parent.Dgdocument,
            Dgclass = parent.Dgclass,
            DryIceWeight = parent.DryIceWeight,

            // ── Internal ──
            InternalStatus = parent.InternalStatus,
            TotalDistance = null, // Will be calculated during re-rate

            // ── Split relationship ──
            JobRelationshipTypeId = childRelTypeId,
            ParentId = parentJobId,
            RootParentId = rootParentId,
            InformationParentId = rootParentId,

            // ── Booked by ──
            UcjbBookedBy = userName,
        };

        if (isPickupLeg)
        {
            // Leg A: Origin → Meeting Point
            child.UcjbFrom = parent.UcjbFrom;
            child.UcjbFromAddr = parent.UcjbFromAddr;
            child.UcjbTo = null;
            child.UcjbToAddr = meetingPoint.FullAddress;

            child.PickupAddressLine1 = parent.PickupAddressLine1;
            child.PickupAddressLine2 = parent.PickupAddressLine2;
            child.PickupAddressLine3 = parent.PickupAddressLine3;
            child.PickupAddressLine4 = parent.PickupAddressLine4;
            child.PickupAddressLine5 = parent.PickupAddressLine5;
            child.PickupAddressLine6 = parent.PickupAddressLine6;
            child.PickupAddressLine7 = parent.PickupAddressLine7;
            child.PickupAddressLine8 = parent.PickupAddressLine8;
            child.PickUpLatitude = parent.PickUpLatitude;
            child.PickUpLongitude = parent.PickUpLongitude;

            child.DeliveryAddressLine1 = meetingPoint.AddressLine1;
            child.DeliveryAddressLine2 = meetingPoint.AddressLine2;
            child.DeliveryAddressLine3 = meetingPoint.AddressLine3;
            child.DeliveryAddressLine4 = meetingPoint.AddressLine4;
            child.DeliveryAddressLine5 = meetingPoint.AddressLine5;
            child.DeliveryAddressLine6 = meetingPoint.AddressLine6;
            child.DeliveryAddressLine7 = meetingPoint.AddressLine7;
            child.DeliveryAddressLine8 = meetingPoint.AddressLine8;
            child.DeliveryLatitude = meetingPoint.Latitude;
            child.DeliveryLongitude = meetingPoint.Longitude;

            child.FromAirportId = parent.FromAirportId;
            child.ToAirportId = null;

            child.PickupFromContact = parent.PickupFromContact;
            child.PickupFromPhone = parent.PickupFromPhone;
        }
        else
        {
            // Leg B: Meeting Point → Final Destination
            child.UcjbFrom = null;
            child.UcjbFromAddr = meetingPoint.FullAddress;
            child.UcjbTo = parent.UcjbTo;
            child.UcjbToAddr = parent.UcjbToAddr;

            child.PickupAddressLine1 = meetingPoint.AddressLine1;
            child.PickupAddressLine2 = meetingPoint.AddressLine2;
            child.PickupAddressLine3 = meetingPoint.AddressLine3;
            child.PickupAddressLine4 = meetingPoint.AddressLine4;
            child.PickupAddressLine5 = meetingPoint.AddressLine5;
            child.PickupAddressLine6 = meetingPoint.AddressLine6;
            child.PickupAddressLine7 = meetingPoint.AddressLine7;
            child.PickupAddressLine8 = meetingPoint.AddressLine8;
            child.PickUpLatitude = meetingPoint.Latitude;
            child.PickUpLongitude = meetingPoint.Longitude;

            child.DeliveryAddressLine1 = parent.DeliveryAddressLine1;
            child.DeliveryAddressLine2 = parent.DeliveryAddressLine2;
            child.DeliveryAddressLine3 = parent.DeliveryAddressLine3;
            child.DeliveryAddressLine4 = parent.DeliveryAddressLine4;
            child.DeliveryAddressLine5 = parent.DeliveryAddressLine5;
            child.DeliveryAddressLine6 = parent.DeliveryAddressLine6;
            child.DeliveryAddressLine7 = parent.DeliveryAddressLine7;
            child.DeliveryAddressLine8 = parent.DeliveryAddressLine8;
            child.DeliveryLatitude = parent.DeliveryLatitude;
            child.DeliveryLongitude = parent.DeliveryLongitude;

            child.FromAirportId = null;
            child.ToAirportId = parent.ToAirportId;

            child.DeliverToContact = parent.DeliverToContact;
            child.DeliverToPhone = parent.DeliverToPhone;
        }

        return child;
    }

    private static async Task<(int ParentRelTypeId, int ChildRelTypeId)> GetRelationshipTypeIdsAsync(
        DespatchContext context)
    {
        var relTypes = await context.TblJobRelationshipTypes
            .AsNoTracking()
            .Where(r => r.SystemName == ParentSystemName || r.SystemName == ChildSystemName)
            .Select(r => new { r.SystemName, r.JobRelationshipTypeId })
            .ToListAsync();

        var parentRelType = relTypes.FirstOrDefault(r => r.SystemName == ParentSystemName)
                            ?? throw new InvalidOperationException(
                                $"Job relationship type '{ParentSystemName}' not found");

        var childRelType = relTypes.FirstOrDefault(r => r.SystemName == ChildSystemName)
                           ?? throw new InvalidOperationException(
                               $"Job relationship type '{ChildSystemName}' not found");

        return (parentRelType.JobRelationshipTypeId, childRelType.JobRelationshipTypeId);
    }

    private static async Task<int?> GetParentJobCourierIdAsync(DespatchContext context) =>
        await context.TblSettings
            .AsNoTracking()
            .Where(s => s.SettingId == 1 && s.ParentJobCourierId != null
                        && context.TucCouriers.Any(c => c.UccrId == s.ParentJobCourierId))
            .Select(s => s.ParentJobCourierId)
            .FirstOrDefaultAsync();

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

    /// <summary>
    /// Generates child job numbers using letter suffixes based on total split count from root job.
    /// </summary>
    private static async Task<(string PickupJobNumber, string DeliveryJobNumber)> GenerateChildJobNumbersAsync(
        DespatchContext context,
        TucJob job)
    {
        var rootParentId = job.RootParentId ?? job.UcjbId;

        string mainJobNumber;
        if (rootParentId == job.UcjbId)
            mainJobNumber = job.UcjbNumber;
        else
            mainJobNumber = await context.TucJobs
                .AsNoTracking()
                .Where(j => j.UcjbId == rootParentId)
                .Select(j => j.UcjbNumber)
                .FirstOrDefaultAsync() ?? job.UcjbNumber;

        var existingChildCount = await context.TucJobs
            .AsNoTracking()
            .CountAsync(j => j.RootParentId == rootParentId && j.UcjbId != rootParentId);

        var pickupSuffix = GetLetterSuffix(existingChildCount);
        var deliverySuffix = GetLetterSuffix(existingChildCount + 1);

        return ($"{mainJobNumber}{pickupSuffix}", $"{mainJobNumber}{deliverySuffix}");
    }

    /// <summary>
    /// Re-rates all non-void child jobs under the root parent, distributing the parent's
    /// original amount proportionally based on each leg's calculated rate.
    /// Uses parent's speed directly — no GetValidSpeedIdAsync (Bug fix #4).
    /// </summary>
    private async Task ReRateSplitJobsAsync(DespatchContext context, int parentJobId)
    {
        try
        {
            var parentJob = await context.TucJobs
                .AsNoTracking()
                .Where(j => j.UcjbId == parentJobId)
                .Select(j => new { j.UcjbAmount, j.RootParentId })
                .FirstOrDefaultAsync();

            if (parentJob == null)
            {
                Log.Warning("Parent job {ParentJobId} not found for re-rating.", parentJobId);
                return;
            }

            var parentAmount = parentJob.UcjbAmount ?? 0m;
            if (parentAmount == 0m)
            {
                Log.Information("Parent job {ParentJobId} has zero amount. Skipping re-rate.", parentJobId);
                return;
            }

            var rootParentId = parentJob.RootParentId ?? parentJobId;

            var jobIdsToRate = await context.TucJobs
                .AsNoTracking()
                .Where(j => j.RootParentId == rootParentId && j.UcjbId != rootParentId && !j.UcjbVoid)
                .OrderBy(j => j.Sequence)
                .Select(j => j.UcjbId)
                .ToListAsync();

            if (jobIdsToRate.Count == 0)
            {
                Log.Warning("No non-void jobs found for parent {ParentJobId}. Skipping re-rate.", parentJobId);
                return;
            }

            // Rate each job independently using the rating service
            var isUs = tenantInfoService.IsUsTenant();
            var jobRates = new List<(int JobId, decimal Rate)>();

            foreach (var id in jobIdsToRate)
            {
                var rate = 0m;
                try
                {
                    if (isUs)
                    {
                        var details = await jobRepository.GetJobDetailsForRatingAsync(id);
                        rate = await rateJobService.GetJobRateUsAsync(details);
                    }
                    else
                    {
                        var details = await jobRepository.GetJobDetailsForRatingNzAsync(id, false);
                        rate = await rateJobService.GetJobRateNzAsync(details);
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Failed to rate job {JobId}. Using rate 0.", id);
                }

                jobRates.Add((id, rate));
            }

            // Distribute parent amount proportionally
            var totalRate = jobRates.Sum(c => c.Rate);
            var runningTotal = 0m;

            for (var i = 0; i < jobRates.Count; i++)
            {
                decimal jobAmount;
                if (i == jobRates.Count - 1)
                {
                    // Last job absorbs rounding difference
                    jobAmount = parentAmount - runningTotal;
                }
                else if (totalRate == 0m)
                {
                    // All rates zero: distribute evenly
                    jobAmount = Math.Round(parentAmount / jobRates.Count, 2);
                }
                else
                {
                    var percentage = jobRates[i].Rate / totalRate;
                    jobAmount = Math.Round(percentage * parentAmount, 2);
                }

                runningTotal += jobAmount;

                var id = jobRates[i].JobId;
                await context.TucJobs
                    .Where(j => j.UcjbId == id)
                    .ExecuteUpdateAsync(j => j
                        .SetProperty(x => x.UcjbAmount, jobAmount)
                        .SetProperty(x => x.RatedManually, false));
            }

            Log.Information(
                "Successfully re-rated {Count} split jobs for parent {ParentJobId}. Parent amount: {ParentAmount}",
                jobRates.Count, parentJobId, parentAmount);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to re-rate split jobs for parent {ParentJobId}. Jobs created but not rated.",
                parentJobId);
        }
    }

    private static async Task ConsolidateMarsInformationAsync(DespatchContext context, int jobId, string despatcher)
    {
        try
        {
            await context.Procedures.DES_stpJob_ColsolidateMarsInformationAsync(jobId, false, despatcher, null);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to consolidate MARS information for job {JobId}.", jobId);
        }
    }

    private static async Task UpdateJobDisplayInDespatchAsync(DespatchContext context, int jobId) =>
        await context.TucJobs
            .Where(j => j.RootParentId == jobId)
            .ExecuteUpdateAsync(j => j.SetProperty(x => x.DisplayInDespatch, true));

    private static async Task CreateSplitJobNotesAsync(
        DespatchContext context,
        DateTime currentTenantTime,
        int pickupJobId,
        int deliveryJobId,
        string parentNotes,
        int? staffId)
    {
        var parentNotesText = string.IsNullOrWhiteSpace(parentNotes) ? string.Empty : $"  {parentNotes}";

        var pickupNote = new TucNote
        {
            JobId = pickupJobId,
            NoteTypeId = (int)NoteType.InternalNote,
            NoteText = $"SPLIT Part 1 of 2. {parentNotesText}",
            CreatedBy = staffId,
            CreatedDate = currentTenantTime
        };

        var deliveryNote = new TucNote
        {
            JobId = deliveryJobId,
            NoteTypeId = (int)NoteType.InternalNote,
            NoteText = $"SPLIT Part 2 of 2. {parentNotesText}",
            CreatedBy = staffId,
            CreatedDate = currentTenantTime
        };

        await context.TucNotes.AddRangeAsync(pickupNote, deliveryNote);
        await context.SaveChangesAsync();
    }
}
