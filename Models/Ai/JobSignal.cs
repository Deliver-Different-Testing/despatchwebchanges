using DespatchWeb.Models.Response;

namespace DespatchWeb.Models.Ai;

public sealed record JobSignal(SummarySeverity Severity, string Line);
