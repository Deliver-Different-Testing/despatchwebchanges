using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;
using CourierLocation = DespatchWeb.Models.Response.CourierLocation;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Repositories;

public partial class JobRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    ITenantClock clock,
    IClearListEnvelopeService clearListEnvelopeService,
    ICreateJobService createJobService,
    ICourierRepository courierRepository)
    : BaseJobRepository(contextFactory, infoService, clock, clearListEnvelopeService), IJobQueryRepository,
        IJobCommandRepository
{
    private const decimal PriceEqualityTolerance = 0.0001m;

    /// <summary>Dispatcher id that marks a multi-leg job whose siblings share a dispatcher.</summary>
    private const int MultiLegDispatcherId = 148;

    /// <summary>Parent relationship types whose children's shared dispatcher is cleared on restore.</summary>
    private static readonly int[] SharedDispatcherRelationshipTypes = [5, 7];

    private readonly ITenantClock _clock = clock;
    private readonly IDbContextFactory<DespatchContext> _contextFactory = contextFactory;
    private readonly ITenantInfoService _infoService = infoService;

    /// <summary>
    /// Updates pricing fields (amount, PPD, fuel, courier payment) for multiple jobs manually.
    /// Handles both active and archived jobs, updates parent job totals, and manages pricing breakdowns.
    /// </summary>
    /// <param name="data">List of job pricing updates to apply.</param>
    /// <returns>The set of job IDs that were actually found and updated.</returns>
    public async Task<IReadOnlySet<int>> UpdateManualPriceAsync(IReadOnlyList<JobManualPriceModel> data)
    {
        data = data.Select(item => new JobManualPriceModel
        {
            Id = item.Id,
            Amount = item.Amount ?? 0,
            RawBaseAmount = item.RawBaseAmount,
            Fuel = item.Fuel ?? 0,
            Ppd = item.Ppd ?? 0,
            CourierPayment = item.CourierPayment ?? 0,
            CourierFuel = item.CourierFuel ?? 0,
            CourierBonus = item.CourierBonus ?? 0,
            StatusName = item.StatusName,
            CourierCode = item.CourierCode,
            Void = item.Void
        }).ToList();

        // Validation logic remains the same
        if (
            data.Any(d =>
                d.Id <= 0
                || (
                    d.Amount > 0
                    && (
                        d.Ppd < 0
                        || d.Fuel < 0
                        || d.CourierPayment < 0
                        || d.CourierFuel < 0
                        || d.CourierBonus < 0
                        || d.Amount < d.Ppd + d.Fuel
                        || d.Amount < d.CourierPayment + d.CourierFuel + d.CourierBonus
                    )
                )
                || (
                    d.Amount < 0
                    && (
                        d.Ppd > 0
                        || d.Fuel > 0
                        || d.CourierPayment > 0
                        || d.CourierFuel > 0
                        || d.CourierBonus > 0
                        || d.Amount > d.Ppd + d.Fuel
                        || d.Amount > d.CourierPayment + d.CourierFuel + d.CourierBonus
                    )
                )
            )
        )
        {
            throw new ArgumentException(
                "Invalid Values. Please check whether the Total is less than all other amounts", nameof(data));
        }

        var jobIds = data.Select(j => j.Id).Distinct().ToList();

        if (jobIds.Count == 0)
        {
            return new HashSet<int>();
        }

        // Discover the input jobs plus their parents/children directly from the real job tables
        // (live + archived). The legacy tblJob view was unreliable here: any job it failed to
        // surface was silently dropped from the id set, so the UPDATE below matched nothing and
        // the caller saw a "success" with no actual change.
        var activeIdData = Context.TucJobs
            .Where(j =>
                jobIds.Contains(j.UcjbId)
                || (j.ParentId.HasValue && jobIds.Contains(j.ParentId.Value)))
            .Select(j => new { JobId = j.UcjbId, ParentId = j.ParentId ?? j.UcjbId });

        var archivedIdData = Context.TucJobArchives
            .Where(j =>
                jobIds.Contains(j.UcjbId)
                || (j.ParentId.HasValue && jobIds.Contains(j.ParentId.Value)))
            .Select(j => new { JobId = j.UcjbId, ParentId = j.ParentId ?? j.UcjbId });

        var idData = await activeIdData.Concat(archivedIdData).ToListAsync();

        var ids = idData
            .Select(j => j.JobId)
            .Concat(idData.Select(j => j.ParentId))
            .Distinct()
            .ToList();

        // Load the live and archived jobs to mutate on the single repository context so that every
        // write below (job amounts, courier/status changes, and pricing breakdowns) shares one
        // transaction and commits atomically. Previously these saves ran on separate connections,
        // which allowed one to commit while another failed or deadlocked — leaving the price changed
        // while the request reported failure.
        var dbData = await Context
            .TucJobs.AsTracking().Where(j =>
                (ids.Contains(j.UcjbId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value)))
                && j.UcjbLocked != true
            )
            .ToListAsync();

        var dbDataArchive = await Context
            .TucJobArchives.AsTracking().Where(j =>
                (ids.Contains(j.UcjbId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value)))
                && (j.UcjbLocked != 1 || !j.UcjbInvoiceNo.HasValue)
            )
            .ToListAsync();

        // Create dictionaries for O(1) lookups instead of O(n) list searches
        var dbDataDict = dbData.ToDictionary(j => j.UcjbId);
        var dbDataArchiveDict = dbDataArchive.ToDictionary(j => j.UcjbId);

        // Update job status
        await UpdateJobStatusesAsync(data, dbDataDict, dbDataArchiveDict);

        // Update job couriers
        await UpdateJobCouriersAsync(data, dbDataDict, dbDataArchiveDict);

        // Log counts for diagnostics
        Log.Information("Processing {DbDataCount} active jobs and {Count} archived jobs", dbData.Count,
            dbDataArchive.Count);
        // Keep track of jobs with changed prices
        var jobsWithChangedPrices = new HashSet<int>();
        var processedJobIds = new HashSet<int>();

        // Process individual jobs and save in batches
        foreach (var d in data)
        {
            dynamic match = dbDataDict.TryGetValue(d.Id, out var activeJob) ? activeJob
                : dbDataArchiveDict.TryGetValue(d.Id, out var archivedJob) ? archivedJob
                : null;

            if (match == null)
            {
                Log.Warning("Job with ID {DId} not found in database", d.Id);
                continue; // Skip this job instead of throwing an exception
            }

            try
            {
                // Check if the price is actually changing
                if (d.Amount.HasValue && d.Ppd.HasValue && d.Fuel.HasValue && d.CourierPayment.HasValue &&
                    d.CourierFuel.HasValue && d.CourierBonus.HasValue)
                {
                    bool priceChanged =
                        Math.Abs((match.UcjbAmount ?? 0m) - d.Amount.Value) >= PriceEqualityTolerance ||
                        Math.Abs((match.FuelSurchargeAmount ?? 0m) - d.Fuel.Value) >= PriceEqualityTolerance ||
                        Math.Abs((match.PpdexclusiveAmount ?? 0m) - d.Ppd.Value) >= PriceEqualityTolerance;

                    if (priceChanged)
                    {
                        // Apply updates cautiously
                        match.UcjbAmount = Math.Round(d.Amount.Value, 4, MidpointRounding.AwayFromZero);
                        match.FuelSurchargeAmount = Math.Round(d.Fuel.Value, 4, MidpointRounding.AwayFromZero);
                        match.PpdexclusiveAmount = Math.Round(d.Ppd.Value, 4, MidpointRounding.AwayFromZero);
                        match.RawBaseAmount = match.UcjbAmount - match.FuelSurchargeAmount - match.PpdexclusiveAmount;
                        // A directly-entered bulk price is a manual set — flag it so a later
                        // auto re-rate doesn't silently overwrite it.
                        match.RatedManually = true;
                        // Mark this job for a pricing breakdown update
                        jobsWithChangedPrices.Add(d.Id);
                        Log.Information("Job {DId} has price change - updating", d.Id);
                    }
                    else
                    {
                        Log.Information("Job {DId} price unchanged - skipping pricing breakdown update", d.Id);
                    }
                }

                // Always update these fields, regardless of price change
                match.CourierPercentage = null;
                if (d.CourierPayment != null)
                {
                    match.CourierPayment = Math.Round(d.CourierPayment.Value, 4, MidpointRounding.AwayFromZero);
                }

                match.CourierFuel = Math.Round(d.CourierFuel.Value, 4, MidpointRounding.AwayFromZero);
                match.CourierBonus = Math.Round(d.CourierBonus.Value, 4, MidpointRounding.AwayFromZero);

                processedJobIds.Add(d.Id);

                // Save changes for this specific job immediately
            }
            catch (Exception ex)
            {
                Log.Error("Error updating job {DId}: {ExMessage}", d.Id, ex.Message);
            }
        }

        // Process parent jobs separately
        var parentJobs = dbData
            .Select(j => new
            {
                j.UcjbId,
                ParentId = j.ParentId ?? j.UcjbId,
                UcjbAmount = j.UcjbAmount ?? 0m,
                j.FuelSurchargeAmount,
                PpdexclusiveAmount = j.PpdexclusiveAmount ?? 0m
            })
            .Concat(
                dbDataArchive.Select(j => new
                {
                    j.UcjbId,
                    ParentId = j.ParentId ?? j.UcjbId,
                    UcjbAmount = j.UcjbAmount ?? 0m,
                    j.FuelSurchargeAmount,
                    PpdexclusiveAmount = j.PpdexclusiveAmount ?? 0m
                })
            )
            .GroupBy(j => j.ParentId)
            .Where(x => x.Count() > 1)
            .ToList();

        foreach (var x in parentJobs)
        {
            try
            {
                dynamic parentJob = dbDataDict.TryGetValue(x.Key, out var activeParent)
                    ? activeParent
                    : dbDataArchiveDict[x.Key];

                var childJobs = x.Where(j => j.UcjbId != parentJob.UcjbId).ToList();

                if (childJobs.Count == 0)
                {
                    continue;
                }

                var totalAmount = childJobs.Sum(j => j.UcjbAmount);
                var totalFuel = childJobs.Sum(j => j.FuelSurchargeAmount);
                var totalPpd = childJobs.Sum(j => j.PpdexclusiveAmount);

                // Check if a parent job's price is actually changing
                var parentPriceChanged =
                    Math.Abs((decimal)(parentJob.UcjbAmount ?? 0m) - totalAmount) >= PriceEqualityTolerance ||
                    Math.Abs((decimal)(parentJob.FuelSurchargeAmount ?? 0m) - totalFuel) >= PriceEqualityTolerance ||
                    Math.Abs((decimal)(parentJob.PpdexclusiveAmount ?? 0m) - totalPpd) >= PriceEqualityTolerance;

                if (parentPriceChanged)
                {
                    parentJob.UcjbAmount = totalAmount;
                    parentJob.FuelSurchargeAmount = totalFuel;
                    parentJob.PpdexclusiveAmount = totalPpd;
                    parentJob.RawBaseAmount = totalAmount - totalFuel - totalPpd;

                    // The breakdown below gets collapsed to a single "Manually Rated" line since
                    // there's no way to know how to re-split the new total across the old lines —
                    // flag the job so a later auto re-rate doesn't silently overwrite it.
                    parentJob.RatedManually = true;

                    // Mark this parent job for a pricing breakdown update
                    jobsWithChangedPrices.Add(x.Key);
                    Log.Information("Parent job {XKey} has price change - updating", x.Key);
                }
                else
                {
                    Log.Information("Parent job {XKey} price unchanged - skipping pricing breakdown update", x.Key);
                }

                processedJobIds.Add(x.Key);
            }
            catch (Exception ex)
            {
                Log.Error("Error processing parent job {XKey}: {ExMessage}", x.Key, ex.Message);
            }
        }

        // Only update pricing breakdowns for jobs with changed prices
        if (jobsWithChangedPrices.Count != 0)
        {
            // Separate jobs by their source table (active vs. archived)
            var activeJobIds = jobsWithChangedPrices.Where(id => dbData.Any(j => j.UcjbId == id)).ToList();
            var archivedJobIds = jobsWithChangedPrices
                .Where(id => dbDataArchive.Any(j => j.UcjbId == id) && dbData.All(j => j.UcjbId != id)).ToList();

            // Handle active jobs - use the PricingBreakdowns table
            if (activeJobIds.Count != 0)
            {
                var existingBreakdowns = await Context.PricingBreakdowns
                    .Where(pb =>
                        activeJobIds.Contains(pb.JobId ?? 0) ||
                        activeJobIds.Contains(pb.PrebookJobId ?? 0))
                    .ToListAsync();

                if (existingBreakdowns.Count != 0)
                {
                    Log.Information(
                        "Removing {ExistingBreakdownsCount} existing pricing breakdowns for {Count} active jobs with changed prices",
                        existingBreakdowns.Count, activeJobIds.Count);
                    Context.PricingBreakdowns.RemoveRange(existingBreakdowns);
                }

                foreach (var jobId in activeJobIds)
                {
                    var jobFromDb = dbData.FirstOrDefault(j => j.UcjbId == jobId);
                    if (jobFromDb == null)
                    {
                        continue;
                    }

                    var newBreakdown = new PricingBreakdown
                    {
                        JobId = jobId,
                        PrebookJobId = null,
                        ChildJobId = jobFromDb.ParentId,
                        ChargeName = "Manually Rated",
                        ChargeAmount = jobFromDb.UcjbAmount ?? 0,
                        Total = null,
                        Included = null,
                        Charged = null
                    };

                    await Context.PricingBreakdowns.AddAsync(newBreakdown);
                    Log.Information("Added new pricing breakdown for active job {JobId} with amount {Amount}", jobId,
                        jobFromDb.UcjbAmount ?? 0);
                }
            }

            // Handle archived jobs - use PricingBreakdownArchives table
            if (archivedJobIds.Count != 0)
            {
                var existingArchiveBreakdowns = await Context.PricingBreakdownArchives
                    .Where(pb =>
                        archivedJobIds.Contains(pb.JobId ?? 0) ||
                        archivedJobIds.Contains(pb.PrebookJobId ?? 0))
                    .ToListAsync();

                if (existingArchiveBreakdowns.Count != 0)
                {
                    Log.Information(
                        "Removing {ExistingBreakdownsCount} existing pricing breakdown archives for {Count} archived jobs with changed prices",
                        existingArchiveBreakdowns.Count, archivedJobIds.Count);
                    Context.PricingBreakdownArchives.RemoveRange(existingArchiveBreakdowns);
                }

                foreach (var jobId in archivedJobIds)
                {
                    var jobFromArchive = dbDataArchive.FirstOrDefault(j => j.UcjbId == jobId);
                    if (jobFromArchive == null)
                    {
                        continue;
                    }

                    var newArchiveBreakdown = new PricingBreakdownArchive
                    {
                        JobId = jobId,
                        PrebookJobId = null,
                        ChargeName = "Manually Rated",
                        ChargeAmount = jobFromArchive.UcjbAmount ?? 0,
                        Total = null,
                        Included = null,
                        Charged = null
                    };

                    await Context.PricingBreakdownArchives.AddAsync(newArchiveBreakdown);
                    Log.Information("Added new pricing breakdown archive for archived job {JobId} with amount {Amount}",
                        jobId, jobFromArchive.UcjbAmount ?? 0);
                }
            }
        }
        else
        {
            Log.Information("No jobs with changed prices - skipping pricing breakdown updates");
        }

        // Finally, update all jobs to the locked state
        foreach (var d in dbData.Where(j => processedJobIds.Contains(j.UcjbId)))
        {
            d.UcjbLocked = true;
        }

        foreach (var d in dbDataArchive.Where(j => processedJobIds.Contains(j.UcjbId)))
        {
            d.UcjbLocked = 1;
        }

        // Persist every change (job amounts, courier/status updates, pricing breakdowns) inside a
        // single transaction so the batch is all-or-nothing. If any write fails the whole batch rolls
        // back, so callers never observe a job whose price changed while the request reported failure.
        var strategy = Context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await Context.Database.BeginTransactionAsync();
            try
            {
                var changesCount = await Context.SaveChangesAsync();
                await transaction.CommitAsync();
                Log.Information("Successfully saved {ChangesCount} changes", changesCount);
            }
            catch (DbUpdateException ex)
            {
                await transaction.RollbackAsync();
                Log.Error("Error saving changes: {ExMessage}", ex.Message);
                if (ex.InnerException != null)
                {
                    Log.Error("Inner exception: {InnerExceptionMessage}", ex.InnerException.Message);
                }

                throw;
            }
        });

        // Report which of the requested jobs were actually found and updated, so the caller can
        // surface the rest instead of reporting a false success. Parent jobs pulled in for total
        // recomputation are intersected out (only caller-requested IDs are returned).
        processedJobIds.IntersectWith(jobIds);
        return processedJobIds;
    }

    /// <summary>
    /// Updates the void status for multiple jobs. Sets UcjbVoid = true and UcjbStatus = 1000.
    /// </summary>
    /// <param name="jobIds">List of job IDs to void.</param>
    public async Task UpdateJobVoidStatusAsync(IReadOnlyList<int> jobIds)
    {
        if (jobIds.Count == 0)
        {
            return;
        }

        // Use ExecuteUpdateAsync for direct SQL UPDATE without loading entities
        await using var activeContext = CreateNewContext();
        await using var archiveContext = CreateNewContext();

        var activeTask = activeContext.TucJobs
            .Where(j => jobIds.Contains(j.UcjbId))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.UcjbVoid, true)
                .SetProperty(j => j.UcjbStatus, 1000));

        var archiveTask = archiveContext.TucJobArchives
            .Where(j => jobIds.Contains(j.UcjbId))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.UcjbVoid, true)
                .SetProperty(j => j.UcjbStatus, 1000));

        await Task.WhenAll(activeTask, archiveTask);

        foreach (var jobId in jobIds)
        {
            Log.Information("Job {JobId} marked as voided via bulk upload", jobId);
        }
    }

    /// <summary>
    /// Swaps POD (proof of delivery) data between two jobs.
    /// </summary>
    public async Task SwapPodAsync(string job1,
        string job2) =>
        await Context.Procedures.DESWEB_qdfSwapPODAsync(job1, job2);

    /// <summary>
    /// Restores selected jobs back to dispatch status.
    /// </summary>
    /// <param name="jobIds">List of job IDs to redispatch.</param>
    public async Task ReDispatchSelectedJobsAsync(IReadOnlyList<int> jobIds)
    {
        try
        {
            await RestoreJobsCoreAsync(jobIds);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(ReDispatchSelectedJobsAsync)));
            throw;
        }
    }

    /// <summary>
    /// Re-sends selected jobs to the courier device.
    /// </summary>
    /// <param name="jobIds">List of job IDs to resend.</param>
    public async Task ReSendSelectedJobsAsync(IReadOnlyList<int> jobIds)
    {
        if (jobIds.Count == 0)
        {
            return;
        }

        foreach (var jobId in jobIds)
        {
            await Context.Procedures.uspReDespatchJobAsync(jobId);
        }
    }

    /// <summary>
    /// Re-assigns selected jobs to auto-dispatch for courier reassignment.
    /// </summary>
    /// <param name="jobIds">List of job IDs to reassign.</param>
    public async Task ReAssignSelectedJobsAsync(IReadOnlyList<int> jobIds)
    {
        if (jobIds.Count == 0)
        {
            return;
        }

        foreach (var jobId in jobIds)
        {
            await Context.Procedures.uspReassignJobAsync(jobId);
        }
    }

    /// <summary>
    /// Sets a job as the first priority job for a courier.
    /// </summary>
    public async Task SetFirstJobAsync(int jobId, int courierId) =>
        await Context.Procedures.DES_stpJob_AutoDespatchSelectedJobs_FSCourierIDAsync(jobId, courierId);

    /// <summary>
    /// Updates POD (proof of delivery) details including name, time, and status for a job and its related jobs.
    /// </summary>
    /// <param name="data">POD update request with job ID and POD details.</param>
    public async Task UpdatePodDetailsAsync(UpdatePodDetailsRequest data)
    {
        // Find if a job is in active or archive table (tracked for mutation via SaveChanges)
        var activeJob = await Context.TucJobs
            .AsTracking()
            .FirstOrDefaultAsync(j => j.UcjbId == data.JobId);
        var isArchived = activeJob == null;
        int? parentId;
        int? deliveryTzId;
        TucJobArchive archivedJob = null;

        // Determine parent ID and delivery timezone based on job location
        if (isArchived)
        {
            archivedJob = await Context.TucJobArchives
                .AsTracking()
                .FirstOrDefaultAsync(j => j.UcjbId == data.JobId);
            if (archivedJob == null)
                // Job isn't found in either table
            {
                return;
            }

            parentId = archivedJob.ParentId;
            deliveryTzId = archivedJob.DeliverByTimeZoneId;
        }
        else
        {
            parentId = activeJob.ParentId;
            deliveryTzId = activeJob.DeliverByTimeZoneId;
        }

        // Load delivery timezone entity (null falls back to tenant timezone in ParsePodTime)
        var deliveryTimeZone = deliveryTzId.HasValue
            ? await Context.TimeZones.FindAsync(deliveryTzId.Value)
            : null;

        var completionTime = ParsePodTime(data.PodTime, deliveryTimeZone);

        // Update the already-tracked job entity directly (no re-query needed)
        if (isArchived)
        {
            archivedJob.UcjbJobDone = true;
            archivedJob.UcjbStatus = data.JobStatus;
            archivedJob.UcjbPodname = data.PodName;
            archivedJob.UcjbComplTime = completionTime;
            archivedJob.InternalStatus = (int)InternalJobStatus.Reprice;
        }
        else
        {
            activeJob.UcjbJobDone = true;
            activeJob.UcjbStatus = data.JobStatus;
            activeJob.UcjbPodname = data.PodName;
            activeJob.UcjbComplTime = completionTime;
            activeJob.InternalStatus = (int)InternalJobStatus.Reprice;
        }

        // Update parent job if all siblings are complete (only relevant for child jobs)
        if (parentId != null)
        {
            var hasUncompletedSiblings = await Context.TucJobs
                .AnyAsync(j => j.ParentId == parentId &&
                               j.UcjbId != data.JobId &&
                               j.UcjbId != parentId &&
                               j.UcjbJobDone == false &&
                               j.UcjbVoid == false);

            if (!hasUncompletedSiblings)
            {
                await UpdateParentJobCompletionDetailsAsync(
                    parentId.Value,
                    data.JobStatus,
                    data.PodName,
                    completionTime,
                    isArchived);
            }
        }

        await Context.SaveChangesAsync();
    }

    /// <summary>
    /// Re-sends all jobs assigned to a courier to their device.
    /// </summary>
    public async Task ReSendAllJobsAsync(int courierId) =>
        await Context.Procedures.uspReDespatchJobByCourierIDAsync(courierId);

    /// <summary>
    /// Resets the late notification flag for a job's pickup or delivery event.
    /// </summary>
    /// <param name="jobId">The job ID.</param>
    /// <param name="lateEventType">The type of late event (Pickup or Delivery).</param>
    public async Task ResetLateEventAsync(int jobId,
        int lateEventType)
    {
        switch (lateEventType)
        {
            case (int)LateEventType.Pickup:
                await Context.TucJobs
                    .Where(j => j.UcjbId == jobId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(j => j.LatePickupNotificationHasBeenSent, false));
                break;
            case (int)LateEventType.Delivery:
                await Context.TucJobs
                    .Where(j => j.UcjbId == jobId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(j => j.LateDeliveryNotificationHasBeenSent, false));
                break;
        }
    }

    /// <summary>
    /// Marks a job as late for pickup and updates the late pickup time.
    /// </summary>
    /// <param name="jobId">The job ID.</param>
    /// <param name="bookedSpeed">The booked speed short name.</param>
    /// <param name="notifiedSpeed">The notified speed short name.</param>
    /// <param name="late">The late time in minutes.</param>
    /// <param name="calculationRequired">Whether to calculate the late time based on ETA.</param>
    public async Task LatePickupAsync(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        bool calculationRequired
    )
    {
        var currentDate = _clock.TenantNow;

        var time = await Context.TucJobTypes
            .Where(jt => jt.ShortName == bookedSpeed || jt.ShortName == notifiedSpeed)
            .MaxAsync(jt => jt.PickupTime);

        // Get job information
        var job = await Context.TucJobs.AsTracking().FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job);

        if (!job.UcjbTime.HasValue)
        {
            return;
        }

        var jobDateTime = job.UcjbDate.Add(job.UcjbTime.Value.TimeOfDay);
        var windowValue = job.UcjbLatePick ?? time;

        if (!windowValue.HasValue)
        {
            return;
        }

        var dueMins = (jobDateTime.AddMinutes((double)windowValue) - currentDate).TotalMinutes;
        var latePick = job.UcjbLatePick;

        if (calculationRequired)
        {
            var pickupEtaValue = late;
            late = (int)(pickupEtaValue - (int)dueMins + windowValue);
            if (latePick.GetValueOrDefault(0) == late)
            {
                return;
            }
        }

        var minsOver = late - time;
        await SaveNoteAsync(jobId: jobId, noteText: $"Late Pickup: {minsOver} mins over ETA");

        // Update job
        job.UcjbStatus = (int)JobStatus.LatePickup;
        job.UcjbLatePick = late;
        job.LatePickupNotificationHasBeenSent = false;

        await Context.SaveChangesAsync();
    }

    /// <summary>
    /// Marks a job as late for delivery and updates the late delivery time.
    /// </summary>
    /// <param name="jobId">The job ID.</param>
    /// <param name="bookedSpeed">The booked speed short name.</param>
    /// <param name="notifiedSpeed">The notified speed short name.</param>
    /// <param name="late">The late time in minutes.</param>
    /// <param name="calculationRequired">Whether to calculate the late time based on ETA.</param>
    public async Task LateDeliveryAsync(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        bool calculationRequired
    )
    {
        var currentDate = _clock.TenantNow;

        // Get the maximum delivery time for the specified speeds
        var time = await Context.TucJobTypes
            .Where(predicate: jt => jt.ShortName == bookedSpeed || jt.ShortName == notifiedSpeed)
            .MaxAsync(selector: jt => jt.DeliveryTime);

        // Get job information
        var job = await Context.TucJobs.AsTracking().FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job);

        if (!job.UcjbTime.HasValue)
        {
            return;
        }

        // Calculate DueMins, LateDel, and Window
        var jobDateTime = job.UcjbDate.Add(value: job.UcjbTime.Value.TimeOfDay);
        var windowValue = job.UcjbLateDel ?? time;

        if (!windowValue.HasValue)
        {
            return;
        }

        var dueMins = (jobDateTime.AddMinutes(value: (double)windowValue) - currentDate).TotalMinutes;
        var lateDel = job.UcjbLateDel;

        // Perform calculation if required
        if (calculationRequired)
        {
            var deliveryEtaValue = late;
            late = (int)(deliveryEtaValue - (int)dueMins + windowValue);

            // Return if lateDel is already equal to late
            if (lateDel.GetValueOrDefault(defaultValue: 0) == late)
            {
                return;
            }
        }

        // Format delivery time
        var minsOver = late - time;

        await SaveNoteAsync(jobId: jobId, noteText: $"Late Delivery: {minsOver} mins over ETA");

        // Update job
        job.UcjbStatus = (int)JobStatus.LateDelivery;
        job.UcjbLateDel = late;
        job.LateDeliveryNotificationHasBeenSent = false;

        await Context.SaveChangesAsync();
    }

    /// <summary>
    /// Restores split jobs back to their original state.
    /// </summary>
    /// <param name="jobIds">List of job IDs to restore.</param>
    public async Task RestoreSplitJobsAsync(IReadOnlyList<int> jobIds)
    {
        if (jobIds is null or { Count: 0 })
        {
            return;
        }

        foreach (var jobId in jobIds)
        {
            await Context.Procedures.DES_stpJob_SplitJobRestoreAsync(jobId);
        }
    }

    /// <summary>
    /// Restores the given jobs back to active dispatch status, including genuinely-completed
    /// jobs (the operator confirms that in the UI). Proof of delivery is always preserved
    /// (see <see cref="RestoreJobsCoreAsync"/>).
    /// </summary>
    /// <param name="jobIds">List of job IDs to restore.</param>
    public async Task RestoreJobsAsync(IReadOnlyList<int> jobIds)
    {
        try
        {
            await RestoreJobsCoreAsync(jobIds);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(RestoreJobsAsync)));
            throw;
        }
    }

    /// <summary>
    /// Voids a job and optionally its related jobs, clearing all pricing fields and closing tasks.
    /// If the job is a parent, all children are also voided regardless of VoidSingleJobOnly.
    /// </summary>
    /// <param name="data">Void request containing job ID, reason, and options for voiding related jobs.</param>
    public async Task VoidJobAsync(VoidJobRequest data)
    {
        try
        {
            // Use selected job IDs if provided, otherwise fall back to legacy behavior
            var jobsToVoid = data.SelectedJobIds is { Count: > 0 }
                ? data.SelectedJobIds
                : data.VoidSingleJobOnly
                    ? await GetJobWithChildrenAsync(data.JobId)
                    : await GetAllRelatedJobIdsIncludingParentAsync(data.JobId);

            if (jobsToVoid.Count == 0)
            {
                return;
            }

            // Get courier IDs before voiding
            var courierIds = await Context.TucJobs
                .Where(jt => jobsToVoid.Contains(jt.UcjbId) && jt.UcjbCourierId.HasValue)
                .Select(jt => jt.UcjbCourierId!.Value)
                .Distinct()
                .TagWith($"VoidJob - Get Courier IDs for {jobsToVoid.Count} jobs")
                .ToListAsync();

            // Execute a void operation and clear all pricing fields
            await Context.TucJobs
                .Where(j => jobsToVoid.Contains(j.UcjbId))
                .TagWith($"VoidJob - Update {jobsToVoid.Count} jobs")
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbStatus, (int)JobStatus.Void)
                    .SetProperty(j => j.UcjbVoid, true)
                    .SetProperty(j => j.UcjbAmount, 0)
                    .SetProperty(j => j.FuelSurchargeAmount, 0m)
                    .SetProperty(j => j.Ppdamount, 0)
                    .SetProperty(j => j.PpdexclusiveAmount, 0)
                    .SetProperty(j => j.PickupAmount, 0)
                    .SetProperty(j => j.DropoffAmount, 0)
                    .SetProperty(j => j.Nwamount, 0)
                    .SetProperty(j => j.Gssamount, 0)
                    .SetProperty(j => j.RawAmount, 0)
                    .SetProperty(j => j.PickupRawAmount, 0)
                    .SetProperty(j => j.DropoffRawAmount, 0)
                    .SetProperty(j => j.NwrawAmount, 0)
                    .SetProperty(j => j.RawBaseAmount, 0));

            // Clear pricing breakdowns for voided jobs
            await Context.PricingBreakdowns
                .Where(p => (p.JobId.HasValue && jobsToVoid.Contains(p.JobId.Value)) ||
                            (p.ChildJobId.HasValue && jobsToVoid.Contains(p.ChildJobId.Value)))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.ChargeAmount, 0m)
                    .SetProperty(p => p.Total, 0)
                    .SetProperty(p => p.Included, 0)
                    .SetProperty(p => p.Charged, 0)
                    .SetProperty(p => p.CostAmount, 0));

            // Void any linked bulk jobs
            var linkedBulkJobIds = await Context.TblBulkJobs
                .Where(b => b.JobId.HasValue && jobsToVoid.Contains(b.JobId.Value) && !b.Void)
                .Select(b => b.BulkJobId)
                .TagWith($"VoidJob - Find linked bulk jobs for {jobsToVoid.Count} jobs")
                .ToListAsync();

            if (linkedBulkJobIds.Count > 0)
            {
                var bulkCourierIds = await Context.TblBulkJobs
                    .Where(b => linkedBulkJobIds.Contains(b.BulkJobId) && b.CourierId.HasValue)
                    .Select(b => b.CourierId!.Value)
                    .Distinct()
                    .ToListAsync();

                courierIds = courierIds.Union(bulkCourierIds).ToList();

                await Context.TblBulkJobs
                    .Where(b => linkedBulkJobIds.Contains(b.BulkJobId))
                    .TagWith($"VoidJob - Void {linkedBulkJobIds.Count} linked bulk jobs")
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(b => b.JobStatus, (int)JobStatus.Void)
                        .SetProperty(b => b.Void, true)
                        .SetProperty(b => b.Amount, 0)
                        .SetProperty(b => b.CourierPayment, 0));

                await CloseAllBulkJobTasksAsync(linkedBulkJobIds);
                await SaveMultipleBulkNotesAsync(linkedBulkJobIds, data.VoidReason);
            }

            // Update courier statuses
            if (courierIds.Count > 0)
            {
                await UpdateClearListAreaOrderStatus(courierIds);
            }

            // Close tasks
            await CloseTasksByJobIdsAsync(jobsToVoid);
            await SaveNoteToMultipleJobsAsync(jobsToVoid, data.VoidReason);

            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error voiding job {JobId} (SingleOnly: {VoidSingleJobOnly})",
                data.JobId, data.VoidSingleJobOnly);
            throw;
        }
    }

    /// <summary>
    /// Voids an archived job and optionally its related archived jobs, clearing all pricing fields.
    /// Unlike live job voiding, this does not update courier statuses or close tasks (not applicable to archived jobs).
    /// </summary>
    /// <param name="data">Void request containing job ID, reason, and options for voiding related jobs.</param>
    public async Task VoidArchivedJobAsync(VoidJobRequest data)
    {
        try
        {
            // Use selected job IDs if provided, otherwise fall back to legacy behavior
            var jobsToVoid = data.SelectedJobIds is { Count: > 0 }
                ? data.SelectedJobIds
                : data.VoidSingleJobOnly
                    ? await GetArchivedJobWithChildrenAsync(data.JobId)
                    : await GetAllRelatedArchivedJobIdsIncludingParentAsync(data.JobId);

            if (jobsToVoid.Count == 0)
            {
                return;
            }

            // Verify all jobs are actually archived (reject mixed scenarios)
            var liveJobCount = await Context.TucJobs
                .CountAsync(j => jobsToVoid.Contains(j.UcjbId));

            if (liveJobCount > 0)
            {
                throw new InvalidOperationException(
                    $"Cannot void archived jobs: {liveJobCount} job(s) are not archived. Mixed live/archived voiding is not supported.");
            }

            // Execute a void operation and clear all pricing fields on archived jobs
            await Context.TucJobArchives
                .Where(j => jobsToVoid.Contains(j.UcjbId))
                .TagWith($"VoidArchivedJob - Update {jobsToVoid.Count} archived jobs")
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbStatus, (int)JobStatus.Void)
                    .SetProperty(j => j.UcjbVoid, true)
                    .SetProperty(j => j.UcjbAmount, 0)
                    .SetProperty(j => j.FuelSurchargeAmount, 0m)
                    .SetProperty(j => j.Ppdamount, 0)
                    .SetProperty(j => j.PpdexclusiveAmount, 0)
                    .SetProperty(j => j.PickupAmount, 0)
                    .SetProperty(j => j.DropoffAmount, 0)
                    .SetProperty(j => j.Nwamount, 0)
                    .SetProperty(j => j.Gssamount, 0)
                    .SetProperty(j => j.RawAmount, 0)
                    .SetProperty(j => j.PickupRawAmount, 0)
                    .SetProperty(j => j.DropoffRawAmount, 0)
                    .SetProperty(j => j.NwrawAmount, 0)
                    .SetProperty(j => j.RawBaseAmount, 0));

            // Clear pricing breakdowns for voided archived jobs
            await Context.PricingBreakdownArchives
                .Where(p => p.JobId.HasValue && jobsToVoid.Contains(p.JobId.Value))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.ChargeAmount, 0m)
                    .SetProperty(p => p.Total, 0)
                    .SetProperty(p => p.Included, 0)
                    .SetProperty(p => p.Charged, 0)
                    .SetProperty(p => p.CostAmount, 0));

            // Skip: courier status updates (not applicable to archived jobs)
            // Skip: task closing (not applicable to archived jobs)

            // Add void note to archived notes
            await SaveNoteToMultipleArchivedJobsAsync(jobsToVoid, data.VoidReason);

            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error voiding archived job {JobId} (SingleOnly: {VoidSingleJobOnly})",
                data.JobId, data.VoidSingleJobOnly);
            throw;
        }
    }

    /// <summary>
    /// Voids a bulk job and optionally its related jobs, updating courier statuses and closing tasks.
    /// </summary>
    /// <param name="data">Void request containing bulk job ID, reason, and options for voiding related jobs.</param>
    public async Task VoidBulkJobAsync(VoidBulkJobRequest data)
    {
        try
        {
            // Use selected job IDs if provided, otherwise fall back to legacy behavior
            var jobsToVoid = data.SelectedJobIds is { Count: > 0 }
                ? data.SelectedJobIds
                : data.VoidSingleJobOnly
                    ? await GetBulkJobWithChildrenAsync(data.BulkJobId)
                    : await GetAllRelatedBulkJobIdsIncludingParentAsync(data.BulkJobId);

            // Combined query: void jobs and get distinct courier IDs in parallel
            await Context.TblBulkJobs
                .Where(j => jobsToVoid.Contains(j.BulkJobId))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.JobStatus, (int)JobStatus.Void)
                    .SetProperty(j => j.Void, true)
                    .SetProperty(j => j.Amount, 0)
                    .SetProperty(j => j.CourierPayment, 0));

            var courierIds = await Context.TblBulkJobs
                .Where(jt => jobsToVoid.Contains(jt.BulkJobId) && jt.CourierId.HasValue)
                .Select(jt => jt.CourierId.Value)
                .Distinct()
                .ToListAsync();

            // Update courier statuses in parallel
            await UpdateClearListAreaOrderStatus(courierIds);

            // Close tasks and add notes
            await CloseAllBulkJobTasksAsync(jobsToVoid);
            await SaveMultipleBulkNotesAsync(jobsToVoid, data.VoidReason);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error voiding job {JobId} (SingleOnly: {VoidSingleJobOnly})",
                data.BulkJobId, data.VoidSingleJobOnly);
            throw;
        }
    }

    /// <summary>
    /// Reverses a job split, merging child jobs back into the parent.
    /// </summary>
    /// <param name="jobId">The job ID to unsplit.</param>
    /// <returns>Status message from the unsplit operation.</returns>
    public async Task<string> UnSplitJobAsync(int jobId)
    {
        var message = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await Context.Procedures.DES_stpJob_UnSplitAsync(jobId, message, returnValue);
        return message.Value;
    }

    /// <summary>
    /// Adds a new pricing breakdown component to a job or prebook job.
    /// </summary>
    /// <param name="viewModel">The charge details to add.</param>
    /// <param name="isArchived">True if adding to an archived job.</param>
    /// <returns>The ID of the newly created pricing breakdown record.</returns>
    public async Task<int> AddJobPriceBreakdownAsync(ChargeViewModel viewModel, bool isArchived = false)
    {
        try
        {
            // Validate charge name (required by database constraint)
            if (string.IsNullOrWhiteSpace(viewModel.Name))
            {
                throw new ArgumentException("Charge name is required", nameof(viewModel));
            }

            if (viewModel.Name.Length > 100)
            {
                throw new ArgumentException("Charge name cannot exceed 100 characters", nameof(viewModel));
            }

            if (viewModel.ChildJobId is null && viewModel.PrebookJobId is null)
            {
                return 0;
            }

            var isPrebook = viewModel.PrebookJobId.HasValue;

            int effectiveJobId;
            if (!isPrebook && viewModel.ChildJobId.HasValue)
            {
                effectiveJobId = isArchived
                    ? await Context.GetEffectiveArchiveJobIdAsync(viewModel.ChildJobId.Value)
                    : await Context.GetEffectiveJobIdAsync(viewModel.ChildJobId.Value);
            }
            else
            {
                effectiveJobId = await Context.GetEffectiveJobBookingIdAsync(viewModel.PrebookJobId ?? 0);
            }

            // Validate job was found (effectiveJobId of 0 indicates job not found)
            if (effectiveJobId == 0)
            {
                var jobIdentifier = isPrebook
                    ? $"PrebookJobId {viewModel.PrebookJobId}"
                    : $"ChildJobId {viewModel.ChildJobId}";
                throw new InvalidOperationException($"Job not found: {jobIdentifier}");
            }

            var note = $"Added price component: {viewModel.Name} for ${viewModel.Amount:F2}";

            if (isArchived && !isPrebook)
            {
                var archiveItem = new PricingBreakdownArchive
                {
                    ChargeAmount = viewModel.Amount,
                    ChargeName = viewModel.Name,
                    JobId = effectiveJobId,
                    CostAmount = viewModel.CostAmount
                };

                await Context.PricingBreakdownArchives.AddAsync(archiveItem);
                await Context.SaveChangesAsync();

                await SetArchiveJobAsManuallyPriceAsync(effectiveJobId);

                await RecalculateJobAmountFromBreakdownAsync(
                    effectiveJobId, null, viewModel.ChildJobId, isArchived: true);

                return archiveItem.PricingBreakdownId;
            }

            var item = new PricingBreakdown
            {
                ChargeAmount = viewModel.Amount,
                ChargeName = viewModel.Name,
                JobId = !isPrebook ? effectiveJobId : null,
                PrebookJobId = isPrebook ? effectiveJobId : null,
                CostAmount = viewModel.CostAmount,
                ChildJobId = viewModel.ChildJobId
            };

            switch (isPrebook)
            {
                case true:
                    await SetPrebookJobAsManuallyPriceAsync(viewModel.PrebookJobId.Value, note);
                    break;
                default:
                    if (viewModel.ChildJobId != null)
                    {
                        await SetJobAsManuallyPriceAsync(viewModel.ChildJobId.Value, note);
                    }

                    break;
            }

            await Context.PricingBreakdowns.AddAsync(item);
            await Context.SaveChangesAsync();

            await RecalculateJobAmountFromBreakdownAsync(
                item.JobId, item.PrebookJobId, item.ChildJobId, isArchived: false);

            return item.PricingBreakdownId;
        }
        catch (DbUpdateException e)
        {
            Log.Error(e.InnerException ?? e,
                "Database error in AddJobPriceBreakdownAsync. ViewModel: {@ViewModel}, IsArchived: {IsArchived}",
                viewModel, isArchived);
            throw;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(AddJobPriceBreakdownAsync)));
            throw;
        }
    }

    /// <summary>
    /// Updates an existing pricing breakdown component.
    /// </summary>
    /// <param name="viewModel">The updated charge details.</param>
    /// <param name="isArchived">True if updating an archived job's pricing breakdown.</param>
    public async Task UpdateJobPriceBreakdownAsync(ChargeViewModel viewModel, bool isArchived = false)
    {
        if (viewModel.JobId is null && viewModel.PrebookJobId is null)
        {
            return;
        }

        int rowsAffected;
        if (isArchived)
        {
            rowsAffected = await Context.PricingBreakdownArchives
                .Where(p => p.PricingBreakdownId == viewModel.ChargeId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.ChargeAmount, viewModel.Amount)
                    .SetProperty(p => p.ChargeName, viewModel.Name)
                    .SetProperty(p => p.CostAmount, viewModel.CostAmount));
        }
        else
        {
            rowsAffected = await Context.PricingBreakdowns
                .Where(p => p.PricingBreakdownId == viewModel.ChargeId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.ChargeAmount, viewModel.Amount)
                    .SetProperty(p => p.ChargeName, viewModel.Name)
                    .SetProperty(p => p.CostAmount, viewModel.CostAmount));
        }

        if (rowsAffected == 0)
        {
            return;
        }

        var note = $"Updated price breakdown: {viewModel.Name} charge amount changed to {viewModel.Amount:C}";

        if (viewModel.PrebookJobId != null)
        {
            await SetPrebookJobAsManuallyPriceAsync(viewModel.PrebookJobId.Value, note);
        }
        else if (viewModel.JobId != null && !isArchived)
        {
            await SetJobAsManuallyPriceAsync(viewModel.JobId.Value, note);
        }
        else if (viewModel.JobId != null)
        {
            await SetArchiveJobAsManuallyPriceAsync(viewModel.JobId.Value);
        }

        await RecalculateJobAmountFromBreakdownAsync(
            viewModel.JobId, viewModel.PrebookJobId, viewModel.ChildJobId, isArchived);
    }

    /// <summary>
    /// Deletes a pricing breakdown component from a job.
    /// </summary>
    /// <param name="chargeId">The pricing breakdown ID to delete.</param>
    /// <param name="isArchived">True if deleting from an archived job.</param>
    public async Task DeleteJobPriceBreakdownAsync(int chargeId, bool isArchived = false)
    {
        if (isArchived)
        {
            var archiveBreakdown = await Context.PricingBreakdownArchives
                .FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
            if (archiveBreakdown == null)
            {
                return;
            }

            var archiveJobId = archiveBreakdown.JobId;
            Context.PricingBreakdownArchives.Remove(archiveBreakdown);
            await Context.SaveChangesAsync();

            if (archiveJobId != null)
            {
                await SetArchiveJobAsManuallyPriceAsync(archiveJobId.Value);
            }

            await RecalculateJobAmountFromBreakdownAsync(
                archiveJobId, null, null, isArchived: true);
            return;
        }

        var breakdown = await Context.PricingBreakdowns
            .FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
        if (breakdown == null)
        {
            return;
        }

        var note = $"Deleted {chargeId} - {breakdown.ChargeName} - {breakdown.ChargeAmount}";

        var isPrebook = breakdown.PrebookJobId.HasValue;
        switch (isPrebook)
        {
            case true:
                if (breakdown.PrebookJobId != null)
                {
                    await SetPrebookJobAsManuallyPriceAsync(breakdown.PrebookJobId.Value, note);
                }

                break;
            default:
                if (breakdown.JobId != null)
                {
                    await SetJobAsManuallyPriceAsync(breakdown.JobId.Value, note);
                }

                break;
        }

        var deletedJobId = breakdown.JobId;
        var deletedPrebookId = breakdown.PrebookJobId;
        var deletedChildJobId = breakdown.ChildJobId;

        Context.PricingBreakdowns.Remove(breakdown);
        await Context.SaveChangesAsync();

        await RecalculateJobAmountFromBreakdownAsync(
            deletedJobId, deletedPrebookId, deletedChildJobId, isArchived: false);
    }

    /// <summary>
    /// Updates the delivery address for a job (active or archived).
    /// </summary>
    /// <param name="request">Request containing job ID and new address details.</param>
    public async Task UpdateDeliveryAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;
            var isArchived = await IsJobArchived(request.JobId);

            // Combine all address lines for device sync field
            var fullAddress = CombineAddressLines(address);

            // Update archive record if JobId is found
            if (isArchived)
            {
                await Context.TucJobArchives
                    .Where(j => j.UcjbId == request.JobId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(j => j.DeliveryLatitude, address.Latitude)
                        .SetProperty(j => j.DeliveryLongitude, address.Longitude)
                        .SetProperty(j => j.DeliveryAddressLine1, address.AddressLine1)
                        .SetProperty(j => j.DeliveryAddressLine2, address.AddressLine2)
                        .SetProperty(j => j.DeliveryAddressLine3, address.AddressLine3)
                        .SetProperty(j => j.DeliveryAddressLine4, address.AddressLine4)
                        .SetProperty(j => j.DeliveryAddressLine5, address.AddressLine5)
                        .SetProperty(j => j.DeliveryAddressLine6, address.AddressLine6)
                        .SetProperty(j => j.DeliveryAddressLine7, address.AddressLine7)
                        .SetProperty(j => j.DeliveryAddressLine8, address.AddressLine8)
                        .SetProperty(j => j.UcjbToAddr, fullAddress));

                return;
            }

            var rowsAffected = await Context.TucJobs
                .Where(j => j.UcjbId == request.JobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.DeliveryLatitude, address.Latitude)
                    .SetProperty(j => j.DeliveryLongitude, address.Longitude)
                    .SetProperty(j => j.DeliveryAddressLine1, address.AddressLine1)
                    .SetProperty(j => j.DeliveryAddressLine2, address.AddressLine2)
                    .SetProperty(j => j.DeliveryAddressLine3, address.AddressLine3)
                    .SetProperty(j => j.DeliveryAddressLine4, address.AddressLine4)
                    .SetProperty(j => j.DeliveryAddressLine5, address.AddressLine5)
                    .SetProperty(j => j.DeliveryAddressLine6, address.AddressLine6)
                    .SetProperty(j => j.DeliveryAddressLine7, address.AddressLine7)
                    .SetProperty(j => j.DeliveryAddressLine8, address.AddressLine8)
                    .SetProperty(j => j.UcjbToAddr, fullAddress));

            if (rowsAffected == 0)
            {
                throw new ArgumentException($"Job with ID {request.JobId} not found", nameof(request));
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobRepository),
                    nameof(UpdateDeliveryAddressAsync)));
            throw;
        }
    }

    /// <summary>
    /// Updates the pickup address for a job (active or archived).
    /// </summary>
    /// <param name="request">Request containing job ID and new address details.</param>
    public async Task UpdatePickupAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;
            var isArchived = await IsJobArchived(request.JobId);

            // Combine all address lines for device sync field
            var fullAddress = CombineAddressLines(address);

            if (isArchived)
            {
                await Context.TucJobArchives
                    .Where(j => j.UcjbId == request.JobId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(j => j.PickUpLatitude, address.Latitude)
                        .SetProperty(j => j.PickUpLongitude, address.Longitude)
                        .SetProperty(j => j.PickupAddressLine1, address.AddressLine1)
                        .SetProperty(j => j.PickupAddressLine2, address.AddressLine2)
                        .SetProperty(j => j.PickupAddressLine3, address.AddressLine3)
                        .SetProperty(j => j.PickupAddressLine4, address.AddressLine4)
                        .SetProperty(j => j.PickupAddressLine5, address.AddressLine5)
                        .SetProperty(j => j.PickupAddressLine6, address.AddressLine6)
                        .SetProperty(j => j.PickupAddressLine7, address.AddressLine7)
                        .SetProperty(j => j.PickupAddressLine8, address.AddressLine8)
                        .SetProperty(j => j.UcjbFromAddr, fullAddress));

                return;
            }

            var rowsAffected = await Context.TucJobs
                .Where(j => j.UcjbId == request.JobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.PickUpLatitude, address.Latitude)
                    .SetProperty(j => j.PickUpLongitude, address.Longitude)
                    .SetProperty(j => j.PickupAddressLine1, address.AddressLine1)
                    .SetProperty(j => j.PickupAddressLine2, address.AddressLine2)
                    .SetProperty(j => j.PickupAddressLine3, address.AddressLine3)
                    .SetProperty(j => j.PickupAddressLine4, address.AddressLine4)
                    .SetProperty(j => j.PickupAddressLine5, address.AddressLine5)
                    .SetProperty(j => j.PickupAddressLine6, address.AddressLine6)
                    .SetProperty(j => j.PickupAddressLine7, address.AddressLine7)
                    .SetProperty(j => j.PickupAddressLine8, address.AddressLine8)
                    .SetProperty(j => j.UcjbFromAddr, fullAddress));

            if (rowsAffected == 0)
            {
                throw new ArgumentException($"Job with ID {request.JobId} not found", nameof(request));
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobRepository),
                    nameof(UpdatePickupAddressAsync)));
            throw;
        }
    }

    /// <summary>
    /// Updates a single property on a job (active or archived).
    /// </summary>
    /// <param name="jobId">The job ID to update.</param>
    /// <param name="field">The property to update.</param>
    /// <param name="value">The new value.</param>
    public async Task UpdateJobAsync(
        int jobId,
        JobProperty field,
        string value
    )
    {
        try
        {
            var isArchived = await IsJobArchived(jobId);
            if (isArchived)
            {
                await UpdateTucJobArchiveAsync(jobId, field, value);
                return;
            }

            // Job will be active
            await UpdateTucJobAsync(jobId, field, value);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured updating Job {jobId}", jobId);
            throw;
        }
    }

    /// <summary>
    /// Releases a bulk job (and any children) to live dispatch, creating a TblBulkRun if one
    /// doesn't exist yet and invoking UTL_stpJob_InsertFromTblBulkJob for each releasable row.
    /// Returns the live job numbers that were released, in book-date order, so the caller
    /// can show them to the operator and let them copy/paste into the search filter.
    ///
    /// Throws InvalidOperationException for the conditions that were previously silent
    /// "commit-with-no-work" returns: bulk job not found, all children already released, or
    /// the SP completed but no matching live tucJob exists afterward.
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to release.</param>
    /// <returns>The released job numbers, in book-date order.</returns>
    public async Task<IReadOnlyList<string>> ReleaseBulkJobByIdAsync(int bulkJobId)
    {
        var strategy = Context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await Context.Database.BeginTransactionAsync();

            try
            {
                var currentTenantTime = _clock.TenantNow;
                var releaseNote = $"Bulk Job Released Manually at {currentTenantTime:dd/MM/yyyy HH:mm}\r\n";

                // Stamp BookDate + Notes across the parent and any children.
                var updatedCount = await Context.TblBulkJobs
                    .Where(b => b.BulkJobId == bulkJobId || b.ParentId == bulkJobId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(b => b.BookDate, currentTenantTime)
                        .SetProperty(b => b.Notes, b => releaseNote + (b.Notes ?? string.Empty)));

                if (updatedCount == 0)
                {
                    throw new InvalidOperationException(
                        $"Bulk job {bulkJobId} not found — no parent or child rows matched.");
                }

                var releasable = await Context.TblBulkJobs
                    .Where(b => b.Done == false && (b.BulkJobId == bulkJobId || b.ParentId == bulkJobId))
                    .OrderBy(b => b.BookDate)
                    .ThenBy(b => b.BookTime)
                    .ThenBy(b => b.BulkJobId)
                    .Select(b => new { b.BulkJobId, b.JobNumber, b.ClientCode })
                    .ToListAsync();

                if (releasable.Count == 0)
                {
                    throw new InvalidOperationException(
                        $"Bulk job {bulkJobId} has no releasable rows — all children may already be Done.");
                }

                var releasableIds = releasable.Select(r => (int?)r.BulkJobId).ToList();
                var runName = await Context.TblBulkJobRuns
                    .Where(jr => releasableIds.Contains(jr.BulkJobId))
                    .Join(Context.TblBulkRuns,
                        jr => jr.RunId,
                        r => r.Id,
                        (jr, r) => r.Name)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrEmpty(runName))
                {
                    runName = releasable[0].ClientCode + currentTenantTime.ToString("HHmm");

                    var newRun = new TblBulkRun
                    {
                        Name = runName,
                        Mins = null,
                        Kms = null,
                        CourierId = null,
                        Status = 0,
                        Revenue = null,
                        Payout = null,
                        CourierPercentage = null,
                        GoogleRouteResponse = null,
                        Created = currentTenantTime,
                        LastModified = currentTenantTime
                    };
                    await Context.TblBulkRuns.AddAsync(newRun);
                    await Context.SaveChangesAsync();

                    var jobRuns = releasable.Select(r => new TblBulkJobRun
                    {
                        RunId = newRun.Id,
                        BulkJobId = r.BulkJobId,
                        PickRunOrder = null
                    }).ToList();
                    await Context.TblBulkJobRuns.AddRangeAsync(jobRuns);
                    await Context.SaveChangesAsync();
                }

                foreach (var row in releasable)
                {
                    await Context.Procedures.UTL_stpJob_InsertFromTblBulkJobAsync(
                        bulkJobID: row.BulkJobId,
                        runName: runName,
                        courierID: null,
                        runStatus: null,
                        jobBookingID: null,
                        returnValue: null,
                        cancellationToken: CancellationToken.None
                    );
                }

                // Verify the SP actually inserted live tucJob rows for the numbers we expected.
                var jobNumbers = releasable.Select(r => r.JobNumber).ToList();
                var liveJobCount = await Context.TucJobs
                    .Where(j => jobNumbers.Contains(j.UcjbNumber) && !j.UcjbVoid)
                    .CountAsync();

                if (liveJobCount != jobNumbers.Count)
                {
                    throw new InvalidOperationException(
                        $"Bulk release for {bulkJobId} expected {jobNumbers.Count} live jobs " +
                        $"({string.Join(", ", jobNumbers)}) but only {liveJobCount} are present and not voided. " +
                        "The insert stored procedure or a trigger may have failed silently — investigate before retrying.");
                }

                await transaction.CommitAsync();
                return (IReadOnlyList<string>)jobNumbers;
            }
            catch (Exception e)
            {
                await transaction.RollbackAsync();
                Log.Error(e, "{Message}",
                    ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                        nameof(ReleaseBulkJobByIdAsync)));
                throw;
            }
        });
    }

    /// <summary>
    /// Creates a new job with minimal required information for quick entry by running the
    /// legacy DD_stpJob_InsertExcelerator stored procedure (source = DespatchWeb, not held).
    /// Job-number generation and speed lookup happen here; the proc owns the authoritative
    /// tucJob insert. Pricing is passed through as a fixed amount.
    /// </summary>
    /// <param name="request">Job creation request with addresses, client, and speed.</param>
    /// <returns>The ID of the newly created job.</returns>
    public async Task<int> QuickAddJobAsync(JobCreateViewModel request)
    {
        try
        {
            var now = _infoService.GetCurrentTenantTime();
            var staffInfo = await _infoService.GetStaffInfoAsync()
                            ?? throw new InvalidOperationException("Unable to resolve staff info for quick add job.");

            var jobNumber = await GenerateJobNumberAsync(staffInfo.Id, request.SpeedId);
            var speed = await GetJobTypeByIdAsync(request.SpeedId);

            var jobInput = BuildQuickAddInputModel(request, staffInfo, jobNumber, speed.UcjtName, now);

            return await InsertQuickAddJobViaProcAsync(jobInput);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(QuickAddJobAsync)));
            throw;
        }
    }

    /// <summary>
    /// Creates paired phantom jobs for an inter-courier charge transfer between two couriers.
    /// The jobs are inserted directly as already-completed and hidden from dispatch — they exist
    /// only to move money between couriers, not as real work to be performed.
    /// </summary>
    /// <param name="viewModel">The inter-courier charge details including from/to courier and amount.</param>
    public async Task AddInterCourierChargeAsync(InterCourierChargeViewModel viewModel)
    {
        try
        {
            var staffId = _infoService.GetStaffId();
            var currentTime = _clock.TenantNow;

            // Parallel job-number generation requires separate contexts (stored proc per context).
            await using var fromJobNumberContext = await _contextFactory.CreateDbContextAsync();
            await using var toJobNumberContext = await _contextFactory.CreateDbContextAsync();

            var fromJobNumber =
                await GenerateJobNumberAsync(staffId, (int)JobServiceType.AllServices, fromJobNumberContext);
            var toJobNumber =
                await GenerateJobNumberAsync(staffId, (int)JobServiceType.AllServices, toJobNumberContext);

            var (fromJob, toJob) = BuildIccJobPair(fromJobNumber, toJobNumber, viewModel, currentTime, staffId);

            await using var insertContext = await _contextFactory.CreateDbContextAsync();
            await createJobService.InsertJobRawAsync(insertContext, fromJob, CancellationToken.None);
            await createJobService.InsertJobRawAsync(insertContext, toJob, CancellationToken.None);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(AddInterCourierChargeAsync)));
            throw;
        }
    }

    /// <summary>
    /// Associates client items with a job and updates the job amount.
    /// </summary>
    public async Task AddClientsItemToJobAsync(
        int jobId,
        IReadOnlyList<int> clientItemIds,
        decimal totalCost
    )
    {
        var clientItemsString =
            clientItemIds.Count == 0
                ? string.Empty
                : string.Join(",", clientItemIds);

        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.ClientItemIds, clientItemsString)
                .SetProperty(j => j.UcjbAmount, totalCost));
    }

    /// <summary>
    /// Updates the read status for multiple jobs in a single atomic operation.
    /// </summary>
    /// <param name="data">Request containing job IDs and whether to mark as read or unread.</param>
    public async Task BulkUpdateReadStatusAsync(BulkReadUpdateRequestModel data)
    {
        var jobIds = data.JobIds;
        if (jobIds == null || jobIds.Count == 0)
        {
            return;
        }

        var currentTenantTime = _clock.TenantNow;
        var staffId = _infoService.GetStaffId();
        var shouldMarkAsRead = data.ShouldMarkAsRead;

        var parameterPlaceholders = string.Join(",", jobIds.Select((_, i) => $"@p{i + 3}"));

        var parameters = new List<object> { shouldMarkAsRead, currentTenantTime, staffId };
        parameters.AddRange(jobIds.Cast<object>());

        var sql = """
                  -- Update existing tracker records
                  UPDATE tucJobReadTracker
                  SET HasBeenRead = @p0, ReadTimestamp = @p1, ReadByStaffId = @p2
                  WHERE JobId IN (
                  """ + parameterPlaceholders + """
                                                );

                                                -- Insert new tracker records only for jobs that exist in tucJob and don't have a tracker yet
                                                -- Uses NOT EXISTS to prevent PK violation race condition
                                                INSERT INTO tucJobReadTracker (JobId, HasBeenRead, ReadByStaffId, ReadTimestamp)
                                                SELECT j.UcjbId, @p0, @p2, @p1
                                                FROM tucJob j
                                                WHERE j.UcjbId IN (
                                                """ + parameterPlaceholders + """
                                                                              )
                                                                                AND NOT EXISTS (SELECT 1 FROM tucJobReadTracker t WHERE t.JobId = j.UcjbId);
                                                                              """;
        await Context.Database.ExecuteSqlRawAsync(sql, parameters.ToArray());
    }

    /// <summary>
    /// Updates or creates package/parcel items for a job.
    /// </summary>
    /// <param name="jobId">The job ID to update packages for.</param>
    /// <param name="parcels">List of parcel dimensions to add or update.</param>
    /// <param name="calculateDimsOncePerJob"></param>
    public async Task UpdatePackagesForJobAsync(int jobId,
        IReadOnlyList<ParcelDimensions> parcels,
        bool? calculateDimsOncePerJob = null)
    {
        try
        {
            // A null list means "remove all parcels" — treat it as empty.
            parcels ??= [];

            // Archived jobs live in tucJobArchive / tucJobItemsArchive, not the live tables —
            // route them to the archive equivalents so package/weight edits on archived (but
            // not-yet-invoiced) jobs succeed instead of failing.
            if (await IsJobArchived(jobId))
            {
                await UpdatePackagesForArchivedJobAsync(jobId, parcels, calculateDimsOncePerJob);
                return;
            }

            var effectiveJobId = await Context.GetEffectiveJobIdAsync(jobId);
            var childJobId = await IsStopJob(jobId) ? jobId : (int?)null;

            Log.Information(
                "UpdatePackages for Job {JobId} (effective {EffectiveJobId}, child {ChildJobId}): {Count} parcels",
                jobId, effectiveJobId, childJobId, parcels.Count);

            var strategy = Context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await Context.Database.BeginTransactionAsync();

                // Delete all existing items for this scope
                await Context.TucJobItems
                    .Where(i => i.JobId == effectiveJobId &&
                                (childJobId == null || i.ChildJobId == childJobId))
                    .ExecuteDeleteAsync();

                // Re-insert all parcels with sequential ItemIds
                if (parcels.Count > 0)
                {
                    // Get max ItemId across ALL items for this job (not just this scope)
                    // to avoid collisions with sibling stop jobs
                    var maxItemId = await Context.TucJobItems
                        .Where(i => i.JobId == effectiveJobId)
                        .MaxAsync(i => (int?)i.ItemId) ?? 0;

                    var nextItemId = maxItemId + 1;

                    var newItems = parcels.Select(p => new TucJobItem
                    {
                        JobId = effectiveJobId,
                        ChildJobId = childJobId,
                        Height = p.Height ?? 0,
                        Length = p.Length ?? 0,
                        Depth = p.Depth ?? 0,
                        Weight = p.Weight ?? 0,
                        Cubic = p.Cubic,
                        Notes = p.ItemName,
                        Barcode = p.Barcode,
                        Items = 1,
                        ItemId = nextItemId++
                    }).ToList();

                    await Context.TucJobItems.AddRangeAsync(newItems);
                    await Context.SaveChangesAsync();
                }

                // Update UcjbQty with total parcel count so it syncs to device
                // For stop jobs, only count items belonging to this specific stop (not sibling stops)
                var totalItemCount = await Context.TucJobItems
                    .Where(i => i.JobId == effectiveJobId &&
                                (childJobId == null || i.ChildJobId == childJobId))
                    .CountAsync();

                int? dimensionsType = calculateDimsOncePerJob is true ? 2 : null;

                if (childJobId == null)
                {
                    // Non-stop: sync qty across parent and all split children (they share the same parcels)
                    if (calculateDimsOncePerJob.HasValue)
                    {
                        await Context.TucJobs
                            .Where(j => j.UcjbId == effectiveJobId || j.RootParentId == effectiveJobId)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(j => j.UcjbQty, (short)totalItemCount)
                                .SetProperty(j => j.DimensionsType, dimensionsType));
                    }
                    else
                    {
                        await Context.TucJobs
                            .Where(j => j.UcjbId == effectiveJobId || j.RootParentId == effectiveJobId)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(j => j.UcjbQty, (short)totalItemCount));
                    }
                }
                else
                {
                    // Stop job: each stop has its own parcels — only update this stop's qty
                    if (calculateDimsOncePerJob.HasValue)
                    {
                        await Context.TucJobs
                            .Where(j => j.UcjbId == jobId)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(j => j.UcjbQty, (short)totalItemCount)
                                .SetProperty(j => j.DimensionsType, dimensionsType));
                    }
                    else
                    {
                        await Context.TucJobs
                            .Where(j => j.UcjbId == jobId)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(j => j.UcjbQty, (short)totalItemCount));
                    }
                }

                await transaction.CommitAsync();
            });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository),
                    nameof(UpdatePackagesForJobAsync)));
            throw;
        }
    }

    public async Task UpdateJobWeightAsync(int jobId, decimal weight)
    {
        // Archived jobs live in tucJobArchive, not tucJob — route them to the archive tables
        // so weight edits on archived (but not-yet-invoiced) jobs succeed instead of silently
        // updating zero live rows.
        if (await IsJobArchived(jobId))
        {
            await UpdateArchivedJobWeightAsync(jobId, weight);
            return;
        }

        if (await IsStopJob(jobId))
        {
            // Stop job: each stop has its own weight — only update this stop
            await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.UcjbWeight, (double)weight));
            return;
        }

        // Non-stop: resolve to parent and sync weight across the entire delivery chain
        var effectiveJobId = await Context.GetEffectiveJobIdAsync(jobId);
        await Context.TucJobs
            .Where(j => j.UcjbId == effectiveJobId || j.RootParentId == effectiveJobId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UcjbWeight, (double)weight));
    }

    /// <summary>
    /// Updates or creates package/parcel items for a bulk job.
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to update packages for.</param>
    /// <param name="parcels">List of parcel dimensions to add or update.</param>
    /// <param name="calculateDimsOncePerJob"></param>
    public async Task UpdatePackagesForBulkJobAsync(int bulkJobId,
        IReadOnlyList<ParcelDimensions> parcels,
        bool? calculateDimsOncePerJob = null)
    {
        try
        {
            var effectiveJobId = await Context.GetEffectiveBulkJobIdAsync(bulkJobId);
            int? childJobId = effectiveJobId != bulkJobId ? bulkJobId : null;

            var strategy = Context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await Context.Database.BeginTransactionAsync();

                // Delete all existing items for this scope
                await Context.TblBulkJobItems
                    .Where(i => i.JobId == effectiveJobId &&
                                (childJobId == null || i.ChildJobId == childJobId))
                    .ExecuteDeleteAsync();

                // Re-insert all parcels with sequential ItemIds
                if (parcels.Count > 0)
                {
                    // Get max ItemId across ALL items for this job (not just this scope)
                    // to avoid collisions with sibling stop jobs
                    var maxItemId = await Context.TblBulkJobItems
                        .Where(i => i.JobId == effectiveJobId)
                        .MaxAsync(i => (int?)i.ItemId) ?? 0;

                    var nextItemId = maxItemId + 1;

                    var newItems = parcels.Select(p => new TblBulkJobItem
                    {
                        JobId = effectiveJobId,
                        ChildJobId = childJobId,
                        Height = p.Height ?? 0,
                        Length = p.Length ?? 0,
                        Depth = p.Depth ?? 0,
                        Weight = p.Weight ?? 0,
                        Cubic = p.Cubic,
                        Notes = p.ItemName,
                        Barcode = p.Barcode,
                        ItemId = nextItemId++
                    }).ToList();

                    await Context.TblBulkJobItems.AddRangeAsync(newItems);
                    await Context.SaveChangesAsync();
                }

                if (calculateDimsOncePerJob.HasValue)
                {
                    int? dimensionsType = calculateDimsOncePerJob.Value ? 2 : null;
                    await Context.TblBulkJobs
                        .Where(j => j.BulkJobId == effectiveJobId || j.RootParentId == effectiveJobId)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(j => j.DimensionsType, dimensionsType));
                }

                await transaction.CommitAsync();
            });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository),
                    nameof(UpdatePackagesForBulkJobAsync)));
            throw;
        }
    }


    /// <summary>
    /// Adds new package items to a job with sequential item IDs.
    /// </summary>
    public async Task AddPackagesToJobAsync(int effectiveJobId,
        List<TucJobItem> items)
    {
        var maxItemId = await Context.TucJobItems
            .Where(i => i.JobId == effectiveJobId)
            .MaxAsync(i => (int?)i.ItemId) ?? 0;

        for (var i = 0; i < items.Count; i++) items[i].ItemId = maxItemId + i + 1;

        await Context.TucJobItems.AddRangeAsync(items);
        await Context.SaveChangesAsync();
    }

    /// <summary>
    /// Updates the notes field for a job.
    /// </summary>
    /// <param name="jobId">The job ID to update.</param>
    /// <param name="note">The new notes content.</param>
    public async Task UpdateJobNoteAsync(int jobId,
        string note)
    {
        try
        {
            Log.Information("Starting note update for job {JobId}", jobId);

            var rowsAffected = await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbNotes, note));

            if (rowsAffected == 0)
            {
                Log.Warning("Job {JobId} not found", jobId);
                throw new KeyNotFoundException($"Job with ID {jobId} not found");
            }

            Log.Information(
                "Successfully updated note for job {JobId}. New note length: {NewLength}",
                jobId,
                note.Length
            );
        }
        catch (KeyNotFoundException ex)
        {
            Log.Error(ex, "Job not found when updating note for job {JobId}", jobId);
            throw;
        }
        catch (DbUpdateException ex)
        {
            Log.Error(ex, "Database error occurred while updating note for job {JobId}", jobId);
            throw;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unexpected error updating note for job {JobId}", jobId);
            throw;
        }
    }

    /// <summary>
    /// Updates the read status for a single job using MERGE for race condition safety.
    /// </summary>
    /// <param name="jobId">The job ID.</param>
    /// <param name="hasBeenRead">Whether to mark as read or unread.</param>
    public async Task UpdateJobReadStatusAsync(int jobId,
        bool hasBeenRead)
    {
        try
        {
            var staffId = _infoService.GetStaffId();
            var currentTenantTime = _clock.TenantNow;

            // Use MERGE to handle concurrent inserts safely (prevents PK violation race condition)
            await Context.Database.ExecuteSqlInterpolatedAsync($"""
                                                                                MERGE INTO tucJobReadTracker WITH (HOLDLOCK) AS target
                                                                                USING (SELECT {jobId} AS JobId) AS source
                                                                                ON target.JobId = source.JobId
                                                                                WHEN MATCHED THEN
                                                                                    UPDATE SET HasBeenRead = {hasBeenRead},
                                                                                               ReadByStaffId = {staffId},
                                                                                               ReadTimestamp = {currentTenantTime}
                                                                                WHEN NOT MATCHED THEN
                                                                                    INSERT (JobId, HasBeenRead, ReadByStaffId, ReadTimestamp)
                                                                                    VALUES ({jobId}, {hasBeenRead}, {staffId}, {currentTenantTime});
                                                                """);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(UpdateJobReadStatusAsync)));
            throw;
        }
    }

    /// <summary>
    /// Manually reprices a job with a new total price.
    /// </summary>
    /// <param name="data">Repricing data including job ID and new price.</param>
    public async Task SimpleRepriceJobManualAsync(SimpleRepriceJobModel data)
    {
        try
        {
            var rowsChanged = data switch
            {
                { IsBulk: true } => await Context.TblBulkJobs
                    .Where(j => j.BulkJobId == data.JobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Amount, data.NewPrice)),

                { IsPrebook: true } => await Context.TucJobBookings
                    .Where(j => j.UcbkId == data.JobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.RatedManually, true)
                        .SetProperty(j => j.UcbkAmount, data.NewPrice)),

                _ => await RepriceRegularOrArchivedJobAsync(data)
            };

            if (rowsChanged == 0)
            {
                throw new InvalidOperationException($"Job {data.JobId} not found");
            }

            if (data is { IsBulk: false, IsPrebook: false })
            {
                await SyncBreakdownLinesToChildAmountAsync(data.JobId, data.NewPrice);
            }
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(SimpleRepriceJobManualAsync)));
            throw;
        }
    }

    /// <summary>
    /// Reprices a job using a base amount and calculates the fuel surcharge.
    /// Uses the UTL_fncJob_RawBaseToAmount database function to calculate the total.
    /// </summary>
    /// <param name="data">Repricing data including job ID and base amount.</param>
    /// <returns>The calculated total including fuel surcharge.</returns>
    public async Task<decimal> RepriceJobWithBaseAmountAsync(RepriceJobWithBaseAmountModel data)
    {
        try
        {
            // Call the database function to calculate total with fuel surcharge
            var totalAmount = await Context.TucJobs
                .Select(_ => DespatchContext.UTL_fncJob_RawBaseToAmount(data.JobId, data.BaseAmount))
                .FirstOrDefaultAsync() ?? 0m;

            if (data.IsPrebook)
            {
                var rowsChanged = await Context.TucJobBookings
                    .Where(j => j.UcbkId == data.JobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.RatedManually, true)
                        .SetProperty(j => j.UcbkAmount, totalAmount));

                if (rowsChanged == 0)
                {
                    throw new InvalidOperationException($"Job booking {data.JobId} not found");
                }
            }
            else
            {
                // Try regular jobs first
                var rowsChanged = await Context.TucJobs
                    .Where(j => j.UcjbId == data.JobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.RatedManually, true)
                        .SetProperty(j => j.UcjbAmount, totalAmount));

                // Fall back to archived jobs if not found
                if (rowsChanged == 0)
                {
                    rowsChanged = await Context.TucJobArchives
                        .Where(j => j.UcjbId == data.JobId)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(j => j.RatedManually, true)
                            .SetProperty(j => j.UcjbAmount, totalAmount));
                }

                if (rowsChanged == 0)
                {
                    throw new InvalidOperationException($"Job {data.JobId} not found");
                }

                await SyncBreakdownLinesToChildAmountAsync(data.JobId, totalAmount);
            }

            return totalAmount;
        }
        catch (InvalidOperationException e)
        {
            Log.Error(e, "{Message}", ErrorMessageStringFormatter.FormatForLogging(e,
                nameof(JobRepository), nameof(RepriceJobWithBaseAmountAsync)));
            throw;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(RepriceJobWithBaseAmountAsync)));
            throw;
        }
    }

    /// <summary>
    /// Assigns a courier to one or more jobs.
    /// </summary>
    /// <param name="jobIds">List of job IDs to assign.</param>
    /// <param name="courierId">The courier ID to assign.</param>
    public async Task AssignCourierToJobAsync(IReadOnlyList<int> jobIds, int courierId)
    {
        var rowsChanged = await AssignCourierToJobsAsync(jobIds, courierId);
        if (rowsChanged == 0)
        {
            throw new InvalidOperationException($"No records found for jobs: {string.Join(", ", jobIds)}");
        }
    }

    /// <summary>
    /// Auto-dispatches courier assignment to related child jobs based on parent job assignments.
    /// Only updates child jobs that have auto-dispatch enabled and no courier assigned.
    /// </summary>
    /// <param name="jobIds">List of parent job IDs whose courier assignments should cascade to children.</param>
    /// <param name="internalStatus">The internal status to set on child jobs.</param>
    public async Task AssignCourierToChildJobsAsync(IReadOnlyList<int> jobIds, InternalJobStatus internalStatus)
    {
        if (jobIds is null or { Count: 0 })
        {
            return;
        }

        var strategy = Context.Database.CreateExecutionStrategy();

        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await Context.Database.BeginTransactionAsync();

            try
            {
                var parentJobValues = await Context.TucJobs
                    .Where(parent => jobIds.Contains(parent.UcjbId) && parent.ParentId.HasValue)
                    .Select(parent => new
                    {
                        parent.ParentId,
                        parent.UcjbCourierId,
                        parent.UcjbDispId,
                        parent.UcjbDispTime,
                        parent.UcjbDispDate,
                        parent.UcjbStatus,
                        parent.UcjbDate
                    })
                    .ToListAsync();

                if (parentJobValues.Count == 0)
                {
                    return;
                }

                var parentIds = parentJobValues
                    .Where(p => p.ParentId.HasValue)
                    .Select(p => p.ParentId.Value)
                    .Distinct()
                    .ToList();

                var parentValuesByParentId = parentJobValues
                    .GroupBy(p => p.ParentId!.Value)
                    .ToDictionary(g => g.Key, g => g.OrderBy(p => p.UcjbDate).First());

                var childJobsToUpdate = await Context.TucJobs
                    .Where(child => parentIds.Contains(child.ParentId.Value)
                                    && child.UcjbCourierId == null
                                    && child.JobRelationshipType.AutoDespatchToOtherChildJobs == true
                                    && !jobIds.Contains(child.UcjbId))
                    .Select(child => new
                    {
                        child.UcjbId,
                        child.ParentId,
                        child.UcjbDate
                    })
                    .ToListAsync();

                var allChildIdsToUpdate = new List<(int childId, int parentId)>();

                foreach (var (parentId, parentValues) in parentValuesByParentId)
                {
                    var childIds = childJobsToUpdate
                        .Where(c => c.ParentId == parentId && c.UcjbDate.Date <= parentValues.UcjbDate.Date)
                        .Select(c => (c.UcjbId, parentId))
                        .ToList();

                    allChildIdsToUpdate.AddRange(childIds);
                }

                if (allChildIdsToUpdate.Count == 0)
                {
                    await transaction.CommitAsync();
                    return;
                }

                foreach (var (parentId, parentValues) in parentValuesByParentId)
                {
                    var childIdsForThisParent = allChildIdsToUpdate
                        .Where(x => x.parentId == parentId)
                        .Select(x => x.childId)
                        .ToList();

                    if (childIdsForThisParent.Count == 0)
                    {
                        continue;
                    }

                    await Context.TucJobs
                        .Where(j => childIdsForThisParent.Contains(j.UcjbId))
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(j => j.UcjbCourierId, parentValues.UcjbCourierId)
                            .SetProperty(j => j.UcjbDispId, parentValues.UcjbDispId)
                            .SetProperty(j => j.UcjbDispTime, parentValues.UcjbDispTime)
                            .SetProperty(j => j.UcjbDispDate, parentValues.UcjbDispDate)
                            .SetProperty(j => j.UcjbStatus, parentValues.UcjbStatus)
                            .SetProperty(j => j.InternalStatus, (int)internalStatus));
                }

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        });
    }


    public async Task<CreateMinimalTucJobResponse> CreateMinimalTucJobAsync(CreateMinimalTucJobInputModel data,
        CancellationToken cancellationToken = default) =>
        await createJobService.CreateJobAsync(data, cancellationToken);

    /// <summary>
    /// Reads the most recent external (non-Staff) qty change from JobDeliveryJourney and applies
    /// it to TucJob.UcjbQty, then records a Staff journey entry so to apply is auditable.
    /// </summary>
    public async Task<bool> ApplyWebQtyUpdateAsync(int jobId)
    {
        var pendingChange = await Context.JobDeliveryJourneys
            .Where(j => j.JobId == jobId &&
                        j.FieldName == "ucjbQty" &&
                        j.UpdatedByType != nameof(DeliveryJourneyUpdatedByType.Staff) &&
                        j.NewValue != null)
            .OrderByDescending(j => j.UpdatedAt)
            .FirstOrDefaultAsync();

        if (pendingChange == null)
        {
            return false;
        }

        if (!short.TryParse(pendingChange.NewValue, out var newQty))
        {
            return false;
        }

        var currentQty = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.UcjbQty)
            .FirstOrDefaultAsync();

        // Guard: qty already matches — update was previously applied
        if (currentQty == newQty)
        {
            return false;
        }

        var rowsAffected = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbQty, newQty));

        if (rowsAffected == 0)
        {
            return false;
        }

        await Context.JobDeliveryJourneys.AddAsync(new JobDeliveryJourney
        {
            JobId = jobId,
            ChangeType = nameof(DeliveryJourneyChangeType.JobUpdate),
            FieldName = "ucjbQty",
            OldValue = currentQty.ToString(),
            NewValue = newQty.ToString(),
            StaffId = _infoService.GetStaffId(),
            UpdatedAt = DateTime.UtcNow,
            UpdatedByType = nameof(DeliveryJourneyUpdatedByType.Staff)
        });
        await Context.SaveChangesAsync();

        return true;
    }

    public async Task<decimal> GetJobAmountAsync(int jobId, bool isBooking)
    {
        if (isBooking)
        {
            return await Context.TucJobBookings
                .Where(j => j.UcbkId == jobId)
                .Select(j => j.UcbkAmount ?? 0)
                .FirstOrDefaultAsync();
        }

        return await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.UcjbAmount ?? 0)
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// Retrieves a bulk job and its related family jobs (parent and siblings).
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to retrieve.</param>
    /// <returns>View model containing the main job and related jobs in the family.</returns>
    public async Task<JobGroupViewModel> GetBulkJobDetailAsync(int bulkJobId)
    {
        try
        {
            // Get the main job's parent ID first
            var parentIdQuery = await Context.TblBulkJobs
                .Where(j => j.BulkJobId == bulkJobId)
                .Select(j => j.ParentId ?? j.BulkJobId)
                .FirstOrDefaultAsync();

            if (parentIdQuery == 0)
            {
                return new JobGroupViewModel
                {
                    Job = null,
                    RelatedJobs = []
                };
            }

            var familyRootId = parentIdQuery;

            var allJobs = await Context.TblBulkJobs
                .Where(j => j.BulkJobId == familyRootId || j.ParentId == familyRootId)
                .Select(JobMappings.BulkJobMapping)
                .TagWith($"GetBulkJobDetail - Family {familyRootId}")
                .ToListAsync();

            var mainBulkJob = allJobs.FirstOrDefault(j => j.Id == bulkJobId);
            var relatedJobs = allJobs.Where(j => j.Id != bulkJobId).ToList();

            return new JobGroupViewModel
            {
                Job = mainBulkJob,
                RelatedJobs = relatedJobs
            };
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(GetBulkJobDetailAsync)));
            throw;
        }
    }

    /// <summary>
    /// Retrieves detailed dispatch information for a bulk job including addresses, speed, and status.
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to retrieve.</param>
    /// <returns>Dispatch job view model with full job details.</returns>
    public async Task<DispatchJobViewModel> GetBulkDispatchJobDetailAsync(int bulkJobId)
    {
        var isUsCustomer = _infoService.IsUsTenant();

        var bulkJob = await (
                from j in Context.TblBulkJobs
                join c in Context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
                from courier in courierJoin.DefaultIfEmpty()
                join t in Context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
                from speed in speedJoin.DefaultIfEmpty()
                join s in Context.TucJobStatuses on j.JobStatus equals s.UcjsId into statusJoin
                from status in statusJoin.DefaultIfEmpty()
                join rt in Context.TucJobReadTrackers on j.JobId equals rt.JobId into rtJoin
                from readTracker in rtJoin.DefaultIfEmpty()
                join vs in Context.VehicleSizes on j.Size equals vs.VehicleSizeId into vsJoin
                from vehicleSize in vsJoin.DefaultIfEmpty()
                join cl in Context.TucClients on j.ClientId equals cl.UcclId into clientJoin
                from client in clientJoin.DefaultIfEmpty()
                where j.BulkJobId == bulkJobId
                select new DispatchJobViewModel
                {
                    Id = j.BulkJobId,
                    HasBeenRead = readTracker != null && readTracker.HasBeenRead,
                    IsParentOrSingle = !j.ParentId.HasValue || j.ParentId == j.JobId,
                    ParentId = j.ParentId,

                    IsFlightJob = speed != null
                                  && speed.GroupingId == (isUsCustomer
                                      ? (int)SpeedGrouping.Flight
                                      : (int)UrgentSpeedGrouping.Flight),
                    IsAgentJob = speed != null
                                 && speed.GroupingId == (isUsCustomer
                                     ? (int)SpeedGrouping.Agent
                                     : (int)UrgentSpeedGrouping.NationwideAgent),

                    Vehicle = vehicleSize != null
                        ? new Suggestion
                        {
                            Id = vehicleSize.VehicleSizeId,
                            Text = vehicleSize.VehicleName
                        }
                        : null,

                    Time = j.BookTime,
                    ClientId = j.ClientId,
                    Client = j.ClientCode,
                    ClientName = client != null ? client.UcclName : string.Empty,
                    PickupAddress = new AddressViewModel
                    {
                        AddressLine1 = j.PickupAddressLine1,
                        AddressLine2 = j.PickupAddressLine2,
                        AddressLine3 = j.PickupAddressLine3,
                        AddressLine4 = j.PickupAddressLine4,
                        AddressLine5 = j.PickupAddressLine5,
                        AddressLine6 = j.PickupAddressLine6,
                        AddressLine7 = j.PickupAddressLine7,
                        AddressLine8 = j.PickupAddressLine8,
                        Latitude = !string.IsNullOrEmpty(j.PickUpLatitude)
                            ? decimal.Parse(j.PickUpLatitude)
                            : null,
                        Longitude = !string.IsNullOrEmpty(j.PickUpLongitude)
                            ? decimal.Parse(j.PickUpLongitude)
                            : null
                    },
                    DeliveryAddress = new AddressViewModel
                    {
                        AddressLine1 = j.DeliveryAddressLine1,
                        AddressLine2 = j.DeliveryAddressLine2,
                        AddressLine3 = j.DeliveryAddressLine3,
                        AddressLine4 = j.DeliveryAddressLine4,
                        AddressLine5 = j.DeliveryAddressLine5,
                        AddressLine6 = j.DeliveryAddressLine6,
                        AddressLine7 = j.DeliveryAddressLine7,
                        AddressLine8 = j.DeliveryAddressLine8,
                        Latitude = !string.IsNullOrEmpty(j.DeliveryLatitude)
                            ? decimal.Parse(j.DeliveryLatitude)
                            : null,
                        Longitude = !string.IsNullOrEmpty(j.DeliveryLongitude)
                            ? decimal.Parse(j.DeliveryLongitude)
                            : null
                    },
                    JobNo = j.JobNumber,
                    Courier = courier != null ? courier.Code : null,
                    StatusId = j.JobStatus,
                    Status = status != null ? status.UcjsCode : null,
                    Speed = speed != null ? speed.ShortName : null,
                    SpeedId = j.Speed,
                    Booked = new DateTime(
                        j.BookDate.Year,
                        j.BookDate.Month,
                        j.BookDate.Day,
                        j.BookTime.Hour,
                        j.BookTime.Minute,
                        j.BookTime.Second
                    ),
                    IsBulkJob = true
                })
            .FirstOrDefaultAsync();

        return bulkJob;
    }

    /// <summary>
    /// Searches bulk jobs with filtering by date, client, courier, speed, and wildcard text.
    /// </summary>
    /// <param name="data">Search parameters including date range, filters, and pagination.</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Paginated search results with bulk job details.</returns>
    public async Task<JobSearchResult> BulkSearchAsync(PodSearchRequest data,
        CancellationToken cancellationToken = default)
    {
        var isUsCustomer = _infoService.IsUsTenant();
        var jobSearch = (data.Job ?? string.Empty).Trim().ToLower();
        var wildSearch = (data.Wild ?? string.Empty).ToLower();

        // Build the base query
        var query = from j in Context.TblBulkJobs
            join c in Context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
            from courier in courierJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
            from speed in speedJoin.DefaultIfEmpty()
            join s in Context.TucJobStatuses on j.JobStatus equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join rt in Context.TucJobReadTrackers on j.JobId equals rt.JobId into rtJoin
            from readTracker in rtJoin.DefaultIfEmpty()
            join vs in Context.VehicleSizes on j.Size equals vs.VehicleSizeId into vsJoin
            from vehicleSize in vsJoin.DefaultIfEmpty()
            join cl in Context.TucClients on j.ClientId equals cl.UcclId into clientJoin
            from client in clientJoin.DefaultIfEmpty()
            where
                // Hide routed schedule jobs (Steve, 2026-06-22): a tblBulkJob row is "routed"
                // when its live job link (tblBulkJob.JobID = tucJob.ucjbID) points to a tucJob
                // whose RouteId is set. Route-auto-assign stamps RouteId on tucJob at materialisation,
                // so this predicate drops every routed schedule job from JobSearch Bulk Job Data.
                !Context.TucJobs.Any(tj => tj.UcjbId == j.JobId && tj.RouteId != null)
                && (
                    // When searching by specific bulk job ID, ignore all other filters
                    data.BulkJobIdSet
                        ? j.BulkJobId == data.BulkJobId
                        : j.BookDate.Date >= data.FromDate.Date
                          && j.BookDate.Date <= data.ToDate.Date
                          && (!data.ClientSet || data.ClientIds.Contains(j.ClientId))
                          && (!data.CourierSet || (j.CourierId.HasValue && data.CourierIds.Contains(j.CourierId.Value)))
                          && (!data.SpeedSet || data.SpeedIds.Contains(j.Speed))
                          && (!data.JobSet || EF.Functions.Like(j.JobNumber.ToLower(), $"%{jobSearch}%"))
                          && (
                              !data.WildSet
                              || EF.Functions.Like(
                                  (j.FromAddress ?? string.Empty)
                                  + " "
                                  + (j.Contact ?? string.Empty)
                                  + " "
                                  + (j.FromSuburb ?? string.Empty)
                                  + " "
                                  + (j.ToAddress ?? string.Empty)
                                  + " "
                                  + (j.DeliverToContact ?? string.Empty)
                                  + " "
                                  + (j.ToSuburb ?? string.Empty)
                                  + " "
                                  + (j.ClientRefa ?? string.Empty)
                                  + " "
                                  + (j.ClientRefb ?? string.Empty)
                                  + " "
                                  + (j.OurRef ?? string.Empty)
                                  + " "
                                  + j.JobNumber.ToLower()
                                  + " "
                                  + j.Barcode.ToLower()
                                  + " "
                                  + (j.PickupFromContact ?? string.Empty)
                                  + " "
                                  + (j.PickupFromPhone ?? string.Empty)
                                  + " "
                                  + (j.DeliverToPhone ?? string.Empty)
                                  + " "
                                  + (j.ProofOfDeliveryEmail ?? string.Empty)
                                  + " "
                                  + (j.ProofOfDeliveryMobile ?? string.Empty)
                                  + " "
                                  + (j.TrackingEmail ?? string.Empty)
                                  + " "
                                  + (j.TrackingMobile ?? string.Empty),
                                  wildSearch
                              )
                          )
                )
            orderby j.BookDate, j.BookTime, j.JobId, j.BulkJobId
            select new DispatchJobViewModel
            {
                Id = j.BulkJobId,
                HasBeenRead = readTracker != null && readTracker.HasBeenRead,
                IsParentOrSingle = !j.ParentId.HasValue || j.ParentId == j.JobId,
                ParentId = j.ParentId,

                IsFlightJob = speed != null
                              && speed.GroupingId == (isUsCustomer
                                  ? (int)SpeedGrouping.Flight
                                  : (int)UrgentSpeedGrouping.Flight),
                IsAgentJob = speed != null
                             && speed.GroupingId == (isUsCustomer
                                 ? (int)SpeedGrouping.Agent
                                 : (int)UrgentSpeedGrouping.NationwideAgent),

                Vehicle = vehicleSize != null
                    ? new Suggestion
                    {
                        Id = vehicleSize.VehicleSizeId,
                        Text = vehicleSize.VehicleName
                    }
                    : null,

                Time = j.BookTime,
                ClientId = j.ClientId,
                Client = j.ClientCode,
                ClientName = client != null ? client.UcclName : string.Empty,
                PickupAddress = new AddressViewModel
                {
                    AddressLine1 = j.PickupAddressLine1,
                    AddressLine2 = j.PickupAddressLine2,
                    AddressLine3 = j.PickupAddressLine3,
                    AddressLine4 = j.PickupAddressLine4,
                    AddressLine5 = j.PickupAddressLine5,
                    AddressLine6 = j.PickupAddressLine6,
                    AddressLine7 = j.PickupAddressLine7,
                    AddressLine8 = j.PickupAddressLine8,
                    Latitude = !string.IsNullOrEmpty(j.PickUpLatitude)
                        ? decimal.Parse(j.PickUpLatitude)
                        : null,
                    Longitude = !string.IsNullOrEmpty(j.PickUpLongitude)
                        ? decimal.Parse(j.PickUpLongitude)
                        : null
                },
                DeliveryAddress = new AddressViewModel
                {
                    AddressLine1 = j.DeliveryAddressLine1,
                    AddressLine2 = j.DeliveryAddressLine2,
                    AddressLine3 = j.DeliveryAddressLine3,
                    AddressLine4 = j.DeliveryAddressLine4,
                    AddressLine5 = j.DeliveryAddressLine5,
                    AddressLine6 = j.DeliveryAddressLine6,
                    AddressLine7 = j.DeliveryAddressLine7,
                    AddressLine8 = j.DeliveryAddressLine8,
                    Latitude = !string.IsNullOrEmpty(j.DeliveryLatitude)
                        ? decimal.Parse(j.DeliveryLatitude)
                        : null,
                    Longitude = !string.IsNullOrEmpty(j.DeliveryLongitude)
                        ? decimal.Parse(j.DeliveryLongitude)
                        : null
                },
                JobNo = j.JobNumber,
                Courier = courier != null ? courier.Code : null,
                StatusId = j.JobStatus,
                Status = status != null ? status.UcjsCode : null,
                Speed = speed != null ? speed.ShortName : null,
                SpeedId = j.Speed,
                Booked = new DateTime(
                    j.BookDate.Year,
                    j.BookDate.Month,
                    j.BookDate.Day,
                    j.BookTime.Hour,
                    j.BookTime.Minute,
                    j.BookTime.Second
                ),
                IsBulkJob = true
            };

        // Cap initial SQL result set to prevent unbounded loads;
        // client-side Distinct (custom comparer) requires in-memory dedup
        const int maxBulkSearchRows = 5000;
        var allResults = await query
            .Take(maxBulkSearchRows)
            .ToListAsync(cancellationToken);

        var distinctResults = allResults
            .Distinct(new DispatchJobViewModelComparer())
            .ToList();

        var totalCount = distinctResults.Count;

        var page = data.Page ?? 0;
        var pageSize = data.PageSize ?? 50;

        var bulkJobs = distinctResults
            .Skip(page * pageSize)
            .Take(pageSize)
            .ToList();

        foreach (var bulkJob in bulkJobs)
        {
            bulkJob.AngularId = Guid.NewGuid();
        }

        var hasMore = (page + 1) * pageSize < totalCount;

        return new JobSearchResult
        {
            Jobs = bulkJobs,
            TotalCount = totalCount,
            HasMore = hasMore
        };
    }

    /// <summary>
    /// Searches both live and archived jobs with filtering and sorting.
    /// Queries both tables in parallel for improved performance.
    /// </summary>
    /// <param name="data">Search parameters including date range, filters, sorting, and pagination.</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Paginated search results combining live and archived jobs.</returns>
    public async Task<JobSearchResult> PodSearchAsync(PodSearchRequest data,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var isUsCustomer = _infoService.IsUsTenant();
            var now = _clock.TenantNow;

            var fromDate = data.FromDate.Date;
            var toDate = data.ToDate.Date;
            var page = data.Page ?? 0;
            var pageSize = data.PageSize ?? 50;

            var jobSearch = $"%{(data.Job ?? string.Empty).Trim()}%";
            var wildSearch = $"%{data.Wild ?? string.Empty}%";

            await using var liveJobsContext = await _contextFactory.CreateDbContextAsync(cancellationToken);
            await using var archivedJobsContext = await _contextFactory.CreateDbContextAsync(cancellationToken);

            IQueryable<TucJob> liveJobsQuery;
            IQueryable<TucJobArchive> archivedJobsQuery;

            if (data.JobIdSet)
            {
                // When searching by specific job ID, ignore all other filters
                liveJobsQuery = liveJobsContext.TucJobs
                    .Where(j => j.UcjbId == data.JobId);

                archivedJobsQuery = archivedJobsContext.TucJobArchives
                    .Where(j => j.UcjbId == data.JobId);
            }
            else
            {
                liveJobsQuery = liveJobsContext.TucJobs
                    .Where(j =>
                        j.UcjbDate.Date >= fromDate
                        && j.UcjbDate.Date <= toDate
                        && (!data.ClientSet ||
                            (j.UcjbClientId.HasValue && data.ClientIds.Contains(j.UcjbClientId.Value)))
                        && (!data.CourierSet ||
                            (j.UcjbCourierId.HasValue && data.CourierIds.Contains(j.UcjbCourierId.Value)))
                        && (!data.SpeedSet || (j.UcjbSpeed.HasValue && data.SpeedIds.Contains(j.UcjbSpeed.Value)))
                        && (!data.JobSet || EF.Functions.Like(j.UcjbNumber, jobSearch))
                    );

                archivedJobsQuery = archivedJobsContext.TucJobArchives
                    .Where(j =>
                        j.UcjbDate.HasValue
                        && j.UcjbDate.Value.Date >= fromDate
                        && j.UcjbDate.Value.Date <= toDate
                        && (!data.ClientSet ||
                            (j.UcjbClientId.HasValue && data.ClientIds.Contains(j.UcjbClientId.Value)))
                        && (!data.CourierSet ||
                            (j.UcjbCourierId.HasValue && data.CourierIds.Contains(j.UcjbCourierId.Value)))
                        && (!data.SpeedSet || (j.UcjbSpeed.HasValue && data.SpeedIds.Contains(j.UcjbSpeed.Value)))
                        && (!data.JobSet || EF.Functions.Like(j.UcjbNumber, jobSearch))
                    );
            }

            if (data is { JobIdSet: false, WildSet: true })
            {
                liveJobsQuery = liveJobsQuery.Where(j =>
                    j.TucJobNationwides.Any(nw => EF.Functions.Like(
                        (nw.UcnwFlightNo ?? string.Empty) + " " +
                        (nw.AircraftName ?? string.Empty) + " " +
                        (nw.CarrierFsCode ?? string.Empty) + " " +
                        (nw.DepartureAirportName ?? string.Empty) + " " +
                        (nw.ArrivalAirportName ?? string.Empty),
                        wildSearch))
                    ||
                    EF.Functions.Like(
                        (j.UcjbFromAddr ?? string.Empty) + " " +
                        (j.PickupFromContact ?? string.Empty) + " " +
                        (j.UcjbFromNavigation.UcsuName ?? string.Empty) + " " +
                        (j.UcjbToAddr ?? string.Empty) + " " +
                        (j.DeliverToContact ?? string.Empty) + " " +
                        (j.UcjbToNavigation.UcsuName ?? string.Empty) + " " +
                        (j.UcjbClientRefa ?? string.Empty) + " " +
                        (j.UcjbClientRefb ?? string.Empty) + " " +
                        (j.UcjbOurRef ?? string.Empty) + " " +
                        j.UcjbNumber + " " +
                        (j.Barcode ?? string.Empty) + " " +
                        (j.UcjbContact ?? string.Empty) + " " +
                        (j.CustomJobName ?? string.Empty) + " " +
                        (j.UcjbPodname ?? string.Empty) + " " +
                        (j.UcjbContactPhone ?? string.Empty) + " " +
                        (j.PickupFromPhone ?? string.Empty) + " " +
                        (j.DeliverToPhone ?? string.Empty) + " " +
                        (j.ProofOfDeliveryEmail ?? string.Empty) + " " +
                        (j.ProofOfDeliveryMobile ?? string.Empty) + " " +
                        (j.TrackingEmail ?? string.Empty) + " " +
                        (j.TrackingMobile ?? string.Empty),
                        wildSearch
                    )
                    ||
                    j.UcjbClient.TblClientContacts.Any(cc =>
                        EF.Functions.Like(
                            (cc.Contact.UcctFirstname ?? string.Empty) + " " +
                            (cc.Contact.UcctSurname ?? string.Empty),
                            wildSearch))
                );

                archivedJobsQuery = archivedJobsQuery.Where(j =>
                    EF.Functions.Like(
                        (j.UcjbFromAddr ?? string.Empty) + " " +
                        (j.PickUpFromContact ?? string.Empty) + " " +
                        (j.UcjbToAddr ?? string.Empty) + " " +
                        (j.DeliverToContact ?? string.Empty) + " " +
                        (j.UcjbClientRefa ?? string.Empty) + " " +
                        (j.UcjbClientRefb ?? string.Empty) + " " +
                        (j.UcjbOurRef ?? string.Empty) + " " +
                        j.UcjbNumber + " " +
                        (j.Barcode ?? string.Empty) + " " +
                        (j.UcjbContact ?? string.Empty) + " " +
                        (j.CustomJobName ?? string.Empty) + " " +
                        (j.UcjbPodname ?? string.Empty) + " " +
                        (j.UcjbContactPhone ?? string.Empty) + " " +
                        (j.PickUpFromPhone ?? string.Empty) + " " +
                        (j.DeliverToPhone ?? string.Empty) + " " +
                        (j.ProofOfDeliveryEmail ?? string.Empty) + " " +
                        (j.ProofOfDeliveryMobile ?? string.Empty) + " " +
                        (j.TrackingEmail ?? string.Empty) + " " +
                        (j.TrackingMobile ?? string.Empty),
                        wildSearch
                    )
                );
            }

            // Get counts and data in parallel for better performance
            var liveCountTask = liveJobsQuery
                .TagWith("PodSearch - Live Count")
                .CountAsync(cancellationToken);

            var archivedCountTask = archivedJobsQuery
                .TagWith("PodSearch - Archived Count")
                .CountAsync(cancellationToken);

            // Wait for counts
            await Task.WhenAll(liveCountTask, archivedCountTask);

            var liveCount = await liveCountTask;
            var archivedCount = await archivedCountTask;
            var totalCount = liveCount + archivedCount;

            if (totalCount == 0)
            {
                return new JobSearchResult
                {
                    Jobs = [],
                    TotalCount = 0,
                    HasMore = false
                };
            }

            // Determine sort direction
            var sortDescending = string.Equals(data.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);
            var sortColumn = data.SortColumn?.ToLowerInvariant();

            // Apply database-level sorting based on sort column
            // For columns that can be sorted at DB level, apply appropriate ordering
            var liveJobsOrdered = ApplyLiveJobSorting(liveJobsQuery, sortColumn, sortDescending);
            var archivedJobsOrdered = ApplyArchivedJobSorting(archivedJobsQuery, sortColumn, sortDescending);

            // Get data in parallel - fetch more when sorting to ensure we have enough records
            var fetchSize = pageSize * 3; // Fetch extra to handle pagination across both sources

            var liveJobsTask = liveJobsOrdered
                .Take(fetchSize)
                .Select(JobMappings.PodSearchMapping(isUsCustomer))
                .TagWith("PodSearch - Live Jobs")
                .ToListAsync(cancellationToken);

            var archivedJobsTask = archivedJobsOrdered
                .Take(fetchSize)
                .Select(JobMappings.PodSearchArchivedMapping(isUsCustomer))
                .TagWith("PodSearch - Archived Jobs")
                .ToListAsync(cancellationToken);

            // Wait for both queries
            await Task.WhenAll(liveJobsTask, archivedJobsTask);

            var liveJobs = await liveJobsTask;
            var archivedJobs = await archivedJobsTask;

            // Apply sorting to combined results
            var sortedJobs = ApplyDispatchJobSorting(liveJobs.Concat(archivedJobs), sortColumn, sortDescending);

            var allJobs = sortedJobs
                .Skip(page * pageSize)
                .Take(pageSize)
                .ToList();

            if (allJobs.Count == 0)
            {
                return new JobSearchResult
                {
                    Jobs = [],
                    TotalCount = totalCount,
                    HasMore = false
                };
            }

            var (economySpeedId, ecoDeliveryTime) = await GetEconomySpeedAndDeliveryTimeAsync();

            foreach (var job in allJobs)
            {
                job.AngularId = Guid.NewGuid();
                job.Remain = CalculateRemainTime(job, now, economySpeedId, ecoDeliveryTime);
            }

            return new JobSearchResult
            {
                Jobs = allJobs,
                TotalCount = totalCount,
                HasMore = (page + 1) * pageSize < totalCount
            };
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(PodSearchAsync)));
            throw;
        }
    }

    /// <summary>
    /// Retrieves job data for CSV/Excel download with full details including addresses, pricing, and courier info.
    /// Uses the same query logic as PodSearchAsync to ensure consistent results between search and download.
    /// Queries both live (TucJobs) and archived (TucJobArchives) tables in parallel.
    /// </summary>
    /// <param name="courierIds">Optional filter by courier IDs.</param>
    /// <param name="speedIds">Optional filter by speed IDs.</param>
    /// <param name="wild">Wildcard search text.</param>
    /// <param name="job">Job number search text.</param>
    /// <param name="fromDate">Start date filter.</param>
    /// <param name="toDate">End date filter.</param>
    /// <param name="clientIds">Optional filter by client IDs.</param>
    /// <param name="jobId"></param>
    /// <returns>List of job models formatted for download export.</returns>
    public async Task<IReadOnlyList<JobDownloadModel>> PodSearchDownloadAsync(
        IReadOnlyList<int> courierIds,
        IReadOnlyList<int> speedIds,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        IReadOnlyList<int> clientIds,
        int? jobId = null
    )
    {
        // Use same date handling as PodSearchAsync - strip time component
        var fromDateOnly = fromDate.Date;
        var toDateOnly = toDate.Date;

        var jobSearch = $"%{job.Trim()}%";
        var wildSearch = $"%{wild}%";

        var clientSet = clientIds is { Count: > 0 };
        var courierSet = courierIds is { Count: > 0 };
        var speedSet = speedIds is { Count: > 0 };
        var jobSet = !string.IsNullOrEmpty(job);
        var jobIdSet = jobId.HasValue;
        var wildSet = !string.IsNullOrEmpty(wild);

        // Use separate contexts for parallel queries (same pattern as PodSearchAsync)
        await using var liveJobsContext = await _contextFactory.CreateDbContextAsync();
        await using var archivedJobsContext = await _contextFactory.CreateDbContextAsync();

        // Increase command timeout for large multi-client queries (5 minutes)
        liveJobsContext.Database.SetCommandTimeout(TimeSpan.FromMinutes(5));
        archivedJobsContext.Database.SetCommandTimeout(TimeSpan.FromMinutes(5));

        // Build live and archived queries with SAME filters as PodSearchAsync
        IQueryable<TucJob> liveJobsQuery;
        IQueryable<TucJobArchive> archivedJobsQuery;

        if (jobIdSet)
        {
            // When searching by specific job ID, ignore all other filters
            liveJobsQuery = liveJobsContext.TucJobs
                .Where(j => j.UcjbId == jobId);

            archivedJobsQuery = archivedJobsContext.TucJobArchives
                .Where(j => j.UcjbId == jobId);
        }
        else
        {
            liveJobsQuery = liveJobsContext.TucJobs
                .Where(j =>
                    j.UcjbDate.Date >= fromDateOnly
                    && j.UcjbDate.Date <= toDateOnly
                    && (!clientSet || (j.UcjbClientId.HasValue && clientIds.Contains(j.UcjbClientId.Value)))
                    && (!courierSet || (j.UcjbCourierId.HasValue && courierIds.Contains(j.UcjbCourierId.Value)))
                    && (!speedSet || (j.UcjbSpeed.HasValue && speedIds.Contains(j.UcjbSpeed.Value)))
                    && (!jobSet || EF.Functions.Like(j.UcjbNumber, jobSearch))
                );

            archivedJobsQuery = archivedJobsContext.TucJobArchives
                .Where(j =>
                    j.UcjbDate.HasValue
                    && j.UcjbDate.Value.Date >= fromDateOnly
                    && j.UcjbDate.Value.Date <= toDateOnly
                    && (!clientSet || (j.UcjbClientId.HasValue && clientIds.Contains(j.UcjbClientId.Value)))
                    && (!courierSet || (j.UcjbCourierId.HasValue && courierIds.Contains(j.UcjbCourierId.Value)))
                    && (!speedSet || (j.UcjbSpeed.HasValue && speedIds.Contains(j.UcjbSpeed.Value)))
                    && (!jobSet || EF.Functions.Like(j.UcjbNumber, jobSearch))
                );
        }

        // Apply SAME wildcard search as PodSearchAsync
        if (!jobIdSet && wildSet)
        {
            liveJobsQuery = liveJobsQuery.Where(j =>
                j.TucJobNationwides.Any(nw => EF.Functions.Like(
                    (nw.UcnwFlightNo ?? string.Empty) + " " +
                    (nw.AircraftName ?? string.Empty) + " " +
                    (nw.CarrierFsCode ?? string.Empty) + " " +
                    (nw.DepartureAirportName ?? string.Empty) + " " +
                    (nw.ArrivalAirportName ?? string.Empty),
                    wildSearch))
                ||
                EF.Functions.Like(
                    (j.UcjbFromAddr ?? string.Empty) + " " +
                    (j.PickupFromContact ?? string.Empty) + " " +
                    (j.UcjbFromNavigation.UcsuName ?? string.Empty) + " " +
                    (j.UcjbToAddr ?? string.Empty) + " " +
                    (j.DeliverToContact ?? string.Empty) + " " +
                    (j.UcjbToNavigation.UcsuName ?? string.Empty) + " " +
                    (j.UcjbClientRefa ?? string.Empty) + " " +
                    (j.UcjbClientRefb ?? string.Empty) + " " +
                    (j.UcjbOurRef ?? string.Empty) + " " +
                    j.UcjbNumber + " " +
                    (j.Barcode ?? string.Empty) + " " +
                    (j.UcjbContact ?? string.Empty) + " " +
                    (j.CustomJobName ?? string.Empty) + " " +
                    (j.UcjbPodname ?? string.Empty) + " " +
                    (j.UcjbContactPhone ?? string.Empty) + " " +
                    (j.PickupFromPhone ?? string.Empty) + " " +
                    (j.DeliverToPhone ?? string.Empty) + " " +
                    (j.ProofOfDeliveryEmail ?? string.Empty) + " " +
                    (j.ProofOfDeliveryMobile ?? string.Empty) + " " +
                    (j.TrackingEmail ?? string.Empty) + " " +
                    (j.TrackingMobile ?? string.Empty),
                    wildSearch
                )
                ||
                j.UcjbClient.TblClientContacts.Any(cc =>
                    EF.Functions.Like(
                        (cc.Contact.UcctFirstname ?? string.Empty) + " " +
                        (cc.Contact.UcctSurname ?? string.Empty),
                        wildSearch))
            );

            archivedJobsQuery = archivedJobsQuery.Where(j =>
                EF.Functions.Like(
                    (j.UcjbFromAddr ?? string.Empty) + " " +
                    (j.PickUpFromContact ?? string.Empty) + " " +
                    (j.UcjbToAddr ?? string.Empty) + " " +
                    (j.DeliverToContact ?? string.Empty) + " " +
                    (j.UcjbClientRefa ?? string.Empty) + " " +
                    (j.UcjbClientRefb ?? string.Empty) + " " +
                    (j.UcjbOurRef ?? string.Empty) + " " +
                    j.UcjbNumber + " " +
                    (j.Barcode ?? string.Empty) + " " +
                    (j.UcjbContact ?? string.Empty) + " " +
                    (j.CustomJobName ?? string.Empty) + " " +
                    (j.UcjbPodname ?? string.Empty) + " " +
                    (j.UcjbContactPhone ?? string.Empty) + " " +
                    (j.PickUpFromPhone ?? string.Empty) + " " +
                    (j.DeliverToPhone ?? string.Empty) + " " +
                    (j.ProofOfDeliveryEmail ?? string.Empty) + " " +
                    (j.ProofOfDeliveryMobile ?? string.Empty) + " " +
                    (j.TrackingEmail ?? string.Empty) + " " +
                    (j.TrackingMobile ?? string.Empty),
                    wildSearch
                )
            );
        }

        // Cap each source to prevent unbounded export result sets
        const int maxExportRowsPerSource = 50000;

        // Execute both queries in parallel with direct mapping to JobDownloadModel
        var liveJobsTask = liveJobsQuery
            .OrderBy(j => j.UcjbNumber)
            .Take(maxExportRowsPerSource)
            .Select(JobMappings.LiveJobDownloadMapping)
            .TagWith("PodSearchDownload - Live Jobs")
            .ToListAsync();

        var archivedJobsTask = archivedJobsQuery
            .OrderBy(j => j.UcjbNumber)
            .Take(maxExportRowsPerSource)
            .Select(JobMappings.ArchivedJobDownloadMapping)
            .TagWith("PodSearchDownload - Archived Jobs")
            .ToListAsync();

        await Task.WhenAll(liveJobsTask, archivedJobsTask);

        // Archived jobs have no JobId-keyed item navigation (TucJobArchive.TucJobItemsArchives is
        // keyed by ChildJobId), so sum tucJobItemsArchive.Cubic by JobId via a correlated subquery.
        // Live-job cubic is summed inline in LiveJobDownloadMapping via the TucJobItemJobs navigation.
        var archivedCubicByJobId = await archivedJobsQuery
            .Take(maxExportRowsPerSource)
            .Select(j => new
            {
                j.UcjbId,
                Cubic = archivedJobsContext.TucJobItemsArchives
                    .Where(i => i.JobId == j.UcjbId)
                    .Sum(i => i.Cubic)
            })
            .TagWith("PodSearchDownload - Archived Job Cubic")
            .ToDictionaryAsync(x => x.UcjbId, x => x.Cubic);

        // Combine and sort by job number
        // Note: No parent/child filtering applied - download returns all jobs matching search criteria
        // to maintain consistency with PodSearchAsync results
        var allJobs = (await liveJobsTask)
            .Concat(await archivedJobsTask)
            .OrderBy(j => j.JobNumber)
            .ToList();

        // Apply timezone conversion to pickup and delivery times for consistent export
        var tenantTimeZone = _infoService.GetTenantTimeZone();
        return allJobs.Select(j => new JobDownloadModel
        {
            Id = j.Id,
            ParentId = j.ParentId,
            JobNumber = j.JobNumber,
            BookDate = j.BookDate,
            Amount = j.Amount,
            Fuel = j.Fuel,
            Ppd = j.Ppd,
            CourierPayment = j.CourierPayment,
            CourierFuel = j.CourierFuel,
            CourierBonus = j.CourierBonus,
            Quantity = j.Quantity,
            Weight = j.Weight,
            Size = j.Size,
            Cubic = j.IsArchived ? archivedCubicByJobId.GetValueOrDefault(j.Id) : j.Cubic,
            PickupAddressLine1 = j.PickupAddressLine1,
            PickupAddressLine2 = j.PickupAddressLine2,
            PickupAddressLine3 = j.PickupAddressLine3,
            PickupAddressLine4 = j.PickupAddressLine4,
            PickupAddressLine5 = j.PickupAddressLine5,
            PickupAddressLine6 = j.PickupAddressLine6,
            PickupAddressLine7 = j.PickupAddressLine7,
            PickupAddressLine8 = j.PickupAddressLine8,
            DeliveryAddressLine1 = j.DeliveryAddressLine1,
            DeliveryAddressLine2 = j.DeliveryAddressLine2,
            DeliveryAddressLine3 = j.DeliveryAddressLine3,
            DeliveryAddressLine4 = j.DeliveryAddressLine4,
            DeliveryAddressLine5 = j.DeliveryAddressLine5,
            DeliveryAddressLine6 = j.DeliveryAddressLine6,
            DeliveryAddressLine7 = j.DeliveryAddressLine7,
            DeliveryAddressLine8 = j.DeliveryAddressLine8,
            ClientReferenceA = j.ClientReferenceA,
            ClientReferenceB = j.ClientReferenceB,
            ClientReferenceC = j.ClientReferenceC,
            CustomerName = j.CustomerName,
            PickedUpDate = j.PickedUpDate.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(j.PickedUpDate.Value, tenantTimeZone).DateTime
                : j.PickedUpDate,
            DeliveredDate = j.DeliveredDate.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(j.DeliveredDate.Value, tenantTimeZone).DateTime
                : j.DeliveredDate,
            AgentAirlineName = j.AgentAirlineName,
            AWB = j.AWB,
            StatusName = j.StatusName,
            InvoiceNumber = j.InvoiceNumber,
            InvoiceDate = j.InvoiceDate,
            IsArchived = j.IsArchived,
            LoggedInContact = j.LoggedInContact,
            RawBaseAmount = j.RawBaseAmount,
            CourierCode = j.CourierCode,
            Void = j.Void,
            OurReference = j.OurReference,
            Speed = j.Speed,
            Notes = j.Notes
        }).ToList();
    }

    /// <summary>
    /// Retrieves performance and spend report data for multiple clients.
    /// </summary>
    public async Task<IReadOnlyList<PerformanceSpendReportModel>> GetClientJobsReportDataAsync(
        [FromQuery] ClientJobsReportRequest request)
    {
        var startDate = request.StartDate.Date;
        var endDate = request.EndDate.Date;
        var clientIds = request.ClientIds;

        try
        {
            var query =
                from j in Context.TucJobArchives
                join jt0 in Context.TucJobTypes on j.UcjbSpeed equals jt0.UcjtId into jtJoin
                from jt in jtJoin.DefaultIfEmpty()
                join ajt0 in Context.TucJobTypes on j.AcceptedJobTypeId equals ajt0.UcjtId into ajtJoin
                from ajt in ajtJoin.DefaultIfEmpty()
                join sf0 in Context.TucSuburbs on j.UcjbFrom equals sf0.UcsuId into sfJoin
                from sfrom in sfJoin.DefaultIfEmpty()
                join st0 in Context.TucSuburbs on j.UcjbTo equals st0.UcsuId into stJoin
                from sto in stJoin.DefaultIfEmpty()
                join ad0 in Context.TucJobAddressDeatils on j.UcjbId equals ad0.JobId into adJoin
                from ad in adJoin.DefaultIfEmpty()
                join cl0 in Context.TucClients on j.UcjbClientId equals cl0.UcclId into clJoin
                from cl in clJoin.DefaultIfEmpty()
                join cr0 in Context.TucCouriers on j.UcjbCourierId equals cr0.UccrId into crJoin
                from cr in crJoin.DefaultIfEmpty()
                join jrt0 in Context.TblJobRelationshipTypes
                    on j.JobRelationshipTypeId equals jrt0.JobRelationshipTypeId into jrtJoin
                from jrt in jrtJoin.DefaultIfEmpty()
                where j.UcjbDate >= startDate
                      && j.UcjbDate <= endDate
                      && (j.JobRelationshipTypeId == null || jrt.DisplayStatement)
                      && clientIds.Contains(j.UcjbClientId ?? 0)
                      && !j.UcjbVoid
                      && j.UcjbJobDone
                select new ClientJobsReportRow
                {
                    JobNumber = j.UcjbNumber,
                    JobType = (int?)j.UcjbType,
                    Date = j.UcjbDate,
                    Booked = j.UcjbTime,
                    BookedBy = j.UcjbContact,
                    PickedUpTime = j.PickUpTime,
                    Delivered = j.UcjbComplTime,
                    JobTypeDescription = jt != null ? jt.UcjtDescription : null,
                    Minutes = jt != null ? jt.Minutes : null,
                    PodName = j.UcjbPodname,
                    FromSuburb = sfrom != null ? sfrom.UcsuName : null,
                    FromPostcode = sfrom != null ? sfrom.PostCode : null,
                    ToSuburb = sto != null ? sto.UcsuName : null,
                    ToPostcode = sto != null ? sto.PostCode : null,
                    ToSuburbFromAddress = ad != null ? ad.ToSuburb : null,
                    FromAddr = j.UcjbFromAddr,
                    ToAddr = j.UcjbToAddr,
                    CourierId = j.UcjbCourierId,
                    LatePickup = j.UcjbLatePick == 1,
                    LateDelivery = j.UcjbLateDel == 1,
                    ClientLegalName = cl != null ? cl.UcclLegalName : null,
                    Speed = jt != null ? jt.UcjtName : null,
                    AcceptedSpeed = ajt != null ? ajt.UcjtName : null,
                    Notes = j.UcjbNotes,
                    Amount = j.UcjbAmount,
                    RefA = j.UcjbClientRefa,
                    RefB = j.UcjbClientRefb,
                    OurRef = j.UcjbOurRef,
                    Weight = (decimal?)j.UcjbWeight,
                    Size = j.UcjbSize,
                    Quantity = j.UcjbQty,
                    Year = j.UcjbYear,
                    Month = j.UcjbMonth,
                    CourierCode = cr != null ? cr.Code : null,
                    CourierName = cr != null ? cr.UccrName : null,
                    InvoiceNo = j.UcjbInvoiceNo,
                    Locked = j.UcjbLocked == 1,
                    ClientId = j.UcjbClientId,
                    ClientNote = cl != null ? cl.UcclNote : null,
                    RawBaseAmount = j.RawBaseAmount,
                    FuelSurchargeAmount = j.FuelSurchargeAmount
                };

            var ordered = query
                .OrderBy(r =>
                    r.JobTypeDescription == "15 Minute" ? 1 :
                    r.JobTypeDescription == "30 Minute" ? 2 :
                    r.JobTypeDescription == "45 Minute" ? 3 :
                    r.JobTypeDescription == "1 Hour" ? 4 :
                    r.JobTypeDescription == "75 Minute" ? 5 :
                    r.JobTypeDescription == "90 Minute" ? 6 :
                    r.JobTypeDescription == "2 Hour" ? 7 :
                    r.JobTypeDescription == "3 Hour" ? 8 :
                    r.JobTypeDescription == "Baggage" ? 10 :
                    r.JobTypeDescription == "Truck Super" ? 11 :
                    r.JobTypeDescription == "Truck Express" ? 12 :
                    r.JobTypeDescription == "Truck Standard" ? 13 :
                    r.JobTypeDescription == "Truck Economy" ? 14 :
                    100)
                .ThenBy(r => r.Date)
                .ThenBy(r => r.Booked)
                .ThenBy(r => r.CourierId)
                .ThenBy(r => r.Minutes);

            var rows = await ordered.ToListAsync();
            return rows.ConvertAll(MapToPerformanceSpendReportModel);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(GetClientJobsReportDataAsync)));
            throw;
        }
    }

    /// <summary>
    /// Retrieves a courier's current work: non-void jobs dated on or before
    /// <paramref name="endDate"/>'s day (today plus overdue past jobs). Done/completed jobs are
    /// included but bounded below by <paramref name="startDate"/> so the panel's "Done" tab has
    /// data without returning the courier's entire completion history.
    /// </summary>
    /// <param name="courierId">The courier ID to filter by.</param>
    /// <param name="startDate">Lower bound for done jobs only; undelivered jobs are unbounded below
    /// because current work intentionally includes overdue jobs from earlier days.</param>
    /// <param name="endDate">Upper bound of the window (its calendar day is fully included).</param>
    /// <returns>Search result with jobs and map items for the courier.</returns>
    public async Task<JobSearchResult> CurrentJobListAsync(int courierId,
        DateTimeOffset startDate,
        DateTimeOffset endDate)
    {
        var isUsCustomer = _infoService.IsUsTenant();

        // Current work is unbounded below for undelivered jobs: it includes overdue (past, not-done)
        // jobs as well as today's. endDate caps the window at the current day. Done jobs are kept
        // (so the client "Done" tab has data) but bounded to [startDate, endDate] so we don't return
        // the courier's full completion history. Distinct from the drivers-overview count
        // (CurrentWorkJob), which excludes done work entirely.
        var query = Context.TucJobs
            .Where(j => j.UcjbCourierId == courierId)
            .Where(CurrentWorkListJob(startDate, endDate));

        // Single query to get both jobs and map items data
        var jobs = await query
            .Select(JobMappings.JobDispatchMapping(isUsCustomer, _infoService.GetCurrentTenantId()))
            .ToListAsync();

        var totalCount = jobs.Count;

        // Build map items from jobs (avoids the second query)
        var mapItems = jobs.Select(j => new DispatchMapItem
        {
            JobId = j.Id,
            JobNo = j.JobNo,
            PickupAddress = j.PickupAddress,
            DeliveryAddress = j.DeliveryAddress,
            AssignedCourier = j.AssignedCourier
        }).ToList();

        // Calculate remaining time for each job
        var (economySpeedId, ecoDeliveryTime) = await GetEconomySpeedAndDeliveryTimeAsync();
        var now = _clock.TenantNow;
        foreach (var job in jobs)
        {
            job.AngularId = Guid.NewGuid();
            job.Remain = CalculateRemainTime(job, now, economySpeedId, ecoDeliveryTime);
        }

        return new JobSearchResult
        {
            Jobs = jobs,
            TotalCount = totalCount,
            HasMore = false,
            MapItems = mapItems
        };
    }

    /// <summary>
    /// Retrieves paginated job list for the dispatch page with full filtering support.
    /// </summary>
    /// <param name="queryParams">Query parameters including pagination, filters, and sorting.</param>
    /// <param name="isInternal">Whether the user is internal staff.</param>
    /// <param name="isUsTenant">Whether this is a US tenant.</param>
    /// <param name="clientIds">Comma-separated list of client IDs to filter by.</param>
    /// <param name="selectedViewIds">List of view IDs to filter by.</param>
    /// <param name="selectedClearListId">Optional clear list ID to filter by.</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Paginated job search results.</returns>
    public async Task<JobSearchResult> JobListAsync(
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        IReadOnlyList<int> selectedViewIds,
        int? selectedClearListId = null,
        CancellationToken cancellationToken = default) =>
        await DespatchQry(
            AppPage.Dispatch,
            queryParams,
            isInternal,
            isUsTenant,
            clientIds,
            selectedViewIds,
            null,
            selectedClearListId,
            cancellationToken
        );

    /// <summary>
    /// Gets the maximum auto late pickup alert threshold from system settings.
    /// </summary>
    public async Task<int> MaxAutoLatePickupAlertAsync()
    {
        var output = new OutputParameter<int?>();
        await Context.Procedures.GEN_qdfSetting_GetMaxAutoLatePickupAlertAsync(output);
        return output.Value ?? 0;
    }

    /// <summary>
    /// Gets the maximum auto late delivery alert threshold from system settings.
    /// </summary>
    public async Task<int> MaxAutoLateDeliveryAlertAsync()
    {
        var output = new OutputParameter<int?>();
        await Context.Procedures.GEN_qdfSetting_GetMaxAutoLateDeliveryAlertAsync(output);
        return output.Value ?? 0;
    }

    /// <summary>
    /// Calculates the PPD (Prepaid Discount) exclusive amount for a client.
    /// </summary>
    public async Task<decimal> PpdExclusiveAmountAsync(int clientId,
        decimal amount) =>
        await CalculateAmountAsync(clientId, amount);

    /// <summary>
    /// Retrieves all available job speeds/types.
    /// </summary>
    public async Task<IReadOnlyList<Suggestion>> GetSpeedsAsync() =>
        await Context.DesQryAllJobTypes
            .Select(x => new Suggestion { Id = x.JobTypeId, Text = x.Name })
            .ToListAsync();

    /// <summary>
    /// Searches job speeds/types by name.
    /// </summary>
    /// <param name="searchTerm">The search term to filter speeds by.</param>
    public async Task<IReadOnlyList<Suggestion>> GetSpeedsBySearchTermAsync(string searchTerm) =>
        await Context.DesQryAllJobTypes
            .Where(jt => EF.Functions.Like(jt.Name, $"%{searchTerm}%"))
            .Select(jt => new Suggestion { Id = jt.JobTypeId, Text = jt.Name })
            .ToListAsync();

    /// <summary>
    /// Retrieves all active Recurring Routes for the current tenant, ordered by name.
    /// Used by the Recurring Jobs Dashboard route filter dropdown.
    /// Inactive routes are intentionally excluded so dispatchers can't filter by
    /// retired routes that won't return any jobs anyway.
    /// </summary>
    public async Task<IReadOnlyList<Suggestion>> GetActiveRoutesAsync() =>
        await Context.Routes
            .Where(r => r.Active)
            .OrderBy(r => r.Name)
            .Select(r => new Suggestion { Id = r.RouteId, Text = r.Name })
            .ToListAsync();

    /// <summary>
    /// Retrieves active contacts for a specific client.
    /// </summary>
    /// <param name="clientId">The client ID to get contacts for.</param>
    public async Task<IReadOnlyList<Suggestion>> GetContactsByClientIdAsync(int clientId) =>
        await Context.UtlQryContactLookups
            .Join(
                Context.TblClientContacts,
                s => s.ContactId,
                cc => cc.ContactId,
                (s, cc) => new { s, cc }
            )
            .Where(x => x.cc.ClientId == clientId && x.s.Active)
            .Select(x => new Suggestion { Id = x.s.ContactId, Text = x.s.UcctFirstname + Space + x.s.UcctSurname })
            .Distinct()
            .ToListAsync();

    /// <summary>
    /// Retrieves available locations where parcels can be left if recipient not home.
    /// </summary>
    public async Task<IReadOnlyList<Lookup>> LeaveParcelLocationsAsync() =>
        await Context.TblJobLeaveNotHomes
            .OrderBy(l => l.Sequence)
            .Select(x => new Lookup { Id = x.LeaveNotHomeId, Text = x.Name })
            .ToListAsync();

    /// <summary>
    /// Retrieves available undeliverable location options (e.g., wrong address, refused).
    /// </summary>
    public async Task<IReadOnlyList<UndeliverableLocation>> UndeliverableLocationsAsync() =>
        await Context.TblUndeliverableLocations
            .OrderBy(u => u.Name)
            .Select(x => new UndeliverableLocation
            {
                Id = x.UndeliverableLocationId,
                Text = x.Name,
                JobStatusId = x.JobTypeId
            })
            .ToListAsync();

    /// <summary>
    /// Retrieves available internal job statuses for dispatch workflow.
    /// </summary>
    public async Task<IReadOnlyList<InternalStatus>> GetInternalStatusListAsync() =>
        await Context
            .TucJobInternalStatuses
            .Where(x => x.Tcis != (int)InternalJobStatus.OvernightCp
                        && x.Tcis != (int)InternalJobStatus.ActionRequired)
            .OrderBy(u => u.Tcis)
            .Select(x => new InternalStatus
            {
                Id = x.Tcis,
                Text = x.TcisName,
                DefaultSchedule = x.DefaultSchedule,
                DefaultMins = x.DefaultMinutes
            })
            .ToListAsync();

    /// <summary>
    /// Retrieves all available job statuses.
    /// </summary>
    public async Task<IReadOnlyList<Suggestion>> GetStatusListAsync() =>
        await Context.TucJobStatuses
            .OrderBy(s => s.UcjsName)
            .Select(s => new Suggestion { Id = s.UcjsId, Text = s.UcjsName })
            .ToListAsync();

    /// <summary>
    /// Retrieves event types for customer service, general events, and partner-task events.
    /// 'PT' covers the inter-tenant job-change-request workflow (Partner Change Request /
    /// Approved / Rejected / Applied).
    /// </summary>
    public async Task<IReadOnlyList<Suggestion>> EventTypeListAsync() =>
        await Context.TucEventTypes
            .Where(u => u.UcetGroup == "CS" || u.UcetGroup == "GE" || u.UcetGroup == "PT")
            .OrderBy(u => u.UcetName)
            .Select(x => new Suggestion { Id = x.UcetId, Text = x.UcetName })
            .ToListAsync();

    /// <summary>
    /// Retrieves pricing breakdown components for a job or prebook job.
    /// </summary>
    /// <param name="jobId">The job or prebook job ID.</param>
    /// <param name="isPrebook">True if querying a prebook job.</param>
    /// <param name="isArchived">True if querying an archived job (skips live table lookup).</param>
    /// <returns>List of charge components making up the total price.</returns>
    public async Task<IReadOnlyList<ChargeViewModel>> GetJobPriceBreakdownAsync(int jobId,
        bool isPrebook, bool isArchived = false)
    {
        if (isPrebook)
        {
            var effectivePrebookId = await Context.GetEffectiveJobBookingIdAsync(jobId);
            var prebookBreakdowns = await Context.PricingBreakdowns
                .Where(p => p.PrebookJobId == jobId)
                .Select(p => new ChargeViewModel
                {
                    ChargeId = p.PricingBreakdownId,
                    Amount = p.ChargeAmount,
                    Name = p.ChargeName,
                    JobId = p.JobId,
                    PrebookJobId = p.PrebookJobId,
                    CostAmount = p.CostAmount
                })
                .ToListAsync();

            // Fall back to parent prebooks rows if this job has none
            if (prebookBreakdowns.Count == 0 && effectivePrebookId != jobId)
            {
                prebookBreakdowns = await Context.PricingBreakdowns
                    .Where(p => p.PrebookJobId == effectivePrebookId)
                    .Select(p => new ChargeViewModel
                    {
                        ChargeId = p.PricingBreakdownId,
                        Amount = p.ChargeAmount,
                        Name = p.ChargeName,
                        JobId = p.JobId,
                        PrebookJobId = p.PrebookJobId,
                        CostAmount = p.CostAmount
                    })
                    .ToListAsync();
            }

            return prebookBreakdowns;
        }

        // Query archive table directly if we know the job is archived
        if (isArchived)
        {
            var effectiveArchiveJobId = await Context.GetEffectiveArchiveJobIdAsync(jobId);
            if (effectiveArchiveJobId == 0)
            {
                return [];
            }

            var archiveBreakdowns = await Context.PricingBreakdownArchives
                .Where(p => p.JobId == jobId)
                .Select(p => new ChargeViewModel
                {
                    ChargeId = p.PricingBreakdownId,
                    Amount = p.ChargeAmount,
                    Name = p.ChargeName,
                    JobId = p.JobId,
                    PrebookJobId = p.PrebookJobId,
                    CostAmount = p.CostAmount
                })
                .ToListAsync();

            // Fall back to parent's archived rows if this job has none
            if (archiveBreakdowns.Count == 0 && effectiveArchiveJobId != jobId)
            {
                archiveBreakdowns = await Context.PricingBreakdownArchives
                    .Where(p => p.JobId == effectiveArchiveJobId)
                    .Select(p => new ChargeViewModel
                    {
                        ChargeId = p.PricingBreakdownId,
                        Amount = p.ChargeAmount,
                        Name = p.ChargeName,
                        JobId = p.JobId,
                        PrebookJobId = p.PrebookJobId,
                        CostAmount = p.CostAmount
                    })
                    .ToListAsync();
            }

            return archiveBreakdowns;
        }

        // Try live jobs — query the requested job first, then fall back to
        // the parent's rows.  The previous OR query (effectiveJobId || jobId)
        // combined both parent and child rows for split jobs, doubling the total.
        var effectiveJobId = await Context.GetEffectiveJobIdAsync(jobId);
        if (effectiveJobId != 0)
        {
            var pricingBreakdowns = await Context.PricingBreakdowns
                .Where(p => p.JobId == jobId)
                .Select(p => new ChargeViewModel
                {
                    ChargeId = p.PricingBreakdownId,
                    Amount = p.ChargeAmount,
                    Name = p.ChargeName,
                    JobId = p.JobId,
                    PrebookJobId = p.PrebookJobId,
                    CostAmount = p.CostAmount,
                    ChildJobId = p.ChildJobId
                })
                .ToListAsync();

            // Fall back to parent's breakdown rows if the child has none of its own
            if (pricingBreakdowns.Count == 0 && effectiveJobId != jobId)
            {
                pricingBreakdowns = await Context.PricingBreakdowns
                    .Where(p => p.JobId == effectiveJobId)
                    .Select(p => new ChargeViewModel
                    {
                        ChargeId = p.PricingBreakdownId,
                        Amount = p.ChargeAmount,
                        Name = p.ChargeName,
                        JobId = p.JobId,
                        PrebookJobId = p.PrebookJobId,
                        CostAmount = p.CostAmount,
                        ChildJobId = p.ChildJobId
                    })
                    .ToListAsync();
            }

            if (pricingBreakdowns.Count != 0)
            {
                return pricingBreakdowns;
            }
        }

        // Fall back to archive table if live query returned no results
        var archiveJobId = await Context.GetEffectiveArchiveJobIdAsync(jobId);
        if (archiveJobId == 0)
        {
            return [];
        }

        return await Context.PricingBreakdownArchives
            .Where(p => p.JobId == archiveJobId)
            .Select(p => new ChargeViewModel
            {
                ChargeId = p.PricingBreakdownId,
                Amount = p.ChargeAmount,
                Name = p.ChargeName,
                JobId = p.JobId,
                PrebookJobId = p.PrebookJobId,
                CostAmount = p.CostAmount
            })
            .ToListAsync();
    }

    /// <summary>
    /// Suggests fuel-surcharge revenue/cost amounts for a manually-added price breakdown line,
    /// using the same fuel rate (UTL_fncMFV_FAF_Rates) and driver fuel percentage (VehicleSize)
    /// that auto-computed charges use. Resolved live against the job's client/booked date/vehicle
    /// size rather than frozen at add-time, matching how the rest of pricing always recomputes
    /// fresh from current rates.
    /// </summary>
    public async Task<SuggestedFuelChargeViewModel> GetSuggestedFuelChargeAsync(int jobId, decimal chargeAmount,
        bool isPrebook, bool isArchived = false)
    {
        int? clientId;
        DateTime? bookedDate;
        int? vehicleSizeId;

        if (isPrebook)
        {
            var effectivePrebookId = await Context.GetEffectiveJobBookingIdAsync(jobId);
            var job = await Context.TucJobBookings
                .Where(j => j.UcbkId == effectivePrebookId)
                .Select(j => new { j.UcbkClientId, j.UcbkDate, j.UcbkSize })
                .FirstOrDefaultAsync();
            clientId = job?.UcbkClientId;
            bookedDate = job?.UcbkDate;
            vehicleSizeId = job?.UcbkSize;
        }
        else if (isArchived)
        {
            var effectiveArchiveJobId = await Context.GetEffectiveArchiveJobIdAsync(jobId);
            var job = await Context.TucJobArchives
                .Where(j => j.UcjbId == effectiveArchiveJobId)
                .Select(j => new { j.UcjbClientId, j.UcjbDate, j.UcjbSize })
                .FirstOrDefaultAsync();
            clientId = job?.UcjbClientId;
            bookedDate = job?.UcjbDate;
            vehicleSizeId = job?.UcjbSize;
        }
        else
        {
            var effectiveJobId = await Context.GetEffectiveJobIdAsync(jobId);
            var job = await Context.TucJobs
                .Where(j => j.UcjbId == effectiveJobId)
                .Select(j => new { j.UcjbClientId, j.UcjbDate, j.UcjbSize })
                .FirstOrDefaultAsync();
            clientId = job?.UcjbClientId;
            bookedDate = job?.UcjbDate;
            vehicleSizeId = job?.UcjbSize;
        }

        if (clientId is null)
        {
            return new SuggestedFuelChargeViewModel { FuelChargeAmount = 0m, FuelCostAmount = 0m };
        }

        var mfv = await Context.TucJobs
            .Select(_ => DespatchContext.UTL_fncMFV_FAF_Rates(clientId, bookedDate, null, vehicleSizeId))
            .FirstOrDefaultAsync() ?? 0m;

        var driverFuelPercentage = vehicleSizeId.HasValue
            ? await Context.VehicleSizes
                .Where(v => v.VehicleSizeId == vehicleSizeId)
                .Select(v => (decimal?)v.FuelPercentage)
                .FirstOrDefaultAsync() ?? 0m
            : 0m;

        var fuelChargeAmount = Math.Round(chargeAmount * mfv, 2);
        var fuelCostAmount = Math.Round(fuelChargeAmount * driverFuelPercentage, 2);

        return new SuggestedFuelChargeViewModel
        {
            FuelChargeAmount = fuelChargeAmount,
            FuelCostAmount = fuelCostAmount
        };
    }

    /// <summary>
    /// Gets the name of a staff member by ID.
    /// </summary>
    public async Task<string> GetStaffNameAsync(int staffId) => await Context.TucStaffs
        .Where(s => s.UcstId == staffId)
        .Select(s => s.UcstFirstName + " " + s.UcstLastName)
        .FirstOrDefaultAsync();

    /// <summary>
    /// Checks if a client has any active items available for a specific speed.
    /// </summary>
    public async Task<bool> HasClientItemsAvailableAsync(int clientId,
        int speedId) =>
        await Context
            .TblClientAvailableSpeeds.Where(cas =>
                cas.ClientId == clientId && cas.SpeedId == speedId
            )
            .SelectMany(cas =>
                cas.TblClientAvailableSpeedItems.Where(casi => casi.Active)
                    .Select(casi => casi.ClientItem)
            )
            .AnyAsync();

    /// <summary>
    /// Retrieves paginated client items available for a specific speed, with selection state from a job.
    /// </summary>
    public async Task<PaginatedResponse<ClientItemsViewModel>> GetClientItemsBySpeedAsync(
        int clientId,
        int speedId,
        int jobId
    )
    {
        var job = await GetJobInfo(jobId);
        var clientItemIds = GetClientItemIds(job?.ClientItemIds);
        var clientItemsQuery = BuildClientItemsQuery(clientId, speedId, clientItemIds);
        return await CreatePagedList(clientItemsQuery);
    }

    /// <summary>
    /// Retrieves job details needed for late call notification processing.
    /// </summary>
    public async Task<JobLateCallDto> GetJobForLateCallAsync(int jobId) =>
        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(JobMappings.JobLateCallMapping)
            .FirstOrDefaultAsync();

    /// <summary>
    /// Retrieves all available time zone options for selection.
    /// </summary>
    public async Task<IReadOnlyList<TimeZoneSuggestion>> GetTimeZoneOptions() =>
        await Context.TimeZones
            .Select(t => new TimeZoneSuggestion
            {
                Id = t.Id,
                Text = t.DisplayName + " " + t.Code,
                TimeZoneIana = t.Name
            })
            .OrderBy(tz => tz.TimeZoneIana)
            .ToListAsync();

    /// <summary>
    /// Checks if a job number already exists in the system.
    /// </summary>
    public async Task<bool> JobNumberExistsAsync(string jobNumber) =>
        await Context.JobNumberExistsAsync(jobNumber);

    /// <summary>
    /// Calculates the raw price for a nationwide service job using the database function.
    /// </summary>
    public async Task<decimal> GetNationwideServiceRawPriceAsync(int? clientId,
        int? fromSuburbId,
        int? toSuburbId,
        int? speed,
        int? size,
        float? weight,
        int? quantity,
        int? type)
    {
        var result = await Context.TucJobs
            .Select(j => DespatchContext.UTL_fncS_GetNationwideService_RawPrice(
                clientId,
                fromSuburbId,
                toSuburbId,
                speed,
                size,
                weight,
                quantity,
                type))
            .FirstOrDefaultAsync();

        return result ?? 0m;
    }

    /// <summary>
    /// Retrieves detailed dispatch information for a job, checking both active and archived tables.
    /// </summary>
    /// <param name="jobId">The job ID to retrieve.</param>
    /// <returns>Dispatch job view model with full details including addresses, courier, and status.</returns>
    public async Task<DispatchJobViewModel> GetDispatchJobDetailAsync(int jobId)
    {
        var isUsCustomer = _infoService.IsUsTenant();

        // First, try to get from active jobs (TucJobs)
        var activeJob = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(JobMappings.JobDispatchMapping(isUsCustomer, _infoService.GetCurrentTenantId()))
            .FirstOrDefaultAsync();

        if (activeJob != null)
        {
            // TucJob doesn't have an Archived field, so check tblJobs view for the actual archived status
            var archivedStatus = await Context.TblJobs
                .Where(j => j.JobId == jobId)
                .Select(j => j.Archived ?? false)
                .FirstOrDefaultAsync();

            activeJob.IsArchived = archivedStatus;
            return activeJob;
        }

        // If not found in active jobs, try archived jobs (TblJobs)
        var archivedJobQuery =
            from j in Context.TblJobs
            join c in Context.TucCouriers on j.CourierId equals c.UccrId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join y in Context.TucSuburbs on j.FromSuburbId equals y.UcsuId into fromJoin
            from fs in fromJoin.DefaultIfEmpty()
            join z in Context.TucSuburbs on j.ToSuburbId equals z.UcsuId into toJoin
            from ts in toJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
            from speed in speedJoin.DefaultIfEmpty()
            join s in Context.TucJobStatuses on j.Status equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join rt in Context.TucJobReadTrackers on j.JobId equals rt.JobId into rtJoin
            from readTracker in rtJoin.DefaultIfEmpty()
            join vs in Context.VehicleSizes on j.Size equals vs.VehicleSizeId into vsJoin
            from vehicleSize in vsJoin.DefaultIfEmpty()
            join cl in Context.TucClients on j.ClientId equals cl.UcclId into clientJoin
            from client in clientJoin.DefaultIfEmpty()
            where j.JobId == jobId
            select new DispatchJobViewModel
            {
                Id = j.JobId,
                HasBeenRead = readTracker != null && readTracker.HasBeenRead,
                IsParentOrSingle = !j.ParentId.HasValue || j.ParentId == j.JobId,
                ParentId = j.ParentId,

                IsFlightJob = speed != null
                              && speed.GroupingId == (isUsCustomer
                                  ? (int)SpeedGrouping.Flight
                                  : (int)UrgentSpeedGrouping.Flight),
                IsAgentJob = speed != null
                             && speed.GroupingId == (isUsCustomer
                                 ? (int)SpeedGrouping.Agent
                                 : (int)UrgentSpeedGrouping.NationwideAgent),

                Vehicle = vehicleSize != null
                    ? new Suggestion
                    {
                        Id = vehicleSize.VehicleSizeId,
                        Text = vehicleSize.VehicleName
                    }
                    : null,
                Time = j.Time,
                ClientId = j.ClientId,
                Client = j.ClientCode,
                ClientName = client != null ? client.UcclName : string.Empty,

                From = fs != null ? fs.UcsuName : null,
                ToSuburbId = j.ToSuburbId,
                JobNo = j.Number,
                ToAddress = j.ToAddress,
                PickupAddress = new AddressViewModel
                {
                    AddressLine1 = j.PickupAddressLine1,
                    AddressLine2 = j.PickupAddressLine2,
                    AddressLine3 = j.PickupAddressLine3,
                    AddressLine4 = j.PickupAddressLine4,
                    AddressLine5 = j.PickupAddressLine5,
                    AddressLine6 = j.PickupAddressLine6,
                    AddressLine7 = j.PickupAddressLine7,
                    AddressLine8 = j.PickupAddressLine8,
                    Latitude = j.PickUpLatitude,
                    Longitude = j.PickUpLongitude
                },
                DeliveryAddress = new AddressViewModel
                {
                    AddressLine1 = j.DeliveryAddressLine1,
                    AddressLine2 = j.DeliveryAddressLine2,
                    AddressLine3 = j.DeliveryAddressLine3,
                    AddressLine4 = j.DeliveryAddressLine4,
                    AddressLine5 = j.DeliveryAddressLine5,
                    AddressLine6 = j.DeliveryAddressLine6,
                    AddressLine7 = j.DeliveryAddressLine7,
                    AddressLine8 = j.DeliveryAddressLine8,
                    Latitude = j.DeliveryLatitude,
                    Longitude = j.DeliveryLongitude
                },
                Courier = co != null ? co.Code : null,
                CourierData = co != null
                    ? new CourierData
                    {
                        Courier = co.Code,
                        CourierNumber = co.Code,
                        CourierId = co.UccrId,
                        CourierMobile = co.UccrMobile,
                        CourierName = co.UccrName + " " + co.UccrSurname
                    }
                    : null,
                AssignedCourier = co != null
                    ? new Suggestion
                    {
                        Id = co.UccrId,
                        Text = co.UccrName + " " + co.UccrSurname
                    }
                    : null,
                StatusId = j.Status,
                Status = status != null ? status.UcjsCode : null,
                StatusName = status != null ? status.UcjsName : null,
                Speed = speed != null ? speed.ShortName : null,
                SpeedId = j.Speed,
                JobTypeMins = speed != null ? speed.Minutes : null,
                PreBook = false,
                PickUpLatitude = j.PickUpLatitude,
                PickUpLongitude = j.PickUpLongitude,
                DeliveryLatitude = j.DeliveryLatitude,
                DeliveryLongitude = j.DeliveryLongitude,
                Booked = j.Date.HasValue
                    ? new DateTime(
                        j.Date.Value.Year,
                        j.Date.Value.Month,
                        j.Date.Value.Day,
                        j.Time.HasValue ? j.Time.Value.Hour : 0,
                        j.Time.HasValue ? j.Time.Value.Minute : 0,
                        j.Time.HasValue ? j.Time.Value.Second : 0
                    )
                    : null,
                IsArchived = j.Archived ?? false, // Use the actual Archived field from TblJobs view
                Locked = j.Locked.HasValue ? j.Locked != 0 : null,
                ToAirportId = j.ToAirportId,
                FromAirportId = j.FromAirportId,
                PickupContact = j.PickupFromContact,
                DeliveryContact = j.DeliverToContact
            };

        return await archivedJobQuery.FirstOrDefaultAsync();
    }

    /// <summary>
    /// Determines if a job has a parent (is a child job in a split or family).
    /// </summary>
    /// <param name="jobId">The job ID to check.</param>
    /// <returns>True if the job has a parent.</returns>
    public async Task<bool> IsJobParentAsync(int jobId)
    {
        var jobInfo = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new { HasParent = j.ParentId.HasValue })
            .FirstOrDefaultAsync();

        if (jobInfo != null)
        {
            return jobInfo.HasParent;
        }

        var bookingInfo = await Context.TucJobBookings
            .Where(j => j.UcbkId == jobId)
            .Select(j => new { HasParent = j.ParentId.HasValue })
            .FirstOrDefaultAsync();

        return bookingInfo?.HasParent ?? false;
    }

    /// <summary>
    /// Determines if a bulk job has a parent (is a child in a family).
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to check.</param>
    /// <returns>True if the bulk job has a parent.</returns>
    public async Task<bool> IsBulkJobParent(int bulkJobId) =>
        await Context.TblBulkJobs
            .Where(j => j.BulkJobId == bulkJobId)
            .Select(j => j.ParentId.HasValue || j.BulkParentId.HasValue)
            .FirstOrDefaultAsync();

    public async Task<List<JobItemTypeDto>> GetJobItemTypesAsync(int? jobId, int? bulkJobId)
    {
        if (bulkJobId.HasValue)
        {
            var id = bulkJobId.Value;
            return await Context.TblBulkJobItemTypes
                .Where(jit => jit.JobId == id)
                .Select(jit => new JobItemTypeDto
                {
                    ItemId = jit.ItemId,
                    Name = jit.ItemType.Name,
                    Quantity = jit.Quantity
                })
                .ToListAsync();
        }

        if (!jobId.HasValue)
        {
            return [];
        }

        var jid = jobId.Value;

        var active = Context.TucJobItemTypes
            .Where(jit => jit.JobId == jid)
            .Select(jit => new JobItemTypeDto
            {
                ItemId = jit.ItemId,
                Name = jit.ItemType.Name,
                Quantity = jit.Quantity
            });

        var archive = Context.TucJobItemTypesArchives
            .Where(jit => jit.JobId == jid)
            .Select(jit => new JobItemTypeDto
            {
                ItemId = jit.ItemId,
                Name = jit.ItemType.Name,
                Quantity = jit.Quantity
            });

        var booking = Context.TucJobBookingItemTypes
            .Where(jit => jit.BookingId == jid)
            .Select(jit => new JobItemTypeDto
            {
                ItemId = jit.ItemId,
                Name = jit.ItemType.Name,
                Quantity = jit.Quantity
            });

        return await active.Concat(archive).Concat(booking).ToListAsync();
    }

    /// <summary>
    /// Retrieves all active jobs with location data for the mega map display.
    /// </summary>
    public async Task<IReadOnlyList<MegaMapResponse>> GetJobsForMegaMapAsync(
        CancellationToken cancellationToken = default)
    {
        const int maxMapJobs = 5000;
        var isUsCustomer = _infoService.IsUsTenant();

        // Get active jobs to display on a map
        var jobs = await Context.TucJobs
            .Where(j =>
                j.UcjbStatus.HasValue
                && JobStatusGroups.Active.Contains(j.UcjbStatus.Value)
                && !j.UcjbVoid
            )
            .Take(maxMapJobs)
            .Select(j => new MegaMapResponse
            {
                JobId = j.UcjbId,
                JobNumber = j.UcjbNumber,
                JobStatus = j.UcjbStatus != null ? j.UcjbStatusNavigation.UcjsName : "New",
                EstimatedDelivery =
                    j.UcjbSpeedNavigation.GroupingId ==
                    (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight)
                    && j.TucJobNationwides.Count != 0
                        ? j.TucJobNationwides.OrderByDescending(n => n.UcnwLegNumber).First().UcnwEta.Value
                        : j
                            .UcjbDate.Date.Add(j.UcjbTime.Value.TimeOfDay)
                            .AddMinutes(j.UcjbSpeedNavigation.Minutes ?? 180),
                IsFlightJob = j.UcjbSpeedNavigation.GroupingId ==
                              (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight),
                PickupLocation = new AddressViewModel
                {
                    Latitude = j.PickUpLatitude ?? 0,
                    Longitude = j.PickUpLongitude ?? 0,
                    AddressLine1 = j.PickupAddressLine1,
                    AddressLine2 = j.PickupAddressLine2,
                    AddressLine3 = j.PickupAddressLine3,
                    AddressLine4 = j.PickupAddressLine4,
                    AddressLine5 = j.PickupAddressLine5,
                    AddressLine6 = j.PickupAddressLine6,
                    AddressLine7 = j.PickupAddressLine7,
                    AddressLine8 = j.PickupAddressLine8
                },
                DeliveryLocation = new AddressViewModel
                {
                    Latitude = j.DeliveryLatitude ?? 0,
                    Longitude = j.DeliveryLongitude ?? 0,
                    AddressLine1 = j.DeliveryAddressLine1,
                    AddressLine2 = j.DeliveryAddressLine2,
                    AddressLine3 = j.DeliveryAddressLine3,
                    AddressLine4 = j.DeliveryAddressLine4,
                    AddressLine5 = j.DeliveryAddressLine5,
                    AddressLine6 = j.DeliveryAddressLine6,
                    AddressLine7 = j.DeliveryAddressLine7,
                    AddressLine8 = j.DeliveryAddressLine8
                },
                CourierLocation = j.UcjbCourierId.HasValue
                    ? new CourierLocation
                    {
                        CourierId = j.UcjbCourier.UccrId,
                        CourierName =
                            $"{j.UcjbCourier.UccrName} {j.UcjbCourier.UccrSurname}".Trim(),
                        Coordinates = j.UcjbCourier.CourierGpsid.HasValue
                            ? new Coordinates
                            {
                                Lat = (decimal)j.UcjbCourier.CourierGps.Latitude,
                                Lng = (decimal)j.UcjbCourier.CourierGps.Longitude
                            }
                            : null
                    }
                    : null,
                FlightInfo =
                    j.UcjbSpeedNavigation.GroupingId ==
                    (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight)
                        ? j.TucJobNationwides
                            .OrderBy(n => n.UcnwLegNumber).Take(1)
                            .SelectMany(
                                first => j.TucJobNationwides.OrderByDescending(n => n.UcnwLegNumber).Take(1),
                                (first, last) => new AssignedFlight
                                {
                                    FlightNumber = first.UcnwFlightNo,
                                    ExpectedArrival = last.UcnwEta,
                                    ExpectedDeparture = first.UcnwEtd
                                })
                            .FirstOrDefault()
                        : null
            })
            .ToListAsync(cancellationToken);

        return jobs;
    }

    /// <summary>
    /// Retrieves a job by ID including its related family jobs, marking it as read.
    /// </summary>
    /// <param name="jobId">The job ID to retrieve.</param>
    /// <returns>Job group containing the job and related jobs.</returns>
    public async Task<JobGroupViewModel> GetJobByIdAsync(int jobId)
    {
        try
        {
            // Fire-and-forget: mark as read concurrently (doesn't affect the read result)
            _ = MarkJobAsReadAsync(jobId);

            // Try live first — eliminates the separate IsLiveJobAsync round-trip
            var result = await GetLiveJobByIdAsync(jobId);
            if (result != null)
            {
                return result;
            }

            return await GetArchivedJobByIdAsync(jobId);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting job {JobId}. Please see exception.", jobId);
            throw;
        }
    }

    /// <summary>
    /// Retrieves a single job by ID without related jobs.
    /// </summary>
    /// <param name="jobId">The job ID to retrieve.</param>
    /// <returns>The job view model.</returns>
    public async Task<JobViewModel> GetSingleJobById(int jobId)
    {
        try
        {
            var jobGroup = await GetJobByIdAsync(jobId);
            return jobGroup.Job;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting job {JobId}. Please see exception.", jobId);
            throw;
        }
    }

    /// <summary>
    /// Finds the 3 closest airports to a given coordinate using Haversine distance approximation.
    /// </summary>
    /// <param name="latitude">Reference latitude.</param>
    /// <param name="longitude">Reference longitude.</param>
    /// <returns>List of closest airports with distance and agent info.</returns>
    public async Task<IReadOnlyList<AddressWithAgent>> GetClosestAirportsAsync(
        decimal latitude,
        decimal longitude
    )
    {
        try
        {
            var latRad = (double)latitude / 57.3;

            var closestAirports = await Context
                .TblAirports.Where(a => a.Active)
                .Select(a => new AddressWithAgent
                {
                    AirportId = a.AirportId,
                    AirportCode = a.AirportCode,
                    StreetAddress = a.StreetAddress,
                    City = a.Name,
                    AgentId = a.AgentId ?? 0,
                    Latitude = a.Latitude,
                    Longitude = a.Longitude,
                    Distance = (decimal)
                        Math.Sqrt(
                            Math.Pow(110.574 * ((double)latitude - (double)a.Latitude), 2)
                            + Math.Pow(
                                110.574
                                * ((double)a.Longitude - (double)longitude)
                                * Math.Cos(latRad),
                                2
                            )
                        )
                })
                .OrderBy(a => a.Distance)
                .Take(3)
                .ToListAsync();

            return closestAirports;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobRepository),
                    nameof(GetClosestAirportsAsync)));
            throw;
        }
    }

    /// <summary>
    /// Retrieves a job type/speed by ID including its grouping information.
    /// </summary>
    /// <param name="speedId">The job type ID.</param>
    /// <returns>The job type entity with grouping.</returns>
    public async Task<TucJobType> GetJobTypeByIdAsync(int speedId) =>
        await Context.TucJobTypes
            .Include(s => s.Grouping)
            .FirstOrDefaultAsync(x => x.UcjtId == speedId) ??
        throw new KeyNotFoundException($"Job type with ID {speedId} not found");

    /// <summary>
    /// Retrieves aggregate statistics for the overview page (active, completed, inactive counts).
    /// </summary>
    public async Task<OverviewStatsViewModel> GetOverviewStatsAsync()
    {
        var baseQuery = Context.TucJobs.Where(j => j.InverseParent.Count != 0);

        var stats = await baseQuery
            .GroupBy(j => true) // Group all records together
            .Select(g => new OverviewStatsViewModel
            {
                Active = g.Count(j =>
                    j.UcjbStatus.HasValue
                    && JobStatusGroups.Active.Contains(j.UcjbStatus.Value)
                    && !j.UcjbVoid
                ),
                Completed = g.Count(j =>
                    j.UcjbStatus.HasValue
                    && JobStatusGroups.Completed.Contains(j.UcjbStatus.Value)
                    && !j.UcjbVoid
                ),
                Inactive = g.Count(j => j.UcjbVoid)
            })
            .FirstOrDefaultAsync();

        return stats
               ?? new OverviewStatsViewModel
               {
                   Active = 0,
                   Inactive = 0,
                   Completed = 0
               };
    }

    /// <summary>
    /// Retrieves scan history for a job within the last 3 days. The job number
    /// is resolved server-side from tucJob (with a tucJobArchive fallback) or
    /// tblBulkJob, so the equality match on tblBulkScan.Scan is immune to any
    /// client-side formatting drift between currentJob.jobNo and the barcode
    /// that landed in tblBulkScan.
    /// </summary>
    /// <param name="runDate">Reference date for the search window.</param>
    /// <param name="jobId">Job id to resolve a job number for.</param>
    /// <param name="isBulkJob">When true, resolve via tblBulkJob; otherwise tucJob with archive fallback.</param>
    /// <returns>List of scan events with courier and timestamp details.</returns>
    public async Task<IReadOnlyList<ScanDetailResult>> ScanList(DateTimeOffset? runDate,
        int jobId, bool isBulkJob)
    {
        // Scans are recorded against the parcel/item barcode for operational scan
        // types (Sort, Run, Pickup, Transit, InwardsDepot) and against the job
        // number only for Transfer scans. Match on the job number AND the job's
        // item barcodes, mirroring the Run Viewer Scan Manager (RVW_stpScanJobs /
        // RVW_stpJobItems). Matching the job number alone misses every depot scan.
        string jobNumber;
        var scanKeys = new HashSet<string>();

        if (isBulkJob)
        {
            // One read for the number, the item-level (parent) bulk id and the job's
            // own barcode, instead of three round trips to the same row.
            var bulk = await Context.TblBulkJobs
                .Where(j => j.BulkJobId == jobId)
                .Select(j => new
                {
                    j.JobNumber,
                    ItemBulkJobId = j.BulkParentId ?? j.BulkJobId,
                    j.Barcode
                })
                .FirstOrDefaultAsync();

            jobNumber = bulk?.JobNumber;
            if (string.IsNullOrEmpty(jobNumber))
            {
                Log.Information(
                    "ScanList: no job number resolved for jobId={JobId} isBulkJob={IsBulkJob}",
                    jobId, true);
                return [];
            }

            scanKeys.Add(jobNumber);
            if (!string.IsNullOrEmpty(bulk.Barcode))
            {
                scanKeys.Add(bulk.Barcode);
            }

            // Items live at the parent bulk job: read from tucJobItems once the bulk
            // job is pushed live, otherwise from tblBulkJobItems (mirrors RVW_stpJobItems).
            var liveJobId = await Context.TblBulkJobs
                .Where(j => j.BulkJobId == bulk.ItemBulkJobId && j.Done && j.JobId != null)
                .Select(j => j.JobId)
                .FirstOrDefaultAsync();

            var bulkBarcodes = liveJobId != null
                ? await Context.TucJobItems
                    .Where(ji => ji.JobId == liveJobId && ji.Barcode != null)
                    .Select(ji => ji.Barcode)
                    .ToListAsync()
                : await Context.TblBulkJobItems
                    .Where(ji => ji.JobId == bulk.ItemBulkJobId && ji.Barcode != null)
                    .Select(ji => ji.Barcode)
                    .ToListAsync();
            scanKeys.UnionWith(bulkBarcodes);
        }
        else
        {
            // Live job: number + item barcodes from the live tables.
            jobNumber = await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(j => j.UcjbNumber)
                .FirstOrDefaultAsync();

            if (!string.IsNullOrEmpty(jobNumber))
            {
                scanKeys.UnionWith(await Context.TucJobItems
                    .Where(ji => ji.JobId == jobId && ji.Barcode != null)
                    .Select(ji => ji.Barcode)
                    .ToListAsync());
            }
            else
            {
                // Archived job: number + item barcodes live in the archive tables;
                // skip the live-item lookup entirely.
                jobNumber = await Context.TucJobArchives
                    .Where(j => j.UcjbId == jobId)
                    .Select(j => j.UcjbNumber)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrEmpty(jobNumber))
                {
                    Log.Information(
                        "ScanList: no job number resolved for jobId={JobId} isBulkJob={IsBulkJob}",
                        jobId, false);
                    return [];
                }

                scanKeys.UnionWith(await Context.TucJobItemsArchives
                    .Where(ji => ji.JobId == jobId && ji.Barcode != null)
                    .Select(ji => ji.Barcode)
                    .ToListAsync());
            }

            scanKeys.Add(jobNumber);
        }

        var scanKeyList = scanKeys.ToList();

        runDate ??= _clock.TenantNow;
        // Compare wall-clock-to-wall-clock: bs.ScanDateTime is stored as
        // tenant local time without an offset, so strip the offset from
        // the cutoff before comparing.
        var cutoffDate = runDate.Value.AddDays(-3).DateTime;

        // Use proper joins instead of subqueries to avoid N+1 queries
        var query = from bs in Context.TblBulkScans
            join courier in Context.TucCouriers on bs.CourierId equals courier.UccrId into courierJoin
            from courier in courierJoin.DefaultIfEmpty()
            join runViewerTransferTo in Context.TucCouriers on bs.ToCourierId equals runViewerTransferTo.UccrId into
                rvtJoin
            from runViewerTransferTo in rvtJoin.DefaultIfEmpty()
            where bs.ScanDateTime > cutoffDate && scanKeyList.Contains(bs.Scan)
            orderby bs.ScanDateTime
            select new
            {
                bs.BulkScanId,
                // Project only the courier columns GetCourierDescription needs,
                // not whole TucCourier rows (three per scan otherwise).
                Courier = courier == null
                    ? (CourierLite?)null
                    : new CourierLite(courier.UccrId, courier.Code, courier.UccrName, courier.UccrSurname),
                bs.ScanDateTime,
                bs.ScanType,
                bs.RunName,
                TransferTo = bs.ToCourier == null
                    ? (CourierLite?)null
                    : new CourierLite(bs.ToCourier.UccrId, bs.ToCourier.Code, bs.ToCourier.UccrName,
                        bs.ToCourier.UccrSurname),
                // Only include RunViewerTransferTo when CourierId is 999 and the courier is active
                RunViewerTransferTo = bs.CourierId == 999 && runViewerTransferTo != null && runViewerTransferTo.Active
                    ? new CourierLite(runViewerTransferTo.UccrId, runViewerTransferTo.Code,
                        runViewerTransferTo.UccrName, runViewerTransferTo.UccrSurname)
                    : (CourierLite?)null
            };

        const int maxScanRows = 1000;
        var results = await query
            .AsNoTracking()
            .Take(maxScanRows)
            .Select(s => new ScanDetailResult
            {
                BulkScanId = s.BulkScanId,
                ScanDateTime = s.ScanDateTime,
                ScanDetail = GetScanDetail(s.ScanType),
                Courier = GetCourierDescription(s.ScanType, s.Courier, s.TransferTo, s.RunViewerTransferTo, s.RunName)
            })
            .ToListAsync();

        Log.Information(
            "ScanList: jobId={JobId} isBulkJob={IsBulkJob} jobNumber={JobNumber} keyCount={KeyCount} count={Count}",
            jobId, isBulkJob, jobNumber, scanKeyList.Count, results.Count);

        return results;
    }

    /// <summary>
    /// Validates that a job exists and was booked today for POD swap operation.
    /// </summary>
    /// <param name="jobNumber">The job number to validate.</param>
    /// <returns>True if the job is valid for POD swap.</returns>
    public async Task<bool> ValidatePodSwapAsync(string jobNumber)
    {
        var today = _clock.TenantToday;

        var isValid = await Context.TblJobs
            .Where(j => j.Number == jobNumber)
            .Where(j => j.Date.HasValue && j.Date.Value.Date == today.Date)
            .AnyAsync();

        return isValid;
    }

    /// <summary>
    /// Resolves a job number to its canonical job id. Returns null when no job
    /// with that number exists. Job numbers are unique per job; if more than one
    /// row ever shares a number, the most recent (highest id) wins.
    /// </summary>
    public async Task<int?> GetJobIdByNumberAsync(string jobNumber) =>
        await Context.TblJobs
            .Where(j => j.Number == jobNumber)
            .OrderByDescending(j => j.JobId)
            .Select(j => (int?)j.JobId)
            .FirstOrDefaultAsync();

    /// <summary>
    /// Calculates the total amount (including fuel surcharge) from a base amount using the database function.
    /// </summary>
    /// <param name="jobId">The job ID to calculate the total for.</param>
    /// <param name="baseAmount">The raw base amount without fuel.</param>
    /// <returns>The calculated total amount including fuel surcharge.</returns>
    public async Task<decimal> GetTotalAmountFromBaseAsync(int jobId, decimal baseAmount) =>
        await Context.TucJobs
            .Select(_ => DespatchContext.UTL_fncJob_RawBaseToAmount(jobId, baseAmount))
            .FirstOrDefaultAsync() ?? 0m;

    public async Task<List<Suggestion>> GetActivePartnerOptionsAsync() =>
        await Context.IntMgrPartnerPairings
            .Where(p => p.Status == "Active")
            .Select(p => new Suggestion
            {
                Id = p.Id,
                Text = p.PartnerTenantName
            })
            .ToListAsync();

    public async Task<bool> IsPartnerJobAsync(int jobId) =>
        await Context.IsPartnerJobAsync(jobId);

    public async Task<bool> IsOutboundPartnerJobAsync(int jobId, string localTenantId) =>
        await Context.IsOutboundPartnerJobAsync(jobId, localTenantId);

    public new async Task<IReadOnlyList<JobCoordinateModel>> GetJobCoordinatesAsync(IReadOnlyList<int> selectedViewIds,
        CancellationToken cancellationToken = default)
        => await base.GetJobCoordinatesAsync(selectedViewIds, cancellationToken);

    public new async Task<bool> IsJobArchived(int jobId)
        => await base.IsJobArchived(jobId);

    public new async Task<IReadOnlyList<MultiSuggestion>> GetRelatedJobsMultiSelectListAsync(int jobId, bool isArchived,
        bool isBulkJob = false)
        => await base.GetRelatedJobsMultiSelectListAsync(jobId, isArchived, isBulkJob);

    public new async Task<int?> GetJobParentIdAsync(int jobId)
        => await base.GetJobParentIdAsync(jobId);

    public new async Task<Dictionary<int, JobCurrentAmountInfo>> GetJobCurrentAmountsAsync(IReadOnlyList<int> jobIds)
        => await base.GetJobCurrentAmountsAsync(jobIds);

    public async Task<Dictionary<int, DateTime?>> GetJobCompletionTimesAsync(IReadOnlyList<int> jobIds)
    {
        if (jobIds is null or { Count: 0 })
        {
            return new Dictionary<int, DateTime?>();
        }

        return await Context.TucJobs
            .Where(j => jobIds.Contains(j.UcjbId))
            .Select(j => new { j.UcjbId, j.UcjbComplTime })
            .ToDictionaryAsync(x => x.UcjbId, x => x.UcjbComplTime);
    }

    /// <summary>
    /// Restores the given jobs back onto the dispatch board (the C# replacement for the legacy
    /// uspRestoreJobs proc). Per job, it un-assigns the courier, clears dispatch/paging/completion
    /// state, resets the status to New and internal status to New Jobs, and re-shows the job via
    /// DisplayInDespatch = 1. Completed jobs are restored too (the operator confirms that in the
    /// UI). The POD name is cleared so the job re-enters the DESWEB_qryDespatch board view, which
    /// excludes any job that still carries a UcjbPodname. The courier device is notified via
    /// UTL_stpJob_RestoreDevice (before the courier is nulled) and the courier's clear-list area
    /// order is recomputed, preserving the proc's side effects.
    /// </summary>
    private async Task RestoreJobsCoreAsync(IReadOnlyList<int> jobIds)
    {
        if (jobIds is null or { Count: 0 })
        {
            return;
        }

        Log.Information(
            "RestoreJobsCore starting for {RequestedCount} requested job(s) {RequestedJobIds}.",
            jobIds.Count, string.Join(",", jobIds));

        var jobs = await Context.TucJobs
            .Where(j => jobIds.Contains(j.UcjbId))
            .Select(j => new
            {
                j.UcjbId,
                j.UcjbCourierId,
                j.ParentId,
                j.UcjbDispId,
                j.UcjbJobDone,
                j.UcjbVoid
            })
            .ToListAsync();

        // Jobs requested but absent from TucJobs are almost always archived (they live only in
        var missingJobIds = jobIds.Where(id => jobs.All(j => j.UcjbId != id)).ToList();
        if (missingJobIds.Count > 0)
        {
            Log.Warning(
                "RestoreJobsCore: {MissingCount} requested job(s) {MissingJobIds} were not found in TucJobs and will be skipped (likely archived).",
                missingJobIds.Count, string.Join(",", missingJobIds));
        }

        Log.Information("RestoreJobsCore loaded {FoundCount} job(s) from TucJobs to evaluate for restore.",
            jobs.Count);

        foreach (var job in jobs)
        {
            Log.Information(
                "RestoreJobsCore evaluating job {JobId}: JobDone={JobDone}, Void={Void}, CourierId={CourierId}, DispId={DispId}, ParentId={ParentId}",
                job.UcjbId, job.UcjbJobDone, job.UcjbVoid, job.UcjbCourierId, job.UcjbDispId, job.ParentId);

            // Multi-leg relationship: clear the shared dispatcher off every sibling job.
            if (job.UcjbDispId == MultiLegDispatcherId && (job.ParentId ?? 0) != 0)
            {
                var parentRelationshipTypeId = await Context.TucJobs
                    .Where(j => j.UcjbId == job.ParentId)
                    .Select(j => j.JobRelationshipTypeId)
                    .FirstOrDefaultAsync();

                if (parentRelationshipTypeId is not null &&
                    SharedDispatcherRelationshipTypes.Contains(parentRelationshipTypeId.Value))
                {
                    await Context.TucJobs
                        .Where(j => j.ParentId == job.ParentId)
                        .ExecuteUpdateAsync(setters => setters.SetProperty(j => j.UcjbDispId, (int?)null));
                }
            }

            // Notify the courier's device the job has been taken off them. Must run before the
            // courier is nulled below (the proc reads the still-assigned courier; it self-guards
            // when the job has no courier).
            await Context.Procedures.UTL_stpJob_RestoreDeviceAsync(job.UcjbId);

            await Context.TucJobs
                .Where(j => j.UcjbId == job.UcjbId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbStatus, (int)JobStatus.New)
                    .SetProperty(j => j.UcjbJobDone, false)
                    .SetProperty(j => j.UcjbVoid, false)
                    .SetProperty(j => j.UcjbCourierId, (int?)null)
                    .SetProperty(j => j.UcjbDispDate, (DateTime?)null)
                    .SetProperty(j => j.UcjbDispTime, (DateTime?)null)
                    .SetProperty(j => j.UcjbPaged, false)
                    .SetProperty(j => j.UcjbPagedTime, (DateTime?)null)
                    .SetProperty(j => j.UcjbComplTime, (DateTime?)null)
                    .SetProperty(j => j.UcjbMobileSend, false)
                    .SetProperty(j => j.AutoDespatch, false)
                    .SetProperty(j => j.DisplayInDespatch, true)
                    .SetProperty(j => j.PickRunOrder, (byte?)null)
                    .SetProperty(j => j.DropRunOrder, (byte?)null)
                    .SetProperty(j => j.DesCheck, false)
                    .SetProperty(j => j.FdcourierId, (int?)null)
                    .SetProperty(j => j.FirstJob, false)
                    .SetProperty(j => j.InternalStatus, (int)InternalJobStatus.NewJobs)
                    .SetProperty(j => j.UcjbPodname, (string?)null));

            Log.Information(
                "RestoreJobsCore restored job {JobId} to New/NewJobs (courier cleared, completion/dispatch state reset; POD name cleared so the job re-enters the dispatch view).",
                job.UcjbId);

            // Recompute the (former) courier's clear-list area ordering now the job is gone.
            if (job.UcjbCourierId is { } courierId)
            {
                await courierRepository.ResetClearListAreaOrderAsync(courierId);
            }
        }

        Log.Information("RestoreJobsCore finished for requested job(s) {RequestedJobIds}.",
            string.Join(",", jobIds));
    }

    /// <summary>
    /// Maps a quick-add <see cref="JobCreateViewModel"/> (plus the resolved staff, job number and
    /// speed text) onto the <see cref="CreateMinimalTucJobInputModel"/> consumed by the proc.
    /// Pure/static so the mapping is unit-testable without a database.
    /// </summary>
    internal static CreateMinimalTucJobInputModel BuildQuickAddInputModel(
        JobCreateViewModel request, Suggestion staffInfo, string jobNumber, string speedText, DateTime now) =>
        new()
        {
            JobNumber = jobNumber,
            FromAddress = request.PickUpAddress,
            ToAddress = request.DeliveryAddress,
            BookedBy = staffInfo.Text,
            ClientId = request.ClientId,
            AgentCourierId = null,
            Speed = speedText,
            SpeedId = request.SpeedId,
            Amount = request.Charge,
            Reference = request.RefA,
            ReferenceB = request.RefB,
            Notes = request.JobNotes,
            TenantCurrentTime = now,
            LoggedInContactId = staffInfo.Id,
            FromContactName = request.FromContactName,
            ToContactName = request.DeliverToContact,
            PickupNotes = request.PickupNotes,
            DeliveryNotes = request.DeliveryNotes,
            PickUpLatitude = request.PickUpAddress?.Latitude,
            PickUpLongitude = request.PickUpAddress?.Longitude,
            DeliveryLatitude = request.DeliveryAddress?.Latitude,
            DeliveryLongitude = request.DeliveryAddress?.Longitude,
            Pickup = request.Date.DateTime,
            Hold = false
        };

    private async Task<int> InsertQuickAddJobViaProcAsync(
        CreateMinimalTucJobInputModel data, CancellationToken cancellationToken = default)
    {
        var jobIdParam = new OutputParameter<int?>();
        var messageParam = new OutputParameter<string>();
        var returnValueParam = new OutputParameter<int>();

        await Context.Procedures.DD_stpJob_InsertExceleratorAsync(
            bookedBy: data.BookedBy,
            fromAddress: data.FromAddress?.FullAddress,
            fromStreet: data.FromAddress != null
                ? (data.FromAddress.AddressLine3 + " " + data.FromAddress.AddressLine4).Trim()
                : null,
            fromBuilding: data.FromAddress?.AddressLine2,
            fromCompany: data.FromAddress?.AddressLine1,
            fromCity: data.FromAddress?.AddressLine5,
            fromState: data.FromAddress?.AddressLine6,
            fromZipCode: data.FromAddress != null ? SafeParseZipCode(data.FromAddress.AddressLine7) : null,
            fromCountry: null,
            speed: data.Speed,
            speedID: data.SpeedId,
            toAddress: data.ToAddress?.FullAddress,
            toStreet: data.ToAddress != null
                ? (data.ToAddress.AddressLine3 + " " + data.ToAddress.AddressLine4).Trim()
                : null,
            toBuilding: data.ToAddress?.AddressLine2,
            toCompany: data.ToAddress?.AddressLine1,
            toCity: data.ToAddress?.AddressLine5,
            toState: data.ToAddress?.AddressLine6,
            toZipCode: data.ToAddress != null ? SafeParseZipCode(data.ToAddress.AddressLine7) : null,
            toCountry: null,
            toAddressType: data.ToAddressType,
            referenceA: data.Reference,
            referenceB: data.ReferenceB,
            vehicleSizeID: data.VehicleSizeId,
            totalWeight: null,
            totalDistance: null,
            @return: null,
            courierNotes: data.Notes,
            clientNotes: data.Notes,
            pickupNotes: data.PickupNotes,
            deliveryNotes: data.DeliveryNotes,
            fromContactName: data.FromContactName,
            fromPhoneNumber: data.FromPhoneNumber,
            toContactName: data.ToContactName,
            toPhoneNumber: data.ToPhoneNumber,
            type: data.Type,
            pickUpFrom: null,
            quantity: null,
            leaveNotHome: null,
            jobNotificationType: data.JobNotificationType,
            jobNotificationEmail: data.JobNotificationEmail,
            jobNotificationMobile: data.JobNotificationMobile,
            toAddressCode: null,
            fromAddressCode: null,
            clientID: data.ClientId,
            time: data.TenantCurrentTime,
            hold: data.Hold,
            fixedAmount: data.Amount,
            agentAmount: null,
            agentCourierID: data.AgentCourierId,
            fuelSurchargeAmount: data.FuelSurchargeAmount,
            ourRef: data.OurRef,
            pickUpLatitude: SafeDecimalToString(data.PickUpLatitude),
            pickUpLongitude: SafeDecimalToString(data.PickUpLongitude),
            deliveryLatitude: SafeDecimalToString(data.DeliveryLatitude),
            deliveryLongitude: SafeDecimalToString(data.DeliveryLongitude),
            pickup: null,
            dropoff: null,
            privateRes: data.PrivateRes,
            truckStartTime: null,
            truckHours: null,
            jobNumber: data.JobNumber,
            storageState: null,
            deliveryState: null,
            sourceId: (int)JobSource.DespatchWeb,
            totalPallets: data.TotalPallets,
            extraStopOffs: null,
            dryIceWeight: data.DryIceWeight,
            cubic: data.Cubic,
            pickupWaitTime: null,
            deliveryWaitTime: null,
            dGClass: data.DgClass,
            dGDocs: data.DgClass.HasValue,
            loggedInContactId: data.LoggedInContactId,
            accessorialChargeGroupId: data.AccessorialChargeGroupId,
            deliverByDateTime: data.DeliverByDateTime,
            pickupTimeZone: data.PickupTimeZone,
            deliverByTimeZone: data.DeliverByTimeZone,
            recurringName: data.RecurringName,
            recurringDays: data.RecurringDays,
            recurringFrequency: data.RecurringFrequency,
            recurringHoliday: null,
            recurringInitialDays: data.RecurringInitialDays,
            tenantCurrentTime: data.TenantCurrentTime,
            dimensionsType: null,
            cubicList: data.CubicList,
            weightList: data.WeightList,
            barcodeList: data.BarcodeList,
            forceTucJobPush: null,
            jobBookingID: null,
            pickupReadyDateTime: null,
            jobID: jobIdParam,
            message: messageParam,
            returnValue: returnValueParam,
            cancellationToken: cancellationToken);

        var success = returnValueParam.Value == 0 || jobIdParam.Value.HasValue;
        if (!success)
        {
            throw new InvalidOperationException($"Failed to create quick add job: {messageParam.Value}");
        }

        return jobIdParam.Value ?? throw new InvalidOperationException("Failed to get job id from quick add job");

        static string SafeDecimalToString(decimal? value) => value?.ToString();

        static int? SafeParseZipCode(string zipCode) =>
            int.TryParse(zipCode, out var result) ? result : null;
    }

    /// <summary>
    /// Builds the paired phantom jobs for an inter-courier charge. The transfer moves money from
    /// the "from" courier to the "to" courier, so the from-job carries a NEGATIVE amount (money
    /// debited) and the to-job a POSITIVE amount (money credited). The dialog only ever submits a
    /// non-negative amount, so the sign is decided here via <see cref="Math.Abs(decimal)"/>.
    /// </summary>
    internal static (TucJob fromJob, TucJob toJob) BuildIccJobPair(
        string fromJobNumber,
        string toJobNumber,
        InterCourierChargeViewModel viewModel,
        DateTime currentTime,
        int staffId)
    {
        var amount = Math.Abs(viewModel.Amount);
        var note = $"From # {viewModel.FromCourierId} To # {viewModel.ToCourierId}";

        var fromJob = CreateIccJobEntry(
            fromJobNumber, viewModel.ClientId, viewModel.FromCourierId, -amount,
            viewModel.Reference, $"To # {viewModel.ToCourierId}", "ICC",
            note, currentTime, staffId);

        var toJob = CreateIccJobEntry(
            toJobNumber, viewModel.ClientId, viewModel.ToCourierId, amount,
            viewModel.Reference, $"From # {viewModel.FromCourierId}", string.Empty,
            note, currentTime, staffId);

        return (fromJob, toJob);
    }

    /// <summary>
    /// Builds a phantom inter-courier-charge job — created in the Completed state and hidden
    /// from dispatch. Mirrors the pre-2025-09-24 field set; the unified CreateJobService path
    /// is unsuitable here because it produces live dispatch-board jobs and runs client-default
    /// validation that the ICC payload doesn't satisfy.
    /// </summary>
    internal static TucJob CreateIccJobEntry(
        string jobNumber,
        int clientId,
        int courierId,
        decimal amount,
        string reference,
        string clientRefB,
        string ourRef,
        string note,
        DateTime currentTime,
        int staffId)
    {
        return new TucJob
        {
            UcjbNumber = jobNumber,
            UcjbDate = currentTime,
            UcjbTime = currentTime,
            UcjbType = (int)JobServiceType.AllServices,
            UcjbClientId = clientId,
            UcjbContact = $"Courier {courierId}",
            UcjbChargeType = 3,
            UcjbAmount = amount,
            UcjbSpeed = 1,
            PickupAddressLine1 = note,
            DeliveryAddressLine1 = "ToSP",
            UcjbSize = 1,
            UcjbQty = 1,
            UcjbCbd = false,
            UcjbKm = 0,
            UcjbFlightDetails = "FD",
            UcjbWeight = 1,
            UcjbCourierId = courierId,
            UcjbClientRefa = (reference ?? string.Empty)[..Math.Min((reference ?? string.Empty).Length, 20)],
            UcjbClientRefb = (clientRefB ?? string.Empty)[..Math.Min((clientRefB ?? string.Empty).Length, 15)],
            UcjbOurRef = (ourRef ?? string.Empty)[..Math.Min((ourRef ?? string.Empty).Length, 20)],
            UcjbOpId = staffId,
            UcjbVan = false,
            Truck = false,
            UcjbReturn = false,
            UcjbVoid = false,
            UcjbAttention = false,
            UcjbPickUpFrom = 0,
            UcjbPaged = true,
            UcjbClientCode = "ZZZ!!",
            UcjbRefJobId = 0,
            UcjbNotes = string.Empty,
            UcjbStatus = (int)JobStatus.Completed,
            UcjbComplTime = currentTime,
            UcjbPodname = $"Courier {courierId}",
            UcjbJobDone = true,
            ProofOfDelivery = 0,
            SourceId = (int)JobSource.DespatchWeb,
            Reprice = false,
            FuelSurchargeAmount = 0,
            DeliverToPrivateBusiness = 0,
            UcjbDispTime = currentTime,
            DisplayInDespatch = false
        };
    }

    /// <summary>
    /// Archive-table counterpart of <see cref="UpdatePackagesForJobAsync"/>. Mirrors the same
    /// delete-and-reinsert flow against tucJobItemsArchive / tucJobArchive for archived jobs.
    /// </summary>
    private async Task UpdatePackagesForArchivedJobAsync(int jobId,
        IReadOnlyList<ParcelDimensions> parcels,
        bool? calculateDimsOncePerJob = null)
    {
        var effectiveJobId = await Context.GetEffectiveArchiveJobIdAsync(jobId);
        var childJobId = await IsStopJob(jobId) ? jobId : (int?)null;

        Log.Information(
            "UpdatePackages for archived Job {JobId} (effective {EffectiveJobId}, child {ChildJobId}): {Count} parcels",
            jobId, effectiveJobId, childJobId, parcels.Count);

        var strategy = Context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await Context.Database.BeginTransactionAsync();

            // Delete all existing items for this scope
            await Context.TucJobItemsArchives
                .Where(i => i.JobId == effectiveJobId &&
                            (childJobId == null || i.ChildJobId == childJobId))
                .ExecuteDeleteAsync();

            // Re-insert all parcels with sequential ItemIds
            if (parcels.Count > 0)
            {
                // Get max ItemId across ALL items for this job (not just this scope)
                // to avoid collisions with sibling stop jobs
                var maxItemId = await Context.TucJobItemsArchives
                    .Where(i => i.JobId == effectiveJobId)
                    .MaxAsync(i => (int?)i.ItemId) ?? 0;

                var nextItemId = maxItemId + 1;

                var newItems = parcels.Select(p => new TucJobItemsArchive
                {
                    JobId = effectiveJobId,
                    ChildJobId = childJobId,
                    Height = p.Height ?? 0,
                    Length = p.Length ?? 0,
                    Depth = p.Depth ?? 0,
                    Weight = p.Weight ?? 0,
                    Cubic = p.Cubic,
                    Notes = p.ItemName,
                    Barcode = p.Barcode,
                    Items = 1,
                    ItemId = nextItemId++
                }).ToList();

                await Context.TucJobItemsArchives.AddRangeAsync(newItems);
                await Context.SaveChangesAsync();
            }

            // Update UcjbQty with total parcel count so it stays consistent with the parcels
            // For stop jobs, only count items belonging to this specific stop (not sibling stops)
            var totalItemCount = await Context.TucJobItemsArchives
                .Where(i => i.JobId == effectiveJobId &&
                            (childJobId == null || i.ChildJobId == childJobId))
                .CountAsync();

            int? dimensionsType = calculateDimsOncePerJob is true ? 2 : null;

            if (childJobId == null)
            {
                // Non-stop: sync qty across parent and all split children (they share the same parcels)
                if (calculateDimsOncePerJob.HasValue)
                {
                    await Context.TucJobArchives
                        .Where(j => j.UcjbId == effectiveJobId || j.RootParentId == effectiveJobId)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(j => j.UcjbQty, (short)totalItemCount)
                            .SetProperty(j => j.DimensionsType, dimensionsType));
                }
                else
                {
                    await Context.TucJobArchives
                        .Where(j => j.UcjbId == effectiveJobId || j.RootParentId == effectiveJobId)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(j => j.UcjbQty, (short)totalItemCount));
                }
            }
            else
            {
                // Stop job: each stop has its own parcels — only update this stop's qty
                if (calculateDimsOncePerJob.HasValue)
                {
                    await Context.TucJobArchives
                        .Where(j => j.UcjbId == jobId)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(j => j.UcjbQty, (short)totalItemCount)
                            .SetProperty(j => j.DimensionsType, dimensionsType));
                }
                else
                {
                    await Context.TucJobArchives
                        .Where(j => j.UcjbId == jobId)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(j => j.UcjbQty, (short)totalItemCount));
                }
            }

            await transaction.CommitAsync();
        });
    }

    private async Task UpdateArchivedJobWeightAsync(int jobId, decimal weight)
    {
        if (await IsStopJob(jobId))
        {
            // Stop job: each stop has its own weight — only update this stop
            await Context.TucJobArchives
                .Where(j => j.UcjbId == jobId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.UcjbWeight, (double)weight));
            return;
        }

        // Non-stop: resolve to parent and sync weight across the entire delivery chain
        var effectiveJobId = await Context.GetEffectiveArchiveJobIdAsync(jobId);
        await Context.TucJobArchives
            .Where(j => j.UcjbId == effectiveJobId || j.RootParentId == effectiveJobId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UcjbWeight, (double)weight));
    }

    /// <summary>
    /// Checks if a job can be split.
    /// A job can be split if it has no flights assigned .
    /// Child jobs can now be split.
    /// </summary>
    /// <param name="jobId">The job ID to check.</param>
    /// <returns>True if the job can be split, false otherwise.</returns>
    public async Task<bool> CanJobBeSplitAsync(int jobId)
    {
        // Use projection to check in SQL without loading full entity + collection
        var result = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new { HasFlights = j.TucJobNationwides.Any() })
            .FirstOrDefaultAsync();

        // Only restriction: cannot split jobs with flights assigned
        return result is { HasFlights: false };
    }

    /// <summary>
    /// Gets all child job IDs for a split parent job.
    /// </summary>
    /// <param name="parentJobId">The parent job ID.</param>
    /// <returns>List of child job IDs.</returns>
    public async Task<IReadOnlyList<int>> GetSplitJobChildrenAsync(int parentJobId) =>
        await Context.TucJobs
            .Where(j => j.ParentId == parentJobId)
            .Select(j => j.UcjbId)
            .ToListAsync();

    internal static PerformanceSpendReportModel MapToPerformanceSpendReportModel(ClientJobsReportRow row)
    {
        var totalTime = row.Booked != null && row.Delivered != null
            ? (int?)Math.Round((row.Delivered.Value.TimeOfDay - row.Booked.Value.TimeOfDay).TotalMinutes,
                MidpointRounding.AwayFromZero)
            : null;

        return new PerformanceSpendReportModel
        {
            JobNumber = row.JobNumber,
            UcjbType = row.JobType switch { 1 => "Pick up from us", 2 => "Deliver to us", 3 => "3rd party", _ => null },
            Date = row.Date?.ToString("dd-MMM-yy"),
            Booked = row.Booked?.ToString("HH:mm"),
            BookedBy = row.BookedBy,
            PickedUpTime = row.PickedUpTime?.ToString("yyyy-MM-dd HH:mm:ss"),
            Delivered = row.Delivered?.ToString("yyyy-MM-dd HH:mm:ss"),
            TotalTime = totalTime?.ToString(),
            DeliveryMins = totalTime != null && row.Minutes != null ? (totalTime - row.Minutes)?.ToString() : null,
            PodName = row.PodName,
            Booker = row.BookedBy,
            AchievedSpeed = row.AcceptedSpeed,
            From = row.FromSuburb,
            FromPostcode = row.FromPostcode,
            To = string.IsNullOrEmpty(row.ToSuburb) || row.ToSuburb == "Unknown"
                ? row.ToSuburbFromAddress ?? "Unknown"
                : row.ToSuburb,
            ToPostcode = row.ToPostcode,
            UcjbFromAddr = row.FromAddr,
            Address = row.ToAddr,
            Courier = row.CourierId?.ToString(),
            LatePickup = row.LatePickup?.ToString(),
            LateDelivery = row.LateDelivery?.ToString(),
            UcclLegalName = row.ClientLegalName,
            UcjbSpeed = row.Speed,
            Notes = row.Notes,
            ChargeExclGst = row.Amount?.ToString("F2"),
            RefA = row.RefA,
            RefB = row.RefB,
            UrgentRef = row.OurRef,
            Weight = row.Weight?.ToString(),
            Vehicle = row.Size switch { 1 or 2 => "Car", 3 => "Van", 4 => "Truck", _ => null },
            Quantity = row.Quantity?.ToString(),
            UcjbYear = row.Year?.ToString(),
            UcjbMonth = row.Month?.ToString(),
            Code = row.CourierCode,
            UccrName = row.CourierName,
            UcjbInvoiceNo = row.InvoiceNo?.ToString(),
            UcjbLocked = row.Locked?.ToString(),
            UcjbClientId = row.ClientId?.ToString(),
            UcclNote = row.ClientNote,
            Minutes = row.Minutes?.ToString(),
            FuelSurchargeAmount = row.FuelSurchargeAmount,
            RawBaseAmount = row.RawBaseAmount
        };
    }

    /// <summary>
    /// Combines all non-empty address lines into a single comma-separated string for device sync.
    /// </summary>
    private static string CombineAddressLines(AddressViewModel address)
    {
        var lines = new[]
        {
            address.AddressLine1,
            address.AddressLine2,
            address.AddressLine3,
            address.AddressLine4,
            address.AddressLine5,
            address.AddressLine6,
            address.AddressLine7,
            address.AddressLine8
        };

        return string.Join(", ", lines.Where(line => !string.IsNullOrWhiteSpace(line)));
    }

    private static IOrderedQueryable<TucJob> ApplyLiveJobSorting(
        IQueryable<TucJob> query,
        string sortColumn,
        bool descending) =>
        sortColumn switch
        {
            "date" => descending
                ? query.OrderByDescending(j => j.UcjbDate).ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbDate).ThenBy(j => j.UcjbTime).ThenBy(j => j.UcjbId),
            "time" => descending
                ? query.OrderByDescending(j => j.UcjbTime).ThenByDescending(j => j.UcjbDate)
                    .ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbTime).ThenBy(j => j.UcjbDate).ThenBy(j => j.UcjbId),
            "jobno" => descending
                ? query.OrderByDescending(j => j.UcjbNumber).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbNumber).ThenBy(j => j.UcjbId),
            "client" => descending
                ? query.OrderByDescending(j => j.UcjbClientCode).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbClientCode).ThenBy(j => j.UcjbId),
            "status" => descending
                ? query.OrderByDescending(j => j.UcjbStatus).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbStatus).ThenBy(j => j.UcjbId),
            "speed" => descending
                ? query.OrderByDescending(j => j.UcjbSpeedNavigation!.ShortName).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbSpeedNavigation!.ShortName).ThenBy(j => j.UcjbId),
            "courier" => descending
                ? query.OrderByDescending(j => j.UcjbCourier!.Code).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbCourier!.Code).ThenBy(j => j.UcjbId),
            _ => query.OrderBy(j => j.UcjbDate).ThenBy(j => j.UcjbTime).ThenBy(j => j.UcjbId)
        };

    private static IOrderedQueryable<TucJobArchive> ApplyArchivedJobSorting(
        IQueryable<TucJobArchive> query,
        string sortColumn,
        bool descending) =>
        sortColumn switch
        {
            "date" => descending
                ? query.OrderByDescending(j => j.UcjbDate).ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbDate).ThenBy(j => j.UcjbTime).ThenBy(j => j.UcjbId),
            "time" => descending
                ? query.OrderByDescending(j => j.UcjbTime).ThenByDescending(j => j.UcjbDate)
                    .ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbTime).ThenBy(j => j.UcjbDate).ThenBy(j => j.UcjbId),
            "jobno" => descending
                ? query.OrderByDescending(j => j.UcjbNumber).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbNumber).ThenBy(j => j.UcjbId),
            "client" => descending
                ? query.OrderByDescending(j => j.UcjbClientCode).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbClientCode).ThenBy(j => j.UcjbId),
            "status" => descending
                ? query.OrderByDescending(j => j.UcjbStatus).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbStatus).ThenBy(j => j.UcjbId),
            "speed" => descending
                ? query.OrderByDescending(j => j.SpeedNavigation!.ShortName).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.SpeedNavigation!.ShortName).ThenBy(j => j.UcjbId),
            "courier" => descending
                ? query.OrderByDescending(j => j.UcjbCourier!.Code).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbCourier!.Code).ThenBy(j => j.UcjbId),
            _ => query.OrderBy(j => j.UcjbDate).ThenBy(j => j.UcjbTime).ThenBy(j => j.UcjbId)
        };

    internal static IEnumerable<DispatchJobViewModel> ApplyDispatchJobSorting(
        IEnumerable<DispatchJobViewModel> jobs,
        string sortColumn,
        bool descending)
    {
        var orderedJobs = sortColumn switch
        {
            "date" => descending
                ? jobs.OrderByDescending(j => j.Booked).ThenByDescending(j => j.Time).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Booked).ThenBy(j => j.Time).ThenBy(j => j.Id),
            "time" => descending
                ? jobs.OrderByDescending(j => j.Time).ThenByDescending(j => j.Booked).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Time).ThenBy(j => j.Booked).ThenBy(j => j.Id),
            "jobno" => descending
                ? jobs.OrderByDescending(j => j.JobNo).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.JobNo).ThenBy(j => j.Id),
            "client" => descending
                ? jobs.OrderByDescending(j => j.Client).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Client).ThenBy(j => j.Id),
            "status" => descending
                ? jobs.OrderByDescending(j => j.Status).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Status).ThenBy(j => j.Id),
            "speed" => descending
                ? jobs.OrderByDescending(j => j.Speed).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Speed).ThenBy(j => j.Id),
            "courier" => descending
                ? jobs.OrderByDescending(j => j.Courier).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Courier).ThenBy(j => j.Id),
            "pickup" => descending
                ? jobs.OrderByDescending(j => j.From).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.From).ThenBy(j => j.Id),
            "delivery" => descending
                ? jobs.OrderByDescending(j => j.ToAddress).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.ToAddress).ThenBy(j => j.Id),
            "vehicle" => descending
                ? jobs.OrderByDescending(j => j.Vehicle?.Text).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Vehicle?.Text).ThenBy(j => j.Id),
            _ => jobs.OrderBy(j => j.Booked).ThenBy(j => j.Time).ThenBy(j => j.Id)
        };

        return orderedJobs;
    }

    private async Task<int> RepriceRegularOrArchivedJobAsync(SimpleRepriceJobModel data)
    {
        // Try regular jobs first, fall back to the archive if not found
        var rowsChanged = await Context.TucJobs
            .Where(j => j.UcjbId == data.JobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.RatedManually, true)
                .SetProperty(j => j.UcjbAmount, data.NewPrice));

        if (rowsChanged > 0)
        {
            return rowsChanged;
        }

        return await Context.TucJobArchives
            .Where(j => j.UcjbId == data.JobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.RatedManually, true)
                .SetProperty(j => j.UcjbAmount, data.NewPrice));
    }

    private async Task UpdateJobCouriersAsync(IReadOnlyList<JobManualPriceModel> data,
        Dictionary<int, TucJob> dbDataDict,
        Dictionary<int, TucJobArchive> dbDataArchiveDict)
    {
        var courierCodes = data.Where(d => !string.IsNullOrWhiteSpace(d.CourierCode))
            .Select(d => d.CourierCode.Trim())
            .Distinct()
            .ToList();

        if (courierCodes.Count == 0)
        {
            Log.Information("No courier updates requested");
            return;
        }

        var courierLookup = await Context.TucCouriers
            .Where(c => courierCodes.Contains(c.Code) && c.Active)
            .ToDictionaryAsync(c => c.Code, c => c.UccrId);

        // Update couriers for each job
        foreach (var d in data.Where(d => !string.IsNullOrWhiteSpace(d.CourierCode)))
        {
            dynamic match = dbDataDict.TryGetValue(d.Id, out var activeJob) ? activeJob
                : dbDataArchiveDict.TryGetValue(d.Id, out var archivedJob) ? archivedJob
                : null;

            if (match == null)
            {
                Log.Warning("Job with ID {DId} not found for courier update", d.Id);
                continue;
            }

            var trimmedCode = d.CourierCode.Trim();
            if (courierLookup.TryGetValue(trimmedCode, out var courierId))
            {
                match.UcjbCourierId = courierId;
                Log.Information("Job {DId} courier updated to {CourierCode} (ID: {CourierId})",
                    d.Id, trimmedCode, courierId);
            }
            else
            {
                Log.Warning("Courier code '{CourierCode}' not found in database for job {DId}",
                    trimmedCode, d.Id);
            }
        }
    }

    private async Task UpdateJobStatusesAsync(IReadOnlyList<JobManualPriceModel> data,
        Dictionary<int, TucJob> dbDataDict,
        Dictionary<int, TucJobArchive> dbDataArchiveDict)
    {
        var statusNames = data.Where(d => !string.IsNullOrWhiteSpace(d.StatusName))
            .Select(d => d.StatusName)
            .Distinct()
            .ToList();

        if (statusNames.Count == 0)
        {
            Log.Information("No status updates requested");
            return;
        }

        var statusLookup = await Context.TucJobStatuses
            .Where(s => statusNames.Contains(s.UcjsName))
            .ToDictionaryAsync(s => s.UcjsName, s => s.UcjsId);

        // Update statuses for each job
        foreach (var d in data.Where(d => !string.IsNullOrWhiteSpace(d.StatusName)))
        {
            dynamic match = dbDataDict.TryGetValue(d.Id, out var activeJob) ? activeJob
                : dbDataArchiveDict.TryGetValue(d.Id, out var archivedJob) ? archivedJob
                : null;

            if (match == null)
            {
                Log.Warning("Job with ID {DId} not found for status update", d.Id);
                continue;
            }

            if (statusLookup.TryGetValue(d.StatusName, out var statusId))
            {
                match.UcjbStatus = statusId;
                Log.Information("Job {DId} status updated to {StatusName} (ID: {StatusId})",
                    d.Id, d.StatusName, statusId);
            }
            else
            {
                Log.Warning("Status name '{StatusName}' not found in database for job {DId}",
                    d.StatusName, d.Id);
            }
        }
    }

    private async Task UpdateParentJobCompletionDetailsAsync(
        int parentId,
        int jobStatus,
        string podName,
        DateTime completionTime,
        bool isArchived)
    {
        if (isArchived)
        {
            var parentJob = await Context.TucJobArchives
                .AsTracking()
                .FirstOrDefaultAsync(j => j.UcjbId == parentId &&
                                          j.UcjbSpeed != 79);

            if (parentJob != null)
            {
                parentJob.UcjbJobDone = true;
                parentJob.UcjbStatus = jobStatus;
                parentJob.UcjbPodname = podName;
                parentJob.UcjbComplTime = completionTime;
            }
        }
        else
        {
            var parentJob = await Context.TucJobs
                .AsTracking()
                .FirstOrDefaultAsync(j => j.UcjbId == parentId &&
                                          j.UcjbSpeed != 79);

            if (parentJob != null)
            {
                parentJob.UcjbJobDone = true;
                parentJob.UcjbStatus = jobStatus;
                parentJob.UcjbPodname = podName;
                parentJob.UcjbComplTime = completionTime;
            }
        }
    }

    /// <summary>
    /// Parses a POD time string into a wall-clock DateTime in the delivery timezone.
    /// Handles DateTimeOffset strings (with timezone offset), time-only inputs, and plain DateTime strings.
    /// Falls back to current time in the delivery timezone if podTime is empty or parsing fails.
    /// </summary>
    /// <param name="podTime">The POD time string from the frontend.</param>
    /// <param name="deliveryTimeZone">The delivery location's timezone (used for fallback to "now").</param>
    private DateTime ParsePodTime(string podTime, TimeZone deliveryTimeZone)
    {
        var deliveryNow = _infoService.GetCurrentTimeFromTimeZone(deliveryTimeZone);

        if (string.IsNullOrWhiteSpace(podTime))
        {
            return deliveryNow;
        }

        // Handle timezone-aware strings from frontend (e.g., "2024-06-10T17:04:00-04:00")
        // .DateTime extracts the wall-clock time which is already in delivery timezone from the frontend
        if (DateTimeOffset.TryParse(podTime, out var parsedOffset))
        {
            return parsedOffset.DateTime;
        }

        if (!DateTime.TryParse(podTime, out var parsedTime))
        {
            return deliveryNow;
        }

        if (parsedTime.Date == DateTime.MinValue.Date || parsedTime.Year == 1)
        {
            return deliveryNow.Date.Add(parsedTime.TimeOfDay);
        }

        return parsedTime;
    }

    /// <summary>
    /// Gets the job ID along with all its children IDs (if any).
    /// </summary>
    private async Task<IReadOnlyList<int>> GetJobWithChildrenAsync(int jobId)
    {
        var childIds = await Context.TucJobs
            .Where(j => j.ParentId == jobId)
            .Select(j => j.UcjbId)
            .TagWith($"GetJobWithChildren - Get children for job {jobId}")
            .ToListAsync();

        childIds.Add(jobId);
        return childIds;
    }

    private async Task<IReadOnlyList<int>> GetAllRelatedJobIdsIncludingParentAsync(int jobId)
    {
        // Single query to get both parent ID and all related job IDs
        var jobWithRelations = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new
            {
                j.ParentId,
                // If it has parent, get siblings; otherwise get children
                RelatedJobIds = j.ParentId.HasValue
                    ? j.Parent.InverseParent.Select(child => child.UcjbId).ToList()
                    : j.InverseParent.Select(child => child.UcjbId).ToList()
            })
            .FirstOrDefaultAsync();

        if (jobWithRelations == null)
        {
            return [];
        }

        var relatedJobIds = jobWithRelations.RelatedJobIds;

        // Add the appropriate ID (parent or self)
        relatedJobIds.Add(jobWithRelations.ParentId ?? jobId);

        return relatedJobIds;
    }

    private async Task<IReadOnlyList<int>> GetAllRelatedBulkJobIdsIncludingParentAsync(int bulkJobId)
    {
        // Single query to get both parent ID and all related job IDs
        var jobWithRelations = await Context.TblBulkJobs
            .Where(j => j.BulkJobId == bulkJobId)
            .Select(j => new
            {
                ParentId = j.BulkParentId,
                // If it has parent, get siblings; otherwise get children
                RelatedJobIds = j.BulkParentId.HasValue
                    ? j.Parent.InverseParent.Select(child => child.BulkJobId).ToList()
                    : j.InverseParent.Select(child => child.BulkJobId).ToList()
            })
            .FirstOrDefaultAsync();

        if (jobWithRelations == null)
        {
            return [];
        }

        var relatedBulkJobIds = jobWithRelations.RelatedJobIds;

        // Add the appropriate ID (parent or self)
        relatedBulkJobIds.Add(jobWithRelations.ParentId ?? bulkJobId);

        return relatedBulkJobIds;
    }

    /// <summary>
    /// Gets the bulk job ID along with all its children IDs (if any).
    /// </summary>
    private async Task<IReadOnlyList<int>> GetBulkJobWithChildrenAsync(int bulkJobId)
    {
        var childIds = await Context.TblBulkJobs
            .Where(j => j.BulkParentId == bulkJobId)
            .Select(j => j.BulkJobId)
            .ToListAsync();

        childIds.Add(bulkJobId);
        return childIds;
    }

    /// <summary>
    /// Gets the archived job ID along with all its children IDs (if any).
    /// </summary>
    private async Task<IReadOnlyList<int>> GetArchivedJobWithChildrenAsync(int jobId)
    {
        var childIds = await Context.TucJobArchives
            .Where(j => j.ParentId == jobId)
            .Select(j => j.UcjbId)
            .TagWith($"GetArchivedJobWithChildren - Get children for archived job {jobId}")
            .ToListAsync();

        childIds.Add(jobId);
        return childIds;
    }

    /// <summary>
    /// Gets all related archived job IDs including parent and siblings.
    /// </summary>
    private async Task<IReadOnlyList<int>> GetAllRelatedArchivedJobIdsIncludingParentAsync(int jobId)
    {
        // Single query to get both parent ID and all related job IDs
        var jobWithRelations = await Context.TucJobArchives
            .Where(j => j.UcjbId == jobId)
            .Select(j => new
            {
                j.ParentId,
                // If it has parent, get siblings; otherwise get children
                RelatedJobIds = j.ParentId.HasValue
                    ? j.Parent.InverseParent.Select(child => child.UcjbId).ToList()
                    : j.InverseParent.Select(child => child.UcjbId).ToList()
            })
            .FirstOrDefaultAsync();

        if (jobWithRelations == null)
        {
            return [];
        }

        var relatedJobIds = jobWithRelations.RelatedJobIds;

        // Add the appropriate ID (parent or self)
        relatedJobIds.Add(jobWithRelations.ParentId ?? jobId);

        return relatedJobIds;
    }

    private async Task SetJobAsManuallyPriceAsync(int jobId,
        string note)
    {
        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.RatedManually, true));

        await SaveNoteAsync(jobId, note);
    }

    /// <summary>
    /// Recalculates a job's total amount from the sum of its current breakdown lines and
    /// writes the result back to TucJob.UcjbAmount / TucJobArchive.UcjbAmount /
    /// TucJobBooking.UcbkAmount. Keeps the job's displayed price in lock-step with the
    /// breakdown dialog's "Total Revenue" after every breakdown CRUD.
    /// </summary>
    private async Task RecalculateJobAmountFromBreakdownAsync(
        int? jobId,
        int? prebookJobId,
        int? childJobId,
        bool isArchived)
    {
        if (prebookJobId.HasValue)
        {
            var prebookSum = await Context.PricingBreakdowns
                .Where(p => p.PrebookJobId == prebookJobId)
                .SumAsync(p => (decimal?)p.ChargeAmount) ?? 0m;

            await Context.TucJobBookings
                .Where(j => j.UcbkId == prebookJobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcbkAmount, prebookSum));
            return;
        }

        if (!jobId.HasValue)
        {
            return;
        }

        if (isArchived)
        {
            var archiveSum = await Context.PricingBreakdownArchives
                .Where(p => p.JobId == jobId)
                .SumAsync(p => (decimal?)p.ChargeAmount) ?? 0m;

            await Context.TucJobArchives
                .Where(j => j.UcjbId == jobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbAmount, archiveSum));
            return;
        }

        var parentSum = await Context.PricingBreakdowns
            .Where(p => p.JobId == jobId)
            .SumAsync(p => (decimal?)p.ChargeAmount) ?? 0m;

        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.UcjbAmount, parentSum));

        // For split jobs the line also carries a ChildJobId. Sync the child's
        // UcjbAmount to just its child-specific lines so a row on POD search /
        // job list displays a total consistent with what the dialog shows.
        if (childJobId.HasValue && childJobId.Value != jobId.Value)
        {
            var childSum = await Context.PricingBreakdowns
                .Where(p => p.JobId == jobId && p.ChildJobId == childJobId)
                .SumAsync(p => (decimal?)p.ChargeAmount) ?? 0m;

            await Context.TucJobs
                .Where(j => j.UcjbId == childJobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbAmount, childSum));
        }
    }

    /// <summary>
    /// When a child job's amount is manually set, scales the parent's pricing breakdown lines
    /// for that child proportionally to sum to the new amount.
    /// No-ops if no breakdown lines reference this job as a child.
    /// </summary>
    private async Task SyncBreakdownLinesToChildAmountAsync(int childJobId, decimal newAmount)
    {
        // Only applicable when repricing a child job in a split job; root parents should never
        // have their own breakdown rows scaled via this path.
        var parentId = await Context.TucJobs
            .Where(j => j.UcjbId == childJobId)
            .Select(j => j.ParentId)
            .FirstOrDefaultAsync();

        if (parentId == null)
        {
            return;
        }

        var effectiveParentId = await Context.GetEffectiveJobIdAsync(parentId.Value);

        var lines = await Context.PricingBreakdowns
            .Where(pb => pb.ChildJobId == childJobId && pb.JobId == effectiveParentId)
            .ToListAsync();

        if (lines.Count == 0)
        {
            return;
        }

        var currentTotal = lines.Sum(l => l.ChargeAmount);

        if (currentTotal == 0 || newAmount == 0)
        {
            foreach (var line in lines)
            {
                line.ChargeAmount = 0;
            }
        }
        else
        {
            var scaleFactor = newAmount / currentTotal;
            var allocated = 0m;

            for (var i = 0; i < lines.Count - 1; i++)
            {
                var scaled = Math.Round(lines[i].ChargeAmount * scaleFactor, 2, MidpointRounding.AwayFromZero);
                lines[i].ChargeAmount = scaled;
                allocated += scaled;
            }

            // Last line absorbs any rounding difference
            lines[^1].ChargeAmount = newAmount - allocated;
        }

        await Context.SaveChangesAsync();

        await SetJobAsManuallyPriceAsync(effectiveParentId,
            $"Breakdown updated: child job {childJobId} manually repriced to {newAmount:C}");
    }

    private async Task SetPrebookJobAsManuallyPriceAsync(int prebookJobId,
        string note)
    {
        await Context.TucJobBookings
            .Where(j => j.UcbkId == prebookJobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.RatedManually, true));

        await CreateNewRecurringJobNote(prebookJobId, note, false);
    }

    private async Task SetArchiveJobAsManuallyPriceAsync(int jobId)
    {
        await Context.TucJobArchives
            .Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.RatedManually, true));
    }

    private async Task<JobInfo> GetJobInfo(int jobId) =>
        await Context
            .TucJobs.Where(j => j.UcjbId == jobId)
            .Select(j => new JobInfo { ClientItemIds = j.ClientItemIds, IsVan = j.UcjbSize == 3 })
            .FirstOrDefaultAsync();

    private static IEnumerable<int> GetClientItemIds(string clientItemIdsString)
    {
        if (string.IsNullOrEmpty(clientItemIdsString))
        {
            return [];
        }

        return clientItemIdsString
            .Split(',')
            .Where(s => !string.IsNullOrEmpty(s))
            .Select(int.Parse);
    }

    private IQueryable<ClientItemsViewModel> BuildClientItemsQuery(
        int clientId,
        int speedId,
        IEnumerable<int> clientItemIds
    )
    {
        return Context
            .TblClientAvailableSpeeds.Where(cas =>
                cas.ClientId == clientId && cas.SpeedId == speedId
            )
            .SelectMany(cas =>
                cas.TblClientAvailableSpeedItems.Where(casi => casi.Active)
                    .Select(casi => new ClientItemsViewModel
                    {
                        ItemId = casi.ClientItem.ItemId,
                        ClientId = casi.ClientItem.ClientId,
                        Name = casi.ClientItem.Name,
                        Description = casi.ClientItem.Description,
                        PerItem = casi.ClientItem.PerItem,
                        Rate = casi.ClientItem.Rate,
                        VehicleSizeId = casi.ClientItem.VehicleSizeId,
                        Selected = clientItemIds.Contains(casi.ClientItem.ItemId)
                    })
            );
    }

    private static async Task<PaginatedResponse<ClientItemsViewModel>> CreatePagedList(
        IQueryable<ClientItemsViewModel> query
    )
    {
        var count = await query.CountAsync();
        var items = await query.ToListAsync();

        return new PaginatedResponse<ClientItemsViewModel> { Items = items, Total = count };
    }

    private async Task<decimal> CalculateAmountAsync(int clientId,
        decimal amount)
    {
        var outputParam = new OutputParameter<decimal?>();
        await Context.Procedures.UTL_stpPPD_ExclusiveAmountAsync(clientId, amount, outputParam);

        return outputParam.Value ?? 0m;
    }

    private async Task<string> GenerateJobNumberAsync(
        int staffId,
        int jobTypeId,
        DespatchContext customContext = null,
        CancellationToken cancellationToken = default
    )
    {
        var context = customContext ?? Context;
        var jobNumberOutput = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await context.Procedures.NET_stpJob_Insert_JobNumberAsync(
            staffId,
            jobTypeId,
            jobNumberOutput,
            returnValue,
            cancellationToken
        );

        return jobNumberOutput.Value;
    }

    private async Task CloseTasksByJobIdsAsync(IReadOnlyList<int> jobIds) =>
        await Context.TucEvents
            .Where(t => jobIds.Contains(t.UcevJobId.Value) && !t.UcevClosed)
            .ExecuteUpdateAsync(setters => setters.SetProperty(e => e.UcevClosed, true));

    private async Task CloseAllBulkJobTasksAsync(IReadOnlyList<int> bulkJobIds)
    {
        var now = _clock.TenantNow;
        var staffId = _infoService.GetStaffId();

        await Context.TblBulkEvents
            .Where(t => bulkJobIds.Contains(t.BulkJobId.Value) && !t.ClosedDate.HasValue)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(e => e.ClosedDate, now)
                .SetProperty(e => e.ClosedByName,
                    Context.TucStaffs
                        .Where(s => s.UcstId == staffId)
                        .Select(s => s.UcstFirstName + " " + s.UcstLastName)
                        .FirstOrDefault()));
    }

    private async Task<bool> IsStopJob(int jobId)
    {
        // Live jobs in tucJob; once archived the row moves to tucJobArchive. Look in the
        // live table first, then fall back to the archive so this works for archived jobs too.
        var jobNumber = await Context.TucJobs
                            .Where(j => j.UcjbId == jobId)
                            .Select(j => j.UcjbNumber)
                            .FirstOrDefaultAsync()
                        ?? await Context.TucJobArchives
                            .Where(j => j.UcjbId == jobId)
                            .Select(j => j.UcjbNumber)
                            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(jobNumber);
        // Stop jobs are created by appending a single lowercase letter (a-z, not v) to the parent
        // job number. Regular jobs and split children end in an uppercase letter or digit.
        // Guard that the second-to-last char is not also lowercase to avoid false positives.
        if (jobNumber.Length < 2)
        {
            return false;
        }

        var last = jobNumber[^1];
        var secondLast = jobNumber[^2];
        return char.IsLower(last) && last != 'v' && !char.IsLower(secondLast);
    }


    private async Task MarkJobAsReadAsync(int jobId)
    {
        try
        {
            var staffId = _infoService.GetStaffId();
            var currentTenantTime = _clock.TenantNow;

            // Uses a separate context since this runs concurrently with the read queries
            await using var markReadContext = await _contextFactory.CreateDbContextAsync();
            await markReadContext.Database.ExecuteSqlInterpolatedAsync($"""
                                                                        INSERT INTO tucJobReadTracker (JobId, HasBeenRead, ReadByStaffId, ReadTimestamp)
                                                                        SELECT {jobId}, 1, {staffId}, {currentTenantTime}
                                                                        WHERE EXISTS (SELECT 1 FROM tucJob WHERE ucjbId = {jobId})
                                                                          AND NOT EXISTS (SELECT 1 FROM tucJobReadTracker WHERE JobId = {jobId})
                                                                        """);
        }
        catch (Exception e)
        {
            Log.Warning(e, "Failed to mark job {JobId} as read", jobId);
        }
    }

    private async Task<JobGroupViewModel> GetLiveJobByIdAsync(int jobId)
    {
        var mainJobInfo = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new { j.UcjbId, FamilyRootId = j.ParentId ?? j.UcjbId })
            .TagWith("GetLiveJob - Family Root Lookup")
            .FirstOrDefaultAsync();

        if (mainJobInfo == null)
        {
            return null; // Not a live job — caller will try archived
        }

        var familyRootId = mainJobInfo.FamilyRootId;
        var isUsTenant = _infoService.IsUsTenant();

        var allJobsInFamily = await Context.TucJobs
            .Where(j => j.UcjbId == familyRootId || j.ParentId == familyRootId)
            .Select(JobMappings.JobMappingCore(isUsTenant))
            .TagWith($"GetLiveJob - Complete Family {familyRootId}")
            .ToListAsync();

        var mainJob = allJobsInFamily.FirstOrDefault(j => j.Id == jobId);
        ArgumentNullException.ThrowIfNull(mainJob);

        var relatedJobs = allJobsInFamily.Where(j => j.Id != jobId).ToList();

        var allJobs = new List<JobViewModel> { mainJob };
        allJobs.AddRange(relatedJobs);

        await JobMappings.EnrichJobsWithCollectionsAsync(allJobs, _contextFactory, _infoService);

        return new JobGroupViewModel
        {
            Job = mainJob,
            RelatedJobs = relatedJobs
        };
    }

    private async Task<JobGroupViewModel> GetArchivedJobByIdAsync(int jobId)
    {
        var familyRootId = await Context.TucJobArchives
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.ParentId ?? j.UcjbId)
            .TagWith("GetArchivedJob - Family Root")
            .FirstOrDefaultAsync();

        if (familyRootId == 0)
        {
            throw new KeyNotFoundException($"Archived job {jobId} not found");
        }

        var allJobsInFamily = await Context.TucJobArchives
            .Where(j => j.UcjbId == familyRootId || j.ParentId == familyRootId)
            .Select(JobMappings.JobArchiveMapping)
            .TagWith($"GetArchivedJob - Family {familyRootId}")
            .ToListAsync();

        if (allJobsInFamily.Count == 0)
        {
            throw new KeyNotFoundException($"Archived job {jobId} not found");
        }

        var archivedJob = allJobsInFamily.FirstOrDefault(j => j.Id == jobId);
        ArgumentNullException.ThrowIfNull(archivedJob);
        var archivedJobRelatedJobs = allJobsInFamily.Where(j => j.Id != jobId).ToList();

        var allJobs = new List<JobViewModel> { archivedJob };
        allJobs.AddRange(archivedJobRelatedJobs);

        await JobMappings.EnrichArchivedJobsWithCollectionsAsync(allJobs, _contextFactory, _infoService);

        return new JobGroupViewModel
        {
            Job = archivedJob,
            RelatedJobs = archivedJobRelatedJobs
        };
    }

    private static string GetScanDetail(int scanType) =>
        scanType switch
        {
            (int)ScanType.Sort or (int)ScanType.AlternateSort => "Sort",
            (int)ScanType.Run => "Run",
            (int)ScanType.InvalidRun => "InvalidRun",
            (int)ScanType.Transit => "Transit",
            (int)ScanType.InwardsDepot => "InwardsDepot",
            (int)ScanType.Pickup => "Pickup",
            (int)ScanType.InvalidPickup => "InvalidPickup",
            (int)ScanType.Transfer => "Transfer",
            _ => null
        };

    internal static string GetCourierDescription(int scanType,
        CourierLite? courier,
        CourierLite? transferTo,
        CourierLite? runViewerTransferTo,
        string runName) =>
        scanType switch
        {
            (int)ScanType.Transfer when courier?.UccrId == 999 =>
                $"Ops (Run Viewer){(runViewerTransferTo != null ? $" to {runViewerTransferTo.Value.Code} {runViewerTransferTo.Value.UccrName} {runViewerTransferTo.Value.UccrSurname}" : string.Empty)}",

            (int)ScanType.Transfer =>
                $"{courier?.Code} {courier?.UccrName} {courier?.UccrSurname}{(transferTo != null ? $" to {transferTo.Value.Code} {transferTo.Value.UccrName} {transferTo.Value.UccrSurname}" : string.Empty)}",

            (int)ScanType.InvalidRun =>
                $"{courier?.Code} {courier?.UccrName} - Run {runName?.ToUpper() ?? string.Empty}",

            (int)ScanType.InwardsDepot => $"{courier?.Code} {courier?.UccrName} {runName ?? string.Empty}",

            _ => $"{courier?.Code} {courier?.UccrName}"
        };

    public async Task UpdateClearListAreaOrderStatus(List<int> courierIds)
    {
        if (courierIds.Count == 0)
        {
            return;
        }

        var now = _clock.TenantNow;
        try
        {
            // Batch query 1: Get job counts per courier (jobs not void and not done)
            var jobCountsByCourier = await Context.TucJobs
                .Where(j => j.UcjbDate.Date == now.Date
                            && !j.UcjbVoid
                            && !j.UcjbJobDone
                            && j.UcjbCourierId.HasValue
                            && courierIds.Contains(j.UcjbCourierId.Value))
                .GroupBy(j => j.UcjbCourierId!.Value)
                .Select(g => new { CourierId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.CourierId, x => x.Count);

            // Batch query 2: Get counts of jobs NOT picked up or late delivery per courier
            var nonPickedUpCountsByCourier = await Context.TucJobs
                .Where(j => j.UcjbDate.Date == now.Date
                            && !j.UcjbVoid
                            && !j.UcjbJobDone
                            && j.UcjbCourierId.HasValue
                            && courierIds.Contains(j.UcjbCourierId.Value)
                            && j.UcjbStatus != (int)JobStatus.PickedUp
                            && j.UcjbStatus != (int)JobStatus.LateDelivery)
                .GroupBy(j => j.UcjbCourierId!.Value)
                .Select(g => new { CourierId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.CourierId, x => x.Count);

            // Determine which couriers get which status
            var couriersToSetRejected = new List<int>(); // Status 3 - no jobs
            var couriersToSetPickedUp = new List<int>(); // Status 5 - all jobs picked up or late

            foreach (var courierId in courierIds)
            {
                var jobCount = jobCountsByCourier.GetValueOrDefault(courierId, 0);

                if (jobCount == 0)
                {
                    couriersToSetRejected.Add(courierId);
                }
                else
                {
                    var nonPickedUpCount = nonPickedUpCountsByCourier.GetValueOrDefault(courierId, 0);
                    if (nonPickedUpCount == 0)
                    {
                        couriersToSetPickedUp.Add(courierId);
                    }
                }
            }

            // Bulk update using ExecuteUpdateAsync
            if (couriersToSetRejected.Count > 0)
            {
                await Context.TblClearListAreaOrders
                    .Where(c => couriersToSetRejected.Contains(c.CourierId))
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(c => c.Status, (int)JobStatus.Rejected)
                        .SetProperty(c => c.OrderTime, now));
            }

            if (couriersToSetPickedUp.Count > 0)
            {
                await Context.TblClearListAreaOrders
                    .Where(c => couriersToSetPickedUp.Contains(c.CourierId))
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(c => c.Status, (int)JobStatus.PickedUp)
                        .SetProperty(c => c.OrderTime, now));
            }
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(UpdateClearListAreaOrderStatus)));
            throw;
        }
    }

    private async Task<int> AssignCourierToJobsAsync(IEnumerable<int> jobIds, int courierId)
    {
        var tenantTime = _clock.TenantNow;
        var dispatcherStaffId = _infoService.GetStaffId();

        return await Context.TucJobs
            .Where(j => jobIds.Contains(j.UcjbId))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.UcjbCourierId, courierId)
                .SetProperty(j => j.UcjbDispId, dispatcherStaffId > 0 ? dispatcherStaffId : null)
                .SetProperty(j => j.DesCheck, false)
                .SetProperty(j => j.FdcourierId, (int?)null)
                .SetProperty(j => j.UcjbDispDate, tenantTime)
                .SetProperty(j => j.UcjbDispTime, tenantTime)
                .SetProperty(j => j.UcjbStatus, (int)JobStatus.Dispatched)
                .SetProperty(j => j.InternalStatus, (int)InternalJobStatus.AwaitingPod)
            );
    }

    /// <summary>
    /// Lightweight courier projection — only the fields the scan-list description
    /// needs, so the query doesn't materialise whole TucCourier rows.
    /// </summary>
    internal readonly record struct CourierLite(int UccrId, string Code, string UccrName, string UccrSurname);
}