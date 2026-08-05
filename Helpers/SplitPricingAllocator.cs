using System.Globalization;
using System.Text.RegularExpressions;
using DespatchWeb.Reporting;

namespace DespatchWeb.Helpers;

/// <summary>
/// Divides a split parent's pricing breakdown lines across its legs, proportional to each leg's
/// share of the trip. Pure — no database and no HTTP — so the allocation maths is unit-testable
/// on its own.
/// </summary>
/// <remarks>
/// Each parent line becomes one line per leg, named "<c>{original} Part {suffix}</c>". The legs of
/// a line always sum back to the original amount (the last leg absorbs the rounding remainder), so
/// the parent's line total — and therefore the client invoice — is unchanged by a split.
/// </remarks>
public static partial class SplitPricingAllocator
{
    /// <summary>Matches the <c>ChargeName</c> column length validated in AddJobPriceBreakdownAsync.</summary>
    public const int MaxChargeNameLength = 100;

    /// <summary>Charge name used when the parent carries no itemised lines to divide.</summary>
    public const string ManuallyRatedChargeName = "Manually Rated";

    /// <summary>How the per-leg shares were derived, surfaced to the user in the confirmation dialog.</summary>
    public enum AllocationBasis
    {
        /// <summary>HERE Maps road miles per leg.</summary>
        RoadMiles,

        /// <summary>Straight-line (haversine) miles per leg.</summary>
        StraightLine,

        /// <summary>Shares supplied by the user in the split pricing dialog.</summary>
        UserConfirmed,

        /// <summary>Each leg's independently calculated rate.</summary>
        LegRates,

        /// <summary>Equal shares — no usable distance or rate for any leg.</summary>
        EvenSplit
    }

    /// <summary>A line on the parent job, before it is divided.</summary>
    public sealed record ParentLine(
        int PricingBreakdownId,
        string ChargeName,
        decimal ChargeAmount,
        decimal? CostAmount,
        bool IsAccessorial = false);

    /// <summary>A split leg and its weighting.</summary>
    /// <param name="Sequence">The leg's <c>TucJob.Sequence</c> (1 = pickup leg, 2 = delivery leg).</param>
    /// <param name="LetterSuffix">The leg's job-number suffix — "A", "B", and C/D… for re-splits.</param>
    /// <param name="Miles">Miles travelled on this leg. Zero when no distance could be determined.</param>
    /// <param name="SharePercentOverride">
    /// A share the user confirmed in the dialog, as a percentage. When any leg supplies one, the
    /// overrides win over <paramref name="Miles"/> and are normalised to total 100%.
    /// </param>
    public sealed record LegWeight(
        int Sequence,
        string LetterSuffix,
        decimal Miles,
        decimal? SharePercentOverride = null);

    /// <summary>A line to be written against one leg.</summary>
    public sealed record AllocatedLine(
        int Sequence,
        string LetterSuffix,
        string ChargeName,
        decimal ChargeAmount,
        decimal? CostAmount,
        bool IsAccessorial);

    /// <summary>
    /// Returns each leg's fractional share, in the order the legs were supplied. Shares always sum
    /// to exactly 1: user overrides take precedence, then mileage, then an equal split.
    /// </summary>
    public static IReadOnlyList<decimal> Shares(IReadOnlyList<LegWeight> legs)
    {
        if (legs.Count == 0)
        {
            return [];
        }

        var overrideTotal = legs.Sum(l => l.SharePercentOverride ?? 0m);
        if (legs.Any(l => l.SharePercentOverride.HasValue) && overrideTotal > 0m)
        {
            return Normalise(legs.Select(l => (l.SharePercentOverride ?? 0m) / overrideTotal).ToList());
        }

        return SharesFromWeights(legs.Select(l => l.Miles).ToList());
    }

    /// <summary>
    /// Normalises arbitrary non-negative weights into shares totalling exactly 1, falling back to an
    /// equal split when every weight is zero.
    /// </summary>
    public static IReadOnlyList<decimal> SharesFromWeights(IReadOnlyList<decimal> weights)
    {
        if (weights.Count == 0)
        {
            return [];
        }

        var total = weights.Sum();
        return total > 0m
            ? Normalise(weights.Select(w => w / total).ToList())
            : Normalise(weights.Select(_ => 1m / weights.Count).ToList());
    }

    /// <summary>
    /// Splits an amount by the given shares, rounding each to 2dp with the last share absorbing the
    /// remainder so the parts always sum back to <paramref name="amount"/> exactly.
    /// </summary>
    public static IReadOnlyList<decimal> DistributeAmount(decimal amount, IReadOnlyList<decimal> shares)
    {
        var parts = new List<decimal>(shares.Count);
        var running = 0m;

        for (var i = 0; i < shares.Count; i++)
        {
            if (i == shares.Count - 1)
            {
                parts.Add(amount - running);
                break;
            }

            var part = Math.Round(amount * shares[i], 2, MidpointRounding.AwayFromZero);
            parts.Add(part);
            running += part;
        }

        return parts;
    }

    /// <summary>
    /// Divides every parent line across the legs. Returns the lines grouped leg-by-leg in the order
    /// the parent lines were supplied.
    /// </summary>
    public static IReadOnlyList<AllocatedLine> Allocate(
        IReadOnlyList<ParentLine> lines,
        IReadOnlyList<LegWeight> legs)
    {
        if (legs.Count == 0 || lines.Count == 0)
        {
            return [];
        }

        var shares = Shares(legs);
        var allocated = new List<AllocatedLine>(lines.Count * legs.Count);

        foreach (var line in lines)
        {
            var revenues = DistributeAmount(line.ChargeAmount, shares);
            var costs = line.CostAmount.HasValue ? DistributeAmount(line.CostAmount.Value, shares) : null;

            allocated.AddRange(legs.Select((t, i) => new AllocatedLine(t.Sequence, t.LetterSuffix, LegChargeName(line.ChargeName, t.LetterSuffix, shares[i]), revenues[i], costs?[i], line.IsAccessorial)));
        }

        return allocated;
    }

    /// <summary>
    /// Falls back to a single synthesised line when the parent has no itemised breakdown, so a split
    /// of a flat/manually-priced job still gives each leg something to show and sum against.
    /// </summary>
    public static IReadOnlyList<ParentLine> EnsureLines(
        IReadOnlyList<ParentLine> lines,
        decimal parentAmount,
        decimal? parentCost) =>
        lines.Count > 0
            ? lines
            : [new ParentLine(0, ManuallyRatedChargeName, parentAmount, parentCost)];

    /// <summary>
    /// Names a leg's copy of a parent line: appends " Part {suffix}", and scales any mileage figure
    /// in the name by the leg's share so per-leg miles parse correctly out of names like
    /// "Base (108 miles)". Truncates the original when the suffix would exceed the column length.
    /// </summary>
    public static string LegChargeName(string chargeName, string letterSuffix, decimal? mileageShare)
    {
        var name = (chargeName ?? string.Empty).Trim();

        if (mileageShare.HasValue && PriceLineClassifier.ParseMiles(name) is not null)
        {
            name = ScaleMiles(name, mileageShare.Value);
        }

        var suffix = $" Part {letterSuffix}";
        var room = MaxChargeNameLength - suffix.Length;
        if (name.Length > room)
        {
            name = name[..Math.Max(0, room)].TrimEnd();
        }

        return $"{name}{suffix}";
    }

    /// <summary>
    /// Converts a 0-based index to an Excel-style letter suffix (0=A, 25=Z, 26=AA, 27=AB, …).
    /// </summary>
    public static string LetterSuffix(int index)
    {
        var result = string.Empty;
        var n = index;

        do
        {
            result = (char)('A' + n % 26) + result;
            n = n / 26 - 1;
        } while (n >= 0);

        return result;
    }

    // Shares are rounded so they read cleanly in the dialog; the last leg absorbs the drift so the
    // set still totals exactly 1 and Distribute's remainder handling stays exact.
    private static List<decimal> Normalise(IReadOnlyList<decimal> raw)
    {
        var shares = new List<decimal>(raw.Count);
        var running = 0m;

        for (var i = 0; i < raw.Count; i++)
        {
            if (i == raw.Count - 1)
            {
                shares.Add(1m - running);
                break;
            }

            var share = Math.Round(raw[i], 6, MidpointRounding.AwayFromZero);
            shares.Add(share);
            running += share;
        }

        return shares;
    }

    // Scales every "<n> mi"/"<n> miles" figure in a charge name, preserving the original's
    // decimal places so "Base (108 miles)" stays whole-numbered.
    private static string ScaleMiles(string name, decimal share) =>
        MilesRegex().Replace(name, match =>
        {
            var raw = match.Groups[1].Value;
            if (!decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var miles))
            {
                return match.Value;
            }

            var dot = raw.IndexOf('.');
            var decimals = dot < 0 ? 0 : raw.Length - dot - 1;
            var scaled = Math.Round(miles * share, decimals, MidpointRounding.AwayFromZero);

            return scaled.ToString($"F{decimals}", CultureInfo.InvariantCulture) + match.Groups[2].Value;
        });

    [GeneratedRegex(@"([\d.]+)(\s*mi(?:les)?\b)", RegexOptions.IgnoreCase, "en-NZ")]
    private static partial Regex MilesRegex();
}
