#nullable enable
namespace DespatchWeb.Interfaces;

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
