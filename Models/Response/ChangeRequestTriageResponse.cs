#nullable enable annotations
namespace DespatchWeb.Models.Response;

// ---- Note blocker extraction --------------------------------------------

public sealed record ChangeRequestTriageResponse
{
    /// <summary>"approve", "reject" or "clarify". Advisory — a human always decides.</summary>
    public string RecommendedAction { get; init; } = string.Empty;
    public double Confidence { get; init; }
    public string Rationale { get; init; } = string.Empty;
    public List<string> RiskFactors { get; init; } = [];
    public AiUsageInfo Usage { get; init; }
}
