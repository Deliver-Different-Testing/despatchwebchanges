#nullable enable
namespace DespatchWeb.Interfaces;

/// <summary>
/// Builds a capability link to a single job in the inbound-agent portal
/// (<c>{tblSetting.InboundUrl}/{token}</c>, where the token is the reversible
/// encrypted job id produced by <c>dbo.EncryptJobIdReversible</c>). Abstracted so the
/// SQL-Server-only encryption UDF stays out of SQLite-backed repository tests.
/// </summary>
public interface IInboundAgentLinkService
{
    /// <summary>
    /// Returns the full inbound-agent link for <paramref name="jobId"/>, or
    /// <c>null</c> when the tenant has no <c>InboundUrl</c> configured (nothing to link).
    /// </summary>
    Task<string?> BuildJobLinkAsync(int jobId, CancellationToken cancellationToken = default);
}
