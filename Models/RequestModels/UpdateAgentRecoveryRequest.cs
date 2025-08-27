namespace DespatchWeb.Models.RequestModels;

public class UpdateAgentRecoveryRequest
{
    public int RecoveryId { get; set; }
    public bool IsPrimaryRecoveryAgent { get; set; }
}