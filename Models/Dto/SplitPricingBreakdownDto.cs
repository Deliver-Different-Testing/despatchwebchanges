#nullable enable
namespace DespatchWeb.Models.Dto;

public sealed class SplitPricingBreakdownDto
{
    public int JobId { get; init; }
    /// <summary>True when read from the Archive tables; the grid echoes it back on save.</summary>
    public bool IsArchived { get; init; }
    public decimal TotalRevenue { get; init; }
    public decimal TotalCost { get; init; }
    public decimal GrossProfit { get; init; }
    public decimal MarginPercent { get; init; }
    public required IReadOnlyList<SplitPricingBreakdownItemDto> Items { get; init; }
    public required IReadOnlyList<SplitPricingBreakdownLegDto> Legs { get; init; }
    public required SplitPricingLockStateDto Locks { get; init; }
}

public sealed class SplitPricingBreakdownItemDto
{
    public int PricingBreakdownId { get; init; }
    public required string Name { get; init; }
    public decimal Revenue { get; init; }
    public bool IsAccessorial { get; init; }
    public required IReadOnlyList<SplitPricingBreakdownAllocationDto> Allocations { get; init; }
}

public sealed class SplitPricingBreakdownAllocationDto
{
    public int LegJobId { get; init; }
    public decimal SharePercent { get; init; }
    public decimal Revenue { get; init; }
    public decimal? Cost { get; init; }
    public decimal? CostOverride { get; init; }

    /// <summary>
    /// What Cost would be without CostOverride — the value the grid's "was X" + reset
    /// affordance (§3) shows and reverts to. Null exactly when Cost is (the item has no cost).
    /// </summary>
    public decimal? DerivedCost { get; init; }
}

public sealed class SplitPricingBreakdownLegDto
{
    public int JobId { get; init; }
    public required string JobNumber { get; init; }
    public string? DriverName { get; init; }
    public decimal SharePercent { get; init; }
    public decimal Revenue { get; init; }
    public decimal Cost { get; init; }
    public decimal MarginPercent { get; init; }
    public bool CostLocked { get; init; }
    public string? CostLockReason { get; init; }
}

public sealed class SplitPricingLockStateDto
{
    public bool RevenueLocked { get; init; }
    public string? RevenueLockReason { get; init; }
    public bool ShareLocked { get; init; }
    public string? ShareLockReason { get; init; }
}
