#nullable enable
namespace DespatchWeb.Models.Dto;

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
