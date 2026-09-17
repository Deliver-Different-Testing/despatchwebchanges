namespace DespatchWeb.Models.RequestModels;

/// <summary>
/// One leg's confirmed share of a single breakdown line, for a charge that shouldn't follow the
/// overall split — a congestion charge only one leg's route incurred, for example. Lines with no
/// entry here keep following <see cref="SplitJobRequest.PricingAllocation"/>.
/// </summary>
public sealed class SplitPricingLineAllocationItem
{
    /// <summary>The parent PricingBreakdown row this override applies to; 0 for the synthesised line.</summary>
    public int PricingBreakdownId { get; init; }

    /// <summary>The leg this share applies to — 1 = pickup leg, 2 = delivery leg.</summary>
    public int Sequence { get; init; }

    /// <summary>This line's share for this leg, as a percentage. Shares are normalised server-side.</summary>
    public decimal SharePercent { get; init; }

    /// <summary>
    /// This leg's cost for this line, set directly rather than derived from
    /// <see cref="SharePercent"/> — a driver paid a fixed amount regardless of the revenue split.
    /// Null means derived (the default).
    /// </summary>
    public decimal? CostOverride { get; init; }
}
