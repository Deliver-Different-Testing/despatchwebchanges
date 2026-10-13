#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class SplitPricingItemRevenueUpdate
{
    public int PricingBreakdownId { get; init; }
    public decimal Revenue { get; init; }
    /// <summary>Null when the name wasn't touched; the grid always sends the full new name otherwise.</summary>
    public string? Name { get; init; }
}
