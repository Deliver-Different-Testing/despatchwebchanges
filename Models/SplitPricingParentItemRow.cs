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
