#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class AgentInboundChangeRequestResult
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public IReadOnlyList<JobChangeRequestDto> Requests { get; init; } = [];
}
