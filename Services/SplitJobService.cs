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
/// Service for splitting a job into a pickup leg (the existing job, updated in-place)
/// and a delivery child job (created via the CreateMinimalTucJob stored procedure).
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
        AddressViewModel meetingPointAddress)
    {
        var currentTenantTime = tenantInfoService.GetCurrentTenantTime();
        var staffId = tenantInfoService.GetStaffId();

        await using var context = await contextFactory.CreateDbContextAsync();
        await using var transaction = await context.Database.BeginTransactionAsync();

        int deliveryJobId;

        try
        {
            Log.Information("Splitting job {JobId} by user {UserName} with meeting point address",
                jobId, userName);

            // Get relationship type IDs
            var (parentRelTypeId, childRelTypeId) = await GetRelationshipTypeIdsAsync(context);

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

            // Generate delivery child job number (single suffix)
            var deliveryJobNumber = await GenerateChildJobNumberAsync(context, job);

            // Determine root parent ID - preserve existing if job is already a child
            var rootParentId = job.RootParentId ?? job.UcjbId;

            // Capture original destination data before modifying the parent
            var originalDeliveryAddress = new AddressViewModel(
                job.DeliveryAddressLine1, job.DeliveryAddressLine2,
                job.DeliveryAddressLine3, job.DeliveryAddressLine4,
                job.DeliveryAddressLine5, job.DeliveryAddressLine6,
                job.DeliveryAddressLine7, job.DeliveryAddressLine8)
            {
                Latitude = job.DeliveryLatitude,
                Longitude = job.DeliveryLongitude
            };
            var originalDeliverToContact = job.DeliverToContact;
            var originalDeliverToPhone = job.DeliverToPhone;

            // --- Update parent job to become pickup leg ---
            job.JobRelationshipTypeId = parentRelTypeId;
            // Keep courier — parent IS the pickup leg
            if (!job.ParentId.HasValue || job.ParentId == job.UcjbId) job.ParentId = jobId;
            job.RootParentId ??= jobId;
            job.InformationParentId ??= job.RootParentId;

            // Change destination to meeting point
            job.UcjbTo = null;
            job.UcjbToAddr = meetingPointAddress.FullAddress;
            job.DeliveryAddressLine1 = meetingPointAddress.AddressLine1;
            job.DeliveryAddressLine2 = meetingPointAddress.AddressLine2;
            job.DeliveryAddressLine3 = meetingPointAddress.AddressLine3;
            job.DeliveryAddressLine4 = meetingPointAddress.AddressLine4;
            job.DeliveryAddressLine5 = meetingPointAddress.AddressLine5;
            job.DeliveryAddressLine6 = meetingPointAddress.AddressLine6;
            job.DeliveryAddressLine7 = meetingPointAddress.AddressLine7;
            job.DeliveryAddressLine8 = meetingPointAddress.AddressLine8;
            job.DeliveryLatitude = meetingPointAddress.Latitude;
            job.DeliveryLongitude = meetingPointAddress.Longitude;
            job.DeliverToLeaveId = HandOffLeaveType;
            job.DeliverToPrivateBusiness = PrivateResidenceDeliverTo;
            job.DeliverToContact = null;
            job.DeliverToPhone = null;

            await context.SaveChangesAsync();

            // --- Create delivery child via stored procedure ---
            var speedName = job.UcjbSpeedNavigation?.UcjtName;

            var deliveryInput = new CreateMinimalTucJobInputModel
            {
                JobNumber = deliveryJobNumber,
                FromAddress = meetingPointAddress,
                ToAddress = originalDeliveryAddress,
                BookedBy = userName,
                ClientId = job.UcjbClientId ?? 0,
                SpeedId = validSpeedId ?? 0,
                Speed = speedName,
                Amount = job.UcjbAmount ?? 0m,
                Reference = job.UcjbClientRefa,
                ReferenceB = job.UcjbClientRefb,
                TenantCurrentTime = currentTenantTime,
                LoggedInContactId = staffId,
                ToContactName = originalDeliverToContact,
                ToPhoneNumber = originalDeliverToPhone,
                OurRef = job.UcjbOurRef,
                Hold = false,
                PickUpLatitude = meetingPointAddress.Latitude,
                PickUpLongitude = meetingPointAddress.Longitude,
                DeliveryLatitude = originalDeliveryAddress.Latitude,
                DeliveryLongitude = originalDeliveryAddress.Longitude
            };

            var spResult = await jobRepository.CreateMinimalTucJobAsync(deliveryInput);
            if (!spResult.Success || !spResult.JobId.HasValue)
                throw new InvalidOperationException(
                    $"Failed to create delivery child job via stored procedure: {spResult.Message}");

            deliveryJobId = spResult.JobId.Value;

            // Load the delivery job created by the SP and set relationships
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId)
                              ?? throw new InvalidOperationException(
                                  $"Delivery job {deliveryJobId} not found after stored procedure creation");

            deliveryJob.ParentId = jobId;
            deliveryJob.RootParentId = rootParentId;
            deliveryJob.InformationParentId = rootParentId;
            deliveryJob.Sequence = 1;
            deliveryJob.JobRelationshipTypeId = childRelTypeId;
            deliveryJob.UcjbCourierId = null;
            deliveryJob.DisplayInDespatch = false;
            deliveryJob.UcjbVan = job.UcjbVan;

            await context.SaveChangesAsync();

            // Create note for the delivery child
            await CreateSplitJobNoteAsync(context, currentTenantTime, deliveryJobId,
                job.UcjbNotes, staffId);

            // Update display in dispatch
            await UpdateJobDisplayInDespatchAsync(context, rootParentId);

            await transaction.CommitAsync();

            Log.Information(
                "Successfully split job {JobId} — parent is pickup, delivery child {DeliveryId}",
                jobId, deliveryJobId);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Log.Error(ex, "Error splitting job {JobId}", jobId);
            throw;
        }

        await PerformPostSplitOperationsAsync(jobId, userName);

        return (jobId, deliveryJobId);
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
    /// Generates a single child job number using a letter suffix based on total split count from root job.
    /// </summary>
    private static async Task<string> GenerateChildJobNumberAsync(
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

        // Generate single letter suffix for the delivery child
        var suffix = GetLetterSuffix(existingChildCount);

        return $"{mainJobNumber}{suffix}";
    }

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

            // Get all non-void jobs under RootParentID (including root parent), ordered by Sequence
            var jobIdsToRate = await context.TucJobs
                .AsNoTracking()
                .Where(j => j.RootParentId == rootParentId && !j.UcjbVoid)
                .OrderBy(j => j.Sequence)
                .Select(j => j.UcjbId)
                .ToListAsync();

            if (jobIdsToRate.Count == 0)
            {
                Log.Warning("No non-void jobs found for parent {ParentJobId}. Skipping re-rate.", parentJobId);
                return;
            }

            // Rate each job independently
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

            // Sum all rates
            var totalRate = jobRates.Sum(c => c.Rate);

            // Distribute parent amount proportionally based on calculated rates
            var runningTotal = 0m;
            for (var i = 0; i < jobRates.Count; i++)
            {
                decimal jobAmount;
                if (i == jobRates.Count - 1)
                {
                    // Last job absorbs rounding difference to ensure exact balance
                    jobAmount = parentAmount - runningTotal;
                }
                else if (totalRate == 0m)
                {
                    // All rates are 0: distribute evenly
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

    private static async Task CreateSplitJobNoteAsync(
        DespatchContext context,
        DateTime currentTenantTime,
        int deliveryJobId,
        string parentNotes,
        int? staffId)
    {
        var parentNotesText = string.IsNullOrWhiteSpace(parentNotes) ? string.Empty : $"  {parentNotes}";

        var deliveryNote = new TucNote
        {
            JobId = deliveryJobId,
            NoteTypeId = (int)NoteType.InternalNote,
            NoteText = $"SPLIT delivery leg.{parentNotesText}",
            CreatedBy = staffId,
            CreatedDate = currentTenantTime
        };

        await context.TucNotes.AddAsync(deliveryNote);
        await context.SaveChangesAsync();
    }
}
