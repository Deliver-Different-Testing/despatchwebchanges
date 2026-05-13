using DespatchWeb.Enums;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Evaluates whether a proposed change to a specific <see cref="JobChangeField"/> on a
/// live inter-tenant job is auto-applied, requires manual counterparty approval, or is
/// prohibited at the current <see cref="JobLifecycleStage"/>.
/// </summary>
public interface IJobChangePolicyService
{
    JobChangePolicyDecision Evaluate(JobChangeField field, string requestingPartyType, JobLifecycleStage stage);
}

public sealed record JobChangePolicyDecision(
    bool Allowed,
    JobChangeApprovalMode Mode,
    string ApprovalPartyType,
    string RuleCode,
    bool RequiresCommercialRefresh);
