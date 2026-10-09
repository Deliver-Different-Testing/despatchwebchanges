#nullable enable
namespace DespatchWeb.Models.RequestModels;

/// <summary>Body posted by Integration Manager when the 3CX voice agent asks for a change to a job.</summary>
public sealed class AgentInboundChangeRequestPayload
{
    public int JobId { get; init; }
    public string CallId { get; init; } = string.Empty;
    public string? Reason { get; init; }
    public List<AgentInboundFieldChange> Changes { get; init; } = [];
}
