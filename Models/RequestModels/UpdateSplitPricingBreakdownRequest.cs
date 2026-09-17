#nullable enable
namespace DespatchWeb.Models.RequestModels;

/// <summary>
/// One batched save of every edit made in the split-parent pricing grid (Save & Close),
/// per docs/pricing/job-splitting-price-breakdown.md §8 — only touched rows are included.
/// </summary>
public sealed class UpdateSplitPricingBreakdownRequest
{
    public int JobId { get; init; }
    public IReadOnlyList<SplitPricingItemRevenueUpdate> ItemRevenues { get; init; } = [];
    public IReadOnlyList<SplitPricingAllocationUpdate> Allocations { get; init; } = [];
}

public sealed class SplitPricingItemRevenueUpdate
{
    public int PricingBreakdownId { get; init; }
    public decimal Revenue { get; init; }
}

public sealed class SplitPricingAllocationUpdate
{
    public int PricingBreakdownId { get; init; }
    public int LegJobId { get; init; }
    public decimal? SharePercent { get; init; }
    public decimal? CostOverride { get; init; }
    public bool ResetCostOverride { get; init; }
}
