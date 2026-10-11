#nullable enable annotations
namespace DespatchWeb.Models.Response;

// ---- Note blocker extraction --------------------------------------------

public sealed record ExtractBlockersResponse
{
    public List<BlockerItem> Blockers { get; init; } = [];
    public string Summary { get; init; } = string.Empty;
    public SummarySeverity Severity { get; init; }
    public AiUsageInfo Usage { get; init; }
}
