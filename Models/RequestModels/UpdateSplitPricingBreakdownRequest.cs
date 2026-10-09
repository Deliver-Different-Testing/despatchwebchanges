#nullable enable
namespace DespatchWeb.Models.RequestModels;

/// <summary>
/// One batched save of every edit made in the split-parent pricing grid (Save & Close),
/// per docs/pricing/job-splitting-price-breakdown.md §8 — only touched rows are included.
/// </summary>
public sealed class UpdateSplitPricingBreakdownRequest
{
    public int JobId { get; init; }
    /// <summary>True when the parent has archived — the save then targets the Archive tables.</summary>
    public bool IsArchived { get; init; }
    public IReadOnlyList<SplitPricingItemRevenueUpdate> ItemRevenues { get; init; } = [];
    public IReadOnlyList<SplitPricingAllocationUpdate> Allocations { get; init; } = [];
}
