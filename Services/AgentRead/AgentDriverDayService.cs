#nullable enable
using System.Globalization;
using System.Text.Json.Nodes;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Services.AgentRead;

public sealed record DriverDayRequest(
    string? Search = null,
    int? Fleet = null,
    string? Status = null,
    IReadOnlyList<int>? ViewIds = null,
    bool IncludeBoard = true,
    DateTimeOffset? Now = null,
    string Detail = "attention",
    int MaxDrivers = AgentDriverDayService.DefaultMaxDrivers);

public interface IAgentDriverDayService
{
    Task<JsonObject> GetAsync(DriverDayRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// Who is working today, what they carry and who is about to fall out of compliance. Reads the three Driver Management
/// lists and the clear-list board straight from the repository queries behind the POST screens; nothing here writes.
/// </summary>
public sealed class AgentDriverDayService(
    ICourierRepository couriers,
    IDfrntViewsRepository views,
    ITenantInfoService tenant,
    ILogger<AgentDriverDayService> logger) : IAgentDriverDayService
{
    public const int DefaultMaxDrivers = 200;
    private const int PageSize = 100;
    private const int MaxPages = 20;

    public async Task<JsonObject> GetAsync(DriverDayRequest request, CancellationToken ct = default)
    {
        if (request.Detail is not ("attention" or "all" or "counts")) throw new AgentReadException("detail must be attention, all or counts.");
        if (request.Status is not (null or "" or "active" or "inactive")) throw new AgentReadException("status must be active or inactive.");

        List<string> warnings = [];
        var maxDrivers = request.MaxDrivers > 0 ? request.MaxDrivers : DefaultMaxDrivers;
        var now = request.Now ?? DateTimeOffset.UtcNow;
        var search = request.Search ?? "";
        if (request.Fleet is { } fleet)
        {
            warnings.Add($"fleet={fleet} filters today's drivers and the compliance list; the earnings read takes no fleet, so courierPaymentToday and the tenant-wide money are UNFILTERED.");
        }

        try
        {
            var active = await PageAsync<TodayActiveDriversViewModel, TodayActiveDriversPaginatedResponse>("today's drivers", warnings,
                p => couriers.GetTodayActiveDriversAsync(new TodayActiveDriversFilterRequest
                {
                    SearchTerm = search, OrderBy = "code", Page = p, PageSize = PageSize, Status = request.Status ?? "", Fleet = request.Fleet ?? 0
                }));

            var compliance = await TryPageAsync<CourierComplianceViewModel, CourierCompliancePaginatedResponse>("compliance", warnings,
                p => couriers.GetAllCourierComplianceAsync(new CourierComplianceFilterRequest
                {
                    SearchTerm = search, OrderBy = "code", Page = p, PageSize = PageSize, Type = "", Status = "", Fleet = request.Fleet ?? 0
                }),
                "Every driver below reads \"compliance not checked\"; none of them reads \"valid\".");

            var earnings = await TryPageAsync<CourierDailyEarningsViewModel, CourierDailyEarningsPaginatedResponse>("daily earnings", warnings,
                p => couriers.GetCourierDailyEarningsAsync(new DespatchWeb.Models.PaginatedRequest
                {
                    SearchTerm = search, OrderBy = "name", Page = p, PageSize = PageSize
                }),
                "Money columns are omitted, not zero.");

            var (boardRead, board, boardViews) = await BoardAsync(request, warnings, ct);

            var input = new DriverDayInput(
                active.Items.ToList(), active.First,
                compliance?.Items.ToList() ?? [], compliance?.First,
                earnings?.Items.ToList() ?? [], earnings?.First,
                board, compliance is not null, earnings is not null, boardRead, now);
            var (head, drivers, boardOnly, unmatched) = DriverDayComposer.Compose(input);

            var flagged = drivers.Where(d => ((JsonArray)d["flags"]!).Count > 0).ToList();
            var counts = (JsonObject)head["counts"]!;
            counts["driversReturned"] = drivers.Count;
            counts["driversFlagged"] = flagged.Count;
            counts["onBoardButNotLoggedIn"] = boardOnly.Count;
            counts["complianceRowsForDriversNotOnShift"] = compliance is null ? null : unmatched;
            counts["listsComplete"] = new JsonObject
            {
                ["todaysDrivers"] = active.Complete,
                ["compliance"] = compliance?.Complete,
                ["earnings"] = earnings?.Complete
            };

            head["board"] = new JsonObject { ["viewIds"] = boardViews, ["read"] = boardRead, ["areas"] = counts["boardAreas"]?.DeepClone() };
            counts.Remove("boardAreas");

            var total = active.First.Total;
            if (total == 0)
            {
                head["drivers"] = new JsonArray();
                head["boardOnly"] = Array(boardOnly.Take(maxDrivers));
                head["note"] = "No driver has logged in today on this tenant's clock. That is what the app reports; it is not evidence that nobody is working — a shift that began yesterday and never logged out is excluded by construction.";
                head["warnings"] = AgentJobSearchService.Strings(warnings);
                return head;
            }

            if (request.Detail != "counts")
            {
                var rows = request.Detail == "all" ? drivers : flagged;
                var capped = rows.Take(maxDrivers).ToList();
                if (rows.Count > capped.Count) warnings.Add($"max_drivers={maxDrivers}: {capped.Count} of {rows.Count} rows returned. The counts above are over all of them.");
                head["drivers"] = Array(capped);
                head["boardOnly"] = Array(boardOnly.Take(maxDrivers));
                if (request.Detail == "attention")
                {
                    head["note"] = $"detail=\"attention\": only the {capped.Count} flagged driver(s) are listed. Ask for detail=all to see everyone who worked today.";
                }
            }

            head["warnings"] = AgentJobSearchService.Strings(warnings);
            return head;
        }
        catch (InvalidListQueryException e)
        {
            logger.LogWarning(e, "driver_day: a list query was rejected");
            throw new AgentReadException("One of the driver lists rejected the search or filter; simplify search and fleet and try again.");
        }
    }

    private static JsonArray Array(IEnumerable<JsonObject> rows) => new([.. rows.Select(r => (JsonNode)r)]);

    private sealed record Paged<TItem, TResponse>(List<TItem> Items, TResponse First, bool Complete);

    /// <summary>Pages a list to completion (the repository clamps the page size to 100); a shortfall against the claimed total is reported.</summary>
    private static async Task<Paged<TItem, TResponse>> PageAsync<TItem, TResponse>(string label, List<string> warnings, Func<int, Task<TResponse>> read)
        where TResponse : PaginatedResponse<TItem>
    {
        var first = await read(1);
        var items = first.Items.ToList();
        for (var page = 2; page <= Math.Min(first.Pages, MaxPages) && items.Count < first.Total; page++)
        {
            var next = (await read(page)).Items.ToList();
            if (next.Count == 0) break;
            items.AddRange(next);
        }

        if (first.Pages > MaxPages) warnings.Add($"{label}: {first.Pages} pages of {PageSize}; this tool read the first {MaxPages}. Narrow with search or fleet for a complete answer.");
        var complete = items.Count >= first.Total;
        if (!complete) warnings.Add($"{label}: the response claims total={first.Total} but {items.Count} rows came back — treat this list as INCOMPLETE.");
        return new Paged<TItem, TResponse>(items, first, complete);
    }

    private async Task<Paged<TItem, TResponse>?> TryPageAsync<TItem, TResponse>(string label, List<string> warnings, Func<int, Task<TResponse>> read, string consequence)
        where TResponse : PaginatedResponse<TItem>
    {
        try
        {
            return await PageAsync<TItem, TResponse>(label, warnings, read);
        }
        catch (Exception e) when (e is not OperationCanceledException and not InvalidListQueryException)
        {
            logger.LogError(e, "driver_day: the {List} read failed", label);
            warnings.Add($"{label} failed (see the server log). {consequence}");
            return null;
        }
    }

    private async Task<(bool Read, ClearListViewModel? Board, string Views)> BoardAsync(DriverDayRequest request, List<string> warnings, CancellationToken ct)
    {
        if (!request.IncludeBoard) return (false, null, "not requested");

        var (resolvedIds, _, resolved) = await AgentViewScope.ResolveAsync(views, tenant, request.ViewIds);
        var viewIds = resolvedIds.ToList();
        if (resolved)
        {
            if (viewIds.Count == 0)
            {
                warnings.Add("No despatch_view_ids were given and this login has no dispatch views, so the board was not read. What each driver is carrying is unknown, not zero.");
                return (false, null, "none available");
            }

            warnings.Add($"No despatch_view_ids were given, so all {viewIds.Count} view(s) this login can see were used ({string.Join(", ", viewIds)}).");
        }

        try
        {
            ct.ThrowIfCancellationRequested();
            var board = await couriers.GetClearListsAsync(viewIds, null, null, false);
            return (true, board, string.Join(", ", viewIds.Select(v => v.ToString(CultureInfo.InvariantCulture))));
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "driver_day: the board read failed");
            warnings.Add("board read failed (see the server log). What each driver is carrying is unknown, not zero.");
            return (false, null, "not read");
        }
    }
}






