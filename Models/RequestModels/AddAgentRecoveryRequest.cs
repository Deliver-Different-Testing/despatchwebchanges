namespace DespatchWeb.Models.RequestModels;

public class AddAgentRecoveryRequest
{
    public int JobId { get; set; }
    public int AgentId { get; set; }
    
    public int AirportId { get; set; }
    public bool IsPrimaryRecoveryAgent { get; set; }
}