#nullable enable
using System.Globalization;
using DeliverDifferent.AgentAccess;
using System.Text.Json.Nodes;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;

namespace DespatchWeb.Services.AgentRead;

public sealed record JobSearchRequest(
    string? Query = null,
    string? Job = null,
    string? Reference = null,
    string? OrderNumber = null,
    string? OrderId = null,
    int? ExpectedFulfilmentOrders = null,
    DateOnly? From = null,
    DateOnly? To = null,
    DateOnly? AsOf = null,
    int? LookbackDays = null,
    int? ClientId = null,
    int? CourierId = null,
    int Page = 1,
    int PageSize = AgentJobSearchService.DefaultPageSize,
    bool All = false,
    int? MaxRows = null,
    JobWildcardColumns Columns = JobWildcardColumns.None);

public sealed class AgentReadException(string message) : Exception(message);

public interface IAgentJobSearchService
{
    Task<JsonObject> SearchAsync(JobSearchRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// Reads PodSearchDownload's complete, un-paged query (never the row-dropping JSON search) and treats a wildcard hit as a
/// candidate, not evidence: only a job whose reference column equals the term counts.
/// </summary>
public sealed class AgentJobSearchService(IJobQueryRepository jobs, ITenantClock clock) : IAgentJobSearchService
{
    public const int DefaultPageSize = 25;
    public const int MaxPageSize = 100;
    public const int MaxWindowDays = 400;
    public const int MaxUnfilteredWindowDays = 93;
    private const int DefaultListWindowDays = 30;
    private const string UnfilteredHint = "give q, job, reference, client_id or courier_id for a wider window";
    private const int DefaultOrderLookbackDays = 365;

    public async Task<JsonObject> SearchAsync(JobSearchRequest request, CancellationToken cancellationToken = default)
    {
        var terms = Terms(request);
        return request.OrderNumber is not null || request.OrderId is not null
            ? await OrderTraceAsync(request, terms, cancellationToken)
            : await ListAsync(request, terms, cancellationToken);
    }

    private static List<SearchTerm> Terms(JobSearchRequest request)
    {
        List<SearchTerm> terms = [];
        if (!string.IsNullOrWhiteSpace(request.OrderNumber))
        {
            terms.Add(new SearchTerm("order_number", JobSearchComposer.NormaliseOrderNumber(request.OrderNumber)));
        }

        if (!string.IsNullOrWhiteSpace(request.OrderId)) terms.Add(new SearchTerm("order_id", request.OrderId.Trim()));
        if (!string.IsNullOrWhiteSpace(request.Reference)) terms.Add(new SearchTerm("reference", JobSearchComposer.NormaliseOrderNumber(request.Reference)));
        return terms;
    }

    public static JobWildcardColumns ColumnsFor(IReadOnlySet<string> capabilities)
    {
        var columns = JobWildcardColumns.None;
        if (capabilities.Contains(AgentCapabilities.SeeContactDetails)) columns |= JobWildcardColumns.ContactDetails;
        if (capabilities.Contains(AgentCapabilities.SeeNotes)) columns |= JobWildcardColumns.Notes;
        if (capabilities.Contains(AgentCapabilities.SeePod)) columns |= JobWildcardColumns.PodName;
        return columns;
    }

    // SQL Server LIKE reads [%] as a literal percent, so the agent cannot turn a term into a wildcard.
    internal static string EscapeLike(string term) =>
        term.Replace("[", "[[]", StringComparison.Ordinal).Replace("%", "[%]", StringComparison.Ordinal).Replace("_", "[_]", StringComparison.Ordinal);

    private async Task<IReadOnlyList<JobDownloadModel>> DownloadAsync(string wild, string job, DateOnly from, DateOnly to, JobSearchRequest r) =>
        await jobs.PodSearchDownloadAsync(
            r.CourierId is { } courier ? [courier] : [],
            [],
            EscapeLike(wild),
            EscapeLike(job),
            from.ToDateTime(TimeOnly.MinValue),
            to.ToDateTime(TimeOnly.MinValue),
            r.ClientId is { } client ? [client] : [],
            null,
            r.Columns);

    private async Task<JsonObject> OrderTraceAsync(JobSearchRequest request, List<SearchTerm> terms, CancellationToken ct)
    {
        var anchor = request.AsOf ?? DateOnly.FromDateTime(clock.TenantToday);
        var lookback = request.LookbackDays ?? DefaultOrderLookbackDays;
        var from = request.From ?? anchor.AddDays(-lookback);
        var to = request.To ?? anchor.AddDays(30);
        EnsureWindow(from, to, filtered: true);

        var order = terms.Where(t => t.Kind != "reference").ToList();
        List<string> warnings = [];
        foreach (var term in terms.Where(t => t.Value.Length < 4))
        {
            warnings.Add($"\"{term.Value}\" is only {term.Value.Length} character(s) long — wild is a substring match, so it will hit many jobs that are not this order. "
                         + "Pass order_id as well, and trust only the confirmed rows.");
        }

        Dictionary<int, (JobDownloadModel Row, List<string> FoundBy)> byId = [];
        foreach (var term in terms)
        {
            ct.ThrowIfCancellationRequested();
            foreach (var row in await DownloadAsync(term.Value, request.Job ?? "", from, to, request))
            {
                if (byId.TryGetValue(row.Id, out var existing))
                {
                    if (!existing.FoundBy.Contains(term.Kind)) existing.FoundBy.Add(term.Kind);
                }
                else
                {
                    byId[row.Id] = (row, [term.Kind]);
                }
            }
        }

        var all = byId.Values
            .Select(v => JobSearchComposer.Classify(v.Row, terms, v.FoundBy))
            .OrderBy(j => j.Row.BookDate).ThenBy(j => j.Row.JobNumber, StringComparer.Ordinal)
            .ToList();
        var confirmed = all.Where(j => j.Confirmed).ToList();
        var unconfirmed = all.Where(j => !j.Confirmed).ToList();

        var (usable, reason) = JobSearchComposer.ParcelIdsUsable(confirmed);
        var parcels = JobSearchComposer.GroupParcels(confirmed);
        if (!usable && confirmed.Count > 0) warnings.Add($"Parcels not counted: {reason}.");

        var number = terms.FirstOrDefault(t => t.Kind == "order_number")?.Value;
        var id = terms.FirstOrDefault(t => t.Kind == "order_id")?.Value;
        if (number is not null && confirmed.Count > 0 && !confirmed.Any(j => j.Row.OurReference?.Trim() == number))
        {
            warnings.Add("No job carries the order number in OurReference — the shop has a fixed OurReference in Settings → Delivery, "
                         + "so searching by order number alone will miss this shop's jobs.");
        }

        if (id is not null && confirmed.Count > 0 && !confirmed.Any(j => j.Row.ClientReferenceA?.Trim() == id))
        {
            warnings.Add("No job carries the order id in ClientReferenceA — the shop has a fixed ClientReferenceA configured, so that reference is not the order id here.");
        }

        if (all.Count == 0)
        {
            warnings.Add("No rows at all. Before reading this as 'the booking failed': the search filters on BookDate, so a job booked outside "
                         + $"{from:yyyy-MM-dd}..{to:yyyy-MM-dd} is invisible; the shop may write fixed references (then the order appears in no searchable column except ShopRef1/2/3, "
                         + "which this search does not expose); or the order legitimately never booked — cancelled, already tagged, or not shipping to NZ, each of which "
                         + "returns HTTP 200 from the webhook with no job.");
        }

        warnings.Add("wild also matches ShopRef1/2/3, which this search does not return — an unconfirmed row may still be a genuine job for this order.");

        if (request.ExpectedFulfilmentOrders is null && confirmed.Count > 0)
        {
            warnings.Add("expected_fulfilment_orders was not given, so 'is any parcel missing a job?' is unanswered — this tool cannot read Shopify. "
                         + "Read the fulfilment order count off the Shopify order and call again.");
        }

        var assessment = JobSearchComposer.Assess(confirmed, unconfirmed, parcels, usable, request.ExpectedFulfilmentOrders);

        var cap = request.All ? Math.Clamp(request.MaxRows ?? JobSearchComposer.DefaultAllRows, 1, JobSearchComposer.MaxAllRows) : JobSearchComposer.SummaryRows;
        if (confirmed.Count > cap || unconfirmed.Count > cap)
        {
            warnings.Add($"Row lists truncated to {cap} each ({confirmed.Count} confirmed, {unconfirmed.Count} unconfirmed found). "
                         + "The counts above are over ALL rows. Call again with detail=all (and max_rows) for the rest.");
        }

        return new JsonObject
        {
            ["order"] = new JsonObject
            {
                ["number"] = number,
                ["id"] = id,
                ["searchedTerms"] = Strings(order.Select(t => $"{t.Kind}={t.Value}"))
            },
            ["window"] = Window(from, to),
            ["found"] = confirmed.Count > 0,
            ["counts"] = new JsonObject
            {
                ["jobsConfirmed"] = confirmed.Count,
                ["jobsLive"] = confirmed.Count(j => !j.IsVoid),
                ["jobsVoid"] = confirmed.Count(j => j.IsVoid),
                ["jobsUnconfirmed"] = unconfirmed.Count,
                ["fulfilmentOrdersWithJobs"] = usable ? parcels.Count : null,
                ["expectedFulfilmentOrders"] = request.ExpectedFulfilmentOrders
            },
            ["verdict"] = assessment.Verdict,
            ["flags"] = Strings(assessment.Flags),
            ["priceFlags"] = Strings(assessment.PriceFlags),
            ["parcels"] = new JsonArray([.. (usable ? parcels : []).Select(p => (JsonNode)new JsonObject
            {
                ["fulfilmentOrderId"] = p.FulfilmentOrderId,
                ["jobs"] = Strings(p.Jobs),
                ["live"] = p.Live,
                ["voided"] = p.Voided
            })]),
            ["parcelsNotCountedBecause"] = usable ? null : reason,
            ["jobs"] = new JsonArray([.. confirmed.Take(cap).Select(j => (JsonNode)JobSearchComposer.ToJson(j))]),
            ["unconfirmed"] = new JsonArray([.. unconfirmed.Take(cap).Select(j => (JsonNode)JobSearchComposer.ToJson(j))]),
            ["warnings"] = Strings(warnings)
        };
    }

    private async Task<JsonObject> ListAsync(JobSearchRequest request, List<SearchTerm> terms, CancellationToken ct)
    {
        var to = request.To ?? DateOnly.FromDateTime(clock.TenantToday);
        var from = request.From ?? to.AddDays(-DefaultListWindowDays);
        var filtered = !string.IsNullOrWhiteSpace(request.Query) || !string.IsNullOrWhiteSpace(request.Job) || !string.IsNullOrWhiteSpace(request.Reference)
                       || request.ClientId is not null || request.CourierId is not null;
        EnsureWindow(from, to, filtered);

        var reference = terms.FirstOrDefault(t => t.Kind == "reference");
        var wild = reference?.Value ?? request.Query?.Trim() ?? "";
        ct.ThrowIfCancellationRequested();
        var rows = await DownloadAsync(wild, request.Job ?? "", from, to, request);

        var classified = rows
            .Select(r => JobSearchComposer.Classify(r, terms, reference is null ? [] : [reference.Kind]))
            .OrderBy(j => j.Row.BookDate).ThenBy(j => j.Row.JobNumber, StringComparer.Ordinal)
            .ToList();
        var matching = reference is null ? classified : classified.Where(j => j.Confirmed).ToList();

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);
        var pageRows = matching.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        List<string> warnings = [];
        if (reference is not null)
        {
            warnings.Add("reference matches a job only when OurReference or ClientReferenceA/B/C equals it; the underlying wildcard also matches names, contact fields and addresses, so other hits are counted, not listed.");
        }

        if (wild.Length is > 0 and < 4)
        {
            warnings.Add($"\"{wild}\" is only {wild.Length} character(s) long — it is a substring match and will hit many unrelated jobs.");
        }

        return new JsonObject
        {
            ["window"] = Window(from, to),
            ["counts"] = new JsonObject
            {
                ["jobs"] = matching.Count,
                ["live"] = matching.Count(j => !j.IsVoid),
                ["void"] = matching.Count(j => j.IsVoid),
                ["notMatchingReference"] = reference is null ? null : classified.Count - matching.Count
            },
            ["page"] = page,
            ["pageSize"] = pageSize,
            ["hasMore"] = page * pageSize < matching.Count,
            ["jobs"] = new JsonArray([.. pageRows.Select(j => (JsonNode)JobSearchComposer.ToJson(j, detailed: true))]),
            ["warnings"] = Strings(warnings)
        };
    }

    private static void EnsureWindow(DateOnly from, DateOnly to, bool filtered)
    {
        if (to < from) throw new AgentReadException("'to' is before 'from'.");
        if (!filtered && to.DayNumber - from.DayNumber > MaxUnfilteredWindowDays)
        {
            throw new AgentReadException($"With no search filter the BookDate window may not exceed {MaxUnfilteredWindowDays} days; {UnfilteredHint}.");
        }

        if (to.DayNumber - from.DayNumber > MaxWindowDays) throw new AgentReadException($"The BookDate window may not exceed {MaxWindowDays} days.");
    }

    private static JsonObject Window(DateOnly from, DateOnly to) => new()
    {
        ["fromDate"] = from.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        ["toDate"] = to.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        ["filteredOn"] = "BookDate"
    };

    internal static JsonArray Strings(IEnumerable<string> values) => new([.. values.Select(v => (JsonNode)JsonValue.Create(v)!)]);
}



