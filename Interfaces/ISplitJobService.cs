using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Service for splitting a job into a pickup leg and a delivery child job.
/// </summary>
public interface ISplitJobService
{
    /// <summary>
    /// Splits a job by creating two child jobs (pickup and delivery) via raw SQL
    /// inserts. The meeting point address becomes the pickup leg's destination
    /// and the delivery leg's pickup location.
    /// </summary>
    /// <param name="jobId">The ID of the job to split.</param>
    /// <param name="userName">The username performing the split.</param>
    /// <param name="meetingPointAddress">The meeting point address data including all address lines.</param>
    /// <param name="courierIdForLegB">Optional courier ID to assign to the delivery leg (Leg B).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A tuple where PickupJobId is the newly created pickup child job
    /// and DeliveryJobId is the newly created delivery child job.
    /// </returns>
    Task<(int PickupJobId, int DeliveryJobId)> SplitJobAsync(
        int jobId,
        string userName,
        AddressViewModel meetingPointAddress,
        int? courierIdForLegB = null,
        CancellationToken ct = default);
}
