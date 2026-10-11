namespace DespatchWeb.Models.Response;

public sealed record StructuredSummaryResponse
{
    public string Verdict { get; init; } = string.Empty;
    public SummarySeverity Severity { get; init; }
    public List<string> KeyFacts { get; init; } = [];
    public List<AttentionItem> Attention { get; init; } = [];
    public List<TimelineItem> Timeline { get; init; } = [];
    public List<string> Highlights { get; init; } = [];
    public AiUsageInfo Usage { get; init; }
}
