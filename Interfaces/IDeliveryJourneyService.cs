using DespatchWeb.Models;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

public interface IDeliveryJourneyService
{
    Task<IReadOnlyList<DeliveryJourneyViewModel>> GetDeliveryJourneyForJobAsync(int jobId);

    Task<RecurringJourneyDto> GetDeliveryJourneyForRecurringBookingAsync(int bookingId, int limit = 200);

    /// <summary>
    /// The job's status transitions, oldest first, in tenant-local time. Narrower than
    /// <see cref="GetDeliveryJourneyForJobAsync"/>: no tasks, notes, messages or pricing.
    /// </summary>
    Task<IReadOnlyList<JobStatusHistoryEntry>> GetStatusHistoryForJobAsync(int jobId);
}
