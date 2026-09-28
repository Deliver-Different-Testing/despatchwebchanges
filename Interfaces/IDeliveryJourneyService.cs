using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IDeliveryJourneyService
{
    Task<IReadOnlyList<DeliveryJourneyViewModel>> GetDeliveryJourneyForJobAsync(int jobId);
}
