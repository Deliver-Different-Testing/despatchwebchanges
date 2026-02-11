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
/// Service for splitting jobs into pickup and delivery child jobs.
/// Replaces the stored procedure DES_stpJob_SplitJob with C# implementation.
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
    private const int AcknowledgedStatus = 12;

    /// <inheritdoc />
    public async Task<(int PickupJobId, int DeliveryJobId)> SplitJobAsync(
        int jobId,
        string userName,
        AddressViewModel meetingPointAddress)
    {
        var currentTenantTime = tenantInfoService.GetCurrentTenantTime();

        await using var context = await contextFactory.CreateDbContextAsync();
        await using var transaction = await context.Database.BeginTransactionAsync();

        (int PickupJobId, int DeliveryJobId) result;

        try
        {
            Log.Information("Splitting job {JobId} by user {UserName} with meeting point address",
                jobId, userName);

            // Get relationship type IDs
            var (parentRelTypeId, childRelTypeId) = await GetRelationshipTypeIdsAsync(context);

            // Get parent job courier ID from settings
            var parentJobCourierId = await GetParentJobCourierIdAsync(context);

            // Load the job with related data
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

            // Validate and get a valid speed ID
            var validSpeedId = await GetValidSpeedIdAsync(context, job.UcjbSpeed);

            // Generate child job numbers using letter suffixes
            var (pickupJobNumber, deliveryJobNumber) = await GenerateChildJobNumbersAsync(context, job);

            // Capture original courier ID before modifying parent
            var originalCourierId = job.UcjbCourierId;

            // Determine root parent ID - preserve existing if job is already a child
            var rootParentId = job.RootParentId ?? job.UcjbId;

            // Update parent job (only set parent IDs if not already set)
            job.JobRelationshipTypeId = parentRelTypeId;
            job.UcjbCourierId = parentJobCourierId;
            if (!job.ParentId.HasValue || job.ParentId == job.UcjbId) job.ParentId = jobId;
            job.RootParentId ??= jobId;
            job.InformationParentId ??= job.RootParentId;

            // Create pickup job (leg 1: From → Meeting Point)
            var pickupJob = CreatePickupJob(job, pickupJobNumber, validSpeedId, childRelTypeId,
                meetingPointAddress);
            pickupJob.UcjbCourierId = originalCourierId; // Pickup job keeps original courier
            context.TucJobs.Add(pickupJob);

            // Create delivery job (leg 2: Meeting Point → Final Destination)
            var deliveryJob = CreateDeliveryJob(job, deliveryJobNumber, validSpeedId, childRelTypeId,
                meetingPointAddress);
            context.TucJobs.Add(deliveryJob);

            await context.SaveChangesAsync();

            // Update child job relationships after we have their IDs
            // Child jobs point to the job being split as their ParentId
            // All children share the same RootParentId
            pickupJob.ParentId = jobId;
            pickupJob.RootParentId = rootParentId;
            pickupJob.InformationParentId = rootParentId;
            pickupJob.Sequence = 1;

            deliveryJob.ParentId = jobId;
            deliveryJob.RootParentId = rootParentId;
            deliveryJob.InformationParentId = rootParentId;
            deliveryJob.Sequence = 2;

            // Set status for pickup job based on whether courier is assigned
            pickupJob.UcjbStatus = pickupJob.UcjbCourierId.HasValue ? AcknowledgedStatus : job.UcjbStatus;

            pickupJob.UcjbVan = job.UcjbVan;
            pickupJob.UcjbAttention = job.UcjbAttention;
            deliveryJob.UcjbVan = job.UcjbVan;

            await context.SaveChangesAsync();

            // Create notes for the split jobs
            var staffId = tenantInfoService.GetStaffId();
            await CreateSplitJobNotesAsync(context, currentTenantTime, pickupJob.UcjbId, deliveryJob.UcjbId,
                job.UcjbNotes, staffId);

            // Update display in dispatch
            await UpdateJobDisplayInDespatchAsync(context, rootParentId);

            await transaction.CommitAsync();

            Log.Information("Successfully split job {JobId} into pickup {PickupId} and delivery {DeliveryId}",
                jobId, pickupJob.UcjbId, deliveryJob.UcjbId);

            result = (pickupJob.UcjbId, deliveryJob.UcjbId);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Log.Error(ex, "Error splitting job {JobId}", jobId);
            throw;
        }

        await PerformPostSplitOperationsAsync(jobId, userName);

        return result;
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
            .Where(s => s.SettingId == 1)
            .Select(s => s.ParentJobCourierId)
            .FirstOrDefaultAsync();

    private static async Task<int?> GetValidSpeedIdAsync(DespatchContext context, int? speedId)
    {
        if (!speedId.HasValue) return null;

        var speedExists = await context.TucJobTypes
            .AsNoTracking()
            .AnyAsync(jt => jt.UcjtId == speedId.Value);

        if (speedExists) return speedId;

        Log.Warning("Speed ID {SpeedId} does not exist in tucJobType table. Finding fallback speed.", speedId);

        var fallbackSpeed = await context.TucJobTypes
            .AsNoTracking()
            .OrderBy(jt => jt.UcjtId)
            .Select(jt => jt.UcjtId)
            .FirstOrDefaultAsync();

        if (fallbackSpeed == 0)
            throw new InvalidOperationException("No valid job types found in the system. Cannot create split jobs.");

        Log.Warning("Using fallback speed ID {FallbackSpeedId} instead of invalid speed {OriginalSpeedId}",
            fallbackSpeed, speedId);

        return fallbackSpeed;
    }

    /// <summary>
    /// Converts a 0-based index to Excel-style letter suffix (0=A, 25=Z, 26=AA, 27=AB, etc.)
    /// </summary>
    public static string GetLetterSuffix(int index)
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
        // Find root parent ID - use existing RootParentId if present, otherwise this job is the root
        var rootParentId = job.RootParentId ?? job.UcjbId;

        // Get the main job number from the root parent
        string mainJobNumber;
        if (rootParentId == job.UcjbId)
            mainJobNumber = job.UcjbNumber;
        else
            mainJobNumber = await context.TucJobs
                .AsNoTracking()
                .Where(j => j.UcjbId == rootParentId)
                .Select(j => j.UcjbNumber)
                .FirstOrDefaultAsync() ?? job.UcjbNumber;

        // Count all existing descendants under the root (excluding the root itself)
        var existingChildCount = await context.TucJobs
            .AsNoTracking()
            .CountAsync(j => j.RootParentId == rootParentId && j.UcjbId != rootParentId);

        // Generate letter suffixes for the two new jobs
        var pickupSuffix = GetLetterSuffix(existingChildCount);
        var deliverySuffix = GetLetterSuffix(existingChildCount + 1);

        return ($"{mainJobNumber}{pickupSuffix}", $"{mainJobNumber}{deliverySuffix}");
    }

    private static TucJob CreatePickupJob(
        TucJob parentJob,
        string jobNumber,
        int? speedId,
        int childRelTypeId,
        AddressViewModel meetingPointAddress) =>
        new()
        {
            UcjbNumber = jobNumber,
            UcjbDate = parentJob.UcjbDate,
            UcjbTime = parentJob.UcjbTime,
            UcjbType = parentJob.UcjbType,
            UcjbClientId = parentJob.UcjbClientId,
            UcjbContact = parentJob.UcjbContact,
            UcjbChargeType = parentJob.UcjbChargeType,
            UcjbAmount = parentJob.UcjbAmount,
            UcjbSpeed = speedId,
            UcjbFrom = parentJob.UcjbFrom,
            UcjbFromAddr = parentJob.UcjbFromAddr,
            UcjbTo = null,
            UcjbToAddr = meetingPointAddress.FullAddress,
            UcjbSize = parentJob.UcjbSize,
            UcjbQty = parentJob.UcjbQty,
            UcjbCbd = parentJob.UcjbCbd,
            UcjbWeight = parentJob.UcjbWeight,
            UcjbStatus = parentJob.UcjbStatus,
            UcjbCourierId = parentJob.UcjbCourierId,
            UcjbClientRefa = parentJob.UcjbClientRefa,
            UcjbClientRefb = parentJob.UcjbClientRefb,
            UcjbOurRef = parentJob.UcjbOurRef,
            UcjbOpId = parentJob.UcjbOpId,
            UcjbReturn = parentJob.UcjbReturn,
            UcjbPickUpFrom = parentJob.UcjbPickUpFrom,
            ClientNotes = parentJob.ClientNotes,
            UcjbContactPhone = parentJob.UcjbContactPhone,
            ContactId = parentJob.ContactId,
            DeliverToPrivateBusiness = PrivateResidenceDeliverTo,
            DeliverToLeaveId = HandOffLeaveType,
            ProofOfDelivery = parentJob.ProofOfDelivery,
            ProofOfDeliveryEmail = parentJob.ProofOfDeliveryEmail,
            ProofOfDeliveryMobile = parentJob.ProofOfDeliveryMobile,
            AcceptedJobTypeId = parentJob.AcceptedJobTypeId,
            DesiredJobTypeId = parentJob.DesiredJobTypeId,
            Direct = parentJob.Direct,
            JobRelationshipTypeId = childRelTypeId,
            PickupFromContact = parentJob.PickupFromContact,
            PickupFromPhone = parentJob.PickupFromPhone,
            DeliverToContact = null,
            DeliverToPhone = null,
            DisplayInDespatch = false,
            ShopId = parentJob.ShopId,
            ShopRef1 = parentJob.ShopRef1,
            ShopRef2 = parentJob.ShopRef2,
            ShopRef3 = parentJob.ShopRef3,
            ShopRef4 = parentJob.ShopRef4,
            ShopRef5 = parentJob.ShopRef5,
            CourierPercentageOverride = parentJob.CourierPercentageOverride,
            // Copy pickup address fields from parent
            PickupAddressLine1 = parentJob.PickupAddressLine1,
            PickupAddressLine2 = parentJob.PickupAddressLine2,
            PickupAddressLine3 = parentJob.PickupAddressLine3,
            PickupAddressLine4 = parentJob.PickupAddressLine4,
            PickupAddressLine5 = parentJob.PickupAddressLine5,
            PickupAddressLine6 = parentJob.PickupAddressLine6,
            PickupAddressLine7 = parentJob.PickupAddressLine7,
            PickupAddressLine8 = parentJob.PickupAddressLine8,
            PickUpLatitude = parentJob.PickUpLatitude,
            PickUpLongitude = parentJob.PickUpLongitude,
            // Delivery address is the meeting point
            DeliveryAddressLine1 = meetingPointAddress.AddressLine1,
            DeliveryAddressLine2 = meetingPointAddress.AddressLine2,
            DeliveryAddressLine3 = meetingPointAddress.AddressLine3,
            DeliveryAddressLine4 = meetingPointAddress.AddressLine4,
            DeliveryAddressLine5 = meetingPointAddress.AddressLine5,
            DeliveryAddressLine6 = meetingPointAddress.AddressLine6,
            DeliveryAddressLine7 = meetingPointAddress.AddressLine7,
            DeliveryAddressLine8 = meetingPointAddress.AddressLine8,
            DeliveryLatitude = meetingPointAddress.Latitude,
            DeliveryLongitude = meetingPointAddress.Longitude
        };

    private static TucJob CreateDeliveryJob(
        TucJob parentJob,
        string jobNumber,
        int? speedId,
        int childRelTypeId,
        AddressViewModel meetingPointAddress) =>
        new()
        {
            UcjbNumber = jobNumber,
            UcjbDate = parentJob.UcjbDate,
            UcjbTime = parentJob.UcjbTime,
            UcjbType = parentJob.UcjbType,
            UcjbClientId = parentJob.UcjbClientId,
            UcjbContact = parentJob.UcjbContact,
            UcjbChargeType = parentJob.UcjbChargeType,
            UcjbAmount = parentJob.UcjbAmount,
            UcjbSpeed = speedId,
            UcjbFrom = null,
            UcjbFromAddr = meetingPointAddress.FullAddress,
            UcjbTo = parentJob.UcjbTo,
            UcjbToAddr = parentJob.UcjbToAddr,
            UcjbSize = parentJob.UcjbSize,
            UcjbQty = parentJob.UcjbQty,
            UcjbCbd = parentJob.UcjbCbd,
            UcjbWeight = parentJob.UcjbWeight,
            UcjbStatus = parentJob.UcjbStatus,
            UcjbCourierId = null,
            UcjbClientRefa = parentJob.UcjbClientRefa,
            UcjbClientRefb = parentJob.UcjbClientRefb,
            UcjbOurRef = parentJob.UcjbOurRef,
            UcjbOpId = parentJob.UcjbOpId,
            UcjbReturn = parentJob.UcjbReturn,
            UcjbPickUpFrom = parentJob.UcjbPickUpFrom,
            ClientNotes = parentJob.ClientNotes,
            UcjbContactPhone = parentJob.UcjbContactPhone,
            ContactId = parentJob.ContactId,
            DeliverToPrivateBusiness = parentJob.DeliverToPrivateBusiness,
            DeliverToLeaveId = parentJob.DeliverToLeaveId,
            ProofOfDelivery = parentJob.ProofOfDelivery,
            ProofOfDeliveryEmail = parentJob.ProofOfDeliveryEmail,
            ProofOfDeliveryMobile = parentJob.ProofOfDeliveryMobile,
            AcceptedJobTypeId = parentJob.AcceptedJobTypeId,
            DesiredJobTypeId = parentJob.DesiredJobTypeId,
            Direct = parentJob.Direct,
            JobRelationshipTypeId = childRelTypeId,
            PickupFromContact = null,
            PickupFromPhone = null,
            DeliverToContact = parentJob.DeliverToContact,
            DeliverToPhone = parentJob.DeliverToPhone,
            DisplayInDespatch = false,
            ShopId = parentJob.ShopId,
            ShopRef1 = parentJob.ShopRef1,
            ShopRef2 = parentJob.ShopRef2,
            ShopRef3 = parentJob.ShopRef3,
            ShopRef4 = parentJob.ShopRef4,
            ShopRef5 = parentJob.ShopRef5,
            CourierPercentageOverride = parentJob.CourierPercentageOverride,
            // Pickup address is the meeting point
            PickupAddressLine1 = meetingPointAddress.AddressLine1,
            PickupAddressLine2 = meetingPointAddress.AddressLine2,
            PickupAddressLine3 = meetingPointAddress.AddressLine3,
            PickupAddressLine4 = meetingPointAddress.AddressLine4,
            PickupAddressLine5 = meetingPointAddress.AddressLine5,
            PickupAddressLine6 = meetingPointAddress.AddressLine6,
            PickupAddressLine7 = meetingPointAddress.AddressLine7,
            PickupAddressLine8 = meetingPointAddress.AddressLine8,
            PickUpLatitude = meetingPointAddress.Latitude,
            PickUpLongitude = meetingPointAddress.Longitude,
            // Copy delivery address fields from parent
            DeliveryAddressLine1 = parentJob.DeliveryAddressLine1,
            DeliveryAddressLine2 = parentJob.DeliveryAddressLine2,
            DeliveryAddressLine3 = parentJob.DeliveryAddressLine3,
            DeliveryAddressLine4 = parentJob.DeliveryAddressLine4,
            DeliveryAddressLine5 = parentJob.DeliveryAddressLine5,
            DeliveryAddressLine6 = parentJob.DeliveryAddressLine6,
            DeliveryAddressLine7 = parentJob.DeliveryAddressLine7,
            DeliveryAddressLine8 = parentJob.DeliveryAddressLine8,
            DeliveryLatitude = parentJob.DeliveryLatitude,
            DeliveryLongitude = parentJob.DeliveryLongitude
        };

    private async Task ReRateSplitJobsAsync(DespatchContext context, int parentJobId)
    {
        try
        {
            // Get parent job amount and root parent ID
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

            // Get non-void child jobs under RootParentID (excluding root parent), ordered by Sequence
            var childJobIds = await context.TucJobs
                .AsNoTracking()
                .Where(j => j.RootParentId == rootParentId && j.UcjbId != rootParentId && !j.UcjbVoid)
                .OrderBy(j => j.Sequence)
                .Select(j => j.UcjbId)
                .ToListAsync();

            if (childJobIds.Count == 0)
            {
                Log.Warning("No non-void child jobs found for parent {ParentJobId}. Skipping re-rate.", parentJobId);
                return;
            }

            // Rate each child job independently
            var isUs = tenantInfoService.IsUsTenant();
            var childRates = new List<(int JobId, decimal Rate)>();

            foreach (var childJobId in childJobIds)
            {
                var rate = 0m;
                try
                {
                    if (isUs)
                    {
                        var details = await jobRepository.GetJobDetailsForRatingAsync(childJobId);
                        rate = await rateJobService.GetJobRateUsAsync(details);
                    }
                    else
                    {
                        var details = await jobRepository.GetJobDetailsForRatingNzAsync(childJobId, false);
                        rate = await rateJobService.GetJobRateNzAsync(details);
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Failed to rate child job {ChildJobId}. Using rate 0.", childJobId);
                }

                childRates.Add((childJobId, rate));
            }

            // Sum all child rates
            var totalChildRate = childRates.Sum(c => c.Rate);

            // Distribute parent amount proportionally based on calculated rates
            var runningTotal = 0m;
            for (var i = 0; i < childRates.Count; i++)
            {
                decimal childAmount;
                if (i == childRates.Count - 1)
                {
                    // Last child absorbs rounding difference to ensure exact balance
                    childAmount = parentAmount - runningTotal;
                }
                else if (totalChildRate == 0m)
                {
                    // All rates are 0: distribute evenly
                    childAmount = Math.Round(parentAmount / childRates.Count, 2);
                }
                else
                {
                    var percentage = childRates[i].Rate / totalChildRate;
                    childAmount = Math.Round(percentage * parentAmount, 2);
                }

                runningTotal += childAmount;

                var jobId = childRates[i].JobId;
                await context.TucJobs
                    .Where(j => j.UcjbId == jobId)
                    .ExecuteUpdateAsync(j => j
                        .SetProperty(x => x.UcjbAmount, childAmount)
                        .SetProperty(x => x.RatedManually, false));
            }

            Log.Information(
                "Successfully re-rated {Count} split jobs for parent {ParentJobId}. Parent amount: {ParentAmount}",
                childRates.Count, parentJobId, parentAmount);
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

    private async Task PerformPostSplitOperationsAsync(int jobId, string userName)
    {
        try
        {
            await using var reRateContext = await contextFactory.CreateDbContextAsync();
            await ReRateSplitJobsAsync(reRateContext, jobId);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Post-split re-rating failed for job {JobId}. Split completed successfully.", jobId);
        }

        try
        {
            await using var marsContext = await contextFactory.CreateDbContextAsync();
            await ConsolidateMarsInformationAsync(marsContext, jobId, userName);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Post-split MARS consolidation failed for job {JobId}. Split completed successfully.", jobId);
        }
    }

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
            NoteText = $"SPLIT Part 1 of 2{parentNotesText}",
            CreatedBy = staffId,
            CreatedDate = currentTenantTime
        };

        var deliveryNote = new TucNote
        {
            JobId = deliveryJobId,
            NoteTypeId = (int)NoteType.InternalNote,
            NoteText = $"SPLIT Part 2 of 2{parentNotesText}",
            CreatedBy = staffId,
            CreatedDate = currentTenantTime
        };

        await context.TucNotes.AddRangeAsync(pickupNote, deliveryNote);
        await context.SaveChangesAsync();
    }
}
