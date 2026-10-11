#nullable enable annotations
namespace DespatchWeb.Models.Response;

// ---- Note blocker extraction --------------------------------------------

/// <summary>
/// Deterministic comparison of the stored charge against a fresh re-rate. Not
/// AI-generated — the model only describes it. Null when re-rating is unavailable.
/// </summary>
public sealed class PricingAnomaly
{
    public decimal StoredCharge { get; init; }
    public decimal RecomputedRate { get; init; }
    public decimal DeltaPercent { get; init; }
    public bool IsOutlier { get; init; }
}
