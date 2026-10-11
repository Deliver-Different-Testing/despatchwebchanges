namespace DespatchWeb.Models;

public sealed class RecoveryJobViewModel
{
    public int JobId { get; init; }
    public Suggestion AssignedAgent { get; init; }
    public IEnumerable<RecoveryAgentViewModel> RecoveryAgents { get; init; }
}
