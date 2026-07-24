#nullable enable
using System.Globalization;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Reporting;

// The render input for PriceDetailSpreadsheet. Pure data + the mapping logic that turns raw
// repository rows into per-job audit rows: as-booked reconstruction (120s-first-insert rule),
// current-line bucketing, the change log with staff attribution, and UTC to tenant-local
// conversion. No DB, no EF - all fetching happened in the repository.
public sealed class PriceDetailReportData
{
    // As-booked = every pricing line inserted within this window of the first insert. Real DFRNT
    // data shows all inserts land in the same tick, so 120s is a safe upper bound.
    private static readonly TimeSpan AsBookedWindow = TimeSpan.FromSeconds(120);
    public IReadOnlyList<PriceDetailJob> Jobs { get; private init; } = [];
    public IReadOnlyList<PriceChangeLogEntry> ChangeLog { get; private init; } = [];
    public List<PriceFinding> Findings { get; set; } = [];

    public static PriceDetailReportData From(PriceDetailReportRaw raw, ITenantInfoService info)
    {
        var linesByJob = raw.CurrentLines.GroupBy(l => l.JobId)
            .ToDictionary(g => g.Key, g => g.ToList());
        var historyByJob = raw.History.GroupBy(h => h.JobId)
            .ToDictionary(g => g.Key, g => g.OrderBy(h => h.AtUtc).ToList());

        var jobs = new List<PriceDetailJob>();
        var changeLog = new List<PriceChangeLogEntry>();

        foreach (var h in raw.Headers)
        {
            var current = linesByJob.GetValueOrDefault(h.JobId) ?? [];
            var history = historyByJob.GetValueOrDefault(h.JobId) ?? [];

            var booked = ReconstructAsBooked(current, history);
            var (changes, log) = BuildChanges(h, history, info);
            changeLog.AddRange(log);

            var firstInsertUtc = history
                .Where(x => x is { FieldName: "PricingBreakdown", OldValue: null })
                .Select(x => (DateTime?)x.AtUtc).Min();
            var bookedAtStamp = firstInsertUtc.HasValue
                ? info.ConvertUtcToTenantTimeZone(firstInsertUtc.Value).DateTime.ToString(
                    info.IsUsTenant() ? "MM-dd HH:mm" : "dd-MM HH:mm", CultureInfo.InvariantCulture)
                : "";

            jobs.Add(new PriceDetailJob(h, booked, current, changes, AsBookedSourceOf(history), bookedAtStamp));
        }

        return new PriceDetailReportData { Jobs = jobs, ChangeLog = changeLog, Findings = [] };
    }

    // As-booked lines = the first PricingBreakdown insert batch (all inserts within
    // AsBookedWindow of the earliest insert). This deliberately includes booking-screen
    // accessorials typed seconds after the engine rate lines.
    // Fallback for older jobs with no early itemised batch: roll the CURRENT lines back through
    // every "Pricing: name" value-delta. In DFRNT staging this fallback is dormant (zero
    // "Pricing: <name>" rows exist) but the code stays for tenants that emit them.
    private static List<AsBookedLine> ReconstructAsBooked(
        List<PriceDetailLineRow> current, List<PricingChangeRow> history)
    {
        var inserts = history
            .Where(h => h is { FieldName: "PricingBreakdown", OldValue: null, NewValue: not null })
            .OrderBy(h => h.AtUtc)
            .ToList();

        if (inserts.Count > 0)
        {
            var t0 = inserts[0].AtUtc;
            var batch = inserts.Where(h => h.AtUtc - t0 <= AsBookedWindow);
            var lines = new List<AsBookedLine>();
            foreach (var row in batch)
            {
                if (TryParseNamed(row.NewValue!, out var name, out var amount))
                    lines.Add(new AsBookedLine(name, amount));
            }

            if (lines.Count > 0) return lines;
        }

        // Fallback: current minus sum of each line's value deltas.
        var deltas = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        foreach (var h in history.Where(h => h.FieldName.StartsWith("Pricing: ", StringComparison.Ordinal)))
        {
            var name = h.FieldName.Substring("Pricing: ".Length).Trim();
            deltas[name] = deltas.GetValueOrDefault(name) + (ParseDec(h.NewValue) - ParseDec(h.OldValue));
        }

        return
        [
            .. current
                .Select(c =>
                    new AsBookedLine(c.ChargeName, c.ChargeAmount - deltas.GetValueOrDefault(c.ChargeName.Trim())))
        ];
    }

    private static AsBookedSource AsBookedSourceOf(List<PricingChangeRow> history)
    {
        var created = history.FirstOrDefault(h => h.FieldName == "CreatedBySp");
        var sp = created?.NewValue?.ToLowerInvariant() ?? "";
        if (sp.Contains("prebook")) return AsBookedSource.NightlySp;
        if (string.IsNullOrEmpty(sp)) return AsBookedSource.Manual;
        return AsBookedSource.Engine;
    }

    private static (List<string> Summary, List<PriceChangeLogEntry> Log) BuildChanges(
        PriceDetailHeaderRow h, List<PricingChangeRow> history, ITenantInfoService info)
    {
        var t0 = history
            .Where(x => x is { FieldName: "PricingBreakdown", OldValue: null })
            .Select(x => (DateTime?)x.AtUtc).Min();

        var summary = new List<string>();
        var log = new List<PriceChangeLogEntry>();

        foreach (var r in history)
        {
            var local = info.ConvertUtcToTenantTimeZone(r.AtUtc);
            var stamp = local.DateTime.ToString(info.IsUsTenant() ? "MM-dd HH:mm" : "dd-MM HH:mm",
                CultureInfo.InvariantCulture);

            log.Add(new PriceChangeLogEntry(h.JobNo, local, r.ActorName, r.FieldName, r.OldValue, r.NewValue));

            string? line = null;
            if (r.FieldName == "PricingBreakdown")
            {
                if (r.OldValue is null && r.NewValue is not null)
                {
                    // Skip the initial booking batch - that's "as booked", not a change.
                    if (t0 is { } start && r.AtUtc - start <= AsBookedWindow) continue;
                    line = TryParseNamed(r.NewValue, out var nm, out var amt)
                        ? $"line added: {nm} {amt:C}"
                        : $"line added: {r.NewValue}";
                }
                else if (r.OldValue is not null && r.NewValue is null)
                    line = $"line DELETED: {r.OldValue}";
                else
                    line = $"line renamed: {r.OldValue} -> {r.NewValue}";
            }
            else if (r.FieldName.StartsWith("Pricing: ", StringComparison.Ordinal))
                line = $"{r.FieldName.Substring(9).Trim()}: {ParseDec(r.OldValue):C} -> {ParseDec(r.NewValue):C}";
            else if (r.FieldName is "ucjbVoid" && Truthy(r.NewValue))
                line = "VOIDED";
            else if (r.FieldName is "ucjbAmount" or "FuelSurchargeAmount")
                line = $"{r.FieldName}: {r.OldValue} -> {r.NewValue}";

            if (line is not null) summary.Add($"{stamp} [{r.ActorName}] {line}");
        }

        return (summary, log);
    }

    // Parses "Name: $146.25" - names can contain colons/spaces so split on the last ": $".
    private static bool TryParseNamed(string raw, out string name, out decimal amount)
    {
        name = "";
        amount = 0m;
        var idx = raw.LastIndexOf(": $", StringComparison.Ordinal);
        if (idx < 0) return false;
        name = raw[..idx].Trim().TrimEnd(':').Trim();
        return decimal.TryParse(raw[(idx + 3)..].Replace(",", ""), NumberStyles.Any,
            CultureInfo.InvariantCulture, out amount);
    }

    private static decimal ParseDec(string? s) =>
        decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;

    private static bool Truthy(string? s) => s is "1" or "true" or "True";
}

public enum AsBookedSource
{
    Engine,
    NightlySp,
    Manual
}

public sealed record AsBookedLine(string ChargeName, decimal Amount);

public sealed record PriceChangeLogEntry(
    string JobNo,
    DateTimeOffset WhenLocal,
    string Who,
    string Field,
    string? Old,
    string? New);

// One assembled job: header + booked + current + change summary, with computed rollups.
public sealed class PriceDetailJob(
    PriceDetailHeaderRow header,
    IReadOnlyList<AsBookedLine> booked,
    IReadOnlyList<PriceDetailLineRow> current,
    IReadOnlyList<string> changeSummary,
    AsBookedSource asBookedSource,
    string bookedAtStamp = "")
{
    public PriceDetailHeaderRow Header { get; } = header;
    public IReadOnlyList<AsBookedLine> Booked { get; } = booked;
    public IReadOnlyList<PriceDetailLineRow> Current { get; } = current;
    public IReadOnlyList<string> ChangeSummary { get; } = changeSummary;

    public AsBookedSource AsBookedSource { get; } = asBookedSource;

    // First PricingBreakdown insert time for this job, formatted in tenant-local time (empty when
    // the job has no journey-recorded booking - e.g. purely manual jobs).
    public string BookedAtStamp { get; } = bookedAtStamp;

    // IsRecurringJob is dead (0 on all jobs incl. P-jobs); use parent id or P-prefix.
    public bool IsRecurring => Header.BookingParentId is not null || Header.JobNoIsPPrefix;
    public bool IsManual => Booked.Count == 0 || AsBookedSource == AsBookedSource.Manual;

    public decimal CurrentLinesTotal => Current.Sum(l => l.ChargeAmount);
    public decimal HeaderVsLinesGap => (Header.HeaderAmount ?? 0m) - CurrentLinesTotal;

    public decimal? SystemMiles =>
        PriceLineClassifier.SystemMilesFromLines(Current.Select(l => l.ChargeName));

    public int? OnSitePickupMinutes => Minutes(Header.PickupArrivalUtc, Header.PickupTimeUtc);
    public int? OnSiteDeliveryMinutes => Minutes(Header.DeliveryArrivalUtc, Header.CompletionUtc);

    public decimal BucketTotal(PriceLineClassifier.Bucket b, bool booked = false) =>
        booked
            ? Booked.Where(l => PriceLineClassifier.Classify(l.ChargeName) == b).Sum(l => l.Amount)
            : Current.Where(l => PriceLineClassifier.Classify(l.ChargeName) == b).Sum(l => l.ChargeAmount);

    public string RateBasis(bool booked)
    {
        var names = booked ? Booked.Select(l => l.ChargeName) : Current.Select(l => l.ChargeName);
        return names.Any(n => PriceLineClassifier.ParseMiles(n) is not null) ? "Mileage" : "Zone (flat)";
    }

    private static int? Minutes(DateTime? arrive, DateTime? depart)
    {
        if (arrive is null || depart is null) return null;
        var m = (depart.Value - arrive.Value).TotalMinutes;
        return m is >= 0 and <= 600 ? (int)Math.Round(m) : null;
    }
}

public sealed record PriceFinding(string JobNo, string Type, string Detail, string Severity);