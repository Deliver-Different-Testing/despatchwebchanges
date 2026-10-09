#nullable enable
namespace DespatchWeb.Models;

public sealed class PartnerInboundJobActionResponse
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public PartnerInboundJobAcceptanceStateResponse? NewState { get; init; }
}
