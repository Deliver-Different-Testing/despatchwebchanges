using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface IAddAgentRecoveryJobService
{
    Task<int> AddRecoveryAgentJobAsync(AddAgentRecoveryRequest request);
}