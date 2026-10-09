using DespatchWeb.Models.Response;

namespace DespatchWeb.Models.Ai;

public sealed class JobSignals
{
    public List<JobSignal> Items { get; init; } = [];

    public SummarySeverity MaxSeverity =>
        Items.Count == 0 ? SummarySeverity.Ok : Items.Max(s => s.Severity);

    public IEnumerable<string> Lines =>
        Items.Select(s => $"SIGNAL [{s.Severity.ToString().ToUpper()}]: {s.Line}");
}
