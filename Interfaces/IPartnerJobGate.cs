#nullable enable
using DespatchWeb.Enums;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Central decision point for any tucJob mutation that may need cross-tenant coordination.
/// Callers route every editable field through the gate; the gate decides whether to
/// allow the direct write, auto-apply through the change-request flow, file a Pending
/// request for counterparty approval, or block the edit entirely.
///
/// The gate is the only place that knows the field-mode matrix; controllers and
/// repositories stay ignorant of partnership semantics.
/// </summary>
public interface IPartnerJobGate
{
    /// <summary>
    /// Evaluate a mutation against a <see cref="JobChangeField"/> (the change-request
    /// flow's vocabulary). Returns the routing outcome.
    /// </summary>
    Task<PartnerJobGateResult> EvaluateAsync(int jobId, JobChangeField field, string? requestedValue,
        string? reason, CancellationToken ct);

    /// <summary>
    /// Evaluate a mutation expressed as a <see cref="JobProperty"/> (the legacy
    /// <c>UpdateJob</c> endpoint's vocabulary). Maps the property to a JobChangeField
    /// if one exists; returns <see cref="PartnerJobGateResult.LocalOnly"/> for properties
    /// that don't need cross-tenant sync (courier assignment, internal status, lock, etc.);
    /// returns <see cref="PartnerJobGateResult.Blocked"/> for partner-job mutations whose
    /// apply path isn't supported yet.
    /// </summary>
    Task<PartnerJobGateResult> EvaluateAsync(int jobId, JobProperty property, string? requestedValue,
        CancellationToken ct);
}

public abstract record PartnerJobGateResult
{
    /// <summary>Job has no partner pairing. Caller proceeds with the normal local write.</summary>
    public sealed record NotPartner : PartnerJobGateResult;

    /// <summary>
    /// Field is partner-job-safe to mutate locally (dispatch state each side owns
    /// independently). Caller proceeds with the normal local write; no peer traffic.
    /// </summary>
    public sealed record LocalOnly : PartnerJobGateResult;

    /// <summary>
    /// The gate filed an Auto-apply change request and the field has already been
    /// written. Caller should NOT do its own write — return success to the UI.
    /// </summary>
    public sealed record AutoApplied(int RequestId) : PartnerJobGateResult;

    /// <summary>
    /// The gate filed a Manual change request in Pending state; the counterparty must
    /// approve before the field is mutated. Caller should NOT do its own write.
    /// </summary>
    public sealed record PendingApproval(int RequestId) : PartnerJobGateResult;

    /// <summary>
    /// Mutation refused — either no pairing, an unsupported field, or a downstream
    /// failure filing the change request. Caller surfaces <c>Message</c> to the user.
    /// </summary>
    public sealed record Blocked(string Message) : PartnerJobGateResult;
}
