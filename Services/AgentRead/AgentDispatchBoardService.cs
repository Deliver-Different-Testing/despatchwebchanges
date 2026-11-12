#nullable enable
using System.Globalization;
using System.Text.Json.Nodes;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Services.AgentRead;

public sealed record DispatchBoardRequest(
    IReadOnlyList<int>? ViewIds = null,
    DateOnly? Date = null,
    int Page = 1,
    int PageSize = AgentDispatchBoardService.DefaultPageSize,
    string Detail = "summary",
    int Limit = 25);

public interface IAgentDispatchBoardService
{
    Task<JsonObject> GetAsync(DispatchBoardRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// What is on the board and what still needs a driver, from the same list, clear-list, driver and stats reads the Dispatch
/// and Overview screens use. Always paged (the un-paged path is capped at 2,000 rows and says so only through hasMore).
/// </summary>
public sealed class AgentDispatchBoardService(
    IJobQueryRepository jobs,
    ICourierRepository couriers,
    IDfrntViewsRepository views,
    ITenantInfoService tenant,
    ILogger<AgentDispatchBoardService> logger) : IAgentDispatchBoardService
{
    public const int DefaultPageSize = 500;
    public const int MaxPageSize = 2000;
    private const int DriverCap = 500;

    public async Task<JsonObject> GetAsync(DispatchBoardRequest request, CancellationToken ct = default)
    {
        if (request.Detail is not ("summary" or "all")) throw new AgentReadException("detail must be summary or all.");
        var limit = Math.Clamp(request.Limit, 1, 200);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);
        var page = Math.Max(1, request.Page);
        var all = request.Detail == "all";
        List<string> warnings = [];

        var (resolvedIds, allowedViews, resolved) = await AgentViewScope.ResolveAsync(views, tenant, request.ViewIds);
        var viewIds = resolvedIds.ToList();
        var source = resolved ? "resolved" : "given";
        List<DfrntPageViewModel> viewNames = resolved ? [.. allowedViews] : [];
        if (resolved)
        {
            if (viewIds.Count == 0)
            {
                return new JsonObject
                {
                    ["needs"] = "despatch_view_ids",
                    ["because"] = "No view ids were given and this login has no dispatch views, so there is nothing safe to read. Ask a dispatcher which view they work in — the ids are tenant data and are not derivable here."
                };
            }

            warnings.Add($"No despatch_view_ids were given, so all {viewIds.Count} view(s) this login can see were used ({string.Join(", ", viewIds)}). That is this login's board, not necessarily the tenant's whole operation.");
        }

        DateTimeOffset? day = request.Date is { } d ? new DateTimeOffset(d.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero) : null;
        var board = await jobs.JobListAsync(
            new JobQueryParams { StartDate = day, EndDate = day, Page = page, PageSize = pageSize },
            isInternal: false, tenant.IsUsTenant(), clientIds: "", viewIds, cancellationToken: ct);

        var (rows, counts, boardWarnings) = DispatchBoardComposer.Classify(board.Jobs ?? []);
        warnings.AddRange(boardWarnings);
        if (board.HasMore) warnings.Add($"There are further pages after page {page}; the counts below are this page only.");
        if (rows.Count < board.TotalCount && !board.HasMore)
        {
            warnings.Add($"The list claims totalCount={board.TotalCount} but delivered {rows.Count} rows with hasMore=false. Do not treat this list as the complete board.");
        }

        var drivers = await DriversAsync(all, limit, warnings);
        var clearLists = await ClearListsAsync(viewIds, day, all, limit, warnings);
        var stats = await StatsAsync(rows.Count(r => r.Bucket is "needs-driver" or "allocated"), warnings);
        var overview = await OverviewAsync(all, limit, warnings);

        var needsDriver = rows.Where(r => r.Bucket == "needs-driver").ToList();
        var late = rows.Where(r => r.Late).ToList();
        if (!all && (needsDriver.Count > limit || late.Count > limit))
        {
            warnings.Add($"Lists are capped at {limit} rows; pass detail=all (or raise limit) for every row.");
        }

        var boardOut = new JsonObject
        {
            ["counted"] = rows.Count,
            ["totalCount"] = board.TotalCount,
            ["hasMore"] = board.HasMore,
            ["page"] = page,
            ["pageSize"] = pageSize
        };
        foreach (var (key, value) in counts.ToList()) boardOut[key] = value?.DeepClone();

        return new JsonObject
        {
            ["date"] = request.Date?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                       ?? "not filtered — the board read the whole view, the clear lists defaulted to the tenant's today. Two different windows.",
            ["views"] = new JsonObject
            {
                ["ids"] = new JsonArray([.. viewIds.Select(i => (JsonNode)JsonValue.Create(i))]),
                ["source"] = source,
                ["names"] = new JsonArray([.. viewNames.Select(v => (JsonNode)new JsonObject { ["id"] = v.Id, ["name"] = v.Name })])
            },
            ["stats"] = stats,
            ["board"] = boardOut,
            ["needsDriver"] = new JsonArray([.. (all ? needsDriver : needsDriver.Take(limit)).Select(r => (JsonNode)DispatchBoardComposer.ToJson(r))]),
            ["late"] = new JsonArray([.. (all ? late : late.Take(limit)).Select(r => (JsonNode)DispatchBoardComposer.ToJson(r))]),
            ["drivers"] = drivers,
            ["clearLists"] = clearLists,
            ["overview"] = overview,
            ["warnings"] = AgentJobSearchService.Strings(warnings)
        };
    }

    private async Task<JsonNode?> DriversAsync(bool all, int limit, List<string> warnings)
    {
        try
        {
            var list = (await couriers.GetDriverWorkOverviewAsync())
                .Select(d => new { d.CourierId, d.Name, d.VehicleType, d.JobCount, d.DriverStatusText })
                .OrderByDescending(d => d.JobCount).ToList();
            var onShift = list.Where(d => d.DriverStatusText == "Active").ToList();
            if (list.Count >= DriverCap) warnings.Add("GetDriverWorkOverview returned 500 couriers — that is its hard cap, so the driver list is truncated.");
            return new JsonObject
            {
                ["listed"] = list.Count,
                ["onShift"] = onShift.Count,
                ["offShift"] = list.Count - onShift.Count,
                ["idleOnShift"] = onShift.Count(d => d.JobCount == 0),
                ["jobsCarried"] = onShift.Sum(d => d.JobCount),
                ["loaded"] = new JsonArray([.. (all ? list : list.Take(limit)).Select(d => (JsonNode)new JsonObject
                {
                    ["courierId"] = d.CourierId,
                    ["name"] = d.Name,
                    ["vehicle"] = d.VehicleType,
                    ["jobs"] = d.JobCount,
                    ["status"] = d.DriverStatusText
                })]),
                ["message"] = "jobs is the driver's current work across the WHOLE tenant, not just the requested views; the read lists at most 500 active couriers."
            };
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "dispatch_board: the driver work overview read failed");
            warnings.Add("The driver work overview failed (see the server log) — who is on shift is unknown, not empty.");
            return null;
        }
    }

    private async Task<JsonNode?> ClearListsAsync(IReadOnlyList<int> viewIds, DateTimeOffset? day, bool all, int limit, List<string> warnings)
    {
        try
        {
            var lists = await couriers.GetClearListsAsync(viewIds, day, day, false);
            var summary = DispatchBoardComposer.SummariseClearLists(lists, all ? null : limit);
            if ((int)summary["areas"]! == 0)
            {
                warnings.Add($"No clear-list areas for view(s) {string.Join(", ", viewIds)}. That is \"no lists configured for these views\", not \"no drivers\".");
            }

            return summary;
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "dispatch_board: the clear lists read failed");
            warnings.Add("The clear lists failed (see the server log) — they are unknown.");
            return null;
        }
    }

    private async Task<JsonNode?> StatsAsync(int running, List<string> warnings)
    {
        try
        {
            var s = await jobs.GetOverviewStatsAsync();
            if (s.Active == 0 && running > 0)
            {
                warnings.Add("Overview stats report Active 0 while the board has running jobs — expected on a tenant whose jobs have no child jobs, since the stat tiles only count parents of multi-leg families. Read the board, not the tiles.");
            }

            return new JsonObject
            {
                ["active"] = s.Active,
                ["inactive"] = s.Inactive,
                ["completed"] = s.Completed,
                ["scope"] = "ALL TIME, whole tenant, and ONLY jobs that have child jobs. No date filter and no view filter. Not comparable with the board counts."
            };
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "dispatch_board: the overview stats read failed");
            warnings.Add("The overview stats failed (see the server log).");
            return null;
        }
    }

    private async Task<JsonNode?> OverviewAsync(bool all, int limit, List<string> warnings)
    {
        try
        {
            var o = await jobs.GetJobsForOverviewPageAsync(JobStatusGroup.Active, new OverviewJobsRequest { StatusGroup = 1, Page = 1, Limit = 20 });
            var items = o.Items.ToList();
            return new JsonObject
            {
                ["total"] = o.Total,
                ["page"] = o.Page,
                ["pages"] = o.Pages,
                ["returned"] = items.Count,
                ["scope"] = "statusGroup=1 (Active), parents-and-singles, tenant-wide, NOT view-filtered. A different population from both the tiles and the board.",
                ["sample"] = new JsonArray([.. (all ? items : items.Take(limit)).Select(i => (JsonNode)new JsonObject
                {
                    ["jobId"] = i.JobId,
                    ["jobName"] = i.JobName,
                    ["status"] = i.Status,
                    ["completionPercent"] = i.Completion,
                    ["pickup"] = i.Pickup,
                    ["delivery"] = i.Delivery,
                    ["driver"] = i.Driver,
                    ["region"] = i.Region,
                    ["children"] = i.ChildJobs.Count
                })])
            };
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "dispatch_board: the overview list read failed");
            warnings.Add("The overview list failed (see the server log).");
            return null;
        }
    }
}






