#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class PeerInboundChangeDecisionPayload
{
    /// <summary>"Approved" or "Rejected".</summary>
    public string Outcome { get; init; } = string.Empty;
    public string? Reason { get; init; }
}
