using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface ISendToPartnerService
{
    Task<SendToPartnerResponse> SendAsync(SendToPartnerRequest request);
    Task<PartnerRateForJobResponse> GetRateForJobAsync(int pairingId, int jobId);
}
