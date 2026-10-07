using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Orchestrates the inter-tenant job-change-request lifecycle: structured record,
/// task event, peer notification via Integration Manager, and (on approval / auto)
/// the mutation of <c>tucJob</c>.
/// </summary>
public interface IJobChangeRequestService
{
    Task<JobChangeRequestResult> CreateLocalAsync(CreateJobChangeRequestRequest request, CancellationToken ct);

    Task<JobChangeRequestResult> ApproveAsync(int id, ApproveJobChangeRequestRequest request, CancellationToken ct);

    Task<JobChangeRequestResult> RejectAsync(int id, RejectJobChangeRequestRequest request, CancellationToken ct);

    /// <summary>
    /// Originator retracts their own Pending request. Only valid when <c>UjcrOrigin = "Local"</c>
    /// and <c>UjcrStatus = "Pending"</c>. Sets the row to Cancelled, closes the local task event,
    /// and forwards a Decision=Cancelled signal to the peer so its mirror reflects the same state.
    /// </summary>
    Task<JobChangeRequestResult> CancelAsync(int id, CancelJobChangeRequestRequest request, CancellationToken ct);

    /// <summary>Apply a peer-initiated change request (Origin=Peer). Idempotent on <c>sourceUuid</c>.</summary>
    Task<JobChangeRequestResult> RecordPeerCreateAsync(PeerInboundChangeRequestPayload payload, CancellationToken ct);

    /// <summary>
    /// Record change requests raised by the 3CX voice agent (Origin=VoiceAgent). Always Pending for a
    /// dispatcher to approve, never forwarded to a peer. Idempotent on each change's <c>SourceRequestUuid</c>.
    /// </summary>
    Task<AgentInboundChangeRequestResult> RecordAgentCreateAsync(AgentInboundChangeRequestPayload payload, CancellationToken ct);

    /// <summary>Apply a peer-side approve/reject decision. Idempotent on <c>sourceUuid</c>.</summary>
    Task<JobChangeRequestResult> RecordPeerDecisionAsync(Guid sourceUuid, PeerInboundChangeDecisionPayload payload, CancellationToken ct);

    /// <summary>
    /// Mark a row Applied after the peer has applied it on their side. Persists the
    /// new commercial amount if supplied. Idempotent on <c>sourceUuid</c>.
    /// </summary>
    Task<JobChangeRequestResult> RecordPeerAppliedAsync(Guid sourceUuid, PeerInboundChangeAppliedPayload payload, CancellationToken ct);

    Task<IReadOnlyList<JobChangeRequestDto>> ListForJobAsync(int jobId, CancellationToken ct);

    /// <summary>
    /// Rows the local tenant must approve — Status='Pending' AND Origin='Peer' or 'VoiceAgent'
    /// (anything where this side is the approval party). Joined
    /// with <c>tucJob</c> for the job number and client name so the inbox page
    /// can render without per-row job fetches.
    /// </summary>
    Task<IReadOnlyList<JobChangeRequestInboxItem>> ListPendingForApprovalAsync(int limit, CancellationToken ct);

    /// <summary>
    /// True when the local tenant has at least one <c>IntMgrPartnerPairing</c>
    /// row in <c>Status='Active'</c>. Drives the app-bar Partner Approvals badge
    /// visibility — tenants with no active partnerships never see the button.
    /// </summary>
    Task<bool> HasActivePartnersAsync(CancellationToken ct);
}
