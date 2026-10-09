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

    /// <summary>
    /// Evaluate whether a partner-inbound job is allowed to be allocated to a courier.
    /// When A dispatched with <c>PricingMode == "Agreed"</c>, B's operator must accept
    /// the rate first; until then the gate blocks the allocate action.
    /// Returns <see cref="PartnerJobGateResult.NotPartner"/> for non-partner-inbound jobs
    /// AND for partner-inbound jobs whose pricing mode isn't gated (Mode 2/3 / legacy);
    /// <see cref="PartnerJobGateResult.Blocked"/> with a message when acceptance is
    /// pending or has been rejected.
    /// </summary>
    Task<PartnerJobGateResult> EvaluateAllocateAsync(int jobId, CancellationToken ct);
}
