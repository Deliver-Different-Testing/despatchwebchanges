namespace DespatchWeb.Models.Dto;

/// <summary>One proposed breakdown line on a leg.</summary>
public sealed class SplitPricingLineDto
{
    /// <summary>The parent line this was divided out of; 0 for the synthesised line.</summary>
    public int PricingBreakdownId { get; init; }

    public required string Name { get; init; }
    public decimal Revenue { get; init; }
    public decimal Cost { get; init; }
}
