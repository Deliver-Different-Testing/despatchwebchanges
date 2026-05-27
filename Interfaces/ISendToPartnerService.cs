#nullable enable
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface ISendToPartnerService
{
    Task<SendToPartnerResponse> SendAsync(SendToPartnerRequest request);
    Task<PartnerRateForJobResponse> GetRateForJobAsync(int pairingId, int jobId);

    /// <summary>
    /// Reads the Mode 1 rate-acceptance gate state from IM for a local partner-inbound job.
    /// Returns null when IM reports 404 (the job isn't partner-inbound) — DW treats that as
    /// "gate not applicable, allocate as normal".
    /// </summary>
    Task<PartnerInboundJobAcceptanceStateResponse?> GetInboundJobAcceptanceStateAsync(int jobId);

    /// <summary>Accepts the partner's typed rate on behalf of the current operator.</summary>
    Task<PartnerInboundJobActionResponse> AcceptInboundJobAsync(int jobId);

    /// <summary>Rejects the partner's typed rate with a reason.</summary>
    Task<PartnerInboundJobActionResponse> RejectInboundJobAsync(int jobId, string reason);
}
