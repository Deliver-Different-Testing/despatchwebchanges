using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Service for splitting jobs into pickup and delivery child jobs.
/// </summary>
public interface ISplitJobService
{
    /// <summary>
    /// Splits a job into two child jobs (pickup and delivery) with a specified meeting point.
    /// This is the primary method for splitting jobs - it creates both child jobs with the
    /// meeting point address already set, re-rates them, and finalizes the split in one operation.
    /// </summary>
    /// <param name="jobId">The ID of the job to split.</param>
    /// <param name="userName">The username performing the split.</param>
    /// <param name="meetingPointSuburbId">The suburb ID of the meeting point.</param>
    /// <param name="meetingPointAddress">The meeting point address data including all address lines.</param>
    /// <returns>A tuple containing the pickup job ID and delivery job ID.</returns>
    Task<(int PickupJobId, int DeliveryJobId)> SplitJobAsync(
        int jobId,
        string userName,
        int meetingPointSuburbId,
        AddressViewModel meetingPointAddress);

    /// <summary>
    /// Splits a prebook/recurring job into two child jobs with a specified meeting point.
    /// </summary>
    /// <param name="jobBookingId">The ID of the job booking to split.</param>
    /// <param name="userName">The username performing the split.</param>
    /// <param name="meetingPointSuburbId">The suburb ID of the meeting point.</param>
    /// <param name="meetingPointAddress">The meeting point address data including all address lines.</param>
    /// <returns>A tuple containing the pickup booking ID and delivery booking ID.</returns>
    Task<(int PickupBookingId, int DeliveryBookingId)> SplitJobBookingAsync(
        int jobBookingId,
        string userName,
        int meetingPointSuburbId,
        AddressViewModel meetingPointAddress);
}
