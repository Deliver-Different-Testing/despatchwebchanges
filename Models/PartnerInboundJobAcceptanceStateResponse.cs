#nullable enable
namespace DespatchWeb.Models;

/// <summary>
/// Mode 1 rate-acceptance gate state for a partner-inbound job. Returned by IM; consumed
/// by <c>IPartnerJobGate.EvaluateAllocateAsync</c> and the React acceptance banner.
/// </summary>
public sealed class PartnerInboundJobAcceptanceStateResponse
{
    /// <summary>"Allowed" | "PendingAcceptance" | "Accepted" | "Rejected".</summary>
    public string Status { get; init; } = "Allowed";
    public decimal? ProposedAgreedRate { get; init; }
    public string? RejectionReason { get; init; }
    public DateTime? ActionedAtUtc { get; init; }
    public Guid? PartnerJobGuid { get; init; }
}
