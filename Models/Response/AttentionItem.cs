namespace DespatchWeb.Models.Response;

public sealed class AttentionItem
{
    public string Headline { get; init; } = string.Empty;
    public string Action { get; init; } = string.Empty;
    public SummarySeverity Severity { get; init; }
}
