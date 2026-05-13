namespace DespatchWeb.Enums;

/// <summary>
/// Outcome of a <see cref="DespatchWeb.Interfaces.IJobChangePolicyService"/> evaluation —
/// drives whether <c>JobChangeRequestService</c> applies the change immediately, opens
/// a task for the counterparty, or rejects outright.
/// </summary>
public enum JobChangeApprovalMode
{
    Auto,
    Manual,
    Prohibited
}
