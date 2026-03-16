namespace DespatchWeb.Models.RequestModels;

public sealed class UpdateAgentRecoveryRequest
{
    public int RecoveryId { get; init; }
    public bool IsPrimaryRecoveryAgent { get; init; }
}