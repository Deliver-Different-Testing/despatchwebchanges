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
