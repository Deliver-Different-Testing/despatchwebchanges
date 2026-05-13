using DespatchWeb.Enums;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services;

/// <summary>
/// Hard-coded v1 policy matrix:
///   Auto       — Notes, ProgressNote, PodNote.
///   Manual     — Quantity, Speed.
///   Manual     — PartnerAgreedRate; approving refreshes the commercial amount via the
///                IM rate-for-job endpoint on the approver side.
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
            JobChangeField.Notes
                or JobChangeField.ProgressNote
                or JobChangeField.PodNote =>
                Auto(field, requestingPartyType),

            JobChangeField.PartnerAgreedRate =>
                Manual(approvalParty, $"RATE_CHANGE_{stage}", requiresCommercialRefresh: true),

            JobChangeField.Quantity
                or JobChangeField.Speed =>
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
