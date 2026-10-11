#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class SplitPricingAllocationUpdate
{
    public int PricingBreakdownId { get; init; }
    public int LegJobId { get; init; }
    public decimal? SharePercent { get; init; }
    public decimal? CostOverride { get; init; }
    public bool ResetCostOverride { get; init; }
}
