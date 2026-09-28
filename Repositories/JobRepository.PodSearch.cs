using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    private const int PodSearchDefaultPageSize = 50;
    private const int PodSearchMaxPageSize = 200;

    /// <summary>
    /// Searches both live and archived jobs with filtering, sorting and pagination.
    /// </summary>
    /// <remarks>
    /// The live and archived matches are unioned as a narrow key shape so the database owns the
    /// whole ORDER BY / OFFSET / FETCH. Only the ids on the requested page are then hydrated through
    /// the full projections. Taking a slice from each source before merging — as this used to —
    /// capped the reachable rows at pageSize * 3 per source while the total counted every match, so
    /// a search could report far more jobs than the grid could ever page to.
    /// </remarks>
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

            var page = Math.Max(data.Page ?? 0, 0);
            var pageSize = Math.Clamp(data.PageSize ?? PodSearchDefaultPageSize, 1, PodSearchMaxPageSize);
            var sortColumn = data.SortColumn?.ToLowerInvariant();
            var sortDescending = string.Equals(data.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);

            await using var countContext = await _contextFactory.CreateDbContextAsync(cancellationToken);
            await using var pageContext = await _contextFactory.CreateDbContextAsync(cancellationToken);

            var (countLive, countArchived) = BuildPodSearchQueries(countContext, data);
            var (pageLive, pageArchived) = BuildPodSearchQueries(pageContext, data);

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

            if (pageKeys.Count == 0)
            {
                return new JobSearchResult
                {
                    Jobs = [],
                    TotalCount = totalCount,
                    HasMore = false,
                    StatusCounts = statusCounts
                };
            }

            var allJobs = await HydratePodSearchPageAsync(
                pageKeys, pageContext, countContext, isUsCustomer, cancellationToken);

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
                // Driven by the page itself rather than the separately-executed count, so a count
                // that shifted mid-scroll can never cut paging short.
                HasMore = pageKeys.Count == pageSize,
                StatusCounts = statusCounts
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
    /// Builds the filtered live and archived queries for a POD search against one context, with
    /// archived duplicates of live jobs already excluded.
    /// </summary>
    /// <param name="context">Context both queries are built against, so the duplicate exclusion
    /// stays a single NOT EXISTS.</param>
    /// <param name="data">Search parameters.</param>
    private static (IQueryable<TucJob> Live, IQueryable<TucJobArchive> Archived) BuildPodSearchQueries(
        DespatchContext context, PodSearchRequest data)
    {
        IQueryable<TucJob> live;
        IQueryable<TucJobArchive> archived;

        if (data.JobIdSet)
        {
            // A job-id search ignores every other filter
            live = context.TucJobs.Where(j => j.UcjbId == data.JobId);
            archived = context.TucJobArchives.Where(j => j.UcjbId == data.JobId);
        }
        else
        {
            var fromDate = data.FromDate.Date;
            // Half-open on the raw column: CONVERT(date, ucjbDate) on the left-hand side is not
            // SARGable, so no index on ucjbDate can ever seek. Both bounds are already truncated.
            var toExclusive = data.ToDate.Date.AddDays(1);
            var jobSearch = $"%{(data.Job ?? string.Empty).Trim()}%";

            live = context.TucJobs
                .Where(j =>
                    j.UcjbDate >= fromDate
                    && j.UcjbDate < toExclusive
                    && (!data.ClientSet ||
                        (j.UcjbClientId.HasValue && data.ClientIds.Contains(j.UcjbClientId.Value)))
                    && (!data.CourierSet ||
                        (j.UcjbCourierId.HasValue && data.CourierIds.Contains(j.UcjbCourierId.Value)))
                    && (!data.SpeedSet || (j.UcjbSpeed.HasValue && data.SpeedIds.Contains(j.UcjbSpeed.Value)))
                    && (!data.JobSet || EF.Functions.Like(j.UcjbNumber, jobSearch))
                );

            archived = context.TucJobArchives
                .Where(j =>
                    j.UcjbDate.HasValue
                    && j.UcjbDate.Value >= fromDate
                    && j.UcjbDate.Value < toExclusive
                    && (!data.ClientSet ||
                        (j.UcjbClientId.HasValue && data.ClientIds.Contains(j.UcjbClientId.Value)))
                    && (!data.CourierSet ||
                        (j.UcjbCourierId.HasValue && data.CourierIds.Contains(j.UcjbCourierId.Value)))
                    && (!data.SpeedSet || (j.UcjbSpeed.HasValue && data.SpeedIds.Contains(j.UcjbSpeed.Value)))
                    && (!data.JobSet || EF.Functions.Like(j.UcjbNumber, jobSearch))
                );

            if (!data.WildSet)
            {
                return (live, ExcludeLiveDuplicates(archived, context.TucJobs));
            }

            var wildSearch = $"%{data.Wild ?? string.Empty}%";
            live = live.Where(JobWildcardSearch.LiveJobMatches(wildSearch));
            archived = archived.Where(JobWildcardSearch.ArchivedJobMatches(wildSearch));
        }

        return (live, ExcludeLiveDuplicates(archived, context.TucJobs));
    }

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
}
