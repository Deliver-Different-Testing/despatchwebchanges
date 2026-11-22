namespace DespatchWeb.Interfaces;

public enum PartnerUnlinkReason
{
    PartnerVoided,
    RecallApplied,
    PairingRevoked
}

public enum PartnerUnlinkOutcome
{
    Unlinked,
    NotFound
}

public enum PartnerReleaseScope
{
    Outbound,
    Inbound
}

public sealed record PartnerReleaseResult(int Unlinked, int Voided, int VoidedAfterPickup, int SkippedCompleted);

/// <summary>
/// Ends this tenant's side of a partner hand-off. The sender owns the customer job: when a delegation ends its job is
/// unlinked and goes back to dispatch, never voided. The receiver's copy is what gets voided.
/// </summary>
public interface IPartnerJobLinkService
{
    Task<PartnerUnlinkOutcome> UnlinkAsync(Guid partnerJobGuid, PartnerUnlinkReason reason, string? partnerName, CancellationToken ct);

    Task<PartnerReleaseResult> ReleaseAsync(int pairingId, PartnerReleaseScope scope, string? partnerName, CancellationToken ct);
}
