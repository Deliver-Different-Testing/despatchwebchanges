using DespatchWeb.Models;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

public interface IDeliveryJourneyService
{
    Task<IReadOnlyList<DeliveryJourneyViewModel>> GetDeliveryJourneyForJobAsync(int jobId);

    Task<RecurringJourneyDto> GetDeliveryJourneyForRecurringBookingAsync(int bookingId, int limit = 200);
}
