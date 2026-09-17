namespace DespatchWeb.Helpers;

/// <summary>
/// Splits an amount across a split job's legs for the Price Breakdown grid (docs/pricing/
/// job-splitting-price-breakdown.md §4.6). Pure — no database — so the rounding rule is
/// unit-testable on its own.
/// </summary>
/// <remarks>
/// Unlike <see cref="SplitPricingAllocator.DistributeAmount"/>, whose LAST leg absorbs the
/// rounding remainder (fine for the initial two-leg split, where "last" is arbitrary), the
/// grid's per-item Share % is edited freely across any number of legs, so the spec asks for
/// the remainder to go to whichever leg carries the LARGEST share instead (§4.6) — the leg an
/// extra cent is least likely to be visibly wrong on.
/// </remarks>
public static class PricingBreakdownAllocationCalculator
{
    /// <summary>
    /// Splits <paramref name="amount"/> by <paramref name="shares"/> (fractions expected to sum
    /// to 1). Every leg but the largest-share one is rounded to 2dp away from zero; the
    /// largest-share leg takes the exact remainder, so the parts always sum back to
    /// <paramref name="amount"/>. Ties go to the first leg to reach the maximum share.
    /// </summary>
    public static IReadOnlyList<decimal> DistributeAmount(decimal amount, IReadOnlyList<decimal> shares)
    {
        if (shares.Count == 0)
        {
            return [];
        }

        if (shares.Count == 1)
        {
            return [amount];
        }

        var largestIndex = 0;
        for (var i = 1; i < shares.Count; i++)
        {
            if (shares[i] > shares[largestIndex])
            {
                largestIndex = i;
            }
        }

        var parts = new decimal[shares.Count];
        var running = 0m;

        for (var i = 0; i < shares.Count; i++)
        {
            if (i == largestIndex)
            {
                continue;
            }

            var part = Math.Round(amount * shares[i], 2, MidpointRounding.AwayFromZero);
            parts[i] = part;
            running += part;
        }

        parts[largestIndex] = amount - running;
        return parts;
    }
}
