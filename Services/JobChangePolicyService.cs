using DespatchWeb.Enums;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services;

/// <summary>
/// Hard-coded v1 policy matrix:
///   Auto    — Notes family + customer-visible non-rated fields (refs, contacts,
///             tracking, barcode). Applies immediately on both sides; no approval gate.
///   Manual  — Rated / commercially-affecting fields (Quantity, Speed, rate, dates,
///             times, DG, direct flag, accepted job type). Counterparty must approve.
///             Quantity / Speed / time + date / direct / DG / accepted-type also flag
///             RequiresCommercialRefresh so the approver re-rates via the IM rate-for-job
///             endpoint before stamping Applied.
/// SettlementInclusive (post-settlement rate lock) is deferred until tucJob carries a
/// settlement marker — when added, restore the Prohibited branch on PartnerAgreedRate.
/// Manual rules always assert the counterparty is the approval party.
/// </summary>
public sealed class JobChangePolicyService : IJobChangePolicyService
{
    public JobChangePolicyDecision Evaluate(JobChangeField field, string requestingPartyType, JobLifecycleStage stage)
    {
        var approvalParty = OppositeParty(requestingPartyType);

        return field switch
        {
            // Auto — notes
            JobChangeField.Notes
                or JobChangeField.ProgressNote
                or JobChangeField.PodNote =>
                Auto(field, requestingPartyType),

            // Auto — customer-visible non-rated
            JobChangeField.ConNote
                or JobChangeField.RefA
                or JobChangeField.RefB
                or JobChangeField.OurRef
                or JobChangeField.Attention
                or JobChangeField.FromContactName
                or JobChangeField.ToContactName
                or JobChangeField.FromContactPhone
                or JobChangeField.ToContactPhone
                or JobChangeField.TrackingMobile
                or JobChangeField.TrackingEmail
                or JobChangeField.TrackingMethod
                or JobChangeField.Barcode
                or JobChangeField.DeliverToLeaveID =>
                Auto(field, requestingPartyType),

            // Manual — rate itself. The policy flags this as "refresh required" for
            // schema/audit consistency with other rated fields; ApproveAsync special-cases
            // PartnerAgreedRate to SKIP the refresh fetch because the user supplies the
            // amount directly, but the flag stays true so external consumers (UI, peer)
            // see the same "this is a rated change" signal as Quantity/Speed.
            JobChangeField.PartnerAgreedRate =>
                Manual(approvalParty, $"RATE_CHANGE_{stage}", requiresCommercialRefresh: true),

            // Manual — fields that affect rating; trigger commercial refresh on approval
            JobChangeField.Quantity
                or JobChangeField.Speed
                or JobChangeField.Date
                or JobChangeField.Time
                or JobChangeField.PuTime
                or JobChangeField.DeliverBy
                or JobChangeField.BookedTime
                or JobChangeField.AcceptedJobTypeID
                or JobChangeField.Direct
                or JobChangeField.DGClass
                or JobChangeField.DGDocumentation =>
                Manual(approvalParty, $"{field}_CHANGE_{stage}", requiresCommercialRefresh: true),

            _ => Prohibited("UNKNOWN_FIELD")
        };
    }

    private static JobChangePolicyDecision Auto(JobChangeField field, string requestingParty) =>
        new(true, JobChangeApprovalMode.Auto, requestingParty,
            RuleCode: $"AUTO_{field}", RequiresCommercialRefresh: false);

    private static JobChangePolicyDecision Manual(string approvalParty, string ruleCode, bool requiresCommercialRefresh) =>
        new(true, JobChangeApprovalMode.Manual, approvalParty, ruleCode, requiresCommercialRefresh);

    private static JobChangePolicyDecision Prohibited(string ruleCode) =>
        new(false, JobChangeApprovalMode.Prohibited, ApprovalPartyType: string.Empty,
            ruleCode, RequiresCommercialRefresh: false);

    private static string OppositeParty(string requestingPartyType) => requestingPartyType switch
    {
        "OwnerTenant" => "PartnerTenant",
        _ => "OwnerTenant"
    };
}
