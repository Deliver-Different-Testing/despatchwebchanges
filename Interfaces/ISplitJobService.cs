using System.Threading.Tasks;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Service for splitting jobs into pickup and delivery child jobs.
/// </summary>
public interface ISplitJobService
{
    /// <summary>
    /// Splits a job into two child jobs (pickup and delivery) for separate courier handling.
    /// </summary>
    /// <param name="jobId">The ID of the job to split.</param>
    /// <param name="userName">The username performing the split.</param>
    /// <returns>A tuple containing the pickup job ID and delivery job ID.</returns>
    Task<(int PickupJobId, int DeliveryJobId)> SplitJobAsync(int jobId, string userName);

    /// <summary>
    /// Splits a prebook/recurring job into two child jobs.
    /// </summary>
    /// <param name="jobBookingId">The ID of the job booking to split.</param>
    /// <param name="userName">The username performing the split.</param>
    /// <returns>A tuple containing the pickup job ID and delivery job ID.</returns>
    Task<(int PickupJobId, int DeliveryJobId)> SplitJobBookingAsync(int jobBookingId, string userName);
}
