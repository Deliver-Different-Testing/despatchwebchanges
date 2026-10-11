#nullable enable
namespace DespatchWeb.Models;

/// <summary>
/// A per-leg allocation row, sourced from either PricingBreakdownAllocations or
/// PricingBreakdownAllocationArchive (or synthesized in memory for a pre-feature split) — see
/// <see cref="SplitPricingParentItemRow"/>.
/// </summary>
public sealed record SplitPricingAllocationRow(
    int ParentPricingBreakdownId, int LegJobId, decimal SharePercent, decimal ChargeAmount,
    decimal? CostAmount, decimal? CostOverride);
