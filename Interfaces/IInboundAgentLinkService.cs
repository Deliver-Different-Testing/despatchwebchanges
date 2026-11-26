#nullable enable
using DespatchWeb.EntityClasses;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Builds the capability link an agent receives for a job in the inbound-agent portal
/// (<c>{tblSetting.InboundUrl}/t_{token}</c>). The token is 32 random bytes, base64url encoded; only its SHA-256 is
/// stored, in <c>dbo.AgentAssignmentToken</c>.
/// </summary>
public interface IInboundAgentLinkService
{
    /// <summary>
    /// Mints a token for <paramref name="agentId"/> on <paramref name="jobId"/> and returns the full link, or
    /// <c>null</c> when the tenant has no <c>InboundUrl</c> (nothing is minted then). Only this agent's earlier live
    /// tokens for the job are revoked, at once. Another agent's link is not touched: Inbound Agent honours a token
    /// only while its AgentId equals the job's currently assigned agent, which is what invalidates a previous
    /// agent's link on re-assignment. The new row is added to <paramref name="context"/> and saved by the caller, so
    /// it commits with the message that carries the link.
    /// </summary>
    Task<string?> MintJobLinkAsync(DespatchContext context, int jobId, int agentId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// A link in the real shape with a placeholder token, for previews and "can we link?" checks. Mints nothing.
    /// <c>null</c> when the tenant has no <c>InboundUrl</c>.
    /// </summary>
    Task<string?> BuildPreviewLinkAsync(int jobId, CancellationToken cancellationToken = default);

    /// <summary>Revokes every live token for <paramref name="jobId"/> (agent unassigned).</summary>
    Task RevokeJobTokensAsync(DespatchContext context, int jobId, CancellationToken cancellationToken = default);
}
