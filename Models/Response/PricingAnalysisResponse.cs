#nullable enable annotations
namespace DespatchWeb.Models.Response;

// ---- Note blocker extraction --------------------------------------------

public sealed record PricingAnalysisResponse
{
    public PricingAnomaly? Anomaly { get; init; }
    public List<AccessorialSuggestion> Suggestions { get; init; } = [];
    /// <summary>True when the suggestion pass failed — distinct from "nothing to suggest".</summary>
    public bool Incomplete { get; init; }

    public AiUsageInfo Usage { get; init; }
}
