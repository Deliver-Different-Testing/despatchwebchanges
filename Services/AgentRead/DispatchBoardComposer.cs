#nullable enable
using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DespatchWeb.Enums;
using DespatchWeb.Models;

namespace DespatchWeb.Services.AgentRead;

public sealed record BoardDriver(int? Id, string? Name, string? Code);

public sealed record BoardRow(
    int Id,
    string? JobNo,
    string? Client,
    string? From,
    string? To,
    string? Speed,
    DateTime? Booked,
    int StatusId,
    string Status,
    string? StatusWord,
    BoardDriver? Driver,
    double? RemainMinutes,
    string Bucket,
    bool Late,
    string? LateBecause,
    bool IsBulk,
    bool IsPartner);

/// <summary>
/// dispatch_board's bucketing: every row is classified here from the resolved status trio, never the raw status id or the
/// tenant's renameable status word, and never by the app's needs-dispatch filter (which lists voids as work waiting).
/// </summary>
public static partial class DispatchBoardComposer
{
    private static readonly int[] LateStatuses = [(int)JobStatus.LatePickup, (int)JobStatus.LateDelivery];

    [GeneratedRegex("^n/?a$", RegexOptions.IgnoreCase)]
    private static partial Regex Placeholder();

    private static string? Real(string? v) => string.IsNullOrWhiteSpace(v) || Placeholder().IsMatch(v.Trim()) ? null : v.Trim();

    /// <summary>A job is allocated only when a courier is really attached; the board projection fills "N/A", which is not one.</summary>
    public static BoardDriver? DriverOf(DispatchJobViewModel row)
    {
        var data = row.CourierData;
        var id = row.AssignedCourier?.Id is > 0 ? row.AssignedCourier.Id : data?.CourierId;
        var name = Real(row.AssignedCourier?.Text) ?? Real(data?.CourierName);
        var code = Real(row.Courier) ?? Real(data?.CourierNumber);
        return id is null && name is null && code is null ? null : new BoardDriver(id, name, code);
    }

    private static string? Address(AddressViewModel? a, string? fallback)
    {
        if (a is not null)
        {
            var parts = new[] { a.AddressLine1, a.AddressLine5, a.AddressLine6, a.AddressLine7 }.Select(Real).Where(p => p is not null).ToList();
            if (parts.Count > 0) return string.Join(", ", parts);
        }

        return Real(fallback);
    }

    public static string StatusName(int id) => Enum.IsDefined(typeof(JobStatus), id) ? ((JobStatus)id).ToString() : $"Unknown({id})";

    public static (List<BoardRow> Rows, JsonObject Counts, List<string> Warnings) Classify(IReadOnlyList<DispatchJobViewModel> jobs)
    {
        var rows = jobs.Select(Row).ToList();
        int Count(Func<BoardRow, bool> f) => rows.Count(f);
        var running = (BoardRow r) => r.Bucket is "needs-driver" or "allocated";
        var counts = new JsonObject
        {
            ["rows"] = rows.Count,
            ["needsDriver"] = Count(r => r.Bucket == "needs-driver"),
            ["allocated"] = Count(r => r.Bucket == "allocated"),
            ["delivered"] = Count(r => r.Bucket == "delivered"),
            ["undeliverable"] = Count(r => r.Bucket == "undeliverable"),
            ["void"] = Count(r => r.Bucket == "void"),
            ["late"] = Count(r => r.Late),
            ["remainUnknown"] = Count(r => running(r) && r.RemainMinutes is null)
        };

        List<string> warnings = [];
        var unknown = (int)counts["remainUnknown"]!;
        if (unknown > 0)
        {
            warnings.Add($"{unknown} running job(s) have remain=null — their speed has no JobTypeMins, so \"on time\" is UNKNOWN for them, not true.");
        }

        return (rows, counts, warnings);
    }

    private static BoardRow Row(DispatchJobViewModel j)
    {
        var statusId = j.ResolvedStatusId;
        var driver = DriverOf(j);
        var bucket = j.ResolvedIsVoid ? "void"
            : statusId == (int)JobStatus.Undeliverable ? "undeliverable"
            : j.ResolvedIsComplete ? "delivered"
            : driver is null ? "needs-driver"
            : "allocated";
        var running = bucket is "needs-driver" or "allocated";
        var lateByStatus = running && LateStatuses.Contains(statusId);
        var lateByClock = running && j.Remain is < 0;
        return new BoardRow(
            j.Id, Real(j.JobNo), Real(j.ClientName) ?? Real(j.Client),
            Address(j.PickupAddress, j.From), Address(j.DeliveryAddress, j.ToAddress),
            Real(j.Speed), j.Booked, statusId, StatusName(statusId), Real(j.StatusName), driver, j.Remain, bucket,
            lateByStatus || lateByClock,
            lateByStatus ? $"status is {StatusName(statusId)}"
                : lateByClock ? $"{Math.Abs(j.Remain!.Value).ToString("0.##", CultureInfo.InvariantCulture)} minutes past its service-level target"
                : null,
            j.IsBulkJob, j.IsPartnerJob);
    }

    public static JsonObject ToJson(BoardRow r) => new()
    {
        ["id"] = r.Id,
        ["jobNo"] = r.JobNo,
        ["client"] = r.Client,
        ["from"] = r.From,
        ["to"] = r.To,
        ["speed"] = r.Speed,
        ["booked"] = r.Booked?.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture),
        ["statusId"] = r.StatusId,
        ["status"] = r.Status,
        ["statusWord"] = r.StatusWord,
        ["driver"] = r.Driver is null ? null : new JsonObject { ["id"] = r.Driver.Id, ["name"] = r.Driver.Name, ["code"] = r.Driver.Code },
        ["remainMinutes"] = r.RemainMinutes,
        ["bucket"] = r.Bucket,
        ["late"] = r.Late,
        ["lateBecause"] = r.LateBecause,
        ["isBulk"] = r.IsBulk,
        ["isPartner"] = r.IsPartner
    };

    /// <summary>Who stands on which clear list; areas appear both directly and under columns, so they are de-duplicated.</summary>
    public static JsonObject SummariseClearLists(ClearListViewModel lists, int? limit)
    {
        var areas = lists.Areas.Concat(lists.Columns.SelectMany(c => c.Areas)).DistinctBy(a => a.Id).ToList();
        var sections = 0;
        var couriersOnLists = 0;
        var totalRemaining = 0;
        List<JsonObject> byArea = [];
        foreach (var a in areas)
        {
            var parts = a.Top.Concat(a.Middle).Concat(a.Bottom).ToList();
            sections += parts.Count;
            var couriers = parts.Select(p => Real(p.CourierNumber) ?? p.CourierData?.CourierId?.ToString(CultureInfo.InvariantCulture)).Where(c => c is not null).Distinct().Count();
            couriersOnLists += couriers;
            totalRemaining += a.TotalRemaining;
            byArea.Add(new JsonObject
            {
                ["id"] = a.Id,
                ["name"] = a.Name,
                ["couriers"] = couriers,
                ["jobs"] = parts.Sum(p => p.JobCount),
                ["totalRemaining"] = a.TotalRemaining
            });
        }

        return new JsonObject
        {
            ["areas"] = areas.Count,
            ["sections"] = sections,
            ["couriersOnLists"] = couriersOnLists,
            ["totalRemaining"] = totalRemaining,
            ["byArea"] = new JsonArray([.. (limit is { } l ? byArea.Take(l) : byArea).Select(o => (JsonNode)o)])
        };
    }
}
