namespace DespatchWeb.Models;

public sealed class AgentInfoDialogViewModel: AgentViewModel
{
    public List<AirportViewModel> Airports { get; init; }
    public AddressViewModel Address { get; init; }
}
