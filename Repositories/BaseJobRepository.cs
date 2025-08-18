using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;
using CourierLocation = DespatchWeb.Models.Response.CourierLocation;

namespace DespatchWeb.Repositories;

public class BaseJobRepository(IDbContextFactory<DespatchContext> contextFactory, ITenantInfoService infoService)
    : BaseRepository(contextFactory)
{
    protected async Task<List<DispatchJobViewModel>> DespatchQry(
        AppPage page,
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds,
        NationwideWidget? windowPane = null,
        ClearListEnvelopeViewModel clearListEnvelope = null
    )
    {
        try
        {
            var query = await BuildBaseQuery(selectedViewIds, isUsTenant);
            if (query == null) return [];

            query = ApplyGeographicFilters(query, clearListEnvelope);

            switch (page)
            {
                case AppPage.Dispatch:
                    // Filters
                    query = query.Where(j => j.UcjbStatus != (int)JobStatus.AwaitingPod);
                    if (queryParams.DateCutoff.HasValue)
                        query = query.Where(j => j.UcjbDate <= queryParams.DateCutoff.Value.Date);

                    // Add support for start date and end date filters
                    if (queryParams.StartDate.HasValue)
                        query = query.Where(j => j.UcjbDate >= queryParams.StartDate.Value.Date);

                    if (queryParams.EndDate.HasValue)
                        query = query.Where(j => j.UcjbDate <= queryParams.EndDate.Value.Date);
                    
                    // Sorting
                    query = ApplyDashboardSpecificOrdering(
                        query,
                        queryParams.Order,
                        queryParams.OrderDirection,
                        isUsTenant
                    );
                    break;
                case AppPage.Domestic:
                    query = ApplyNationwideSpecificFilters(
                        query,
                        queryParams,
                        isInternal,
                        windowPane ?? NationwideWidget.JobList,
                        clientIds
                    );
                    query = ApplyNationwideSpecificOrdering(query, queryParams.Order, queryParams.OrderDirection);
                    break;
                case AppPage.JobSearch:
                case AppPage.Prebooks:
                default:
                    return [];
            }

            var jobs = await query
                .Select(JobMappings.JobDispatchMapping)
                .AsNoTracking()
                .ToListAsync();

            return jobs;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occured getting jobs for dispatch page. Please see exception.");
            throw;
        }
    }

    private async Task<IQueryable<TucJob>> BuildBaseQuery(List<int> selectedViews, bool isUsTenant)
    {
        var jobIds = await GetFilteredJobIds(selectedViews, isUsTenant);
        return jobIds.Count == 0 ? null : Context.TucJobs.Where(j => jobIds.Contains(j.UcjbId));
    }

    private async Task<List<int>> GetFilteredJobIds(List<int> selectedViewIds, bool isUsTenant)
    {
        if (selectedViewIds == null || selectedViewIds.Count == 0)
        {
            return await Context
                .DeswebQryDespatchJobViewFilters.Select(x => x.UcjbId)
                .ToListAsync();
        }

        var viewFilters =
            selectedViewIds.Count != 0
                ? await Context
                    .TblDespatchViews.Where(dv => selectedViewIds.Contains(dv.DespatchViewId))
                    .Select(dv => dv.WhereCondition)
                    .ToListAsync()
                : [];

        if (viewFilters.Count == 0) return [];

        var combinedFilters = string.Join(" OR ", viewFilters.Select(filter => $"({filter})"));
        return await Context
            .DeswebQryDespatchJobViewFilters.FromSqlRaw(isUsTenant ?
                $"select * from DESWEB_qry_Despatch_Job_View_Filters WHERE {combinedFilters}" :
                $"select * from DESWEB_qryDespatch WHERE {combinedFilters}"
            )
            .Select(x => x.UcjbId)
            .ToListAsync();
    }

    private static IQueryable<TucJob> ApplyGeographicFilters(
        IQueryable<TucJob> query,
        ClearListEnvelopeViewModel clearListEnvelope
    )
    {
        if (clearListEnvelope == null)
            return query;

        return query.Where(j =>
            j.DeliveryLatitude >= clearListEnvelope.MinimumLatitude
            && j.DeliveryLatitude <= clearListEnvelope.MaximumLatitude
            && j.DeliveryLongitude >= clearListEnvelope.MinimumLongitude
            && j.DeliveryLongitude <= clearListEnvelope.MaximumLongitude
        );
    }

    private static IQueryable<TucJob> ApplyDashboardSpecificOrdering(
        IQueryable<TucJob> query,
        string order,
        string orderDirection,
        bool isUsTenant
    ) => ApplyOrdering(query, order, orderDirection, isUsTenant);

    private static IQueryable<TucJob> ApplyNationwideSpecificFilters(
        IQueryable<TucJob> query,
        JobQueryParams queryParams,
        bool isInternal,
        NationwideWidget windowPane,
        string clientIds
    )
    {
        query = query.Where(j => j.ParentId != j.UcjbId && !j.InverseParent.Any());

        // Filter dates
        if (queryParams.StartDate != null) query = query.Where(j => j.UcjbDate >= queryParams.StartDate);
        if (queryParams.DateCutoff != null) query = query.Where(j => j.UcjbDate <= queryParams.DateCutoff);

        // Apply window pane viewFilters
        query = windowPane switch
        {
            NationwideWidget.JobList => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.NewJobs
                || (j.InternalStatus == null && j.UcjbStatus != (int)JobStatus.AwaitingPod)
            ),

            NationwideWidget.Pod => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.AwaitingPod || j.UcjbStatus == (int)JobStatus.AwaitingPod
            ),

            NationwideWidget.ActionRequired => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.ActionRequired
            ),

            NationwideWidget.Reprice => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.Reprice || j.Reprice == true
            ),

            _ => query
        };

        // Block out completed jobs from the domestic/nationwide page
        query = query.Where(j => j.UcjbComplTime == null);

        // Apply client viewFilters for non-internal users
        if (isInternal || string.IsNullOrEmpty(clientIds))
            return query;

        var clientIdList = clientIds.Split(',').Select(id => int.Parse(id.Trim())).ToList();
        query = query.Where(j => clientIdList.Contains((int)j.UcjbClientId));

        return query;
    }

    private static IQueryable<TucJob> ApplyNationwideSpecificOrdering(
        IQueryable<TucJob> query,
        string order,
        string orderDirection
    ) => ApplyOrdering(query, order, orderDirection, false, true);

    private static IQueryable<TucJob> ApplyStatusGroupOrdering(
        IQueryable<TucJob> query,
        string groupType)
    {
        return groupType switch
        {
            "group-pending" => query.OrderBy(j =>
                j.UcjbStatus == (int)JobStatus.New ? 1 :
                j.UcjbStatus == (int)JobStatus.Dispatched ? 2 :
                j.UcjbStatus == (int)JobStatus.ReadyForPacking ? 3 :
                j.UcjbStatus == (int)JobStatus.ReadyToPickup ? 4 :
                j.UcjbStatus == (int)JobStatus.AwaitingProcessing ? 5 :
                j.UcjbStatus == (int)JobStatus.Preassigned ? 6 : 99
            ).ThenBy(j => j.UcjbTime),

            "group-in-transit" => query.OrderBy(j =>
                j.UcjbStatus == (int)JobStatus.Accepted ? 1 :
                j.UcjbStatus == (int)JobStatus.PickedUp ? 2 :
                j.UcjbStatus == (int)JobStatus.InTransit ? 3 :
                j.UcjbStatus == (int)JobStatus.OutboundAgentAssigned ? 4 :
                j.UcjbStatus == (int)JobStatus.InboundAgentAssigned ? 5 :
                j.UcjbStatus == (int)JobStatus.OutForDelivery ? 6 : 99
            ).ThenBy(j => j.UcjbTime),

            "group-completed" => query.OrderBy(j =>
                j.UcjbStatus == (int)JobStatus.Completed ? 1 :
                j.UcjbStatus == (int)JobStatus.AssumingCompleted ? 2 : 99
            ).ThenByDescending(j => j.UcjbTime),

            "group-problem" => query.OrderBy(j =>
                j.UcjbStatus == (int)JobStatus.Rejected ? 1 :
                j.UcjbStatus == (int)JobStatus.LatePickup ? 2 :
                j.UcjbStatus == (int)JobStatus.Warning ? 3 :
                j.UcjbStatus == (int)JobStatus.LateDelivery ? 4 :
                j.UcjbStatus == (int)JobStatus.AwaitingPod ? 5 :
                j.UcjbStatus == (int)JobStatus.Undeliverable ? 6 : 99
            ).ThenBy(j => j.UcjbTime),

            _ => query
        };
    }

    private static IQueryable<TucJob> ApplyStatusOrdering(
        IQueryable<TucJob> query,
        bool isAscending)
    {
        var orderedQuery = query.OrderBy(j => j.UcjbStatus == (int)JobStatus.New ? 1 :
            j.UcjbStatus == (int)JobStatus.Preassigned ? 2 :
            j.UcjbStatus == (int)JobStatus.Dispatched ? 3 :
            j.UcjbStatus == (int)JobStatus.Accepted ? 4 :
            j.UcjbStatus == (int)JobStatus.PickedUp ? 5 :
            j.UcjbStatus == (int)JobStatus.InTransit ? 6 :
            j.UcjbStatus == (int)JobStatus.OutboundAgentAssigned ? 7 :
            j.UcjbStatus == (int)JobStatus.InboundAgentAssigned ? 8 :
            j.UcjbStatus == (int)JobStatus.OutForDelivery ? 9 :
            j.UcjbStatus == (int)JobStatus.Rejected ? 10 :
            j.UcjbStatus == (int)JobStatus.LatePickup ? 11 :
            j.UcjbStatus == (int)JobStatus.LateDelivery ? 12 :
            j.UcjbStatus == (int)JobStatus.Warning ? 13 :
            j.UcjbStatus == (int)JobStatus.Undeliverable ? 14 :
            j.UcjbStatus == (int)JobStatus.Completed ? 15 :
            j.UcjbStatus == (int)JobStatus.AwaitingPod ? 16 :
            j.UcjbStatus == (int)JobStatus.AssumingCompleted ? 17 : 99);

        return isAscending ? orderedQuery : orderedQuery.Reverse();
    }


    private static IQueryable<TucJob> ApplyOrdering(
        IQueryable<TucJob> query,
        string order,
        string orderDirection,
        bool isUsTenant = false,
        bool isNationwide = false)
    {
        if (string.IsNullOrEmpty(order))
            return query;

        // Check if this is a status group ordering
        if (order.StartsWith("group-"))
        {
            return ApplyStatusGroupOrdering(query, order);
        }

        var isAscending = orderDirection?.Equals("asc", StringComparison.OrdinalIgnoreCase) == true;

        return order.ToLowerInvariant() switch
        {
            "unread" => isAscending
                ? query.OrderBy(j => j.TucJobReadTracker.HasBeenRead)
                : query.OrderByDescending(j => j.TucJobReadTracker.HasBeenRead),

            "group-all" => isAscending
                ? query.OrderBy(j => j.UcjbTime)
                : query.OrderByDescending(j => j.UcjbTime),

            "remain" => ApplyRemainOrdering(query, isAscending, isNationwide),

            "to" => ApplyToOrdering(query, isAscending, isUsTenant),

            "from" => ApplyFromOrdering(query, isAscending, isUsTenant),

            "client" => ApplyClientOrdering(query, isAscending, isNationwide),

            "jobno" => ApplyJobNumberOrdering(query, isAscending, isNationwide),

            "status" => ApplyStatusOrdering(query, isAscending),

            "speed" => isAscending
                ? query.OrderBy(j => j.UcjbSpeedNavigation.ShortName)
                : query.OrderByDescending(j => j.UcjbSpeedNavigation.ShortName),

            "notify" => isAscending
                ? query.OrderBy(j => j.NotifiedJobType.UcjtName)
                : query.OrderByDescending(j => j.NotifiedJobType.UcjtName),

            "lp" => isAscending
                ? query.OrderBy(j => j.UcjbLatePick)
                : query.OrderByDescending(j => j.UcjbLatePick),

            "ld" => isAscending
                ? query.OrderBy(j => j.UcjbLateDel)
                : query.OrderByDescending(j => j.UcjbLateDel),

            "time" => ApplyTimeOrdering(query, isAscending),

            "courier" => ApplyCourierOrdering(query, isAscending, isNationwide),

            "pod" when isNationwide => isAscending
                ? query.OrderBy(j => j.UcjbPodname)
                : query.OrderByDescending(j => j.UcjbPodname),

            // Default to time
            _ => ApplyTimeOrdering(query, isAscending)
        };
    }

    private static IQueryable<TucJob> ApplyRemainOrdering(
        IQueryable<TucJob> query,
        bool isAscending,
        bool isNationwide)
    {
        if (isNationwide)
        {
            return isAscending
                ? query
                    .OrderBy(j => j.FollowupTime)
                    .ThenBy(j => j.UcjbDispTime)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.FollowupTime)
                    .ThenByDescending(j => j.UcjbDispTime)
                    .ThenByDescending(j => j.UcjbTime);
        }

        return isAscending
            ? query.OrderBy(j => j.UcjbDispTime).ThenBy(j => j.UcjbTime)
            : query.OrderByDescending(j => j.UcjbDispTime).ThenByDescending(j => j.UcjbTime);
    }

    private static IQueryable<TucJob> ApplyToOrdering(
        IQueryable<TucJob> query,
        bool isAscending,
        bool isUsTenant)
    {
        if (isUsTenant)
        {
            return isAscending
                ? query
                    .OrderBy(j => j.DeliveryAddressLine5)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.PickupAddressLine5)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query
                    .OrderByDescending(j => j.DeliveryAddressLine5)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.PickupAddressLine5)
                    .ThenByDescending(j => j.UcjbCourier.Code);
        }

        return isAscending
            ? query
                .OrderBy(j => j.UcjbToNavigation.UcsuName)
                .ThenBy(j => j.UcjbTime)
                .ThenBy(j => j.UcjbFromNavigation.UcsuName)
            : query
                .OrderByDescending(j => j.UcjbToNavigation.UcsuName)
                .ThenByDescending(j => j.UcjbTime)
                .ThenByDescending(j => j.UcjbFromNavigation.UcsuName);
    }

    private static IQueryable<TucJob> ApplyFromOrdering(
        IQueryable<TucJob> query,
        bool isAscending,
        bool isUsTenant)
    {
        if (isUsTenant)
        {
            return isAscending
                ? query
                    .OrderBy(j => j.DeliveryAddressLine5)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.DeliveryAddressLine5)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query
                    .OrderByDescending(j => j.DeliveryAddressLine5)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.DeliveryAddressLine5)
                    .ThenByDescending(j => j.UcjbCourier.Code);
        }

        return isAscending
            ? query
                .OrderBy(j => j.UcjbFromNavigation.UcsuName)
                .ThenBy(j => j.UcjbToNavigation.UcsuName)
                .ThenBy(j => j.UcjbTime)
            : query
                .OrderByDescending(j => j.UcjbFromNavigation.UcsuName)
                .ThenByDescending(j => j.UcjbToNavigation.UcsuName)
                .ThenByDescending(j => j.UcjbTime);
    }

    private static IQueryable<TucJob> ApplyClientOrdering(
        IQueryable<TucJob> query,
        bool isAscending,
        bool isNationwide)
    {
        if (isNationwide)
        {
            return isAscending
                ? query
                    .OrderBy(j => j.UcjbClient.UcclCode)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.UcjbClient.UcclCode)
                    .ThenByDescending(j => j.UcjbTime);
        }

        return isAscending
            ? query
                .OrderBy(j => j.UcjbClientCode)
                .ThenBy(j => j.UcjbTime)
                .ThenBy(j => j.UcjbCourier.Code)
            : query
                .OrderByDescending(j => j.UcjbClientCode)
                .ThenByDescending(j => j.UcjbTime)
                .ThenByDescending(j => j.UcjbCourier.Code);
    }

    private static IQueryable<TucJob> ApplyJobNumberOrdering(
        IQueryable<TucJob> query,
        bool isAscending,
        bool isNationwide)
    {
        if (isNationwide)
        {
            return isAscending
                ? query
                    .OrderBy(j => j.UcjbNumber)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.UcjbNumber)
                    .ThenByDescending(j => j.UcjbTime);
        }

        return isAscending
            ? query
                .OrderBy(j => j.UcjbNumber)
                .ThenBy(j => j.UcjbTime)
                .ThenBy(j => j.UcjbCourier.Code)
            : query
                .OrderByDescending(j => j.UcjbNumber)
                .ThenByDescending(j => j.UcjbTime)
                .ThenByDescending(j => j.UcjbCourier.Code);
    }

    private static IQueryable<TucJob> ApplyTimeOrdering(
        IQueryable<TucJob> query,
        bool isAscending)
    {
            return isAscending
                ? query
                    .OrderBy(j => j.UcjbDate)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.UcjbDate)
                    .ThenByDescending(j => j.UcjbTime);
        
    }

    private static IQueryable<TucJob> ApplyCourierOrdering(
        IQueryable<TucJob> query,
        bool isAscending,
        bool isNationwide)
    {
        if (isNationwide)
        {
            return isAscending
                ? query
                    .OrderBy(j => j.UcjbCourier.Code)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.UcjbCourier.Code)
                    .ThenByDescending(j => j.UcjbTime);
        }

        return isAscending
            ? query.OrderBy(j => j.UcjbCourier.UccrName)
            : query.OrderByDescending(j => j.UcjbCourier.UccrName);
    }

    public async Task<JobViewModel> GetJobByIdAsync(int jobId)
    {
        try
        {
            // Mark the job as ready
            await MarkJobAsReadAsync(jobId);

            // Check for a live job first
            var isLiveJob = await Context.TucJobs.AnyAsync(j => j.UcjbId == jobId);
            if (isLiveJob)
            {
                var liveJob = await Context.TucJobs
                    .Where(j => j.UcjbId == jobId)
                    .Select(JobMappings.JobMapping)
                    .AsNoTracking()
                    .FirstOrDefaultAsync();
                return liveJob;
            }

            // Check for an archived job
            var archivedJob = await Context.TucJobArchives
                .Where(j => j.UcjbId == jobId)
                .Select(JobMappings.JobArchiveMapping)
                .AsNoTracking()
                .FirstOrDefaultAsync();
            ArgumentNullException.ThrowIfNull(archivedJob);

            return archivedJob;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting job {JobId}. Please see exception.", jobId);
            throw;
        }
    }

    private async Task MarkJobAsReadAsync(int jobId)
    {
        var alreadyOpened = await Context.TucJobReadTrackers.AnyAsync(x => x.JobId == jobId);
        if (alreadyOpened) return;

        var isLiveJob = await Context.TucJobs.AnyAsync(j => j.UcjbId == jobId);
        if (!isLiveJob) return;

        var staffId = infoService.GetStaffId();
        var currentTenantTime = infoService.GetCurrentTenantTime();

        var readTracker = new TucJobReadTracker
        {
            JobId = jobId,
            HasBeenRead = true,
            ReadByStaffId = staffId,
            ReadTimestamp = currentTenantTime
        };

        await Context.TucJobReadTrackers.AddAsync(readTracker);
        await Context.SaveChangesAsync();
    }

    public async Task UpdateJobReadStatusAsync(int jobId, bool hasBeenRead)
    {
        var data = await Context.TucJobReadTrackers.FirstOrDefaultAsync(x => x.JobId == jobId);
        var staffId = infoService.GetStaffId();
        var currentTenantTime = infoService.GetCurrentTenantTime();

        if (data is null)
        {
            data = new TucJobReadTracker
            {
                JobId = jobId,
                HasBeenRead = hasBeenRead,
                ReadByStaffId = staffId,
                ReadTimestamp = currentTenantTime
            };

            await Context.TucJobReadTrackers.AddAsync(data);
        }
        else
        {
            data.HasBeenRead = hasBeenRead;
            data.ReadByStaffId = staffId;
            data.ReadTimestamp = currentTenantTime;
        }

        await Context.SaveChangesAsync();
    }

    public async Task UpdateJobNoteAsync(int jobId, string note)
    {
        try
        {
            Log.Information("Starting note update for job {JobId}", jobId);

            var job = await Context.TucJobs.Where(j => j.UcjbId == jobId).FirstOrDefaultAsync();

            if (job == null)
            {
                Log.Warning("Job {JobId} not found", jobId);
                throw new KeyNotFoundException($"Job with ID {jobId} not found");
            }

            Log.Debug(
                "Updating note for job {JobId}. Previous note length: {PreviousLength}",
                jobId,
                job.InternalNotes?.Length ?? 0
            );

            job.UcjbNotes = note;

            await Context.SaveChangesAsync();
            Log.Information(
                "Successfully updated note for job {JobId}. New note length: {NewLength}",
                jobId,
                note?.Length ?? 0
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

    public async Task UpdateJobConnoteAsync(int jobId, string conNote)
    {
        try
        {
            Log.Information(
                "Starting connote update for job {JobId} with value {Connote}",
                jobId,
                conNote
            );

            // Get both the job and its possible children in one query
            var jobFamily = await Context
                .TucJobs.Where(j => j.UcjbId == jobId || j.ParentId == jobId)
                .ToListAsync();

            var mainJob = jobFamily.FirstOrDefault(j => j.UcjbId == jobId);

            if (mainJob == null)
            {
                Log.Warning("Job {JobId} not found", jobId);
                throw new KeyNotFoundException($"Job with ID {jobId} not found");
            }

            // If this is a child job, get the whole family using parent's ID
            if (mainJob.ParentId.HasValue)
            {
                Log.Information(
                    "Job {JobId} is a child job. Using parent job {ParentId}",
                    jobId,
                    mainJob.ParentId
                );

                jobFamily = await Context
                    .TucJobs.Where(j =>
                        j.UcjbId == mainJob.ParentId || j.ParentId == mainJob.ParentId
                    )
                    .ToListAsync();
            }

            // Update all jobs in the family
            foreach (var job in jobFamily) job.Connote = conNote;

            Log.Information(
                "Updating connote for job family. Parent: {ParentId}, Total Jobs: {TotalJobs}",
                mainJob.ParentId ?? jobId,
                jobFamily.Count
            );

            await Context.SaveChangesAsync();
            Log.Information("Successfully completed connote update for job family {JobId}", jobId);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating connote for job {JobId}", jobId);
            throw;
        }
    }

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

    public async Task<PaginatedResponse<DeliveryJob>> GetJobsForOverviewPageAsync(
        JobStatusGroup statusGroup,
               OverviewJobsRequest parameters
    )
    {
        // Base query
        var query = Context.TucJobs.Where(j => j.InverseParent.Count != 0);

        // Apply a status group
        query = statusGroup switch
        {
            JobStatusGroup.Active => query.Where(j =>
                j.UcjbStatus.HasValue
                && JobStatusGroups.Active.Contains(j.UcjbStatus.Value)
                && !j.UcjbVoid
            ),

            JobStatusGroup.Completed => query.Where(j =>
                j.UcjbStatus.HasValue
                && JobStatusGroups.Completed.Contains(j.UcjbStatus.Value)
                && !j.UcjbVoid
            ),

            JobStatusGroup.Inactive => query.Where(j => j.UcjbVoid),

            _ => query
        };

        // Apply region filter if provided
        if(parameters.Regions.Count > 0)
        {
            query = query.Where(j =>
                j.TblBulkJobs.Any(b => parameters.Regions.Contains(b.Region.BulkRegionId))
            );
        }

        // Apply speed filter if provided
        if (parameters.Speeds.Count > 0)
        {
            query = query.Where(j => parameters.Speeds.Contains(j.UcjbSpeedNavigation.UcjtId));
        }

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var search = parameters.Search.ToLower().Trim();
            query = query.Where(j =>
                EF.Functions.Like(j.UcjbNumber.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.UcjbStatusNavigation.UcjsName.ToLower(), $"%{search}%")
                || j.TblBulkJobs.Any(b => EF.Functions.Like(b.Region.Name.ToLower(), $"%{search}%"))
                || EF.Functions.Like(j.PickupAddressLine5.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.PickupAddressLine6.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.DeliveryAddressLine5.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.DeliveryAddressLine6.ToLower(), $"%{search}%")
                || (
                    j.UcjbCourier != null
                    && (
                        EF.Functions.Like(j.UcjbCourier.UccrName.ToLower(), $"%{search}%")
                        || EF.Functions.Like(j.UcjbCourier.UccrSurname.ToLower(), $"%{search}%")
                    )
                )
            );
        }

        // Apply date range filter
        if (parameters.StartDate.HasValue)
            query = query.Where(j => j.UcjbDate >= parameters.StartDate);
        if (parameters.EndDate.HasValue)
            query = query.Where(j => j.UcjbDate <= parameters.EndDate);

        // Apply sorting
        query = ApplySorting(query, parameters.OrderBy, parameters.OrderDirection);

        // Get total count for pagination
        var total = await query.CountAsync();
        var pages = (int)Math.Ceiling(total / (double)parameters.Limit);

        var isUsCustomer = infoService.IsUsTenant();

        // Apply pagination
        var jobs = await query
            .Skip((parameters.Page - 1) * parameters.Limit)
            .Take(parameters.Limit)
            .Select(j => new DeliveryJob
            {
                JobId = j.UcjbId,
                JobName = j.UcjbNumber,
                Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : "Unknown",
                Region =
                    j.TblBulkJobs.FirstOrDefault() != null
                        ? j.TblBulkJobs.FirstOrDefault().Region.Name
                        : null,
                Pickup = isUsCustomer
                    ? $"{j.PickupAddressLine5},  {j.PickupAddressLine6}"
                    : j.UcjbFromAddr,
                Delivery = isUsCustomer
                    ? $"{j.DeliveryAddressLine5},  {j.DeliveryAddressLine6}"
                    : j.UcjbToAddr,
                Driver =
                    j.UcjbCourier != null
                        ? $"{j.UcjbCourier.UccrName} {j.UcjbCourier.UccrSurname}"
                        : null,
                Completion = j.InverseParent.Count != 0
                    ? (int)
                    Math.Round(
                        (double)
                        j.InverseParent.Count(c =>
                            c.UcjbJobDone
                            || (
                                c.UcjbStatus.HasValue
                                && JobStatusGroups.Completed.Contains(c.UcjbStatus.Value)
                            )
                        )
                        / j.InverseParent.Count
                        * 100
                    )
                    : 0,
                ChildJobs = j
                    .InverseParent.Select(c => new ChildDeliveryJob
                    {
                        JobId = c.UcjbId,
                        JobName = c.UcjbNumber,
                        Status = c.UcjbStatusNavigation != null ? c.UcjbStatusNavigation.UcjsName : "Unknown",
                        Region =
                            c.TblBulkJobs.FirstOrDefault() != null
                                ? c.TblBulkJobs.FirstOrDefault().Region.Name
                                : null,
                        Pickup = $"{c.PickupAddressLine5}, {c.PickupAddressLine6}",
                        Delivery = $"{c.DeliveryAddressLine5}, {c.DeliveryAddressLine6}",
                        Driver =
                            c.UcjbCourier != null
                                ? $"{c.UcjbCourier.UccrName}, {c.UcjbCourier.UccrSurname}"
                                : null,
                        Completion =
                            c.UcjbJobDone || c.UcjbStatus == (int)JobStatus.Completed ? 100 : 0
                    })
                    .ToList()
            })
            .AsNoTracking()
            .ToListAsync();

        return new PaginatedResponse<DeliveryJob>
        {
            Items = jobs,
            Total = total,
            Page = parameters.Page,
            Pages = pages
        };
    }

    private static IQueryable<TucJob> ApplySorting(
        IQueryable<TucJob> query,
        string orderBy,
        string orderDirection
    )
    {
        var isAscending = !orderDirection.Equals("desc", StringComparison.CurrentCultureIgnoreCase);

        query = orderBy?.ToLower() switch
        {
            "jobname" => isAscending
                ? query.OrderBy(j => j.UcjbNumber)
                : query.OrderByDescending(j => j.UcjbNumber),

            "status" => isAscending
                ? query.OrderBy(j => j.UcjbStatusNavigation.UcjsName)
                : query.OrderByDescending(j => j.UcjbStatusNavigation.UcjsName),

            "completion" => isAscending
                ? query.OrderBy(j =>
                    j.InverseParent.Count(c =>
                        c.UcjbJobDone
                        || (
                            c.UcjbStatus.HasValue
                            && JobStatusGroups.Completed.Contains(c.UcjbStatus.Value)
                        )
                    )
                    / (double)j.InverseParent.Count
                    * 100
                )
                : query.OrderByDescending(j =>
                    j.InverseParent.Count(c =>
                        c.UcjbJobDone
                        || (
                            c.UcjbStatus.HasValue
                            && JobStatusGroups.Completed.Contains(c.UcjbStatus.Value)
                        )
                    )
                    / (double)j.InverseParent.Count
                    * 100
                ),

            "pickup" => isAscending
                ? query.OrderBy(j => j.PickupAddressLine5)
                : query.OrderByDescending(j => j.PickupAddressLine5),

            "delivery" => isAscending
                ? query.OrderBy(j => j.DeliveryAddressLine5)
                : query.OrderByDescending(j => j.DeliveryAddressLine5),

            "driver" => isAscending
                ? query.OrderBy(j => j.UcjbCourier.UccrName)
                : query.OrderByDescending(j => j.UcjbCourier.UccrName),

            "region" => isAscending
                ? query.OrderBy(j => j.TblBulkJobs.FirstOrDefault().Region.Name)
                : query.OrderByDescending(j => j.TblBulkJobs.FirstOrDefault().Region.Name),

            _ => query.OrderBy(j => j.UcjbNumber) // Default sort
        };

        return query;
    }

    public async Task<OverviewDeliveryMapResponse> GetOverviewLocationDataAsync(int jobId)
    {
        var locations = await Context
            .TucJobs.Where(j => j.UcjbId == jobId)
            .Select(j => new OverviewDeliveryMapResponse
            {
                Center = new Coordinates { Lat = (decimal)39.8097343, Lng = (decimal)-98.5556199 },
                Zoom = 5,
                SelectedJobIndex = 0,
                Job = new OverviewJobLocation
                {
                    Id = j.UcjbId,
                    Pickup = new Coordinates
                    {
                        Lat = j.PickUpLatitude ?? 0,
                        Lng = j.PickUpLongitude ?? 0
                    },
                    Delivery = new Coordinates
                    {
                        Lat = j.DeliveryLatitude ?? 0,
                        Lng = j.DeliveryLongitude ?? 0
                    },
                    ChildJobs = j
                        .InverseParent.Select(c => new OverviewChildJobLocation
                        {
                            Id = c.UcjbId,
                            Pickup = new Coordinates
                            {
                                Lat = c.PickUpLatitude ?? 0,
                                Lng = c.PickUpLongitude ?? 0
                            },
                            Delivery = new Coordinates
                            {
                                Lat = c.DeliveryLatitude ?? 0,
                                Lng = c.DeliveryLongitude ?? 0
                            },
                            Flight =
                                j.UcjbSpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                                || IsFlightJobNumber(j.UcjbNumber)
                        })
                        .ToList()
                }
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return locations;
    }

    public async Task<decimal> RateJobAsync(
        int clientId,
        int fromId,
        int toId,
        int speed,
        bool pedal,
        bool van,
        bool returnJob,
        int weight,
        int size,
        bool includeFuelSurcharge,
        string ourRef,
        string refA,
        string refB,
        int quantity,
        DateTime booked
    )
    {
        var curAmount = new OutputParameter<decimal?>();

        await Context.Procedures.sp_RateJob2Async(
            intClientID: clientId,
            intFromID: fromId,
            intToID: toId,
            intSpeed: speed,
            bolPedal: pedal,
            bolVan: van,
            bolReturn: returnJob,
            intWeight: weight,
            size: size,
            includeFuelSurcharge: includeFuelSurcharge,
            ourRef: ourRef,
            clientRefA: refA,
            clientRefB: refB,
            quantity: quantity,
            booked: booked,
            curAmount: curAmount
        );

        return curAmount.Value ?? 0;
    }

    public async Task RateJobUsAsync(RateJobUsDto dto)
    {
        var rate = new OutputParameter<decimal?>();
        var description = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await Context.Procedures.DD_stpJob_Rate_DescribedAsync(
            clientID: dto.ClientId,
            speedID: dto.Speed,
            fromZipCode: string.IsNullOrEmpty(dto.FromZip) ? null : int.Parse(dto.FromZip),
            fromState: null,
            toZipCode: string.IsNullOrEmpty(dto.ToZip) ? null : int.Parse(dto.ToZip),
            toState: null,
            totalDistance: dto.TotalMiles,
            fromMiles: dto.FromMiles,
            toMiles: dto.ToMiles,
            totalWeight: dto.Weight,
            quantity: dto.Quantity,
            cubic: dto.Cubic,
            totalPallets: dto.TotalPallets,
            extraStopOffs: dto.ExtraStopOffs,
            booked: dto.Booked,
            vehicleSizeID: dto.Size,
            dangerousGoods: dto.DangerousGoods,
            dryIceWeight: dto.DryIceWeight,
            waitTime: dto.WaitTime,
            fromAgentId: dto.FromAgentId,
            fromAirportId: dto.FromAirportId,
            toAgentId: dto.ToAgentId,
            toAirportId: dto.ToAirportId,
            description: description,
            rate: rate,
            returnValue: returnValue,
            dimensionsType: dto.CalculateDimsOncePerJob ? 1 : 0
        );

        if (dto.PreviousRate == rate.Value)
        {
            Log.Information("Price is unchanged. Not updating job {Job}", dto.JobId);
            return;
        }

        Log.Information("Pricing breakdown is: {DescriptionValue}", description.Value);

        if (dto.IsPrebook)
        {
            var effectiveJobBookingId = await GetJobBookingRelationshipInfoAsync(dto.JobId);
            await Context.Procedures.DD_InsertPricingBreakdownAsync(
                jobID: null,
                prebookJobID: effectiveJobBookingId,
                pricingBreakdown: description.Value,
                returnValue: returnValue
            );
        }
        else
        {
            var effectiveJobId = await GetJobRelationshipInfoAsync(dto.JobId);
            await Context.Procedures.DD_InsertPricingBreakdownAsync(
                jobID: effectiveJobId,
                prebookJobID: null,
                pricingBreakdown: description.Value,
                returnValue: returnValue
            );
        }

        var printableRate = rate.Value ?? 0;
        await SaveNoteAsync(dto.JobId, $"Repriced from {dto.PreviousRate} to {printableRate}", true);
    }

    public async Task<TucJobType> GetJobTypeById(int speedId)
    {
        var jobType = await Context
            .TucJobTypes.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UcjtId == speedId);

        return jobType ?? throw new KeyNotFoundException($"Job type with ID {speedId} not found");
    }

    public async Task<TucJobTypeGrouping> GetJobTypeGrouping(int groupingId)
    {
        var grouping = await Context
            .TucJobTypeGroupings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.GroupingId == groupingId);

        return grouping ?? throw new KeyNotFoundException($"Job type grouping with ID {groupingId} not found");
    }

    public async Task<List<AddressWithAgent>> GetClosestAirports(
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
                .AsNoTracking()
                .ToListAsync();

            return closestAirports;
        }
        catch (Exception ex)
        {
            throw new ApplicationException("Error while fetching closest airports", ex);
        }
    }

    public async Task<List<MegaMapResponse>> GetJobsForMegaMapAsync()
    {
        // Get active jobs to display on map
        var jobs = await Context
            .TucJobs.Where(j =>
                j.UcjbStatus.HasValue
                && JobStatusGroups.Active.Contains(j.UcjbStatus.Value)
                && !j.UcjbVoid
            )
            .Select(j => new MegaMapResponse
            {
                JobId = j.UcjbId,
                JobNumber = j.UcjbNumber,
                JobStatus = j.UcjbStatus != null ? j.UcjbStatusNavigation.UcjsName : "New",
                EstimatedDelivery =
                    (
                        j.UcjbSpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                        || IsFlightJobNumber(j.UcjbNumber)
                    )
                    && j.TucJobNationwides.Count != 0
                        ? j.TucJobNationwides.FirstOrDefault().UcnwEta.Value
                        : j
                            .UcjbDate.Date.Add(j.UcjbTime.Value.TimeOfDay)
                            .AddMinutes(j.UcjbSpeedNavigation.Minutes ?? 180),
                IsFlightJob =
                    j.UcjbSpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                    || IsFlightJobNumber(j.UcjbNumber),
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
                    j.UcjbSpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                    || IsFlightJobNumber(j.UcjbNumber)
                        ? j
                            .TucJobNationwides.Select(n => new AssignedFlight
                            {
                                FlightNumber = n.UcnwFlightNo,
                                ExpectedArrival = n.UcnwEta,
                                ExpectedDeparture = n.UcnwEtd
                            })
                            .FirstOrDefault()
                        : null
            })
            .AsNoTracking()
            .ToListAsync();

        return jobs;
    }

    private static bool IsFlightJobNumber(string input) =>
        !string.IsNullOrEmpty(input) && input.EndsWith('2');

    public async Task UpdatePackagesForJobAsync(int jobId, List<ParcelDimensions> parcels)
    {
        try
        {
            var effectiveJobId = await GetJobRelationshipInfoAsync(jobId);

            // Process existing and new parcels separately
            var newParcels = new List<TucJobItem>();
            var existingParcelIds = new List<int>();

            foreach (var p in parcels)
            {
                if (p.ItemId == null)
                {
                    // For new items, don't set ItemId (let DB handle it)
                    var newItem = new TucJobItem
                    {
                        JobId = effectiveJobId,
                        Height = p.Height ?? 0,
                        Length = p.Length ?? 0,
                        Depth = p.Depth ?? 0,
                        Notes = p.ItemName
                    };
                    newParcels.Add(newItem);
                }
                else
                {
                    // Add to list of existing IDs to update
                    existingParcelIds.Add(p.ItemId.Value);
                }
            }

            // Handle new items
            if (newParcels.Count > 0)
            {
                await Context.TucJobItems.AddRangeAsync(newParcels);
            }

            // Handle existing items - fetch them all at once
            var existingItems = await Context.TucJobItems
                .Where(i => existingParcelIds.Contains(i.ItemId))
                .ToListAsync();

            // Update existing items
            foreach (var p in parcels.Where(p => p.ItemId != null))
            {
                var existingItem = existingItems.FirstOrDefault(i => i.ItemId == p.ItemId);
                if (existingItem == null) continue;

                existingItem.Height = p.Height ?? 0;
                existingItem.Length = p.Length ?? 0;
                existingItem.Depth = p.Depth ?? 0;
                existingItem.Notes = p.ItemName;
                Context.TucJobItems.Update(existingItem);
            }

            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            throw new ApplicationException("Error while updating packages for job", e);
        }
    }

    public async Task<List<JobCoordinateModel>> GetJobCoordinatesAsync(
        List<int> selectedViewIds)
    {
        try
        {
            var isUsCustomer = infoService.IsUsTenant();
            var query = await BuildBaseQuery(selectedViewIds, isUsCustomer);
            if (query == null) return [];

            query = query.Where(j => j.UcjbStatus != 9);

            var jobCoordinates = await query
                .Select(j => new JobCoordinateModel
                {
                    Id = j.UcjbId,
                    JobNo = j.UcjbNumber,
                    PickupLatitude = j.PickUpLatitude,
                    PickupLongitude = j.PickUpLongitude,
                    DeliveryLatitude = j.DeliveryLatitude,
                    DeliveryLongitude = j.DeliveryLongitude,
                    StatusId = j.UcjbStatus,
                    StatusName = j.UcjbStatusNavigation.UcjsName,
                    ClientId = j.UcjbClientId ?? 0,
                    ClientName = j.UcjbClient.UcclName,
                    Speed = j.UcjbSpeedNavigation.ShortName,
                    FromAddress = j.UcjbFromAddr,
                    ToAddress = j.UcjbToAddr
                })
                .AsNoTracking()
                .ToListAsync();

            return jobCoordinates;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting job coordinates. Please see exception.");
            throw;
        }
    }

    public async Task<List<TucNoteViewModel>> GetNotesByJobId(int jobId)
    {
        ArgumentNullException.ThrowIfNull(jobId);

        return await IsJobArchived(jobId)
            ? await GetArchivedNotesByJobIdAsync(jobId)
            : await GetActiveNotesByJobIdAsync(jobId);
    }

    public async Task<TucNoteViewModel> GetNoteByIdAsync(int noteId)
    {
        ArgumentNullException.ThrowIfNull(noteId);

        // Try to get from active notes first, then archived if not found
        var note = await GetActiveNoteByIdAsync(noteId);
        return note ?? await GetArchivedNoteByIdAsync(noteId);
    }

    public async Task<int> SaveNoteAsync(TucNoteViewModel viewModel, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(viewModel);
        if (viewModel.JobBookingId == null)
        {
            ArgumentNullException.ThrowIfNull(viewModel.JobId, nameof(viewModel.JobId));
        }

        var staffId = infoService.GetStaffId();
        var currentTime = infoService.GetCurrentTenantTime();

        return viewModel.NoteId == 0
            ? await CreateNoteAsync(viewModel, staffId, currentTime, cancellationToken)
            : await UpdateNoteAsync(viewModel, staffId, currentTime, cancellationToken);
    }

    public async Task<int> SaveNoteAsync(int jobId, string noteText, bool isImportant = false,
        bool isRecurringJob = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(noteText, nameof(noteText));

        var viewModel = new TucNoteViewModel
        {
            JobId = isRecurringJob ? null : jobId,
            JobBookingId = isRecurringJob ? jobId : null,
            NoteText = noteText,
            IsImportant = isImportant,
            NoteTypeId = (int)NoteType.InternalNote
        };

        return await SaveNoteAsync(viewModel);
    }

    public async Task DeleteNoteAsync(int noteId, CancellationToken cancellationToken = default)
    {
        var note = await Context.TucNotes.FindAsync([noteId], cancellationToken);
        if (note != null)
        {
            Context.TucNotes.Remove(note);
            await Context.SaveChangesAsync(cancellationToken);
        }
    }

    // Helper Methods
    private async Task<bool> IsJobArchived(int jobId) =>
        await Context.TucJobArchives.AnyAsync(j => j.UcjbId == jobId);

    private async Task<int> GetEffectiveJobId(int jobId, bool isArchived)
    {
        if (isArchived)
        {
            return await Context.TucJobArchives
                .Where(j => j.UcjbId == jobId)
                .Select(j => j.ParentId ?? j.UcjbId)
                .FirstOrDefaultAsync();
        }

        return await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.ParentId ?? j.UcjbId)
            .FirstOrDefaultAsync();
    }

    private async Task<int> GetEffectiveJobBookingId(int jobBookingId)
    {
        return await Context.TucJobBookings
            .Where(j => j.UcbkId == jobBookingId)
            .Select(j => j.ParentId ?? j.UcbkId)
            .FirstOrDefaultAsync();
    }

    // Note Create/Update Operations
    private async Task<int> CreateNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime,
        CancellationToken cancellationToken = default)
    {
        var isArchived = viewModel.JobId.HasValue && await IsJobArchived(viewModel.JobId.Value) &&
                         !viewModel.JobBookingId.HasValue;
        var isPrebook = viewModel.JobBookingId.HasValue;

        if (isArchived)
        {
            var archivedNote = viewModel.ToArchivedEntity();
            archivedNote.CreatedDate = currentTime;
            archivedNote.CreatedBy = staffId;

            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, true);
            archivedNote.JobId = effectiveJobId;

            await Context.TucNoteArchives.AddAsync(archivedNote, cancellationToken);
            await Context.SaveChangesAsync(cancellationToken);
            return archivedNote.NoteId;
        }

        var activeNote = viewModel.ToEntity();
        activeNote.CreatedDate = currentTime;
        activeNote.CreatedBy = staffId;

        if (isPrebook)
        {
            var effectiveJobBookingId = await GetEffectiveJobBookingId(viewModel.JobBookingId.Value);
            activeNote.JobBookingId = effectiveJobBookingId;
        }
        else
        {
            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, false);
            activeNote.JobId = effectiveJobId;
        }

        await Context.TucNotes.AddAsync(activeNote, cancellationToken);
        await Context.SaveChangesAsync(cancellationToken);
        return activeNote.NoteId;
    }

    private async Task<int> UpdateNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime,
        CancellationToken cancellationToken = default)
    {
        var isArchived = viewModel.JobId.HasValue && await IsJobArchived(viewModel.JobId.Value);
        var isPrebook = viewModel.JobBookingId.HasValue;

        if (isArchived)
        {
            var archivedNote = await Context.TucNoteArchives.FindAsync([viewModel.NoteId], cancellationToken);
            if (archivedNote == null)
            {
                throw new ArgumentException($"Note with ID {viewModel.NoteId} not found in archives");
            }

            UpdateNoteProperties(archivedNote, viewModel);
            archivedNote.UpdatedDate = currentTime;
            archivedNote.UpdatedBy = staffId;

            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, true);
            archivedNote.JobId = effectiveJobId;

            Context.TucNoteArchives.Update(archivedNote);
            await Context.SaveChangesAsync(cancellationToken);
            return archivedNote.NoteId;
        }

        var activeNote = await Context.TucNotes.FindAsync([viewModel.NoteId], cancellationToken);
        ArgumentNullException.ThrowIfNull(activeNote);

        UpdateNoteProperties(activeNote, viewModel);
        activeNote.UpdatedDate = currentTime;
        activeNote.UpdatedBy = staffId;

        if (isPrebook)
        {
            var effectiveJobBookingId = await GetEffectiveJobBookingId(viewModel.JobBookingId.Value);
            activeNote.JobBookingId = effectiveJobBookingId;
        }
        else
        {
            var effectiveJobId = await GetEffectiveJobId(viewModel.JobId.Value, false);
            activeNote.JobId = effectiveJobId;
        }

        Context.TucNotes.Update(activeNote);
        await Context.SaveChangesAsync(cancellationToken);
        return activeNote.NoteId;
    }

    private static void UpdateNoteProperties<T>(T note, TucNoteViewModel viewModel)
        where T : class
    {
        dynamic dynamicNote = note;
        dynamicNote.NoteTypeId = viewModel.NoteTypeId;
        dynamicNote.JobId = viewModel.JobId;
        dynamicNote.JobBookingId = viewModel.JobBookingId;
        dynamicNote.NoteText = viewModel.NoteText;
        dynamicNote.IsImportant = viewModel.IsImportant;
    }

    // Query Methods
    private async Task<TucNoteViewModel> GetActiveNoteByIdAsync(int noteId)
    {
        return await Context.TucNotes
            .Include(x => x.NoteType)
            .Include(x => x.CreatedByNavigation)
            .Include(x => x.UpdatedByNavigation)
            .AsNoTracking()
            .Where(x => x.NoteId == noteId)
            .Select(x => new TucNoteViewModel(x))
            .FirstOrDefaultAsync();
    }

    private async Task<List<TucNoteViewModel>> GetActiveNotesByJobIdAsync(int jobId)
    {
        var effectiveJobId = await GetEffectiveJobId(jobId, false);

        return await Context.TucNotes
            .Include(x => x.NoteType)
            .Include(x => x.CreatedByNavigation)
            .Include(x => x.UpdatedByNavigation)
            .Where(x => x.JobId == effectiveJobId)
            .AsNoTracking()
            .Select(x => new TucNoteViewModel(x))
            .ToListAsync();
    }

    private async Task<TucNoteViewModel> GetArchivedNoteByIdAsync(int noteId)
    {
        var query = CreateArchivedNoteQuery()
            .Where(note => note.NoteId == noteId);

        return await query.FirstOrDefaultAsync();
    }

    private async Task<List<TucNoteViewModel>> GetArchivedNotesByJobIdAsync(int jobId)
    {
        var effectiveJobId = await GetEffectiveJobId(jobId, true);

        var query = CreateArchivedNoteQuery()
            .Where(note => note.JobId == effectiveJobId || note.JobBookingId == effectiveJobId);

        return await query.ToListAsync();
    }

    private IQueryable<TucNoteViewModel> CreateArchivedNoteQuery()
    {
        return from note in Context.TucNoteArchives
            join noteType in Context.TucNoteTypes
                on note.NoteTypeId equals noteType.NoteTypeId into noteTypes
            from nt in noteTypes.DefaultIfEmpty()
            join createdBy in Context.TucStaffs
                on note.CreatedBy equals createdBy.UcstId into createdStaff
            from cs in createdStaff.DefaultIfEmpty()
            join updatedBy in Context.TucStaffs
                on note.UpdatedBy equals updatedBy.UcstId into updatedStaff
            from us in updatedStaff.DefaultIfEmpty()
            join job in Context.TucJobArchives
                on note.JobId equals job.UcjbId into jobs
            from j in jobs.DefaultIfEmpty()
            select new TucNoteViewModel
            {
                // Note properties
                NoteId = note.NoteId,
                NoteText = note.NoteText,
                CreatedDate = note.CreatedDate ?? j.UcjbComplTime ?? DateTime.MinValue,
                UpdatedDate = note.UpdatedDate,
                JobId = note.JobId,
                JobBookingId = note.JobBookingId,
                IsImportant = note.IsImportant,

                // Related entity properties
                NoteTypeId = note.NoteTypeId,
                NoteTypeName = nt.NoteTypeName,

                // Staff information
                CreatedBy = note.CreatedBy,
                CreatedByName = cs != null ? cs.UcstFirstName + " " + cs.UcstLastName : null,
                UpdatedBy = note.UpdatedBy,
                UpdatedByName = us != null ? us.UcstFirstName + " " + us.UcstLastName : null,

                // Job information
                JobNumber = j != null ? j.UcjbNumber : null
            };
    }

    public async Task<List<NoteTypeViewModel>> GetNoteTypesAsync()
    {
        var noteTypes = await Context.TucNoteTypes
            .Where(x => x.IsActive)
            .Select(x => new NoteTypeViewModel
            {
                Id = x.NoteTypeId,
                Text = x.NoteTypeName,
                IsPublic = x.IsPublic
            })
            .AsNoTracking()
            .ToListAsync();

        return noteTypes;
    }

    public async Task<bool> IsJobParentAsync(int jobId)
    {
        var jobInfo = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new { HasParent = j.ParentId.HasValue })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        if (jobInfo != null)
            return jobInfo.HasParent;

        var bookingInfo = await Context.TucJobBookings
            .Where(j => j.UcbkId == jobId)
            .Select(j => new { HasParent = j.ParentId.HasValue })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return bookingInfo?.HasParent ?? false;
    }

    protected async Task<int> GetJobRelationshipInfoAsync(int jobId)
    {
        if (jobId == 0) return 0;
        var jobInfo = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new
            {
                EffectiveJobId = j.ParentId ?? j.UcjbId
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return jobInfo.EffectiveJobId;
    }

    protected async Task<int> GetJobBookingRelationshipInfoAsync(int bookingId)
    {
        if (bookingId == 0) return 0;
        var jobInfo = await Context.TucJobBookings
            .Where(j => j.UcbkId == bookingId)
            .Select(j => new
            {
                EffectiveJobId = j.ParentId ?? j.UcbkId
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return jobInfo.EffectiveJobId;

    }

    protected static string GetTrackingName(int trackingMethodId)
    {
        return trackingMethodId switch
        {
            1 => "Email",
            2 => "Mobile",
            3 => "Email & Mobile",
            _ => string.Empty
        };
    }

    public async Task AddNewTucNoteType(NoteTypeViewModel noteType)
    {
        var newType = new TucNoteType
        {
            IsActive = true,
            IsPublic = noteType.IsPublic,
            NoteTypeName = noteType.Text,
            Description = noteType.Description
        };

        await Context.TucNoteTypes.AddAsync(newType);
        await Context.SaveChangesAsync();
    }

    public async Task<JobRatingDetailsDto> GetJobDetailsForRating(int jobId)
    {
        try
        {
            var jobDetails = await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Include(j => j.UcjbClient)
                .Include(j => j.UcjbSpeedNavigation)
                .Select(job => new JobRatingDetailsDto
                {
                    // Map the entity properties to our model
                    JobId = job.UcjbId,
                    ClientId = job.UcjbClientId,
                    FromId = job.UcjbFrom,
                    ToId = job.UcjbTo,
                    SpeedId = job.UcjbSpeed,
                    IsPedal = job.UcjbCbd,
                    IsVan = job.UcjbVan,
                    IsReturnJob = job.UcjbReturn,
                    Weight = job.UcjbWeight,
                    SizeId = job.UcjbSize,
                    IncludeFuelSurcharge = false,
                    IsDirect = job.Direct,
                    AcceptedJobTypeId = job.AcceptedJobTypeId,
                    OurRef = job.UcjbOurRef,
                    RefA = job.UcjbClientRefa,
                    RefB = job.UcjbClientRefb,
                    Quantity = job.UcjbQty ?? 1,
                    BookedDate = job.UcjbDate,

                    // Coordinates
                    PickupLat = job.PickUpLatitude ?? 0,
                    PickupLong = job.PickUpLongitude ?? 0,
                    DeliveryLat = job.DeliveryLatitude ?? 0,
                    DeliveryLong = job.DeliveryLongitude ?? 0,

                    // US-specific properties
                    FromZip = job.PickupAddressLine7,
                    ToZip = job.DeliveryAddressLine7,
                    DangerousGoods = job.Dgdocument ?? false,
                    TotalPallets = job.TucJobItems.Count,
                    ExtraStopOffs = 0,
                    DryIceWeight = job.DryIceWeight ?? 0,
                    WaitTime = 0,

                    // Flight-specific properties
                    FromAirportId = job.FromAirportId,
                    ToAirportId = job.ToAirportId,
                    FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
                    ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

                    // Client-specific rate information
                    ClientDiscount = job.UcjbClient.Discount,
                    Cubic = job.TucJobItems.Sum(i => i.Cubic),
                    IsManuallyRated = job.RatedManually
                })
                .FirstOrDefaultAsync();

            ArgumentNullException.ThrowIfNull(jobDetails);

            return jobDetails;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving job details for rating. Job ID: {JobId}", jobId);
            throw new ApplicationException($"Failed to retrieve job details for rating: {ex.Message}", ex);
        }
    }

    public async Task<JobRatingDetailsDto> GetJobBookingDetailsForRating(int jobId)
    {
        try
        {
            var jobDetails = await Context.TucJobBookings
                .Where(j => j.UcbkId == jobId)
                .Include(j => j.UcbkClient) // Include client info
                .Include(j => j.UcbkSpeedNavigation) // Include job type info
                .Select(job => new JobRatingDetailsDto
                {
                    // Map the entity properties to our model
                    JobId = job.UcbkId,
                    ClientId = job.UcbkClientId ?? 0,
                    FromId = (int)job.UcbkFrom,
                    ToId = (int)job.UcbkTo,
                    SpeedId = job.UcbkSpeed ?? 0,
                    IsPedal = job.UcbkCbd ?? false,
                    IsVan = job.UcbkVan,
                    IsReturnJob = job.UcbkReturn,
                    Weight = job.UcbkWeight ?? 0,
                    SizeId = job.UcbkSize ?? 0,
                    IncludeFuelSurcharge = false,
                    IsDirect = job.Direct,
                    AcceptedJobTypeId = job.AcceptedJobTypeId ?? 0,
                    OurRef = job.UcbkOurRef,
                    RefA = job.UcbkClientRefa,
                    RefB = job.UcbkClientRefb,
                    Quantity = job.Quantity.HasValue ? (int)job.Quantity : 0,
                    BookedDate = job.UcbkDate ?? DateTime.MinValue,
                    PreviousRate = job.PricingBreakdowns.Sum(p => p.Charged),

                    // Coordinates
                    PickupLat = job.PickUpLatitude ?? 0,
                    PickupLong = job.PickUpLongitude ?? 0,
                    DeliveryLat = job.DeliveryLatitude ?? 0,
                    DeliveryLong = job.DeliveryLongitude ?? 0,

                    // US-specific properties
                    FromZip = job.PickupAddressLine7,
                    ToZip = job.DeliveryAddressLine7,
                    DangerousGoods = job.Dgdocument ?? false,
                    TotalPallets = job.TucJobBookingItems.Count,
                    ExtraStopOffs = 0,
                    DryIceWeight = job.DryIceWeight ?? 0,
                    WaitTime = 0,

                    // Flight-specific properties
                    FromAirportId = job.FromAirportId,
                    ToAirportId = job.ToAirportId,
                    FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
                    ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

                    // Client-specific rate information
                    ClientDiscount = job.UcbkClient.Discount,
                    Cubic = job.TucJobBookingItems.Sum(i => i.Cubic),
                    CalculateDimsOncePerJob = job.DimensionsType == 1
                })
                .FirstOrDefaultAsync();

            ArgumentNullException.ThrowIfNull(jobDetails);

            return jobDetails;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving job details for rating. Job ID: {JobId}", jobId);
            throw new ApplicationException($"Failed to retrieve job details for rating: {ex.Message}", ex);
        }
    }

    public async Task UpdateJobRateAsync(int jobId, decimal rate, string noteText)
    {
        try
        {
            var job = await Context.TucJobs.FindAsync(jobId);
            ArgumentNullException.ThrowIfNull(job);

            // Update a job with a new rate
            job.UcjbAmount = rate;
            await Context.SaveChangesAsync();

            // Record change in note
            await SaveNoteAsync(jobId, noteText);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "An error occurred updating the rate for job {JobId}", jobId);
            throw;
        }
    }

    public async Task<DispatchJobViewModel> GetDispatchJobDetailAsync(int jobId)
    {
        var job = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(JobMappings.JobDispatchMapping)
            .AsNoTracking()
            .FirstOrDefaultAsync();
        return job;
    }

    public async Task<bool> JobNumberExistsAsync(string jobNumber) =>
        await Context.TucJobs.AnyAsync(j => j.UcjbNumber == jobNumber);

    public async Task<decimal> GetNationwideServiceRawPriceAsync(int? clientId, int? fromSuburbId,
        int? toSuburbId, int? speed, int? size, float? weight, int? quantity, int? type)
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
}
