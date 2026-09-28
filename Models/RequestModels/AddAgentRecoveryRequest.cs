namespace DespatchWeb.Models.RequestModels;

public sealed class AddAgentRecoveryRequest
{
    public int JobId { get; init; }
    public int AgentId { get; init; }
    
    public int AirportId { get; init; }
    public bool IsPrimaryRecoveryAgent { get; init; }
}