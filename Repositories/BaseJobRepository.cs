using System.Globalization;
using System.Linq.Expressions;
using System.Text.RegularExpressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public partial class BaseJobRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    ITenantClock clock,
    IClearListEnvelopeService clearListEnvelopeService)
    : BaseRepository(contextFactory)
{
    protected const string Space = " ";

    private static readonly Regex[] DangerousSqlPatterns =
    [
        DropRegex(), DeleteRegex(), TruncateRegex(), AlterRegex(), CreateRegex(),
        InsertRegex(), UpdateRegex(), ExecRegex(), ExecuteRegex(), XpPrefixRegex(),
        SpPrefixRegex(), IntoRegex(), UnionRegex(), GrantRegex(), RevokeRegex(),
        DashDashRegex(), BlockCommentOpenRegex(), BlockCommentCloseRegex(),
        ShutdownRegex(), WaitforRegex(), DelayRegex(), OpenrowsetRegex(),
        OpenqueryRegex(), BulkRegex(), DbccRegex(), MergeRegex()
    ];

    [GeneratedRegex(@"\bDROP\b", RegexOptions.IgnoreCase)] private static partial Regex DropRegex();
    [GeneratedRegex(@"\bDELETE\b", RegexOptions.IgnoreCase)] private static partial Regex DeleteRegex();
    [GeneratedRegex(@"\bTRUNCATE\b", RegexOptions.IgnoreCase)] private static partial Regex TruncateRegex();
    [GeneratedRegex(@"\bALTER\b", RegexOptions.IgnoreCase)] private static partial Regex AlterRegex();
    [GeneratedRegex(@"\bCREATE\b", RegexOptions.IgnoreCase)] private static partial Regex CreateRegex();
    [GeneratedRegex(@"\bINSERT\b", RegexOptions.IgnoreCase)] private static partial Regex InsertRegex();
    [GeneratedRegex(@"\bUPDATE\b", RegexOptions.IgnoreCase)] private static partial Regex UpdateRegex();
    [GeneratedRegex(@"\bEXEC\b", RegexOptions.IgnoreCase)] private static partial Regex ExecRegex();
    [GeneratedRegex(@"\bEXECUTE\b", RegexOptions.IgnoreCase)] private static partial Regex ExecuteRegex();
    [GeneratedRegex(@"\bXP_", RegexOptions.IgnoreCase)] private static partial Regex XpPrefixRegex();
    [GeneratedRegex(@"\bSP_", RegexOptions.IgnoreCase)] private static partial Regex SpPrefixRegex();
    [GeneratedRegex(@"\bINTO\b", RegexOptions.IgnoreCase)] private static partial Regex IntoRegex();
    [GeneratedRegex(@"\bUNION\b", RegexOptions.IgnoreCase)] private static partial Regex UnionRegex();
    [GeneratedRegex(@"\bGRANT\b", RegexOptions.IgnoreCase)] private static partial Regex GrantRegex();
    [GeneratedRegex(@"\bREVOKE\b", RegexOptions.IgnoreCase)] private static partial Regex RevokeRegex();
    [GeneratedRegex("--")] private static partial Regex DashDashRegex();
    [GeneratedRegex(@"/\*")] private static partial Regex BlockCommentOpenRegex();
    [GeneratedRegex(@"\*/")] private static partial Regex BlockCommentCloseRegex();
    [GeneratedRegex(@"\bSHUTDOWN\b", RegexOptions.IgnoreCase)] private static partial Regex ShutdownRegex();
    [GeneratedRegex(@"\bWAITFOR\b", RegexOptions.IgnoreCase)] private static partial Regex WaitforRegex();
    [GeneratedRegex(@"\bDELAY\b", RegexOptions.IgnoreCase)] private static partial Regex DelayRegex();
    [GeneratedRegex(@"\bOPENROWSET\b", RegexOptions.IgnoreCase)] private static partial Regex OpenrowsetRegex();
    [GeneratedRegex(@"\bOPENQUERY\b", RegexOptions.IgnoreCase)] private static partial Regex OpenqueryRegex();
    [GeneratedRegex(@"\bBULK\b", RegexOptions.IgnoreCase)] private static partial Regex BulkRegex();
    [GeneratedRegex(@"\bDBCC\b", RegexOptions.IgnoreCase)] private static partial Regex DbccRegex();
    [GeneratedRegex(@"\bMERGE\b", RegexOptions.IgnoreCase)] private static partial Regex MergeRegex();

    private (int? economySpeedId, DateTime? ecoDeliveryTime)? _economyCache;

    protected async Task<JobSearchResult> DespatchQry(
        AppPage page,
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        IReadOnlyList<int> selectedViewIds,
        NationwideWidget? windowPane = null,
        int? selectedClearListId = null,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var query = await BuildBaseQueryAsync(selectedViewIds, isUsTenant);
            if (query == null)
            {
                return new JobSearchResult
                {
                    Jobs = [],
                    TotalCount = 0,
                    HasMore = false
                };
            }

            ClearListEnvelopeViewModel clearListEnvelope = null;
            var isNeedsDispatchFilter = false;

            if (selectedClearListId.HasValue)
            {
                Log.Debug("ClearListId {ClearListID} provided. Getting ClearListEnvelope", selectedClearListId);

                var country = isUsTenant ? Country.Us : Country.Nz;
                clearListEnvelope =
                    await clearListEnvelopeService.GetClearListAreaEnvelopeAsync(selectedClearListId.Value, country);

                // Check if the needs-dispatch filter is active
                isNeedsDispatchFilter = queryParams.StatusFilter?.ToLower() == "needs-dispatch";
            }

            query = ApplyGeographicFilters(query, clearListEnvelope, isNeedsDispatchFilter);
            query = ApplySearchTextFilter(query, queryParams.SearchText);

            switch (page)
            {
                case AppPage.Dispatch:
                    if (queryParams.DateCutoff.HasValue)
                    {
                        query = query.Where(JobDateOnOrBefore(queryParams.DateCutoff.Value));
                    }

                    if (queryParams.StartDate.HasValue)
                    {
                        query = query.Where(JobDateOnOrAfter(queryParams.StartDate.Value));
                    }

                    query = ApplyEndDateFilter(query, queryParams.EndDate, queryParams.UseTime);

                    break;
                case AppPage.Domestic:
                    query = ApplyNationwideSpecificFilters(
                        query,
                        queryParams,
                        isInternal,
                        windowPane ?? NationwideWidget.JobList,
                        clientIds
                    );
                    break;
                case AppPage.JobSearch:
                case AppPage.Prebooks:
                default:
                    return new JobSearchResult
                    {
                        Jobs = [],
                        TotalCount = 0,
                        HasMore = false
                    };
            }

            // The stats header describes the list as a whole, so its counts come off the query as it
            // stands before the category tab narrows it — otherwise picking a tab would rewrite the
            // very numbers it was picked from. Everything else the user asked for still applies.
            var statsQuery = query;
            query = ApplyStatusFilter(query, queryParams.StatusFilter);

            // Resolve the distinct job IDs for this page up-front. Paginating over distinct IDs
            // keeps page sizes consistent and lets us project only the page's jobs (no duplicate
            // rows). Even when the caller omits Page, the non-paginated path is bounded by a safety
            // ceiling so this query can never materialise an unbounded view.
            var requestedPage = queryParams.Page ?? 0;
            var pageSize = queryParams.PageSize ?? 500;

            var (pageJobIds, totalCount, hasMore) = await ResolveJobIdPageAsync(
                query.Select(j => j.UcjbId).Distinct(),
                requestedPage,
                pageSize,
                cancellationToken: cancellationToken);

            // Answered with the first page only; the client keeps it while it scrolls.
            var statusCounts = requestedPage == 0
                ? await CountStatusBucketsAsync(statsQuery, cancellationToken)
                : null;

            var allJobs = await Context.TucJobs
                .Where(j => pageJobIds.Contains(j.UcjbId))
                .Select(JobMappings.JobDispatchMapping(isUsTenant, infoService.GetCurrentTenantId()))
                .ToListAsync(cancellationToken);

            // Populate Children on parent jobs so the frontend can track grouping via _groupChildren.
            // All jobs stay in the flat list the template renders them as flat rows.
            var parentJobMap = allJobs
                .Where(j => j.IsParentOrSingle && j.ParentId.HasValue && j.ParentId == j.Id)
                .ToDictionary(j => j.Id);

            foreach (var child in allJobs.Where(j => !j.IsParentOrSingle && j.ParentId.HasValue))
            {
                if (!parentJobMap.TryGetValue(child.ParentId!.Value, out var parent))
                {
                    continue;
                }

                parent.Children ??= [];
                parent.Children.Add(child);
            }

            await EnrichJobsWithCollections(allJobs);

            var (economySpeedId, ecoDeliveryTime) = await GetEconomySpeedAndDeliveryTimeAsync();
            var now = clock.TenantNow;
            foreach (var job in allJobs)
            {
                job.AngularId = Guid.NewGuid();
                job.Remain = CalculateRemainTime(job, now, economySpeedId, ecoDeliveryTime);
            }

            var mapItems = page == AppPage.Dispatch
                ? allJobs.Select(j => new DispatchMapItem
                {
                    JobId = j.Id,
                    JobNo = j.JobNo,
                    PickupAddress = j.PickupAddress,
                    DeliveryAddress = j.DeliveryAddress,
                    AssignedCourier = j.AssignedCourier
                }).ToList()
                : null;

            return new JobSearchResult
            {
                Jobs = allJobs,
                TotalCount = totalCount,
                HasMore = hasMore,
                MapItems = page == AppPage.Dispatch ? mapItems : null,
                StatusCounts = statusCounts
            };
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting jobs for dispatch page with pagination. Please see exception");
            throw;
        }
    }

    protected async Task<IQueryable<TucJob>> BuildBaseQueryAsync(IReadOnlyList<int> selectedViewIds, bool isUsTenant)
    {
        var jobIdsQuery = await GetFilteredJobIdsQueryAsync(selectedViewIds, isUsTenant);

        if (!isUsTenant && (selectedViewIds == null || selectedViewIds.Count == 0))
        {
            return Context.TucJobs.Where(j => false);
        }

        var query = from job in Context.TucJobs
            join id in jobIdsQuery on job.UcjbId equals id
            select job;

        return query.TagWith($"BuildBaseQuery - Views: {selectedViewIds?.Count ?? 0}");
    }

    /// <summary>
    /// Same despatch-view scoping as <see cref="BuildBaseQueryAsync"/>, but for callers that
    /// group jobs by parent (e.g. the Overview page's parent/child list). A view's
    /// WhereCondition is evaluated leg-by-leg, so a split job's child can match on its own
    /// courier/region/etc. while the parent row does not — resolving straight to the matched
    /// leg's own id would then get filtered out by a parent-only restriction downstream, and
    /// the parent was never in the matched set either. Routing matches through
    /// <see cref="ResolveParentScopedJobs"/> ensures a match on any leg still surfaces the
    /// family under its parent.
    /// </summary>
    protected async Task<IQueryable<TucJob>> BuildParentScopedQueryAsync(IReadOnlyList<int> selectedViewIds, bool isUsTenant)
    {
        if (!isUsTenant && (selectedViewIds == null || selectedViewIds.Count == 0))
        {
            return Context.TucJobs.Where(j => false);
        }

        var matchedJobIdsQuery = await GetFilteredJobIdsQueryAsync(selectedViewIds, isUsTenant);
        var matchedJobIds = await matchedJobIdsQuery.ToListAsync();

        return ResolveParentScopedJobs(matchedJobIds)
            .TagWith($"BuildParentScopedQuery - Views: {selectedViewIds?.Count ?? 0}");
    }

    /// <summary>
    /// Maps a set of matched job/leg ids up to their parent (or themselves, if standalone),
    /// then returns the corresponding parent-level <see cref="TucJob"/> rows. Takes the
    /// matched ids already materialized (rather than an <see cref="IQueryable{T}"/> sourced
    /// from the SQL-Server-only despatch view) so the parent-resolution logic can be composed
    /// and tested against a plain in-memory id list, independent of that view.
    /// </summary>
    // internal so DespatchWeb.Tests can exercise it directly (InternalsVisibleTo is set).
    internal IQueryable<TucJob> ResolveParentScopedJobs(IReadOnlyList<int> matchedJobIds)
    {
        var parentIds = Context.TucJobs
            .Where(job => matchedJobIds.Contains(job.UcjbId))
            .Select(job => job.ParentId ?? job.UcjbId)
            .Distinct();

        return Context.TucJobs.Where(job => parentIds.Contains(job.UcjbId));
    }

    protected async Task<IQueryable<int>> GetFilteredJobIdsQueryAsync(IReadOnlyList<int> selectedViewIds, bool isUsTenant)
    {
        if (selectedViewIds == null || selectedViewIds.Count == 0)
        {
            if (!isUsTenant)
            {
                return Context.TucJobs.Where(j => false).Select(j => j.UcjbId);
            }

            return Context.DeswebQryDespatchJobViewFilters
                .Select(x => x.UcjbId)
                .Distinct();
        }

        var viewFilters = await Context.TblDespatchViews
            .Where(dv => selectedViewIds.Contains(dv.DespatchViewId))
            .Select(dv => dv.WhereCondition)
            .ToListAsync();

        if (viewFilters.Count == 0)
        {
            return Context.TucJobs.Where(j => false).Select(j => j.UcjbId);
        }

        // Validate each filter to prevent SQL injection
        foreach (var filter in viewFilters.Where(filter => !IsValidWhereCondition(filter)))
        {
            Log.Warning("Invalid WhereCondition detected and rejected: {Filter}", filter);
            throw new InvalidOperationException("Invalid filter condition detected in view configuration.");
        }

        // Build combined filter from admin-configured view WhereConditions stored in TblDespatchViews.
        // SECURITY: These filters originate from database-stored admin configuration, NOT user input.
        // The IsValidWhereCondition blocklist provides defense-in-depth but is not the primary trust boundary.
        // Do NOT pass untrusted/user-supplied input into this code path.
        var combinedFilters = string.Join(" OR ", viewFilters.Select(filter => $"({filter})"));

        return Context.DeswebQryDespatchJobViewFilters
            .FromSqlRaw(
                isUsTenant
                    ? $"SELECT DISTINCT UcjbId FROM DESWEB_qry_Despatch_Job_View_Filters WHERE {combinedFilters}"
                    : $"SELECT DISTINCT UcjbId FROM DESWEB_qryDespatch WHERE {combinedFilters}"
            )
            .Select(x => x.UcjbId);
    }

    /// <summary>
    /// Validates that a WhereCondition from the database doesn't contain SQL injection patterns.
    /// </summary>
    private static bool IsValidWhereCondition(string condition) => !string.IsNullOrWhiteSpace(condition) 
                                                                   && DangerousSqlPatterns.All(pattern => !pattern.IsMatch(condition));

    private async Task EnrichJobsWithCollections(List<DispatchJobViewModel> jobs)
    {
        if (jobs.Count == 0)
        {
            return;
        }

        var jobIds = jobs.Select(j => j.Id).ToList();
        var parentIds = jobs.Where(j => j.ParentId.HasValue)
            .Select(j => j.ParentId.Value)
            .Distinct()
            .ToList();

        // Run both queries in parallel using separate contexts (DbContext is not thread-safe)
        await using var relatedJobsContext = CreateNewContext();
        await using var flightsContext = CreateNewContext();

        var relatedJobsTask = parentIds.Count != 0
            ? relatedJobsContext.TucJobs
                .Where(j => parentIds.Contains(j.ParentId.Value))
                .GroupBy(j => j.ParentId.Value)
                .Select(g => new
                {
                    ParentId = g.Key,
                    RelatedJobs = g.Select(j => new Suggestion { Id = j.UcjbId, Text = j.UcjbNumber }).ToList()
                })
                .ToDictionaryAsync(x => x.ParentId, x => x.RelatedJobs)
            : Task.FromResult(new Dictionary<int, List<Suggestion>>());

        var flightsTask = flightsContext.TucJobNationwides
            .Where(nw => nw.UcnwJobId.HasValue && jobIds.Contains(nw.UcnwJobId.Value))
            .Select(nw => new { nw.UcnwJobId, nw.UcnwFlightNo })
            .GroupBy(x => x.UcnwJobId)
            .ToDictionaryAsync(g => g.Key, g => new AssignedFlight { FlightNumber = g.First().UcnwFlightNo });

        await Task.WhenAll(relatedJobsTask, flightsTask);

        var relatedJobsDict = await relatedJobsTask;
        var flightsDict = await flightsTask;

        // Apply related jobs
        foreach (var job in jobs.Where(j => j.ParentId.HasValue))
        {
            if (job.ParentId != null && relatedJobsDict.TryGetValue(job.ParentId.Value, out var related))
            {
                job.RelatedJobs = related;
            }
        }

        // Apply flights
        foreach (var job in jobs)
        {
            if (flightsDict.TryGetValue(job.Id, out var flight))
            {
                job.AssignedFlight = flight;
            }
        }
    }


    /// <summary>
    /// Tallies the stats header's buckets over every job the query matches.
    /// </summary>
    /// <remarks>
    /// The view the base query joins through fans a job out across rows, so the ids are reduced to
    /// a distinct set and re-joined before classifying — the same shape the total count uses, so
    /// the two can never disagree.
    /// </remarks>
    private async Task<JobListStatusCounts> CountStatusBucketsAsync(
        IQueryable<TucJob> query, CancellationToken cancellationToken)
    {
        var tallies = await query
            .Select(j => j.UcjbId)
            .Distinct()
            .Join(Context.TucJobs, id => id, j => j.UcjbId, (_, j) => j)
            .Select(JobListStatusBuckets.Over(JobStatusSnapshots.Live))
            .GroupBy(bucket => bucket)
            .Select(g => new JobListBucketTally(g.Key, g.Count()))
            .TagWith("DespatchQry - Status Counts")
            .ToListAsync(cancellationToken);

        return JobListStatusCounts.FromBuckets(tallies);
    }

    private static IQueryable<TucJob> ApplyStatusFilter(IQueryable<TucJob> query, string statusFilter)
    {
        var completed = (int?)JobStatus.Completed;
        var dispatched = (int?)JobStatus.Dispatched;
        var accepted = (int?)JobStatus.Accepted;
        var pickedUp = (int?)JobStatus.PickedUp;
        var inTransit = (int?)JobStatus.InTransit;

        return statusFilter?.ToLower() switch
        {
            "needs-dispatch" => query.Where(j =>
                j.UcjbCourierId == null
                && j.UcjbStatus != completed
                && j.UcjbStatus != dispatched
                && j.UcjbStatus != accepted
                && j.UcjbStatus != pickedUp
                && j.UcjbStatus != inTransit),
            "in-progress" => query.Where(j =>
                j.UcjbStatus != completed),
            "delivered" => query.Where(j =>
                j.UcjbStatus == completed),
            _ => query // "all" or null — no filter
        };
    }

    private static IQueryable<TucJob> ApplySearchTextFilter(IQueryable<TucJob> query, string searchText)
    {
        if (string.IsNullOrWhiteSpace(searchText))
        {
            return query;
        }

        var search = searchText.Trim().ToLower();
        return query.Where(j =>
            EF.Functions.Like(j.UcjbNumber, $"%{search}%")
            || EF.Functions.Like(j.UcjbClient.UcclName, $"%{search}%")
            || EF.Functions.Like(j.UcjbStatusNavigation.UcjsName, $"%{search}%")
            || (j.UcjbCourier != null
                && (EF.Functions.Like(j.UcjbCourier.UccrName, $"%{search}%")
                    || EF.Functions.Like(j.UcjbCourier.UccrSurname, $"%{search}%")))
            || EF.Functions.Like(j.PickupFromContact, $"%{search}%")
            || EF.Functions.Like(j.DeliverToContact, $"%{search}%")
            || EF.Functions.Like(j.PickupAddressLine1, $"%{search}%")
            || EF.Functions.Like(j.PickupAddressLine2, $"%{search}%")
            || EF.Functions.Like(j.PickupAddressLine3, $"%{search}%")
            || EF.Functions.Like(j.PickupAddressLine4, $"%{search}%")
            || EF.Functions.Like(j.PickupAddressLine5, $"%{search}%")
            || EF.Functions.Like(j.PickupAddressLine6, $"%{search}%")
            || EF.Functions.Like(j.PickupAddressLine7, $"%{search}%")
            || EF.Functions.Like(j.PickupAddressLine8, $"%{search}%")
            || EF.Functions.Like(j.DeliveryAddressLine1, $"%{search}%")
            || EF.Functions.Like(j.DeliveryAddressLine2, $"%{search}%")
            || EF.Functions.Like(j.DeliveryAddressLine3, $"%{search}%")
            || EF.Functions.Like(j.DeliveryAddressLine4, $"%{search}%")
            || EF.Functions.Like(j.DeliveryAddressLine5, $"%{search}%")
            || EF.Functions.Like(j.DeliveryAddressLine6, $"%{search}%")
            || EF.Functions.Like(j.DeliveryAddressLine7, $"%{search}%")
            || EF.Functions.Like(j.DeliveryAddressLine8, $"%{search}%")
            || EF.Functions.Like(j.UcjbSpeedNavigation.ShortName, $"%{search}%")
            || EF.Functions.Like(j.Connote, $"%{search}%")
        );
    }

    private static IQueryable<TucJob> ApplyGeographicFilters(
        IQueryable<TucJob> query,
        ClearListEnvelopeViewModel clearListEnvelope,
        bool pickupOnlyFilter = false
    )
    {
        if (clearListEnvelope == null)
        {
            return query;
        }

        if (pickupOnlyFilter)
            // Filter by pickup location only (jobs FROM this area) - for needs-dispatch
        {
            return query.Where(j =>
                j.PickUpLatitude >= clearListEnvelope.MinimumLatitude
                && j.PickUpLatitude <= clearListEnvelope.MaximumLatitude
                && j.PickUpLongitude >= clearListEnvelope.MinimumLongitude
                && j.PickUpLongitude <= clearListEnvelope.MaximumLongitude
            );
        }

        // Filter by pickup OR delivery location (jobs FROM or TO this area) - for all other categories
        return query.Where(j =>
            // Either pickup is within the envelope
            (j.PickUpLatitude >= clearListEnvelope.MinimumLatitude
             && j.PickUpLatitude <= clearListEnvelope.MaximumLatitude
             && j.PickUpLongitude >= clearListEnvelope.MinimumLongitude
             && j.PickUpLongitude <= clearListEnvelope.MaximumLongitude)
            ||
            // Or delivery is within the envelope
            (j.DeliveryLatitude >= clearListEnvelope.MinimumLatitude
             && j.DeliveryLatitude <= clearListEnvelope.MaximumLatitude
             && j.DeliveryLongitude >= clearListEnvelope.MinimumLongitude
             && j.DeliveryLongitude <= clearListEnvelope.MaximumLongitude)
        );
    }

    private static IQueryable<TucJob> ApplyNationwideSpecificFilters(
        IQueryable<TucJob> query,
        JobQueryParams queryParams,
        bool isInternal,
        NationwideWidget windowPane,
        string clientIds
    )
    {
        // Filter dates
        if (queryParams.StartDate != null)
        {
            query = query.Where(JobDateOnOrAfter(queryParams.StartDate.Value));
        }

        if (queryParams.DateCutoff != null)
        {
            query = query.Where(JobDateOnOrBefore(queryParams.DateCutoff.Value));
        }

        query = ApplyEndDateFilter(query, queryParams.DateCutoff, queryParams.UseTime);

        // Apply window pane viewFilters
        query = windowPane switch
        {
            NationwideWidget.JobList => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.NewJobs
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
        query = query.Where(j => !j.UcjbComplTime.HasValue);

        // Apply client viewFilters for non-internal users
        if (isInternal || string.IsNullOrEmpty(clientIds))
        {
            return query;
        }

        var clientIdList = clientIds.Split(',')
            .Select(id => int.TryParse(id.Trim(), out var parsed) ? parsed : (int?)null)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .ToList();
        query = query.Where(j => clientIdList.Contains((int)j.UcjbClientId));

        return query;
    }

    private static IQueryable<TucJob> ApplyEndDateFilter(
        IQueryable<TucJob> query,
        DateTimeOffset? endDate,
        bool useTime)
    {
        if (!endDate.HasValue)
        {
            return query;
        }

        return useTime
            ? query.Where(JobDateTimeOnOrBefore(endDate.Value))
            : query.Where(JobDateOnOrBefore(endDate.Value));
    }

    /// <summary>
    /// Sargable equivalent of <c>j.UcjbDate.Date &gt;= date.Date</c>. Wrapping the column in
    /// <c>.Date</c> stops the optimiser seeking an index on UcjbDate, so the bound is normalised
    /// in C# and compared against the bare column instead.
    /// </summary>
    internal static Expression<Func<TucJob, bool>> JobDateOnOrAfter(DateTimeOffset date)
    {
        var startInclusive = date.Date;
        return j => j.UcjbDate >= startInclusive;
    }

    /// <summary>
    /// Sargable equivalent of <c>j.UcjbDate.Date &lt;= date.Date</c> (on or before the given
    /// calendar day), expressed as <c>UcjbDate &lt; nextMidnight</c> so an index can seek.
    /// </summary>
    internal static Expression<Func<TucJob, bool>> JobDateOnOrBefore(DateTimeOffset date)
    {
        var exclusiveEnd = date.Date.AddDays(1);
        return j => j.UcjbDate < exclusiveEnd;
    }

    /// <summary>
    /// A courier's "current work": not void, not done, not a Void-status job, and dated on or
    /// before <paramref name="asOf"/>'s calendar day (today + overdue past jobs; future excluded).
    /// Shared by the drivers-overview count and the drill-down list so the two never diverge.
    /// Sargable (bare <c>UcjbDate</c> column) so an index can seek and SQLite can translate it.
    /// </summary>
    internal static Expression<Func<TucJob, bool>> CurrentWorkJob(DateTimeOffset asOf)
    {
        var exclusiveEnd = asOf.Date.AddDays(1);
        return j => !j.UcjbVoid
                    && !j.UcjbJobDone
                    && j.UcjbStatus != (int)JobStatus.Void
                    && j.UcjbDate < exclusiveEnd;
    }

    /// <summary>
    /// The current-work drill-down list. Like <see cref="CurrentWorkJob"/> (the drivers-overview
    /// count) it excludes void jobs and caps the window at <paramref name="endDate"/>'s day, but it
    /// KEEPS done/completed jobs so the panel's client-side "Done" tab has data. Done jobs are bounded
    /// below by <paramref name="startDate"/> (the page's date filter) so the list does not return the
    /// courier's entire completion history; not-done jobs stay unbounded below so overdue work shows.
    /// Sargable (bare <c>UcjbDate</c> column) so an index can seek and SQLite can translate it.
    /// </summary>
    internal static Expression<Func<TucJob, bool>> CurrentWorkListJob(
        DateTimeOffset startDate, DateTimeOffset endDate)
    {
        var startInclusive = startDate.Date;
        var exclusiveEnd = endDate.Date.AddDays(1);
        return j => !j.UcjbVoid
                    && j.UcjbStatus != (int)JobStatus.Void
                    && j.UcjbDate < exclusiveEnd
                    && (!j.UcjbJobDone || j.UcjbDate >= startInclusive);
    }

    /// <summary>
    /// Sargable equivalent of the date-then-time end filter: jobs booked before the filter day, or
    /// on the filter day at or before the filter time. The UcjbDate comparisons avoid <c>.Date</c>
    /// so the index range can seek; the intraday time check on the separate UcjbTime column only
    /// applies within the single matching day.
    /// </summary>
    internal static Expression<Func<TucJob, bool>> JobDateTimeOnOrBefore(DateTimeOffset endDate)
    {
        var filterDate = endDate.Date;
        var nextDay = filterDate.AddDays(1);
        var filterTime = endDate.TimeOfDay;

        return j =>
            j.UcjbDate < filterDate
            || (j.UcjbDate >= filterDate
                && j.UcjbDate < nextDay
                && (!j.UcjbTime.HasValue || j.UcjbTime.Value.TimeOfDay <= filterTime));
    }

    private const int DefaultNonPaginatedJobCap = 2000;

    internal readonly record struct PagedJobIds(IReadOnlyList<int> JobIds, int TotalCount, bool HasMore);

    /// <summary>
    /// Resolves the distinct job IDs for the requested page. When <paramref name="requestedPage"/>
    /// is not positive the caller did not ask for a specific page, so the result is bounded by
    /// <paramref name="nonPaginatedCap"/> to avoid materialising an unbounded view; a warning is
    /// logged (and <see cref="PagedJobIds.HasMore"/> set) when the cap truncates the result.
    /// </summary>
    internal static async Task<PagedJobIds> ResolveJobIdPageAsync(
        IQueryable<int> distinctJobIdQuery,
        int requestedPage,
        int pageSize,
        int nonPaginatedCap = DefaultNonPaginatedJobCap,
        CancellationToken cancellationToken = default)
    {
        var totalCount = await distinctJobIdQuery.CountAsync(cancellationToken);

        if (requestedPage > 0)
        {
            var pageIds = await distinctJobIdQuery
                .OrderBy(id => id)
                .Skip((requestedPage - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PagedJobIds(pageIds, totalCount, totalCount > requestedPage * pageSize);
        }

        var cappedIds = await distinctJobIdQuery
            .OrderBy(id => id)
            .Take(nonPaginatedCap)
            .ToListAsync(cancellationToken);

        var capped = totalCount > nonPaginatedCap;
        if (capped)
        {
            Log.Warning(
                "DespatchQry returned {Returned} of {Total} jobs without pagination; capped at {Cap}. " +
                "The caller should request paged results",
                cappedIds.Count, totalCount, nonPaginatedCap);
        }

        return new PagedJobIds(cappedIds, totalCount, capped);
    }

    protected async Task<IReadOnlyList<JobCoordinateModel>> GetJobCoordinatesAsync(IReadOnlyList<int> selectedViewIds,
        CancellationToken cancellationToken = default)
    {
        const int maxMapCoordinates = 5000;

        try
        {
            var isUsCustomer = infoService.IsUsTenant();
            var jobIdsQuery = await GetFilteredJobIdsQueryAsync(selectedViewIds, isUsCustomer);

            var jobCoordinates = await (
                    from job in Context.TucJobs
                    join id in jobIdsQuery on job.UcjbId equals id
                    where job.UcjbStatus != (int)JobStatus.AwaitingPod
                    select new JobCoordinateModel
                    {
                        Id = job.UcjbId,
                        JobNo = job.UcjbNumber,
                        PickupLatitude = job.PickUpLatitude,
                        PickupLongitude = job.PickUpLongitude,
                        DeliveryLatitude = job.DeliveryLatitude,
                        DeliveryLongitude = job.DeliveryLongitude,
                        StatusId = job.UcjbStatus,
                        StatusName = job.UcjbStatusNavigation.UcjsName,
                        ClientId = job.UcjbClientId ?? 0,
                        ClientName = job.UcjbClient.UcclName,
                        Speed = job.UcjbSpeedNavigation.ShortName,
                        FromAddress = job.UcjbFromAddr,
                        ToAddress = job.UcjbToAddr
                    })
                .Take(maxMapCoordinates)
                .ToListAsync(cancellationToken);

            return jobCoordinates;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository),
                    nameof(GetJobCoordinatesAsync)));
            throw;
        }
    }

    protected async Task SaveMultipleBulkNotesAsync(IReadOnlyList<int> bulkJobIds, string noteText,
        bool isImportant = false,
        NoteType noteType = NoteType.InternalNote)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

        // If a note type is not found, default to the internal note
        var noteTypeExists = await Context.ConfirmNoteTypeExistsAsync(noteType);
        if (!noteTypeExists)
        {
            noteType = NoteType.InternalNote;
        }

        var staffId = infoService.GetStaffId();
        var currentTime = clock.TenantNow;

        var newNotes = bulkJobIds.Select(bulkJobId => new TblBulkJobNote
            {
                BulkJobId = bulkJobId, IsImportant = isImportant, NoteText = noteText, NoteTypeId = (int)noteType,
                CreatedBy = staffId, CreatedDate = currentTime
            })
            .ToList();

        await Context.TblBulkJobNotes.AddRangeAsync(newNotes);
        await Context.SaveChangesAsync();
    }

    private async Task<NoteType> ConfirmNoteTypeExists(NoteType noteType)
    {
        // If a note type is not found, default to the internal note
        var noteTypeExists = await Context.ConfirmNoteTypeExistsAsync(noteType);
        if (!noteTypeExists)
        {
            noteType = NoteType.InternalNote;
        }

        return noteType;
    }

    /// <summary>
    /// Adds notes to the context for multiple jobs. Does NOT call SaveChangesAsync — the caller must save.
    /// </summary>
    protected async Task SaveNoteToMultipleJobsAsync(IReadOnlyList<int> jobIds, string noteText,
        bool isImportant = false,
        bool isRecurringJobs = false, NoteType noteType = NoteType.InternalNote)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

        // If a note type is not found, default to the internal note
        noteType = await ConfirmNoteTypeExists(noteType);

        var now = clock.TenantNow;
        var nowUtc = clock.UtcNow;
        var staffId = infoService.GetStaffId();

        var newNotes = jobIds.Select(jobId => new TucNote
            {
                JobId = isRecurringJobs ? null : jobId,
                JobBookingId = isRecurringJobs ? jobId : null,
                NoteText = noteText,
                IsImportant = isImportant,
                NoteTypeId = (int)noteType,
                CreatedDate = now,
                CreatedDateUtc = nowUtc,
                CreatedBy = staffId,
                UpdatedBy = staffId,
                UpdatedDate = now,
                UpdatedDateUtc = nowUtc
            })
            .ToList();

        await Context.TucNotes.AddRangeAsync(newNotes);
    }

    /// <summary>
    /// Adds notes to the context for multiple archived jobs. Does NOT call SaveChangesAsync — the caller must save.
    /// </summary>
    protected async Task SaveNoteToMultipleArchivedJobsAsync(
        IReadOnlyList<int> jobIds,
        string noteText,
        bool isImportant = false,
        NoteType noteType = NoteType.InternalNote)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

        // If a note type is not found, default to the internal note
        noteType = await ConfirmNoteTypeExists(noteType);

        var now = clock.TenantNow;
        var nowUtc = clock.UtcNow;
        var staffId = infoService.GetStaffId();

        var newNotes = jobIds.Select(jobId => new TucNoteArchive
            {
                JobId = jobId,
                NoteText = noteText,
                IsImportant = isImportant,
                NoteTypeId = (int)noteType,
                CreatedDate = now,
                CreatedDateUtc = nowUtc,
                CreatedBy = staffId,
                UpdatedBy = staffId,
                UpdatedDate = now,
                UpdatedDateUtc = nowUtc
            })
            .ToList();

        await Context.TucNoteArchives.AddRangeAsync(newNotes);
    }

    protected async Task SaveNoteAsync(int jobId, string noteText, bool isImportant = false,
        bool isRecurringJob = false, NoteType noteType = NoteType.InternalNote, bool saveChanges = true)
    {
        try
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(noteText);

            // If a note type is not found, default to the internal note
            noteType = await ConfirmNoteTypeExists(noteType);

            var now = clock.TenantNow;
            var nowUtc = clock.UtcNow;
            var staffId = infoService.GetStaffId();

            var newNote = new TucNote
            {
                JobId = isRecurringJob ? null : jobId,
                JobBookingId = isRecurringJob ? jobId : null,
                NoteText = noteText,
                IsImportant = isImportant,
                NoteTypeId = (int)noteType,
                CreatedDate = now,
                CreatedDateUtc = nowUtc,
                CreatedBy = staffId,
                UpdatedBy = staffId,
                UpdatedDate = now,
                UpdatedDateUtc = nowUtc
            };

            await Context.TucNotes.AddAsync(newNote);

            if (!saveChanges)
            {
                return;
            }

            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository), nameof(SaveNoteAsync)));
            throw;
        }
    }

    /// <summary>
    /// Builds the per-package cubic CSV (matching the api repo's @CubicList convention used by
    /// DD_stpJob_InsertExcelerator) from tucJobItems (or tucJobItemsArchive for an archived job)
    /// for an existing job, expanding each row by its Items count. Returns null when the job has
    /// no per-package cubic data.
    /// </summary>
    protected async Task<string> GetCubicListAsync(int jobId)
    {
        var isArchived = await IsJobArchived(jobId);

        var items = isArchived
            ? await Context.TucJobItemsArchives
                .Where(i => i.JobId == jobId && i.Cubic != null)
                .Select(i => new { i.Items, i.Cubic })
                .ToListAsync()
            : await Context.TucJobItems
                .Where(i => i.JobId == jobId && i.Cubic != null)
                .Select(i => new { i.Items, i.Cubic })
                .ToListAsync();

        if (items.Count == 0)
        {
            return null;
        }

        var cubicValues = new List<string>();
        foreach (var item in items)
        {
            for (var unit = 0; unit < item.Items; unit++)
            {
                cubicValues.Add(item.Cubic?.ToString(CultureInfo.InvariantCulture));
            }
        }

        return string.Join(",", cubicValues);
    }

    // Helper Methods
    protected async Task<bool> IsJobArchived(int jobId) => await Context.IsJobArchivedAsync(jobId);

    protected static string GetTrackingName(int trackingMethodId) =>
        trackingMethodId switch
        {
            1 => "Email",
            2 => "Mobile",
            3 => "Email & Mobile",
            _ => string.Empty
        };

    protected static double? CalculateRemainTime(DispatchJobViewModel job, DateTime currentTenantTime,
        int? economySpeedId, DateTime? ecoDeliveryTime)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(job);
            if (!job.Booked.HasValue)
            {
                throw new ArgumentException("Booked date is required.", nameof(job));
            }

            var jobDateTime = job.Booked.Value;

            if (job.SpeedId == economySpeedId)
            {
                if (!ecoDeliveryTime.HasValue)
                {
                    throw new ArgumentNullException(nameof(ecoDeliveryTime));
                }

                var targetDateTime = new DateTime(
                    job.Booked.Value.Year,
                    job.Booked.Value.Month,
                    job.Booked.Value.Day,
                    ecoDeliveryTime.Value.Hour,
                    ecoDeliveryTime.Value.Minute,
                    ecoDeliveryTime.Value.Second
                );

                return Math.Round((targetDateTime - currentTenantTime).TotalMinutes, MidpointRounding.AwayFromZero);
            }

            if (!job.JobTypeMins.HasValue)
            {
                return null;
            }

            var minutesToAdd = job.JobTypeMins.Value;
            var standardDeliveryDateTime = jobDateTime.AddMinutes(minutesToAdd);
            return Math.Round((standardDeliveryDateTime - currentTenantTime).TotalMinutes, MidpointRounding.AwayFromZero);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository),
                    nameof(CalculateRemainTime)));
            throw;
        }
    }

    protected async Task<int> CreateNewRecurringJobNote(int jobId, string noteText, bool isImportant,
        NoteType noteType = NoteType.InternalNote)
    {
        try
        {
            // Always create a note on the parent job (or self if no parent)
            var effectiveJobId = await Context.GetEffectiveJobBookingIdAsync(jobId);

            noteType = await ConfirmNoteTypeExists(noteType);
            var newNote = new TucNote
            {
                JobBookingId = effectiveJobId,
                NoteText = noteText,
                IsImportant = isImportant,
                NoteTypeId = (int)noteType,
                CreatedBy = infoService.GetStaffId(),
                CreatedDate = clock.TenantNow,
                CreatedDateUtc = clock.UtcNow
            };
            await Context.AddAsync(newNote);
            await Context.SaveChangesAsync();

            return newNote.NoteId;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(RecurringJobRepository),
                    nameof(CreateNewRecurringJobNote)));
            throw;
        }
    }

    protected async Task UpdateRecurringJobNote(int noteId, string noteText, bool isImportant,
        NoteType noteType = NoteType.InternalNote)
    {
        try
        {
            var staffId = infoService.GetStaffId();
            var currentTime = clock.TenantNow;
            var currentTimeUtc = clock.UtcNow;

            var strategy = Context.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await Context.Database.BeginTransactionAsync();

                // Fetch current state for history before updating
                var currentNote = await Context.TucNotes
                    .Where(c => c.NoteId == noteId)
                    .Select(c => new { c.NoteText, c.NoteTypeId, c.IsImportant })
                    .FirstOrDefaultAsync();

                var rowsAffected = await Context.TucNotes
                    .Where(c => c.NoteId == noteId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(e => e.NoteText, noteText)
                        .SetProperty(e => e.NoteTypeId, (int)noteType)
                        .SetProperty(e => e.IsImportant, isImportant)
                        .SetProperty(e => e.UpdatedBy, staffId)
                        .SetProperty(e => e.UpdatedDate, currentTime)
                        .SetProperty(e => e.UpdatedDateUtc, currentTimeUtc)
                    );

                if (rowsAffected == 0)
                {
                    throw new Exception($"Existing note under {noteId} not found");
                }

                if (currentNote != null)
                {
                    var history = new TucNoteHistory
                    {
                        NoteId = noteId,
                        EditedBy = staffId,
                        EditedAtUtc = DateTime.UtcNow,
                        OldNoteText = currentNote.NoteText,
                        NewNoteText = noteText,
                        OldNoteTypeId = currentNote.NoteTypeId,
                        NewNoteTypeId = (int)noteType,
                        OldIsImportant = currentNote.IsImportant,
                        NewIsImportant = isImportant
                    };
                    await Context.TucNoteHistories.AddAsync(history);
                    await Context.SaveChangesAsync();
                }

                await transaction.CommitAsync();
            });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(RecurringJobRepository),
                    nameof(UpdateRecurringJobNote)));
            throw;
        }
    }

    protected async Task<(int? economySpeedId, DateTime? ecoDeliveryTime)> GetEconomySpeedAndDeliveryTimeAsync()
    {
        if (_economyCache.HasValue)
        {
            return _economyCache.Value;
        }

        var economySpeedId = await Context.GetEconomySpeedIdAsync();
        var ecoDeliveryTime = await Context.GetEcoDeliveryTimeAsync();

        _economyCache = (economySpeedId, ecoDeliveryTime);
        return _economyCache.Value;
    }

    protected static void UpdateNoteDate(List<TucNoteViewModel> notes, string tenantTimeZone)
    {
        foreach (var note in notes)
        {
            UpdateNoteDate(note, tenantTimeZone);
        }
    }

    private static void UpdateNoteDate(TucNoteViewModel note, string tenantTimeZone)
    {
        note.CreatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(note.CreatedDate, tenantTimeZone);
        if (note.UpdatedDate.HasValue)
        {
            note.UpdatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(note.UpdatedDate.Value, tenantTimeZone);
        }
    }

    protected async Task<IReadOnlyList<MultiSuggestion>> GetRelatedJobsMultiSelectListAsync(int jobId, bool isArchived,
        bool isBulkJob = false)
    {
        if (isBulkJob)
        {
            // Get parent bulk job ID (self if parented, or BulkParentId if child)
            var parentBulkJobId = await Context.TblBulkJobs
                .Where(j => j.BulkJobId == jobId)
                .Select(j => j.BulkParentId ?? j.BulkJobId)
                .FirstOrDefaultAsync();

            if (parentBulkJobId == 0)
            {
                return [];
            }

            return await Context.TblBulkJobs
                .Where(j => j.BulkJobId == parentBulkJobId || j.BulkParentId == parentBulkJobId)
                .Select(j => new MultiSuggestion
                {
                    Id = j.BulkJobId,
                    Text = j.JobNumber,
                    Selected = j.BulkJobId == jobId,
                    IsBulkJob = true
                })
                .TagWith($"GetRelatedJobs - Bulk Family for Job {jobId}")
                .ToListAsync();
        }

        if (isArchived)
        {
            // First, get the parent ID for this job (if it has one)
            var effectiveArchiveJobId = await Context.GetEffectiveArchiveJobIdAsync(jobId);

            var archivedData = await Context.TucJobArchives
                .Where(j => j.UcjbId == effectiveArchiveJobId || j.ParentId == effectiveArchiveJobId)
                .Select(j => new MultiSuggestion
                {
                    Id = j.UcjbId,
                    Text = j.UcjbNumber,
                    Selected = j.UcjbId == jobId,
                    IsArchived = true
                })
                .TagWith($"GetRelatedJobs - Archived Family for Job {jobId}")
                .ToListAsync();

            return archivedData;
        }

        // Live job from TucJob
        var effectiveLiveJobId = await Context.GetEffectiveJobIdAsync(jobId);

        var liveData = await Context.TucJobs
            .Where(j => j.UcjbId == effectiveLiveJobId || j.ParentId == effectiveLiveJobId)
            .Select(j => new MultiSuggestion
            {
                Id = j.UcjbId,
                Text = j.UcjbNumber,
                Selected = j.UcjbId == jobId
            })
            .TagWith($"GetRelatedJobs - Live Family {effectiveLiveJobId}")
            .ToListAsync();

        return liveData;
    }

    protected async Task<int?> GetJobParentIdAsync(int jobId) =>
        await Context.GetJobParentIdAsync(jobId);

    /// <summary>
    /// Gets current amounts for a list of jobs for bulk price preview/comparison.
    /// </summary>
    protected async Task<Dictionary<int, JobCurrentAmountInfo>> GetJobCurrentAmountsAsync(IReadOnlyList<int> jobIds)
    {
        // Check live jobs
        var liveJobs = await Context.TucJobs
            .Where(j => jobIds.Contains(j.UcjbId))
            .Select(j => new JobCurrentAmountInfo
            {
                JobId = j.UcjbId,
                JobNo = j.UcjbNumber,
                Amount = j.UcjbAmount ?? 0,
                RawBaseAmount = j.RawBaseAmount ?? 0,
                Fuel = j.FuelSurchargeAmount,
                Ppd = j.Ppdamount ?? 0,
                CourierPayment = j.CourierPayment ?? 0,
                CourierFuel = j.CourierFuel ?? 0,
                CourierBonus = j.CourierBonus ?? 0,
                IsPrebook = false,
                RatedManually = j.RatedManually
            })
            .ToListAsync();

        return liveJobs.ToDictionary(j => j.JobId);
    }
}