namespace DespatchWeb.Models.Dto;

/// <summary>
/// The pricing split proposed for a job, shown for confirmation before the split is committed.
/// Nothing is written to produce this.
/// </summary>
public sealed class SplitPricingPreviewDto
{
    /// <summary>How the shares were derived — see <c>SplitPricingAllocator.AllocationBasis</c>.</summary>
    public required string Basis { get; init; }

    /// <summary>
    /// The unit <see cref="SplitPricingLegDto.Distance"/> is expressed in — "mi" for US tenants,
    /// "km" everywhere else. The shares themselves are ratios and so are unit-independent.
    /// </summary>
    public required string DistanceUnit { get; init; }

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
