namespace DespatchWeb.Models.Dto;

/// <summary>One of the parent's lines, before it is divided.</summary>
public sealed class SplitPricingParentLineDto
{
    /// <summary>Identifies the line when overriding its share; 0 for the synthesised line.</summary>
    public int PricingBreakdownId { get; init; }

    /// <summary>The original charge name, without a "Part {suffix}".</summary>
    public required string Name { get; init; }

    public decimal Revenue { get; init; }
    public decimal Cost { get; init; }
    public bool IsAccessorial { get; init; }
}
