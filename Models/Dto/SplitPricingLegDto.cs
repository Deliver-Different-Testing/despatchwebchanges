namespace DespatchWeb.Models.Dto;

/// <summary>One leg of a proposed split.</summary>
public sealed class SplitPricingLegDto
{
    /// <summary>1 = pickup leg, 2 = delivery leg.</summary>
    public int Sequence { get; init; }

    /// <summary>The leg's job-number suffix — "A", "B", and C/D… for re-splits.</summary>
    public required string LetterSuffix { get; init; }

    /// <summary>The job number this leg will be created with.</summary>
    public required string JobNumber { get; init; }

    /// <summary>
    /// The leg's distance, in <see cref="SplitPricingPreviewDto.DistanceUnit"/>. Zero when no
    /// distance could be determined.
    /// </summary>
    public decimal Distance { get; init; }

    public decimal SharePercent { get; init; }
    public decimal TotalRevenue { get; init; }
    public decimal TotalCost { get; init; }

    public required IReadOnlyList<SplitPricingLineDto> Lines { get; init; }
}
