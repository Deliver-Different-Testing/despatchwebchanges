using System.Globalization;
using System.Text.RegularExpressions;

namespace DespatchWeb.Reporting;

// Classifies pricing charge-line NAMES into audit buckets, and parses distance from
// distance-line names. Name-based on purpose: PricingBreakdown.IsAccessorial is a dead flag
// (0 on every engine line - confirmed on DFRNT 671/671). Never read RawBaseAmount here
// (it lumps accessorials into base - audit invariant #3).
public static partial class PriceLineClassifier
{
    public enum Bucket
    {
        BaseDistance,
        Fuel,
        Weight,
        Cubic,
        Congestion,
        AfterHours,
        WaitTime,
        Tolls,
        HazmatDg,
        Surcharge,
        Other
    }

    // The 9 accessorial buckets, in Job Detail column order.
    public static readonly Bucket[] AccessorialBuckets =
    [
        Bucket.Weight, Bucket.Cubic, Bucket.Congestion, Bucket.AfterHours,
        Bucket.WaitTime, Bucket.Tolls, Bucket.HazmatDg, Bucket.Surcharge, Bucket.Other
    ];

    public static bool IsAccessorial(Bucket b) => Array.IndexOf(AccessorialBuckets, b) >= 0;

    public static Bucket Classify(string chargeName)
    {
        var n = (chargeName ?? string.Empty).Trim().ToLowerInvariant();

        // Fuel is always a separate " Fuel"-suffixed row - bucket to Fuel regardless of parent.
        if (n.Contains("fuel")) return Bucket.Fuel;

        if (n.StartsWith("base") || n.StartsWith("distance")) return Bucket.BaseDistance;
        // Flight / agent / recovery legs carry their own base-like miles - keep them out of
        // BaseDistance to avoid double-counting.
        if (n.StartsWith("pickup (") || n.StartsWith("delivery (") || n.Contains("flight"))
            return Bucket.Other;

        if (n.Contains("weight")) return Bucket.Weight;
        if (n.Contains("cubic") || n == "cube") return Bucket.Cubic;
        if (n.Contains("congestion")) return Bucket.Congestion;
        if (n.Contains("after hours") || n.StartsWith("after")) return Bucket.AfterHours;
        if (n.Contains("wait")) return Bucket.WaitTime;
        if (n.Contains("toll")) return Bucket.Tolls;
        if (n.Contains("dangerous goods") || n.Contains("hazmat") || n == "dg") return Bucket.HazmatDg;
        return n.Contains("surcharge")
            ? Bucket.Surcharge
            :
            // Holiday, Stop Offs, Pallets, Dry Ice, Items, Manually Rated, Extra Stop, and anything
            // else the engine emits that we don't have a dedicated bucket for.
            Bucket.Other;
    }

    // Parses miles from a distance-line name.
    //   "Distance (20 mi incl., 65 mi charged)" -> (included: 20, charged: 65)
    //   "Distance (69 mi charged)"              -> (included: 0,  charged: 69)
    //   "Base (108 miles)" / "Pickup (12 miles)"-> (included: 0,  charged: 108)
    // Returns null when the name carries no mileage.
    public static (decimal Included, decimal Charged)? ParseMiles(string chargeName)
    {
        if (string.IsNullOrWhiteSpace(chargeName)) return null;

        var incl = IncRegex().Match(chargeName);
        var chg = ChgRegex().Match(chargeName);
        if (incl.Success || chg.Success)
        {
            return (ParseDec(incl.Groups[1].Value), ParseDec(chg.Groups[1].Value));
        }

        var plain = PlainRegex().Match(chargeName);
        if (plain.Success) return (0m, ParseDec(plain.Groups[1].Value));

        return null;
    }

    // System distance parsed from a job's current lines (first distance line found).
    public static decimal? SystemMilesFromLines(IEnumerable<string> chargeNames)
    {
        foreach (var name in chargeNames)
        {
            var m = ParseMiles(name);
            if (m is { } v) return v.Included + v.Charged;
        }

        return null;
    }

    private static decimal ParseDec(string s) =>
        decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;

    [GeneratedRegex(@"([\d.]+)\s*mi(?:les)?\s*incl", RegexOptions.IgnoreCase, "en-NZ")]
    private static partial Regex IncRegex();

    [GeneratedRegex(@"([\d.]+)\s*mi(?:les)?\s*charged", RegexOptions.IgnoreCase, "en-NZ")]
    private static partial Regex ChgRegex();

    [GeneratedRegex(@"\(([\d.]+)\s*mi(?:les)?\)", RegexOptions.IgnoreCase, "en-NZ")]
    private static partial Regex PlainRegex();
}