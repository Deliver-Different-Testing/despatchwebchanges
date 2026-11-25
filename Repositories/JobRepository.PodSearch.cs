using System.Diagnostics;
using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Serilog;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    private const int PodSearchDefaultPageSize = 50;
    private const int PodSearchMaxPageSize = 200;

    /// <summary>A wildcard search lists at most this many matches; beyond it the header shows "N+".</summary>
    internal const int WildcardMatchCap = 1000;

    /// <summary>Shorter terms match too much of the table to be worth scanning for.</summary>
    internal const int WildcardMinLength = 3;

    /// <summary>
    /// Under the 30s default, so a search that cannot finish answers "too broad" rather than an error.
    /// </summary>
    private const int WildcardCommandTimeoutSeconds = 20;

    /// <summary>A date-less count of out-of-window job-number matches stops at this.</summary>
    internal const int OutsideWindowCountCap = 50;

    /// <summary>
    /// Searches both live and archived jobs with filtering, sorting and pagination.
    /// </summary>
    /// <remarks>
    /// The live and archived matches are unioned as a narrow key shape so the database owns the
    /// whole ORDER BY / OFFSET / FETCH. Only the ids on the requested page are then hydrated through
    /// the full projections. Taking a slice from each source before merging — as this used to —
    /// capped the reachable rows at pageSize * 3 per source while the total counted every match, so
    /// a search could report far more jobs than the grid could ever page to.
    /// <para>
    /// A job-number search resolves in tiers: an exact number (any date), then numbers starting with
    /// the term (inside the date window), and only when both find nothing the original "contains"
    /// match, which cannot use an index. A wildcard search evaluates its predicate once, capped at
    /// <see cref="WildcardMatchCap"/> keys, and answers "too broad" instead of timing out.
    /// </para>
    /// </remarks>
    /// <param name="data">Search parameters including date range, filters, sorting, and pagination.</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Paginated search results combining live and archived jobs.</returns>
    public async Task<JobSearchResult> PodSearchAsync(PodSearchRequest data,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var searchKind = data.JobIdSet ? "jobId" : data.WildSet ? "wild" : data.JobSet ? "job" : "filters";
        try
        {
            var result = data.WildSet && !data.JobIdSet
                ? await WildcardPodSearchAsync(data, cancellationToken)
                : await PagedPodSearchAsync(data, cancellationToken);

            Log.Information(
                "PodSearch {SearchKind} ({MatchMode}) page {Page} returned {RowCount} of {TotalCount} in {ElapsedMs}ms",
                searchKind, result.MatchMode ?? "-", data.Page ?? 0, result.Jobs?.Count ?? 0, result.TotalCount,
                stopwatch.ElapsedMilliseconds);
            return result;
        }
        catch (Exception e) when (!cancellationToken.IsCancellationRequested)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(PodSearchAsync)));
            throw;
        }
    }

    private async Task<JobSearchResult> PagedPodSearchAsync(PodSearchRequest data,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(data.Page ?? 0, 0);
        var pageSize = Math.Clamp(data.PageSize ?? PodSearchDefaultPageSize, 1, PodSearchMaxPageSize);
        var sortColumn = data.SortColumn?.ToLowerInvariant();
        var sortDescending = string.Equals(data.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);

        await using var countContext = await _contextFactory.CreateDbContextAsync(cancellationToken);
        await using var pageContext = await _contextFactory.CreateDbContextAsync(cancellationToken);

        var jobMatch = data.JobSet && !data.JobIdSet && !data.ForceContains
            ? await ResolveJobNumberMatchAsync(countContext, data, cancellationToken)
            : JobNumberMatch.Contains;

        var (countLive, countArchived) = BuildPodSearchQueries(countContext, data, jobMatch);
        var (pageLive, pageArchived) = BuildPodSearchQueries(pageContext, data, jobMatch);

        // One statement across both sources, so live and archive cannot drift against each other
        // the way two independently-executed counts could. The first page also carries the stats
        // header's buckets, so the header describes every match rather than the rows loaded so far.
        var buckets = countLive.Select(JobListStatusBuckets.Over(JobStatusSnapshots.Live))
            .Concat(countArchived.Select(JobListStatusBuckets.Over(JobStatusSnapshots.Archived)));

        var bucketTalliesTask = page == 0
            ? buckets
                .GroupBy(bucket => bucket)
                .Select(g => new JobListBucketTally(g.Key, g.Count()))
                .TagWith("PodSearch - Status Counts")
                .ToListAsync(cancellationToken)
            : Task.FromResult(new List<JobListBucketTally>());

        var countTask = page == 0
            ? Task.FromResult(0)
            : countLive.Select(j => j.UcjbId)
                .Concat(countArchived.Select(j => j.UcjbId))
                .TagWith("PodSearch - Total Count")
                .CountAsync(cancellationToken);

        var pageKeysTask = ApplyPodSearchSorting(
                pageLive.Select(LiveSortKey).Concat(pageArchived.Select(ArchivedSortKey)),
                sortColumn,
                sortDescending)
            .Skip(page * pageSize)
            .Take(pageSize)
            .TagWith("PodSearch - Page Keys")
            .ToListAsync(cancellationToken);

        await Task.WhenAll(countTask, bucketTalliesTask, pageKeysTask);

        var statusCounts = page == 0
            ? JobListStatusCounts.FromBuckets(await bucketTalliesTask)
            : null;
        var totalCount = statusCounts?.Total ?? await countTask;
        var pageKeys = await pageKeysTask;
        var matchMode = data.JobSet && !data.JobIdSet ? JobNumberMatchName(jobMatch) : null;

        if (pageKeys.Count == 0)
        {
            // Nothing in the window: say whether the number exists on other dates, so an empty grid
            // is not mistaken for "no such job".
            var outside = data.JobSet && !data.JobIdSet && totalCount == 0
                ? await FindJobNumberOutsideWindowAsync(countContext, data, cancellationToken)
                : null;

            return new JobSearchResult
            {
                Jobs = [],
                TotalCount = totalCount,
                HasMore = false,
                StatusCounts = statusCounts,
                MatchMode = matchMode,
                OutsideWindowCount = outside?.Count,
                OutsideWindowFrom = outside?.From,
                OutsideWindowTo = outside?.To
            };
        }

        var allJobs = await HydrateAndFinishPageAsync(pageKeys, pageContext, countContext, data,
            flagOutsideWindow: jobMatch == JobNumberMatch.Exact, cancellationToken);

        return new JobSearchResult
        {
            Jobs = allJobs,
            TotalCount = totalCount,
            // Driven by the page itself rather than the separately-executed count, so a count
            // that shifted mid-scroll can never cut paging short.
            HasMore = pageKeys.Count == pageSize,
            StatusCounts = statusCounts,
            MatchMode = matchMode
        };
    }

    /// <summary>
    /// A wildcard search scans every row in the window across ~60 text columns, so its predicate runs
    /// once: the capped, ordered key list answers the page, the total and the stats header together.
    /// </summary>
    private async Task<JobSearchResult> WildcardPodSearchAsync(PodSearchRequest data,
        CancellationToken cancellationToken)
    {
        if (data.Wild.Trim().Length < WildcardMinLength)
        {
            return new JobSearchResult { Jobs = [], SearchTooBroad = true };
        }

        var page = Math.Max(data.Page ?? 0, 0);
        var pageSize = Math.Clamp(data.PageSize ?? PodSearchDefaultPageSize, 1, PodSearchMaxPageSize);
        var sortColumn = data.SortColumn?.ToLowerInvariant();
        var sortDescending = string.Equals(data.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);

        // The shortened timeout is for the key scan alone; hydrating the page by id runs on contexts
        // with the normal timeout, so a slow hydration is not mistaken for a too-broad search.
        await using var keyContext = await _contextFactory.CreateDbContextAsync(cancellationToken);
        await using var liveContext = await _contextFactory.CreateDbContextAsync(cancellationToken);
        await using var archivedContext = await _contextFactory.CreateDbContextAsync(cancellationToken);
        keyContext.Database.SetCommandTimeout(WildcardCommandTimeoutSeconds);

        var (live, archived) = BuildPodSearchQueries(keyContext, data, JobNumberMatch.Contains);

        List<PodSearchSortKey> keys;
        try
        {
            keys = await ApplyPodSearchSorting(
                    live.Select(LiveSortKeyWithBucket).Concat(archived.Select(ArchivedSortKeyWithBucket)),
                    sortColumn,
                    sortDescending)
                .Take(WildcardMatchCap + 1)
                .TagWith("PodSearch - Wildcard Keys")
                .ToListAsync(cancellationToken);
        }
        catch (Exception e) when (IsCommandTimeout(e) && !cancellationToken.IsCancellationRequested)
        {
            Log.Warning("PodSearch wildcard timed out after {TimeoutSeconds}s for a {TermLength}-character term over {Days} days",
                WildcardCommandTimeoutSeconds, data.Wild.Trim().Length, (data.ToDate.Date - data.FromDate.Date).Days + 1);
            return new JobSearchResult { Jobs = [], SearchTooBroad = true };
        }

        var capped = keys.Count > WildcardMatchCap;
        if (capped)
        {
            keys.RemoveAt(keys.Count - 1);
        }

        var statusCounts = page == 0
            ? JobListStatusCounts.FromBuckets(keys
                .GroupBy(k => k.Bucket)
                .Select(g => new JobListBucketTally(g.Key, g.Count()))
                .ToList())
            : null;

        var pageKeys = keys.Skip(page * pageSize).Take(pageSize).ToList();
        var allJobs = pageKeys.Count == 0
            ? []
            : await HydrateAndFinishPageAsync(pageKeys, liveContext, archivedContext, data,
                flagOutsideWindow: false, cancellationToken);

        return new JobSearchResult
        {
            Jobs = allJobs,
            TotalCount = keys.Count,
            TotalIsCapped = capped,
            HasMore = (page + 1) * pageSize < keys.Count,
            StatusCounts = statusCounts
        };
    }

    /// <summary>
    /// A SQL command timeout, bare or wrapped by the retrying execution strategy once it gives up.
    /// </summary>
    internal static bool IsCommandTimeout(Exception exception) => exception switch
    {
        SqlException { Number: -2 } => true,
        RetryLimitExceededException { InnerException: { } inner } => IsCommandTimeout(inner),
        _ => false
    };

    private async Task<List<DispatchJobViewModel>> HydrateAndFinishPageAsync(
        IReadOnlyList<PodSearchSortKey> pageKeys,
        DespatchContext liveContext,
        DespatchContext archivedContext,
        PodSearchRequest data,
        bool flagOutsideWindow,
        CancellationToken cancellationToken)
    {
        var allJobs = await HydratePodSearchPageAsync(
            pageKeys, liveContext, archivedContext, _infoService.IsUsTenant(), cancellationToken);

        var outsideWindow = flagOutsideWindow
            ? pageKeys
                .Where(k => k.Date is not { } date
                            || date < data.FromDate.Date
                            || date >= data.ToDate.Date.AddDays(1))
                .Select(k => (k.JobId, k.IsArchived))
                .ToHashSet()
            : [];

        var now = _clock.TenantNow;
        var (economySpeedId, ecoDeliveryTime) = await GetEconomySpeedAndDeliveryTimeAsync();

        foreach (var job in allJobs)
        {
            job.AngularId = Guid.NewGuid();
            job.Remain = CalculateRemainTime(job, now, economySpeedId, ecoDeliveryTime);
            job.OutsideDateRange = outsideWindow.Contains((job.Id, job.IsArchived));
        }

        return allJobs;
    }

    /// <summary>
    /// Picks the cheapest job-number match that finds anything. A job with exactly this number, on any
    /// date, selects <see cref="JobNumberMatch.Exact"/>; otherwise anything starting with the term inside
    /// the window selects <see cref="JobNumberMatch.Prefix"/>. Both probes are ucjbNumber index seeks;
    /// only when both are empty does the search fall back to the "contains" scan.
    /// </summary>
    private static async Task<JobNumberMatch> ResolveJobNumberMatchAsync(DespatchContext context,
        PodSearchRequest data, CancellationToken cancellationToken)
    {
        var term = data.Job.Trim();
        var (live, archived) = FilteredJobSources(context, data);
        if (await live.Where(j => j.UcjbNumber == term).Select(j => j.UcjbId)
                .Concat(archived.Where(j => j.UcjbNumber == term).Select(j => j.UcjbId))
                .TagWith("PodSearch - Exact Job Number Probe")
                .AnyAsync(cancellationToken))
        {
            return JobNumberMatch.Exact;
        }

        var (prefixLive, prefixArchived) = BuildPodSearchQueries(context, data, JobNumberMatch.Prefix);
        return await prefixLive.Select(j => j.UcjbId)
            .Concat(prefixArchived.Select(j => j.UcjbId))
            .TagWith("PodSearch - Prefix Job Number Probe")
            .AnyAsync(cancellationToken)
            ? JobNumberMatch.Prefix
            : JobNumberMatch.Contains;
    }

    /// <summary>
    /// Jobs starting with the term on any date, under the same client, courier and speed filters, up to
    /// one past the cap. Only called when nothing matched inside the window, so every one of them lies
    /// outside it. The date span is reported only for a complete (uncapped) set, so widening to it is
    /// guaranteed to find them all.
    /// </summary>
    private static async Task<OutsideWindowMatches> FindJobNumberOutsideWindowAsync(DespatchContext context,
        PodSearchRequest data, CancellationToken cancellationToken)
    {
        var term = data.Job.Trim();
        var (live, archived) = FilteredJobSources(context, data);
        var dates = await live.Where(j => j.UcjbNumber.StartsWith(term)).Select(j => (DateTime?)j.UcjbDate)
            .Concat(ExcludeLiveDuplicates(archived.Where(j => j.UcjbNumber.StartsWith(term)), context.TucJobs)
                .Select(j => j.UcjbDate))
            .Take(OutsideWindowCountCap + 1)
            .TagWith("PodSearch - Outside Window Matches")
            .ToListAsync(cancellationToken);

        var known = dates.Where(d => d.HasValue).Select(d => d!.Value.Date).ToList();
        var complete = dates.Count <= OutsideWindowCountCap && known.Count > 0;
        return new OutsideWindowMatches(
            dates.Count,
            complete ? known.Min() : null,
            complete ? known.Max() : null);
    }

    private sealed record OutsideWindowMatches(int Count, DateTime? From, DateTime? To);

    private static string JobNumberMatchName(JobNumberMatch match) => match switch
    {
        JobNumberMatch.Exact => "exact",
        JobNumberMatch.Prefix => "prefix",
        _ => "contains"
    };

    /// <summary>
    /// Builds the filtered live and archived queries for a POD search against one context, with
    /// archived duplicates of live jobs already excluded.
    /// </summary>
    /// <param name="context">Context both queries are built against, so the duplicate exclusion
    /// stays a single NOT EXISTS.</param>
    /// <param name="data">Search parameters.</param>
    /// <param name="jobMatch">How the job-number term matches. An exact match brings in the named job
    /// on any date — the user named one job — alongside the in-window jobs whose numbers start with the
    /// term, so an old job with the exact number never hides today's. Client, courier and speed filters
    /// apply throughout.</param>
    private static (IQueryable<TucJob> Live, IQueryable<TucJobArchive> Archived) BuildPodSearchQueries(
        DespatchContext context, PodSearchRequest data, JobNumberMatch jobMatch = JobNumberMatch.Contains)
    {
        IQueryable<TucJob> live;
        IQueryable<TucJobArchive> archived;

        if (data.JobIdSet)
        {
            // A job-id search ignores every other filter
            live = context.TucJobs.Where(j => j.UcjbId == data.JobId);
            archived = context.TucJobArchives.Where(j => j.UcjbId == data.JobId);
            return (live, ExcludeLiveDuplicates(archived, context.TucJobs));
        }

        var term = (data.Job ?? string.Empty).Trim();
        var exact = data.JobSet && jobMatch == JobNumberMatch.Exact;
        var prefix = data.JobSet && jobMatch == JobNumberMatch.Prefix;
        var contains = data.JobSet && jobMatch == JobNumberMatch.Contains;
        var fromDate = data.FromDate.Date;
        // Half-open on the raw column: CONVERT(date, ucjbDate) on the left-hand side is not
        // SARGable, so no index on ucjbDate can ever seek. Both bounds are already truncated.
        var toExclusive = data.ToDate.Date.AddDays(1);
        var containsPattern = $"%{term}%";

        (live, archived) = FilteredJobSources(context, data);

        if (!exact)
        {
            live = live.Where(j => j.UcjbDate >= fromDate && j.UcjbDate < toExclusive);
            archived = archived.Where(j =>
                j.UcjbDate.HasValue && j.UcjbDate.Value >= fromDate && j.UcjbDate.Value < toExclusive);
        }

        // Each match kind is added as its own Where rather than folded into one expression with
        // flags, so the SQL carries only the predicate in play and the seekable ones stay seekable.
        // The exact form still leads with StartsWith, so it seeks the same ucjbNumber range.
        if (exact)
        {
            live = live.Where(j => j.UcjbNumber.StartsWith(term)
                                   && (j.UcjbNumber == term || (j.UcjbDate >= fromDate && j.UcjbDate < toExclusive)));
            archived = archived.Where(j => j.UcjbNumber.StartsWith(term)
                                           && (j.UcjbNumber == term
                                               || (j.UcjbDate.HasValue && j.UcjbDate.Value >= fromDate
                                                                       && j.UcjbDate.Value < toExclusive)));
        }
        else if (prefix)
        {
            live = live.Where(j => j.UcjbNumber.StartsWith(term));
            archived = archived.Where(j => j.UcjbNumber.StartsWith(term));
        }
        else if (contains)
        {
            live = live.Where(j => EF.Functions.Like(j.UcjbNumber, containsPattern));
            archived = archived.Where(j => EF.Functions.Like(j.UcjbNumber, containsPattern));
        }

        if (data.WildSet)
        {
            var wildSearch = $"%{data.Wild ?? string.Empty}%";
            live = live.Where(JobWildcardSearch.LiveJobMatches(wildSearch));
            archived = archived.Where(JobWildcardSearch.ArchivedJobMatches(wildSearch));
        }

        return (live, ExcludeLiveDuplicates(archived, context.TucJobs));
    }

    /// <summary>Both job sources under the client, courier and speed filters only.</summary>
    private static (IQueryable<TucJob> Live, IQueryable<TucJobArchive> Archived) FilteredJobSources(
        DespatchContext context, PodSearchRequest data) =>
    (
        context.TucJobs.Where(j =>
            (!data.ClientSet || (j.UcjbClientId.HasValue && data.ClientIds.Contains(j.UcjbClientId.Value)))
            && (!data.CourierSet || (j.UcjbCourierId.HasValue && data.CourierIds.Contains(j.UcjbCourierId.Value)))
            && (!data.SpeedSet || (j.UcjbSpeed.HasValue && data.SpeedIds.Contains(j.UcjbSpeed.Value)))),
        context.TucJobArchives.Where(j =>
            (!data.ClientSet || (j.UcjbClientId.HasValue && data.ClientIds.Contains(j.UcjbClientId.Value)))
            && (!data.CourierSet || (j.UcjbCourierId.HasValue && data.CourierIds.Contains(j.UcjbCourierId.Value)))
            && (!data.SpeedSet || (j.UcjbSpeed.HasValue && data.SpeedIds.Contains(j.UcjbSpeed.Value))))
    );

    /// <summary>
    /// Loads the full job rows for one page of sort keys and puts them back into the order the
    /// database returned them in.
    /// </summary>
    private static async Task<List<DispatchJobViewModel>> HydratePodSearchPageAsync(
        IReadOnlyList<PodSearchSortKey> pageKeys,
        DespatchContext liveContext,
        DespatchContext archivedContext,
        bool isUsCustomer,
        CancellationToken cancellationToken)
    {
        var liveIds = pageKeys.Where(k => !k.IsArchived).Select(k => k.JobId).ToList();
        var archivedIds = pageKeys.Where(k => k.IsArchived).Select(k => k.JobId).ToList();

        // The ids already came from the filtered, deduped union, so only the ids are needed here.
        var liveTask = liveIds.Count == 0
            ? Task.FromResult(new List<DispatchJobViewModel>())
            : liveContext.TucJobs
                .Where(j => liveIds.Contains(j.UcjbId))
                .Select(JobMappings.PodSearchMapping(isUsCustomer))
                .TagWith("PodSearch - Live Page Rows")
                .ToListAsync(cancellationToken);

        var archivedTask = archivedIds.Count == 0
            ? Task.FromResult(new List<DispatchJobViewModel>())
            : archivedContext.TucJobArchives
                .Where(j => archivedIds.Contains(j.UcjbId))
                .Select(JobMappings.PodSearchArchivedMapping(isUsCustomer))
                .TagWith("PodSearch - Archived Page Rows")
                .ToListAsync(cancellationToken);

        await Task.WhenAll(liveTask, archivedTask);

        var rank = new Dictionary<(int JobId, bool IsArchived), int>(pageKeys.Count);
        for (var i = 0; i < pageKeys.Count; i++)
        {
            rank[(pageKeys[i].JobId, pageKeys[i].IsArchived)] = i;
        }

        return
        [
            .. (await liveTask).Concat(await archivedTask)
            .OrderBy(j => rank.GetValueOrDefault((j.Id, j.IsArchived), int.MaxValue))
        ];
    }

    /// <summary>
    /// Orders the unioned sort keys. Every branch ends on the job id so the total order is stable —
    /// without one, OFFSET/FETCH can serve the same row on two consecutive pages.
    /// </summary>
    internal static IQueryable<PodSearchSortKey> ApplyPodSearchSorting(
        IQueryable<PodSearchSortKey> query,
        string sortColumn,
        bool descending) =>
        sortColumn switch
        {
            "time" => descending
                ? query.OrderByDescending(k => k.Time).ThenByDescending(k => k.Date)
                    .ThenByDescending(k => k.JobId)
                : query.OrderBy(k => k.Time).ThenBy(k => k.Date).ThenBy(k => k.JobId),
            "jobno" => OrderByKey(query, k => k.JobNumber, descending),
            "client" => OrderByKey(query, k => k.ClientCode, descending),
            "refa" => OrderByKey(query, k => k.RefA, descending),
            "status" => OrderByKey(query, k => k.StatusCode, descending),
            "speed" => OrderByKey(query, k => k.SpeedName, descending),
            "courier" => OrderByKey(query, k => k.CourierCode, descending),
            "pickup" => OrderByKey(query, k => k.PickupSuburb, descending),
            "delivery" => OrderByKey(query, k => k.DeliveryAddress, descending),
            "vehicle" => OrderByKey(query, k => k.VehicleName, descending),
            "isarchived" => OrderByKey(query, k => k.IsArchived, descending),
            // "date", and anything unrecognised. Unlike the sorters this replaced, an unknown
            // column still honours the requested direction.
            _ => descending
                ? query.OrderByDescending(k => k.Date).ThenByDescending(k => k.Time)
                    .ThenByDescending(k => k.JobId)
                : query.OrderBy(k => k.Date).ThenBy(k => k.Time).ThenBy(k => k.JobId)
        };

    private static IQueryable<PodSearchSortKey> OrderByKey<TKey>(
        IQueryable<PodSearchSortKey> query,
        Expression<Func<PodSearchSortKey, TKey>> key,
        bool descending) =>
        descending
            ? query.OrderByDescending(key).ThenByDescending(k => k.JobId)
            : query.OrderBy(key).ThenBy(k => k.JobId);

    /// <summary>
    /// Live half of the sort-key union. Must stay column-for-column identical to
    /// <see cref="ArchivedSortKey"/> — a member the provider cannot translate turns this into a
    /// client projection, and EF refuses to translate a set operation over one.
    /// </summary>
    private static Expression<Func<TucJob, PodSearchSortKey>> LiveSortKey =>
        j => new PodSearchSortKey
        {
            JobId = j.UcjbId,
            IsArchived = false,
            Date = j.UcjbDate,
            Time = j.UcjbTime,
            JobNumber = j.UcjbNumber,
            ClientCode = j.UcjbClientCode,
            RefA = j.UcjbClientRefa,
            StatusCode = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
            SpeedName = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : null,
            CourierCode = j.UcjbCourier != null ? j.UcjbCourier.Code : null,
            PickupSuburb = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : null,
            DeliveryAddress = j.UcjbToAddr,
            VehicleName = j.UcjbSizeNavigation != null ? j.UcjbSizeNavigation.VehicleName : null
        };

    /// <summary>The live sort key plus the stats-header bucket, for the wildcard path's single pass.</summary>
    private static readonly Expression<Func<TucJob, PodSearchSortKey>> LiveSortKeyWithBucket =
        WithBucket(LiveSortKey, JobListStatusBuckets.Over(JobStatusSnapshots.Live));

    /// <summary>The archived sort key plus the stats-header bucket. See <see cref="LiveSortKeyWithBucket"/>.</summary>
    private static readonly Expression<Func<TucJobArchive, PodSearchSortKey>> ArchivedSortKeyWithBucket =
        WithBucket(ArchivedSortKey, JobListStatusBuckets.Over(JobStatusSnapshots.Archived));

    /// <summary>Adds a <see cref="PodSearchSortKey.Bucket"/> binding to a sort-key projection.</summary>
    internal static Expression<Func<TEntity, PodSearchSortKey>> WithBucket<TEntity>(
        Expression<Func<TEntity, PodSearchSortKey>> sortKey,
        Expression<Func<TEntity, JobListBucket>> bucket)
    {
        var init = (MemberInitExpression)sortKey.Body;
        var bucketBody = ReplacingExpressionVisitor.Replace(bucket.Parameters[0], sortKey.Parameters[0], bucket.Body);
        var binding = Expression.Bind(typeof(PodSearchSortKey).GetProperty(nameof(PodSearchSortKey.Bucket))!, bucketBody);
        return Expression.Lambda<Func<TEntity, PodSearchSortKey>>(
            Expression.MemberInit(init.NewExpression, init.Bindings.Append(binding)), sortKey.Parameters);
    }

    /// <summary>Archived half of the sort-key union. See <see cref="LiveSortKey"/>.</summary>
    private static Expression<Func<TucJobArchive, PodSearchSortKey>> ArchivedSortKey =>
        j => new PodSearchSortKey
        {
            JobId = j.UcjbId,
            IsArchived = true,
            Date = j.UcjbDate,
            Time = j.UcjbTime,
            JobNumber = j.UcjbNumber,
            ClientCode = j.UcjbClientCode,
            RefA = j.UcjbClientRefa,
            StatusCode = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
            SpeedName = j.SpeedNavigation != null ? j.SpeedNavigation.ShortName : null,
            CourierCode = j.UcjbCourier != null ? j.UcjbCourier.Code : null,
            PickupSuburb = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : null,
            DeliveryAddress = j.UcjbToAddr,
            VehicleName = j.UcjbSizeNavigation != null ? j.UcjbSizeNavigation.VehicleName : null
        };
}

/// <summary>
/// The flat shape both job sources project into so the database can union, order and page them as
/// one set. Carries the row's identity plus every column the job list can sort by.
/// </summary>
internal sealed class PodSearchSortKey
{
    public int JobId { get; init; }
    public bool IsArchived { get; init; }
    public DateTime? Date { get; init; }
    public DateTime? Time { get; init; }
    public string JobNumber { get; init; }
    public string ClientCode { get; init; }
    public string RefA { get; init; }
    public string StatusCode { get; init; }
    public string SpeedName { get; init; }
    public string CourierCode { get; init; }
    public string PickupSuburb { get; init; }
    public string DeliveryAddress { get; init; }
    public string VehicleName { get; init; }

    /// <summary>Only projected by the wildcard path, which tallies the stats header from the keys.</summary>
    public JobListBucket Bucket { get; init; }
}

/// <summary>How a job-number search term is matched against ucjbNumber.</summary>
internal enum JobNumberMatch
{
    Contains,
    Exact,
    Prefix
}
