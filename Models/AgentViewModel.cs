using System.Collections.Generic;

namespace DespatchWeb.Models;

public class AgentViewModel
{
    public int AgentId { get; init; }
    public string AgentName { get; init; }
    public decimal AgentRate { get; init; }
    public string AgentRanking { get; init; }
    public string AgentNotes { get; init; }
    public string AgentPhone { get; init; }
    public string AgentEmail { get; init; }
}

public class AgentInfoDialogViewModel: AgentViewModel
{
    public List<AirportViewModel> Airports { get; init; }
    public AddressViewModel Address { get; init; }
}
