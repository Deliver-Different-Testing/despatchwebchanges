#nullable enable
namespace DespatchWeb.Models;

/// <summary>
/// A split parent's own price item row, sourced from either the live PricingBreakdowns table
/// or its PricingBreakdownArchive counterpart once the job has archived —
/// GetSplitPricingBreakdownAsync reads from whichever applies and works from this one shape
/// either way.
/// </summary>
public sealed record SplitPricingParentItemRow(
    int PricingBreakdownId, string ChargeName, decimal ChargeAmount, decimal? CostAmount, bool IsAccessorial);

/// <summary>
/// A per-leg allocation row, sourced from either PricingBreakdownAllocations or
/// PricingBreakdownAllocationArchive (or synthesized in memory for a pre-feature split) — see
/// <see cref="SplitPricingParentItemRow"/>.
/// </summary>
public sealed record SplitPricingAllocationRow(
    int ParentPricingBreakdownId, int LegJobId, decimal SharePercent, decimal ChargeAmount,
    decimal? CostAmount, decimal? CostOverride);

/// <summary>A split leg's job number and driver name, from either TucJobs or TucJobArchives.</summary>
public sealed record SplitPricingLegJobRow(int UcjbId, string UcjbNumber, string? DriverName);
