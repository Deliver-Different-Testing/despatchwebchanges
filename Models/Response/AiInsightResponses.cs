#nullable enable annotations
namespace DespatchWeb.Models.Response;

// ---- Note blocker extraction --------------------------------------------

public sealed class BlockerItem
{
    public string Tag { get; init; } = string.Empty;
    public SummarySeverity Severity { get; init; }
    public string Evidence { get; init; } = string.Empty;
    public bool ActionRequired { get; init; }
}

public sealed record ExtractBlockersResponse
{
    public List<BlockerItem> Blockers { get; init; } = [];
    public string Summary { get; init; } = string.Empty;
    public SummarySeverity Severity { get; init; }
    public AiUsageInfo Usage { get; init; }
}

// ---- Pricing analysis ----------------------------------------------------

public sealed class AccessorialSuggestion
{
    public int AccessorialChargeId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Reason { get; init; } = string.Empty;
    public decimal? SuggestedInputValue { get; init; }
}

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

public sealed record PricingAnalysisResponse
{
    public PricingAnomaly? Anomaly { get; init; }
    public List<AccessorialSuggestion> Suggestions { get; init; } = [];
    public AiUsageInfo Usage { get; init; }
}

// ---- Change-request triage (advisory only) -------------------------------

public sealed record ChangeRequestTriageResponse
{
    /// <summary>"approve", "reject" or "clarify". Advisory — a human always decides.</summary>
    public string RecommendedAction { get; init; } = string.Empty;
    public double Confidence { get; init; }
    public string Rationale { get; init; } = string.Empty;
    public List<string> RiskFactors { get; init; } = [];
    public AiUsageInfo Usage { get; init; }
}
