#nullable enable
namespace DespatchWeb.Interfaces;

/// <summary>
/// DespatchWeb → Integration Manager admin endpoints for the job-change-request workflow.
/// Mirrors the SC-JWT pattern used by <see cref="ISendToPartnerService"/> — every call mints
/// a fresh bearer token from the current user's claims so IM can resolve the right tenant.
/// </summary>
public interface IJobChangeRequestPartnerClient
{
    Task<PartnerForwardResult> ForwardCreateAsync(
        int pairingId,
        Guid partnerJobGuid,
        Guid sourceRequestUuid,
        string fieldName,
        string? currentValue,
        string? requestedValue,
        string? reason,
        string approvalMode,
        bool requiresCommercialRefresh,
        CancellationToken ct);

    Task<PartnerForwardResult> ForwardDecisionAsync(
        int pairingId,
        Guid sourceRequestUuid,
        string outcome,
        string? reason,
        CancellationToken ct);

    Task<PartnerForwardResult> ForwardAppliedAsync(
        int pairingId,
        Guid sourceRequestUuid,
        decimal? newCommercialAmount,
        CancellationToken ct);
}

public sealed class PartnerForwardResult
{
    public bool Success { get; init; }
    public string? Message { get; init; }
}
