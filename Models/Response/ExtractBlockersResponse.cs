#nullable enable annotations
namespace DespatchWeb.Models.Response;

// ---- Note blocker extraction --------------------------------------------

public sealed record ExtractBlockersResponse
{
    public List<BlockerItem> Blockers { get; init; } = [];
    public string Summary { get; init; } = string.Empty;
    public SummarySeverity Severity { get; init; }

    /// <summary>True when the analysis failed (refused, truncated, unparseable) — distinct from "nothing found".</summary>
    public bool Incomplete { get; init; }

    public AiUsageInfo Usage { get; init; }
}
