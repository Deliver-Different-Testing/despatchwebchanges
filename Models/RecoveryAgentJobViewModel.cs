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
