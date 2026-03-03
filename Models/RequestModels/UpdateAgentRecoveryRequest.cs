namespace DespatchWeb.Models.RequestModels;

public class UpdateAgentRecoveryRequest
{
    public int RecoveryId { get; init; }
    public bool IsPrimaryRecoveryAgent { get; init; }
}