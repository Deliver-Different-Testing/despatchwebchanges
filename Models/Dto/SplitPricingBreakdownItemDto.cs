#nullable enable
namespace DespatchWeb.Models.Dto;

public sealed class SplitPricingBreakdownItemDto
{
    public int PricingBreakdownId { get; init; }
    public required string Name { get; init; }
    public decimal Revenue { get; init; }
    public bool IsAccessorial { get; init; }
    public required IReadOnlyList<SplitPricingBreakdownAllocationDto> Allocations { get; init; }
}
