namespace DespatchWeb.Models.RequestModels;

/// <summary>
/// One leg's confirmed share of the parent total, as agreed by the user in the split pricing
/// dialog. Shares are sent rather than per-line amounts so the server stays the single source of
/// truth for rounding.
/// </summary>
public sealed class SplitPricingAllocationItem
{
    /// <summary>The leg this share applies to — 1 = pickup leg, 2 = delivery leg.</summary>
    public int Sequence { get; init; }

    /// <summary>The leg's share as a percentage. Shares are normalised server-side.</summary>
    public decimal SharePercent { get; init; }
}
