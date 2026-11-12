#nullable enable
using System.Globalization;
using System.Text.Json.Nodes;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Services.AgentRead;

public sealed record BoardEntry(int CourierId, string? Code, int JobCount, List<string> Destinations, List<string> Areas);

public sealed record ComplianceFacts(string? Credential, string? Expiry, int? DaysUntilExpiry, string? AppStatus, string Class);

public sealed record DriverDayInput(
    IReadOnlyList<TodayActiveDriversViewModel> Active,
    TodayActiveDriversPaginatedResponse? ActiveEnvelope,
    IReadOnlyList<CourierComplianceViewModel> Compliance,
    CourierCompliancePaginatedResponse? ComplianceEnvelope,
    IReadOnlyList<CourierDailyEarningsViewModel> Earnings,
    CourierDailyEarningsPaginatedResponse? EarningsEnvelope,
    ClearListViewModel? Board,
    bool ComplianceRead,
    bool EarningsRead,
    bool BoardRead,
    DateTimeOffset Now);

/// <summary>driver_day's join and flags, ported from the prototype onto the typed Driver Management reads.</summary>
public static class DriverDayComposer
{
    public const int LongSessionMinutes = 840;

    public static string ClassifyCompliance(string? appStatus) => (appStatus ?? "").Trim().ToLowerInvariant() switch
    {
        "expired" => "expired",
        "expiring soon" => "expiring_soon",
        "valid" => "valid",
        "not set" => "not_set",
        _ => "unknown"
    };

    public static int? SessionMinutes(DateTimeOffset? login, DateTimeOffset? logout, DateTimeOffset now) =>
        login is null ? null : (int)Math.Round(((logout ?? now) - login.Value).TotalMinutes, MidpointRounding.AwayFromZero);

    private static int Urgency(string cls) => cls switch { "expired" => 0, "expiring_soon" => 1, "not_set" => 2, "valid" => 3, _ => 4 };

    /// <summary>areas and columns re-list the same area objects and one driver can sit in several areas, so index by courier.</summary>
    public static (Dictionary<int, BoardEntry> ByCourier, int AreaCount) IndexBoard(ClearListViewModel? board)
    {
        Dictionary<int, BoardEntry> byCourier = [];
        var areas = (board?.Areas ?? []).Concat((board?.Columns ?? []).SelectMany(c => c.Areas)).DistinctBy(a => a.Id).ToList();
        foreach (var area in areas)
        {
            var areaName = string.IsNullOrWhiteSpace(area.Name) ? $"area {area.Id}" : area.Name;
            foreach (var section in area.Top.Concat(area.Middle).Concat(area.Bottom))
            {
                if (section.CourierData?.CourierId is not { } id) continue;
                var destinations = section.Destinations.Select(d => d.Label).Where(l => !string.IsNullOrWhiteSpace(l)).ToList();
                if (byCourier.TryGetValue(id, out var existing))
                {
                    existing.Areas.Add(areaName);
                    foreach (var d in destinations.Where(d => !existing.Destinations.Contains(d))) existing.Destinations.Add(d);
                    continue;
                }

                byCourier[id] = new BoardEntry(id,
                    string.IsNullOrWhiteSpace(section.CourierNumber) ? section.CourierData.CourierNumber : section.CourierNumber,
                    section.JobCount, destinations, [areaName]);
            }
        }

        return (byCourier, areas.Count);
    }

    private sealed record Base(int? CourierId, string? Code, string? Name, string? Fleet, string? Status, DateTimeOffset? Login, DateTimeOffset? Logout, string? Duration, int? Deliveries);

    private sealed record Row(Base B, int? SessionMinutes, int? JobsDatedToday, decimal? Payment, decimal? HourlyRate, BoardEntry? Board, ComplianceFacts Compliance, List<string> Flags);

    public static (JsonObject Head, List<JsonObject> Drivers, List<JsonObject> BoardOnly, int UnmatchedComplianceRows) Compose(DriverDayInput input)
    {
        var (board, areaCount) = IndexBoard(input.Board);
        var byId = input.Compliance.Where(c => c.CourierId > 0).GroupBy(c => c.CourierId).ToDictionary(g => g.Key, g => g.ToList());
        var byCode = input.Compliance.Where(c => !string.IsNullOrWhiteSpace(c.Code)).GroupBy(c => c.Code.Trim().ToUpperInvariant()).ToDictionary(g => g.Key, g => g.ToList());
        var earningsById = input.Earnings.GroupBy(e => e.CourierId).ToDictionary(g => g.Key, g => g.First());
        HashSet<string> usedCodes = [];

        Row Build(Base b)
        {
            List<CourierComplianceViewModel>? rows = null;
            var code = (b.Code ?? "").Trim().ToUpperInvariant();
            if (b.CourierId is { } cid && byId.TryGetValue(cid, out var hit)) rows = hit;
            else if (code.Length > 0 && byCode.TryGetValue(code, out var byC)) rows = byC;
            if (rows is not null && code.Length > 0) usedCodes.Add(code);

            var facts = !input.ComplianceRead || rows is null
                ? new ComplianceFacts(null, null, null, null, "unknown")
                : rows.Select(r => new ComplianceFacts(r.ComplianceType, r.ExpiryDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    r.DaysUntilExpiry, r.Status, ClassifyCompliance(r.Status))).OrderBy(f => Urgency(f.Class)).First();

            var earn = b.CourierId is { } id && earningsById.TryGetValue(id, out var e) ? e : null;
            var boardEntry = b.CourierId is { } bid && board.TryGetValue(bid, out var be) ? be : null;
            var minutes = SessionMinutes(b.Login, b.Logout, input.Now);
            var row = new Row(b, minutes, b.Deliveries ?? earn?.Deliveries, earn?.Earnings, earn?.HourlyRate, boardEntry, facts, []);
            row.Flags.AddRange(FlagsFor(row));
            return row;
        }

        var driverRows = input.Active.Select(d => Build(new Base(d.CourierId, d.Code, d.Name, d.Fleet, d.Status, d.LoginTime, d.LogoutTime, d.Duration, d.Deliveries))).ToList();
        var seen = driverRows.Select(d => d.B.CourierId).Where(i => i is not null).ToHashSet();
        var boardOnly = board.Values.Where(e => !seen.Contains(e.CourierId))
            .Select(e => Build(new Base(e.CourierId, e.Code, null, null, null, null, null, null, null))).ToList();

        var unmatched = byCode.Keys.Count(c => !usedCodes.Contains(c));
        var a = input.ActiveEnvelope;
        var head = new JsonObject
        {
            ["scope"] = "the tenant's own today, per the app's clock — none of these reads takes a date, so this cannot be run for yesterday",
            ["counts"] = new JsonObject
            {
                ["driversWhoLoggedInToday"] = a?.Total,
                ["stillLoggedIn"] = a?.TotalActiveDrivers,
                ["averageSessionMinutes"] = a?.AverageSessionTime,
                ["tenantWide"] = input.EarningsRead && input.EarningsEnvelope is { } t
                    ? new JsonObject
                    {
                        ["deliveriesCompletedToday"] = t.TotalDeliveriesToday,
                        ["courierPaymentToday"] = t.TotalEarningsToday,
                        ["averageHourlyRate"] = t.AverageHourlyRate,
                        ["basis"] = "counted over EVERY job completed today on the tenant, not only over the drivers listed here — never expect the per-driver rows to sum to it"
                    }
                    : null,
                ["complianceHeader"] = input.ComplianceRead && input.ComplianceEnvelope is { } c
                    ? new JsonObject
                    {
                        ["expired"] = c.TotalExpired,
                        ["expiringSoon"] = c.TotalExpiringSoon,
                        ["valid"] = c.TotalValid,
                        ["notSet"] = c.TotalNotSet,
                        ["basis"] = "counted across ALL active couriers in the filter scope, not just today's drivers"
                    }
                    : null,
                ["boardAreas"] = input.BoardRead ? areaCount : null
            }
        };

        return (head, [.. driverRows.Select(ToJson)], [.. boardOnly.Select(ToJson)], unmatched);
    }

    private static List<string> FlagsFor(Row r)
    {
        List<string> flags = [];
        var status = r.B.Status;
        var active = string.Equals(status, "Active", StringComparison.OrdinalIgnoreCase) || (status is null && r.B.Logout is null);
        var days = r.Compliance.DaysUntilExpiry;
        var credential = r.Compliance.Credential;

        if (r.Compliance.Class == "expired")
        {
            flags.Add($"EXPIRED {credential ?? "credential"}{(days is { } d ? $" ({Math.Abs(d)} days overdue)" : "")}"
                      + (active ? " — and they are logged in right now" : " — logged out, but do not roster them again until it is renewed"));
        }

        if (r.Compliance.Class == "expiring_soon") flags.Add($"{credential ?? "Credential"} expires in {(days?.ToString(CultureInfo.InvariantCulture) ?? "under 30")} days — book the renewal");
        if (r.Compliance.Class == "not_set") flags.Add($"No expiry recorded for {credential ?? "their credential"} — the app's own header counts this driver as VALID; it is unchecked, not checked");
        if (r.Compliance.Class == "unknown") flags.Add("Compliance not checked — no compliance row matched this driver (inactive courier record, or a read that failed)");

        var carrying = r.Board?.JobCount ?? 0;
        if (!active && carrying > 0) flags.Add($"Logged out with {carrying} job(s) still on the board — reallocate or confirm they finished");
        if (active && carrying == 0 && (r.JobsDatedToday ?? 0) == 0) flags.Add("Logged in with nothing on the board and no jobs dated today — idle, or missing from the board's GPS areas");
        if (active && r.SessionMinutes is { } m && m >= LongSessionMinutes)
        {
            flags.Add($"Logged in {(m / 60.0).ToString("0.0", CultureInfo.InvariantCulture)}h and still open — a forgotten logout inflates every hourly figure on this screen");
        }

        if (r.SessionMinutes is < 0) flags.Add("Logout is BEFORE login — the app's Duration string silently rolls this forward a day; the raw times are wrong");
        if (status is null && r.Board is not null) flags.Add("On the board but not in today's login list — the board is built from courier/GPS data, not from logins");
        return flags;
    }

    private static JsonObject ToJson(Row r) => new()
    {
        ["courierId"] = r.B.CourierId,
        ["code"] = r.B.Code,
        ["name"] = r.B.Name,
        ["fleet"] = r.B.Fleet,
        ["status"] = r.B.Status,
        ["loginTime"] = r.B.Login?.ToString("yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture),
        ["logoutTime"] = r.B.Logout?.ToString("yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture),
        ["sessionMinutes"] = r.SessionMinutes,
        ["appDuration"] = r.B.Duration,
        ["jobsDatedToday"] = r.JobsDatedToday,
        ["courierPaymentToday"] = r.Payment,
        ["hourlyRate"] = r.HourlyRate,
        ["board"] = r.Board is null ? null : new JsonObject
        {
            ["jobCount"] = r.Board.JobCount,
            ["destinations"] = AgentJobSearchService.Strings(r.Board.Destinations),
            ["areas"] = AgentJobSearchService.Strings(r.Board.Areas)
        },
        ["compliance"] = new JsonObject
        {
            ["class"] = r.Compliance.Class,
            ["credential"] = r.Compliance.Credential,
            ["expiry"] = r.Compliance.Expiry,
            ["daysUntilExpiry"] = r.Compliance.DaysUntilExpiry,
            ["appStatus"] = r.Compliance.AppStatus
        },
        ["flags"] = AgentJobSearchService.Strings(r.Flags)
    };
}
