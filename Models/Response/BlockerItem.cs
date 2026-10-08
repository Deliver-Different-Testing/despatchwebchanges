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
