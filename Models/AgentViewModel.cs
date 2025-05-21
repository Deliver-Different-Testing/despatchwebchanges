using System.Collections.Generic;

namespace DespatchWeb.Models;

public class AgentViewModel
{
    public int AgentId { get; set; }
    public string AgentName { get; set; }
    public decimal AgentRate { get; set; }
    public string AgentRanking { get; set; }
    public string AgentNotes { get; set; }
    public string AgentPhone { get; set; }
    public string AgentEmail { get; set; }
}

public class AgentInfoDialogViewModel: AgentViewModel
{
    public List<AirportViewModel> Airports { get; set; }
}
