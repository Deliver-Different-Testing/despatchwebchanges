namespace DespatchWeb.Models;

public sealed class RecoveryAgentViewModel
{
    public int RecoveryId { get; init; }
    public string AgentName { get; init; }
    public string Airport { get; init; }
    public bool PrimaryRecoveryAgent { get; init; }
    public string AssignStatus { get; init; }
}
