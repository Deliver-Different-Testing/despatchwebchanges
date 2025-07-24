using System.Collections.Generic;

namespace DespatchWeb.Models;

public class RecoveryAgentJobViewModel
{
    public int JobId { get; set; }
    public string JobNumber { get; set; }
    public Suggestion AssignedAgent { get; set; }
    public AddressViewModel PickUpAddress { get; set; }
    public AddressViewModel DeliveryAddress { get; set; }
    public string PackageType { get; set; }
    public string Priority { get; set; }
    public string LastKnownLocation { get; set; }
    public string Customer { get; set; }
    public IEnumerable<RecoveryJobViewModel> RecoveryJobs { get; set; }
}

public class RecoveryJobViewModel
{
    public int JobId { get; set; }
    public Suggestion AssignedAgent { get; set; }
    public IEnumerable<RecoveryAgentViewModel> RecoveryAgents { get; set; }
}

public class RecoveryAgentViewModel
{
    public int RecoveryId { get; set; }
    public string AgentName { get; set; }
    public string Airport { get; set; }
    public bool PrimaryRecoveryAgent { get; set; }
    public string AssignStatus { get; set; }
}