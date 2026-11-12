#nullable enable
using System.Globalization;
using System.Text.Json.Nodes;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Services.AgentRead;

public sealed record RecurringCheckRequest(
    bool IncludeInactive = false,
    string Detail = "problems",
    int WindowDays = 7,
    DateOnly? AsOf = null,
    int? MaxBookings = null);

public interface IAgentRecurringCheckService
{
    Task<JsonObject> CheckAsync(RecurringCheckRequest request, CancellationToken cancellationToken = default);
}

public sealed record RecurringClassification(string Status, IReadOnlyList<string> RunDates, string? LastRun, string? NextRun, int RunsInWindow);

/// <summary>Did the recurring bookings run? firing / silent / stale / never, from the booking list, journey and detail reads.</summary>
public sealed class AgentRecurringCheckService(
    IRecurringJobRepository recurring,
    IDeliveryJourneyService journey,
    ITenantClock clock,
    ILogger<AgentRecurringCheckService> logger) : IAgentRecurringCheckService
{
    public const int DefaultMaxBookings = 150;
    private const int PageSize = 100;
    private const int MaxPages = 50;

    public static RecurringClassification Classify(DateTime? lastDone, IReadOnlyList<RecurringJourneyRunDto> runs, DateOnly asOf, int windowDays)
    {
        var runDates = runs.Select(r => r.ServiceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).Order(StringComparer.Ordinal).ToList();
        var asOfText = asOf.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var windowStart = asOf.AddDays(-windowDays).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var past = runDates.Where(d => string.CompareOrdinal(d, asOfText) <= 0).ToList();
        var future = runDates.Where(d => string.CompareOrdinal(d, asOfText) > 0).ToList();
        var inWindow = past.Count(d => string.CompareOrdinal(d, windowStart) >= 0);
        var lastDoneDay = lastDone?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? "";

        var status = runDates.Count == 0 ? "never"
            : inWindow > 0 ? "firing"
            : string.CompareOrdinal(lastDoneDay, windowStart) >= 0 ? "silent"
            : "stale";
        return new RecurringClassification(status, runDates, past.Count > 0 ? past[^1] : null, future.Count > 0 ? future[0] : null, inWindow);
    }

    public static JsonObject Summarise(IEnumerable<string> statuses)
    {
        var list = statuses.ToList();
        var counts = new JsonObject();
        foreach (var s in new[] { "firing", "silent", "stale", "never" }) counts[s] = list.Count(x => x == s);
        return counts;
    }

    public async Task<JsonObject> CheckAsync(RecurringCheckRequest request, CancellationToken ct = default)
    {
        if (request.Detail is not ("problems" or "all" or "counts")) throw new AgentReadException("detail must be problems, all or counts.");
        if (request.WindowDays is < 1 or > 60) throw new AgentReadException("window_days must be 1..60.");

        var asOf = request.AsOf ?? DateOnly.FromDateTime(clock.TenantToday);
        RecurringMode[] modes = request.IncludeInactive
            ? [RecurringMode.Active, RecurringMode.Manual, RecurringMode.Inactive]
            : [RecurringMode.Active];
        List<string> warnings = [];
        List<(RecurringMode Mode, PrebookListViewModel Item)> listed = [];
        var lists = new JsonObject();
        foreach (var mode in modes)
        {
            var items = await ListModeAsync(mode, warnings, ct);
            lists[$"mode{(int)mode}"] = items.Count;
            listed.AddRange(items.Select(i => (mode, i)));
        }

        var cap = Math.Max(1, request.MaxBookings ?? DefaultMaxBookings);
        var toRead = listed.Take(cap).ToList();
        if (listed.Count > cap) warnings.Add($"max_bookings={cap}: read {cap} of {listed.Count} bookings; the list counts stay complete, the status counts cover only those read.");

        List<JsonObject> rows = [];
        foreach (var (mode, item) in toRead)
        {
            ct.ThrowIfCancellationRequested();
            rows.Add(await ReadOneAsync(mode, item, asOf, request.WindowDays, warnings));
        }

        var body = new JsonObject
        {
            ["asOf"] = asOf.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["windowDays"] = request.WindowDays,
            ["lists"] = lists,
            ["counts"] = Summarise(rows.Select(r => (string)r["status"]!))
        };

        if (request.Detail == "all")
        {
            body["bookings"] = new JsonArray([.. rows.Select(r => (JsonNode)r)]);
        }
        else if (request.Detail == "problems")
        {
            body["bookings"] = new JsonArray([.. rows.Where(r => (string?)r["status"] != "firing").Select(Problem)]);
        }

        body["warnings"] = AgentJobSearchService.Strings(warnings);
        return body;
    }

    private static JsonNode Problem(JsonObject r)
    {
        var o = new JsonObject();
        foreach (var key in new[] { "id", "name", "status", "scheduleName", "bookedBy", "initialDays", "lastDone", "nextDue", "lastRun", "nextRun" })
        {
            o[key] = r[key]?.DeepClone();
        }

        return o;
    }

    private async Task<List<PrebookListViewModel>> ListModeAsync(RecurringMode mode, List<string> warnings, CancellationToken ct)
    {
        List<PrebookListViewModel> all = [];
        var total = 0;
        for (var page = 1; page <= MaxPages; page++)
        {
            ct.ThrowIfCancellationRequested();
            var envelope = await recurring.GetRecurringJobsListAsync(new RecurringJobQueryRequest
            {
                Order = "booked",
                OrderDirection = "asc",
                Limit = PageSize,
                Page = page,
                Active = mode != RecurringMode.Inactive,
                RecurringMode = mode
            });
            var items = (envelope.Items ?? []).ToList();
            total = envelope.Total;
            all.AddRange(items);
            if (items.Count == 0 || all.Count >= total) break;
        }

        if (all.Count != total)
        {
            warnings.Add($"recurringMode {(int)mode}: received {all.Count} rows but the list reports a count of {total} — treat the list as incomplete");
        }

        return all;
    }

    private async Task<JsonObject> ReadOneAsync(RecurringMode mode, PrebookListViewModel item, DateOnly asOf, int windowDays, List<string> warnings)
    {
        RecurringJourneyDto journeyDto = new();
        JobRecurringViewModel? job = null;
        try
        {
            journeyDto = await journey.GetDeliveryJourneyForRecurringBookingAsync(item.Id);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "recurring_check: the journey read failed for booking {BookingId}", item.Id);
            warnings.Add($"booking {item.Id}: journey read failed (see the server log)");
        }

        try
        {
            job = (await recurring.GetRecurringJobByIdAsync(item.Id)).Job as JobRecurringViewModel;
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "recurring_check: the detail read failed for booking {BookingId}", item.Id);
            warnings.Add($"booking {item.Id}: detail read failed (see the server log)");
        }

        var c = Classify(job?.LastDone, journeyDto.Runs, asOf, windowDays);
        return new JsonObject
        {
            ["id"] = item.Id,
            ["name"] = item.CustomJobName,
            ["client"] = item.Client,
            ["clientId"] = item.ClientId,
            ["speed"] = item.Speed,
            ["mode"] = (int)mode,
            ["scheduleName"] = job?.ScheduleName,
            ["bookedBy"] = job?.FromContactName,
            ["loggedInContact"] = job?.LoggedInContactName,
            ["initialDays"] = job?.RecurringInitialDays,
            ["firstDue"] = Day(job?.FirstDue),
            ["lastDone"] = Day(job?.LastDone),
            ["nextDue"] = item.NextDueTime is { } due ? due.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : Day(job?.NextDue),
            ["runs"] = c.RunDates.Count,
            ["lastRun"] = c.LastRun,
            ["nextRun"] = c.NextRun,
            ["runsInWindow"] = c.RunsInWindow,
            ["pending"] = journeyDto.Breakdown.Pending,
            ["completed"] = journeyDto.Breakdown.Completed,
            ["status"] = c.Status
        };
    }

    private static string? Day(DateTime? d) => d?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}



