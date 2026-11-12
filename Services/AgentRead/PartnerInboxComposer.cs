#nullable enable
using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Services.AgentRead;

public sealed record Acceptance(
    string Status,
    bool Known,
    bool BlocksAllocation,
    decimal? ProposedAgreedRate,
    string? RejectionReason,
    DateTime? ActionedAtUtc,
    string Meaning);

public sealed record PartnerRow(
    JobChangeRequestInboxItem Item,
    double? WaitingHours,
    string Classification,
    Acceptance? Acceptance,
    IReadOnlyList<JobChangeRequestDto> History,
    bool HistoryRead,
    IReadOnlyList<string> Flags,
    IReadOnlyList<string> PriceFlags);

/// <summary>partner_inbox's classification, gate reading and flags, ported from the prototype.</summary>
public static partial class PartnerInboxComposer
{
    public const int MaxLimit = 500;
    public const int DefaultLimit = 100;

    public static (int Effective, string? Warning) ClampLimit(int? requested)
    {
        var asked = requested ?? DefaultLimit;
        if (asked is >= 1 and <= MaxLimit) return (asked, null);
        var effective = asked > MaxLimit ? MaxLimit : 1;
        return (effective,
            $"limit {asked} is outside the 1..500 band the queue honours (it would silently become 200). "
            + $"Asked for {effective} instead; make a second call if the counts say there are more.");
    }

    public static double? HoursSince(DateTime? from, string asOf)
    {
        if (from is null || !TryParseAsOf(asOf, out var b)) return null;
        var a = DateTime.SpecifyKind(from.Value, DateTimeKind.Utc);
        return Math.Round((b - a).TotalHours, 1, MidpointRounding.AwayFromZero);
    }

    public static bool TryParseAsOf(string asOf, out DateTime value)
    {
        var text = asOf.Length == 10 ? asOf + "T00:00:00" : asOf.Replace(' ', 'T');
        var ok = DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out value);
        return ok;
    }

    public static Acceptance ReadAcceptance(PartnerInboundJobAcceptanceStateResponse? state)
    {
        var status = state?.Status ?? "Allowed";
        var meaning = status switch
        {
            "Allowed" => "Allowed OR no acceptance state recorded at all — the route returns \"Allowed\" for both. Never read it as \"the partner accepted\".",
            "PendingAcceptance" => "The partner's offer has not been accepted; allocating this job is blocked until someone reviews it.",
            "Rejected" => "The partner's offer was rejected; allocation stays blocked until the partner re-dispatches or cancels.",
            "Accepted" => "The partner's offer was accepted; no gate.",
            _ => "Unrecognised acceptance status — the gate blocks on anything it does not know."
        };
        return new Acceptance(status, status != "Allowed", status is "PendingAcceptance" or "Rejected",
            state?.ProposedAgreedRate, state?.RejectionReason, state?.ActionedAtUtc, meaning);
    }

    public static PartnerRow ComposeRow(
        JobChangeRequestInboxItem item,
        IReadOnlyList<JobChangeRequestDto>? history,
        Acceptance? acceptance,
        string asOf,
        int staleHours)
    {
        var r = item.Request;
        var waiting = HoursSince(r.RequestedAt, asOf);
        var commercial = r.RequiresCommercialRefresh;
        List<string> flags = [];
        List<string> priceFlags = [];

        if (acceptance?.Status == "PendingAcceptance")
        {
            flags.Add("Offer not accepted — this job cannot be allocated to a driver until the offer is reviewed");
            if (acceptance.ProposedAgreedRate is { } offered) priceFlags.Add($"Offered rate {offered.ToString(CultureInfo.InvariantCulture)}");
        }

        if (acceptance?.Status == "Rejected")
        {
            flags.Add("Offer was REJECTED — allocation stays blocked until the partner re-dispatches or cancels (see acceptance.rejectionReason)");
        }

        if (commercial)
        {
            flags.Add("Approving this re-rates the job — it is a rated field, not a clerical one");
            if (r.OldCommercialAmount is not null || r.NewCommercialAmount is not null)
            {
                priceFlags.Add($"Re-rate moves the amount {Num(r.OldCommercialAmount) ?? "?"} → {Num(r.NewCommercialAmount) ?? "not yet computed"}");
            }
        }

        if (r.ApprovalMode == "Auto" && r.Status == "Pending")
        {
            flags.Add("approvalMode is Auto but the row is still Pending — an auto-apply field should never wait in the inbox; the apply step did not run");
        }

        if (waiting is { } w && w >= staleHours)
        {
            flags.Add($"Waiting {w.ToString(CultureInfo.InvariantCulture)}h — the partner has had no answer since {r.RequestedAt:yyyy-MM-ddTHH:mm:ss}");
        }

        if (r.Origin != "Peer")
        {
            flags.Add($"origin is \"{r.Origin}\", not \"Peer\" — the inbox is expected to hold Peer rows (VoiceAgent rows also wait here by design)");
        }

        var rows = history ?? [];
        var stranded = rows.Where(h => h.Status == "Approved" && h.AppliedAt is null && h.Id != r.Id).ToList();
        if (stranded.Count > 0)
        {
            flags.Add($"{stranded.Count} earlier request(s) on this job are Approved but never Applied — agreed with the partner and never written to the job");
        }

        var priorSameField = rows.Where(h => h.FieldName == r.FieldName && h.Id != r.Id).ToList();
        if (priorSameField.Count > 0)
        {
            flags.Add($"{priorSameField.Count} earlier request(s) on the same field ({string.Join(", ", priorSameField.Select(h => h.Status))}) — this is being asked again");
        }

        var classification = acceptance?.BlocksAllocation == true ? "rate_gate_blocked"
            : commercial ? "commercial"
            : r.ApprovalMode == "Auto" ? "auto_mode_pending"
            : "operational";

        return new PartnerRow(item, waiting, classification, acceptance, rows, history is not null, flags, priceFlags);
    }

    private static string? Num(decimal? v) => v?.ToString(CultureInfo.InvariantCulture);

    public static JsonObject Summarise(IReadOnlyList<PartnerRow> rows)
    {
        var counts = new JsonObject { ["total"] = rows.Count };
        foreach (var c in new[] { "rate_gate_blocked", "commercial", "auto_mode_pending", "operational" })
        {
            counts[c] = rows.Count(r => r.Classification == c);
        }

        counts["stale"] = rows.Count(r => r.Flags.Any(f => f.StartsWith("Waiting ", StringComparison.Ordinal)));
        counts["flagged"] = rows.Count(r => r.Flags.Count > 0 || r.PriceFlags.Count > 0);
        return counts;
    }

    public static string? Time(DateTime? t) => t?.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);

    /// <summary>From/to values take their class from the field they belong to, so phone, price and free-text edits are redacted.</summary>
    public static void AddValues(JsonObject target, string field, string? from, string? to)
    {
        var classes = AgentFieldProjector.ClassesOfField(field);
        var stem = AgentFieldProjector.StemFor(classes);
        var (a, b) = stem.Length == 0 ? ("from", "to") : (stem + "From", stem + "To");
        target[a] = from;
        target[b] = to;
    }

    public static JsonObject Compact(PartnerRow row)
    {
        var r = row.Item.Request;
        var o = new JsonObject
        {
            ["requestId"] = r.Id,
            ["jobId"] = r.JobId,
            ["jobNo"] = row.Item.JobNo,
            ["client"] = row.Item.ClientName,
            ["field"] = r.FieldName
        };
        AddValues(o, r.FieldName, r.CurrentValue, r.RequestedValue);
        o["reason"] = r.Reason;
        o["waitingHours"] = row.WaitingHours;
        o["classification"] = row.Classification;
        o["money"] = Money(r);
        o["acceptance"] = row.Acceptance is null
            ? null
            : new JsonObject
            {
                ["status"] = row.Acceptance.Status,
                ["known"] = row.Acceptance.Known,
                ["proposedAgreedRate"] = row.Acceptance.ProposedAgreedRate
            };
        o["flags"] = AgentJobSearchService.Strings(row.Flags);
        o["priceFlags"] = AgentJobSearchService.Strings(row.PriceFlags);
        return o;
    }

    public static JsonObject Full(PartnerRow row)
    {
        var o = Compact(row);
        var r = row.Item.Request;
        o["status"] = r.Status;
        o["origin"] = r.Origin;
        o["approvalMode"] = r.ApprovalMode;
        o["ruleCode"] = r.RuleCode;
        o["requestingParty"] = r.RequestingPartyType;
        o["approvalParty"] = r.ApprovalPartyType;
        o["pairingId"] = r.PairingId;
        o["partnerJobGuid"] = r.PartnerJobGuid?.ToString();
        o["requestedAt"] = Time(r.RequestedAt);
        o["respondedAt"] = Time(r.RespondedAt);
        o["appliedAt"] = Time(r.AppliedAt);
        o["requiresCommercialRefresh"] = r.RequiresCommercialRefresh;
        o["acceptance"] = row.Acceptance is null ? null : Acceptance(row.Acceptance);
        o["historyRead"] = row.HistoryRead;
        o["history"] = new JsonArray([.. row.History.Select(h => (JsonNode)HistoryRow(h))]);
        return o;
    }

    public static JsonObject Acceptance(Acceptance a) => new()
    {
        ["status"] = a.Status,
        ["known"] = a.Known,
        ["blocksAllocation"] = a.BlocksAllocation,
        ["proposedAgreedRate"] = a.ProposedAgreedRate,
        ["rejectionReason"] = a.RejectionReason,
        ["actionedAtUtc"] = a.ActionedAtUtc?.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture),
        ["meaning"] = a.Meaning
    };

    public static JsonObject HistoryRow(JobChangeRequestDto h) => new()
    {
        ["requestId"] = h.Id,
        ["field"] = h.FieldName,
        ["status"] = h.Status,
        ["origin"] = h.Origin,
        ["requestedAt"] = Time(h.RequestedAt),
        ["respondedAt"] = Time(h.RespondedAt),
        ["appliedAt"] = Time(h.AppliedAt)
    };

    public static JsonObject? Money(JobChangeRequestDto r)
    {
        if (!r.RequiresCommercialRefresh && r.OldCommercialAmount is null && r.NewCommercialAmount is null) return null;
        return new JsonObject
        {
            ["old"] = r.OldCommercialAmount,
            ["new"] = r.NewCommercialAmount,
            ["delta"] = r.OldCommercialAmount is { } o && r.NewCommercialAmount is { } n ? Math.Round(n - o, 2) : null
        };
    }
}

