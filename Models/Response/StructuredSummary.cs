using System.Text.Json.Serialization;

namespace DespatchWeb.Models.Response;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SummarySeverity
{
    Ok,
    Info,
    Caution,
    Urgent,
    Critical
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TimelineStatus
{
    Ok,
    Pending,
    Warning,
    Late
}

public sealed class AttentionItem
{
    public string Headline { get; init; } = string.Empty;
    public string Action { get; init; } = string.Empty;
    public SummarySeverity Severity { get; init; }
}

public sealed class TimelineItem
{
    public string Label { get; init; } = string.Empty;
    public string Detail { get; init; } = string.Empty;
    public TimelineStatus Status { get; init; }
}

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
