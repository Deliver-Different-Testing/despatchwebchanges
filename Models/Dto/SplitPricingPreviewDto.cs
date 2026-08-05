namespace DespatchWeb.Models.Dto;

/// <summary>
/// The pricing split proposed for a job, shown for confirmation before the split is committed.
/// Nothing is written to produce this.
/// </summary>
public sealed class SplitPricingPreviewDto
{
    /// <summary>How the shares were derived — see <c>SplitPricingAllocator.AllocationBasis</c>.</summary>
    public required string Basis { get; init; }

    /// <summary>The parent's line total, which a split leaves unchanged.</summary>
    public decimal ParentTotalRevenue { get; init; }

    /// <summary>The parent's line cost total, which a split leaves unchanged.</summary>
    public decimal ParentTotalCost { get; init; }

    /// <summary>True when the parent has no itemised lines and a single synthesised line is being divided.</summary>
    public bool IsSynthesised { get; init; }

    /// <summary>
    /// The undivided lines behind the split, so the dialog can offer a share per line rather than
    /// having to reconstruct the originals by summing the legs.
    /// </summary>
    public required IReadOnlyList<SplitPricingParentLineDto> ParentLines { get; init; }

    public required IReadOnlyList<SplitPricingLegDto> Legs { get; init; }
}

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

/// <summary>One leg of a proposed split.</summary>
public sealed class SplitPricingLegDto
{
    /// <summary>1 = pickup leg, 2 = delivery leg.</summary>
    public int Sequence { get; init; }

    /// <summary>The leg's job-number suffix — "A", "B", and C/D… for re-splits.</summary>
    public required string LetterSuffix { get; init; }

    /// <summary>The job number this leg will be created with.</summary>
    public required string JobNumber { get; init; }

    public decimal Miles { get; init; }
    public decimal SharePercent { get; init; }
    public decimal TotalRevenue { get; init; }
    public decimal TotalCost { get; init; }

    public required IReadOnlyList<SplitPricingLineDto> Lines { get; init; }
}

/// <summary>One proposed breakdown line on a leg.</summary>
public sealed class SplitPricingLineDto
{
    /// <summary>The parent line this was divided out of; 0 for the synthesised line.</summary>
    public int PricingBreakdownId { get; init; }

    public required string Name { get; init; }
    public decimal Revenue { get; init; }
    public decimal Cost { get; init; }
}
