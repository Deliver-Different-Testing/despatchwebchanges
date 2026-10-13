using DespatchWeb.Enums;

namespace DespatchWeb.Interfaces;

public sealed record JobChangePolicyDecision(
    bool Allowed,
    JobChangeApprovalMode Mode,
    string ApprovalPartyType,
    string RuleCode,
    bool RequiresCommercialRefresh);
