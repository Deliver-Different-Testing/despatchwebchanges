namespace DespatchWeb.Models.Response;

public sealed class TimelineItem
{
    public string Label { get; init; } = string.Empty;
    public string Detail { get; init; } = string.Empty;
    public TimelineStatus Status { get; init; }
}
