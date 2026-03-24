using DespatchWeb.Enums;
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

    /// <summary>
    /// After a field update on a split parent job, propagates the same field update
    /// to all non-void child jobs and redistributes the parent's current amount
    /// proportionally across the children based on recalculated rates.
    /// </summary>
    /// <param name="parentJobId">The split parent job ID that was just updated.</param>
    /// <param name="field">The field that was updated on the parent.</param>
    /// <param name="value">The new value that was set on the parent.</param>
    /// <param name="ct">Cancellation token.</param>
    Task PropagateUpdateToSplitChildrenAsync(
        int parentJobId,
        JobProperty field,
        string value,
        CancellationToken ct = default);
}
