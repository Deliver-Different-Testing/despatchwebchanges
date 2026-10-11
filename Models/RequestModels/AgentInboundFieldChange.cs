#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class AgentInboundFieldChange
{
    /// <summary>Stable per field per call, so a retried tool call lands on the same row.</summary>
    public Guid SourceRequestUuid { get; init; }
    public string FieldName { get; init; } = string.Empty;
    public string? RequestedValue { get; init; }
}
