namespace DespatchWeb.Models;

public sealed class RecoveryAgentJobViewModel
{
    public int JobId { get; init; }
    public string JobNumber { get; init; }
    public Suggestion AssignedAgent { get; init; }
    public AddressViewModel PickUpAddress { get; init; }
    public AddressViewModel DeliveryAddress { get; init; }
    public string PackageType { get; init; }
    public string Priority { get; init; }
    public string LastKnownLocation { get; init; }
    public string Customer { get; init; }
    public IEnumerable<RecoveryJobViewModel> RecoveryJobs { get; init; }
}

public sealed class RecoveryJobViewModel
{
    public int JobId { get; init; }
    public Suggestion AssignedAgent { get; init; }
    public IEnumerable<RecoveryAgentViewModel> RecoveryAgents { get; init; }
}

public sealed class RecoveryAgentViewModel
{
    public int RecoveryId { get; init; }
    public string AgentName { get; init; }
    public string Airport { get; init; }
    public bool PrimaryRecoveryAgent { get; init; }
    public string AssignStatus { get; init; }
}