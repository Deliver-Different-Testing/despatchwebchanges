#nullable enable
using System.Globalization;
using System.Text.Json.Nodes;
using DespatchWeb.Models;

namespace DespatchWeb.Services.AgentRead;

public sealed record SearchTerm(string Kind, string Value);

public sealed record ClassifiedJob(
    JobDownloadModel Row,
    IReadOnlyList<string> MatchedOn,
    bool Confirmed,
    IReadOnlyList<string> FoundBy)
{
    public string? ClientReferenceB => Blank(Row.ClientReferenceB);
    public bool IsVoid => Row.Void;
    public static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

public sealed record Parcel(string? FulfilmentOrderId, List<string> Jobs, int Live, int Voided);

/// <summary>
/// Flags that mention what a job is priced at live in <c>PriceFlags</c> so the cost class hides them; <c>Flags</c> must stay
/// free of amount-derived text. The invoice state and number on a job row are billing status, not a price, and stay neutral.
/// </summary>
public sealed record Assessment(string Verdict, IReadOnlyList<string> Flags, IReadOnlyList<string> PriceFlags);

/// <summary>The order and reference reading of a job search, ported from the shopify_order_jobs prototype.</summary>
public static class JobSearchComposer
{
    public const int SummaryRows = 25;
    public const int DefaultAllRows = 200;
    public const int MaxAllRows = 500;

    public static string NormaliseOrderNumber(string value) => value.Trim().TrimStart('#').Trim();

    public static ClassifiedJob Classify(JobDownloadModel row, IReadOnlyList<SearchTerm> terms, IReadOnlyList<string> foundBy)
    {
        List<string> matched = [];
        foreach (var (column, value) in References(row))
        {
            if (string.IsNullOrWhiteSpace(value)) continue;
            var trimmed = value.Trim();
            foreach (var term in terms)
            {
                if (trimmed == term.Value || NormaliseOrderNumber(trimmed) == term.Value) matched.Add($"{column} = {term.Kind}");
            }
        }

        return new ClassifiedJob(row, matched, matched.Count > 0, foundBy);
    }

    private static IEnumerable<(string Column, string? Value)> References(JobDownloadModel r) =>
    [
        ("OurReference", r.OurReference), ("ClientReferenceA", r.ClientReferenceA),
        ("ClientReferenceB", r.ClientReferenceB), ("ClientReferenceC", r.ClientReferenceC)
    ];

    public static List<Parcel> GroupParcels(IEnumerable<ClassifiedJob> jobs)
    {
        Dictionary<string, Parcel> byRef = [];
        foreach (var job in jobs)
        {
            var key = job.ClientReferenceB ?? "";
            if (!byRef.TryGetValue(key, out var parcel))
            {
                byRef[key] = parcel = new Parcel(job.ClientReferenceB, [], 0, 0);
            }

            parcel.Jobs.Add(string.IsNullOrEmpty(job.Row.JobNumber) ? job.Row.Id.ToString(CultureInfo.InvariantCulture) : job.Row.JobNumber);
            byRef[key] = job.IsVoid ? parcel with { Voided = parcel.Voided + 1 } : parcel with { Live = parcel.Live + 1 };
        }

        return [.. byRef.Values];
    }

    public static (bool Usable, string? Reason) ParcelIdsUsable(IReadOnlyList<ClassifiedJob> jobs)
    {
        if (jobs.Count == 0) return (false, "no confirmed jobs to count");
        if (jobs.Any(j => j.ClientReferenceB is null))
        {
            return (false, "at least one job has an empty ClientReferenceB, so it cannot be tied to a fulfilment order");
        }

        if (jobs.Any(j => !j.ClientReferenceB!.All(char.IsAsciiDigit)))
        {
            return (false,
                "ClientReferenceB is not a numeric fulfilment order id — the shop has a fixed ClientReferenceB in Settings → Delivery, "
                + "so the same value lands on every job and parcels cannot be counted from despatch");
        }

        return (true, null);
    }

    public static Assessment Assess(
        IReadOnlyList<ClassifiedJob> confirmed,
        IReadOnlyList<ClassifiedJob> unconfirmed,
        IReadOnlyList<Parcel> parcels,
        bool parcelsCountable,
        int? expectedFulfilmentOrders)
    {
        List<string> flags = [];
        List<string> priceFlags = [];
        var live = confirmed.Where(j => !j.IsVoid).ToList();
        var voided = confirmed.Count - live.Count;

        if (confirmed.Count == 0)
        {
            if (unconfirmed.Count > 0)
            {
                flags.Add("UNCONFIRMED ONLY — every hit came from the wildcard's substring match over references, names, contact fields and addresses. "
                          + "It may still be a genuine job matched on ShopRef1/2/3, which the export does not expose: open one job and check.");
                return new Assessment(
                    $"NO CONFIRMED JOB. {unconfirmed.Count} job(s) matched the wildcard but no reference column equals the order — count none of them as this order's.",
                    flags, []);
            }

            return new Assessment("NO JOB FOUND for this order in the searched window.", flags, []);
        }

        var parcelWord = parcelsCountable ? $"{parcels.Count} fulfilment order(s)" : "an uncountable number of fulfilment orders";
        var verdict = $"{live.Count} live despatch job(s) across {parcelWord}" + (voided > 0 ? $", plus {voided} voided" : "") + ".";

        if (parcelsCountable && expectedFulfilmentOrders is { } expected && parcels.Count < expected)
        {
            flags.Add($"PARTIAL BOOKING — {parcels.Count} fulfilment order(s) have a job but you said Shopify shows {expected}. "
                      + "The app returns only the successful bookings so Shopify never retries; the missing parcels have no job and no alert, "
                      + "only a Log.Warning. Book them by hand.");
            verdict += " A parcel is missing its job.";
        }

        if (parcelsCountable && expectedFulfilmentOrders is { } more && parcels.Count > more)
        {
            flags.Add($"MORE PARCELS THAN EXPECTED — {parcels.Count} distinct fulfilment order ids carry jobs but you said Shopify shows {more}. "
                      + "Re-read the order in Shopify before acting.");
        }

        var doubled = parcels.Where(p => p.Live > 1).ToList();
        if (parcelsCountable && doubled.Count > 0)
        {
            flags.Add($"DOUBLE BOOKED — fulfilment order(s) {string.Join(", ", doubled.Select(p => p.FulfilmentOrderId ?? "(blank)"))} have more than one live job. "
                      + "The only guard against re-booking is the string \"Job Numbers:\" inside the Shopify order's free-text field — "
                      + "editing or clearing that field re-arms both the webhook and the poller. Void the duplicates; re-tagging the order is not enough. "
                      + "One caveat before you act: a shop with a fixed NUMERIC ClientReferenceB in Settings → Delivery puts the same value on every job and looks "
                      + "exactly like this — check that setting first.");
            verdict += " A parcel has been booked twice.";
        }

        if (live.Count == 0)
        {
            flags.Add("EVERY JOB IS VOID — this order has no live delivery. Cancelling in Shopify does not void a job (api/Orders/Cancelled is a no-op), so someone voided these by hand.");
        }

        if (live.Any(j => j.Row.Amount == 0))
        {
            priceFlags.Add("A live job is priced $0 — a postcode in no zone, or a manual price never entered. It will invoice at zero.");
        }

        if (live.Any(j => j.Row.Amount is null))
        {
            priceFlags.Add("A live job has a blank Amount — unpriced, not free.");
        }

        if (confirmed.Any(j => j.Row.IsArchived))
        {
            flags.Add("At least one job is archived — archived jobs carry their own edit traps.");
        }

        if (unconfirmed.Count > 0)
        {
            flags.Add($"{unconfirmed.Count} further job(s) matched the wildcard but carry the order in no reference column — listed as unconfirmed and excluded from every count above.");
        }

        return new Assessment(verdict, flags, priceFlags);
    }

    // invoiceState / invoiceNumber are billing status (is there an invoice), not a price, so they stay in the neutral members on purpose.
    public static string InvoiceState(int? invoiceNumber) => invoiceNumber switch
    {
        null => "uninvoiced",
        0 => "zero",
        _ => "invoiced"
    };

    public static JsonObject ToJson(ClassifiedJob job, bool detailed = false)
    {
        var r = job.Row;
        var json = new JsonObject
        {
            ["id"] = r.Id,
            ["jobNumber"] = r.JobNumber,
            ["client"] = ClassifiedJob.Blank(r.CustomerName),
            ["status"] = ClassifiedJob.Blank(r.StatusName),
            ["booked"] = Iso(r.BookDate),
            ["pickedUp"] = Iso(r.PickedUpDate),
            ["delivered"] = Iso(r.DeliveredDate),
            ["amount"] = r.Amount,
            ["void"] = r.Void,
            ["archived"] = r.IsArchived,
            ["invoiceState"] = InvoiceState(r.InvoiceNumber),
            ["invoiceNumber"] = r.InvoiceNumber is null ? null : r.InvoiceNumber.Value.ToString(CultureInfo.InvariantCulture),
            ["ourReference"] = ClassifiedJob.Blank(r.OurReference),
            ["clientReferenceA"] = ClassifiedJob.Blank(r.ClientReferenceA),
            ["clientReferenceB"] = job.ClientReferenceB,
            ["clientReferenceC"] = ClassifiedJob.Blank(r.ClientReferenceC),
            ["matchedOn"] = new JsonArray([.. job.MatchedOn.Select(m => (JsonNode)JsonValue.Create(m)!)]),
            ["confirmed"] = job.Confirmed,
            ["foundBy"] = new JsonArray([.. job.FoundBy.Select(m => (JsonNode)JsonValue.Create(m)!)])
        };

        if (!detailed) return json;

        json["speed"] = ClassifiedJob.Blank(r.Speed);
        json["courierCode"] = ClassifiedJob.Blank(r.CourierCode);
        json["pickupAddress"] = Address(r.PickupAddressLine1, r.PickupAddressLine2, r.PickupAddressLine3, r.PickupAddressLine4, r.PickupAddressLine5, r.PickupAddressLine6, r.PickupAddressLine7, r.PickupAddressLine8);
        json["deliveryAddress"] = Address(r.DeliveryAddressLine1, r.DeliveryAddressLine2, r.DeliveryAddressLine3, r.DeliveryAddressLine4, r.DeliveryAddressLine5, r.DeliveryAddressLine6, r.DeliveryAddressLine7, r.DeliveryAddressLine8);
        json["notes"] = ClassifiedJob.Blank(r.Notes);
        return json;
    }

    public static string? Iso(DateTime? value) => value?.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);

    public static string? Address(params string?[] lines)
    {
        var parts = lines.Where(l => !string.IsNullOrWhiteSpace(l)).Select(l => l!.Trim()).ToList();
        return parts.Count == 0 ? null : string.Join(", ", parts);
    }
}
