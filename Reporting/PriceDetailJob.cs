#nullable enable
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Reporting;

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
        if (arrive is null || depart is null)
        {
            return null;
        }

        var m = (depart.Value - arrive.Value).TotalMinutes;
        return m is >= 0 and <= 600 ? (int)Math.Round(m) : null;
    }
}
