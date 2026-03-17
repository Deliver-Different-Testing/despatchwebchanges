using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Service for splitting a job into a pickup leg (A) and a delivery leg (B) child job.
/// </summary>
public interface ISplitJobService
{
    /// <summary>
    /// Splits a job into two child jobs with a meeting point address.
    /// Child A (pickup leg): origin → meeting point, inherits parent's courier and exact status.
    /// Child B (delivery leg): meeting point → destination, optionally assigned a courier.
    /// Parent becomes a shell with system courier.
    /// </summary>
    /// <param name="jobId">The ID of the job to split.</param>
    /// <param name="userName">The username performing the split.</param>
    /// <param name="meetingPointAddress">The meeting point address data.</param>
    /// <param name="courierIdForLegB">Optional courier ID for the delivery leg. Null = unallocated.</param>
    /// <returns>Tuple of (PickupJobId, DeliveryJobId) for the two created child jobs.</returns>
    Task<(int PickupJobId, int DeliveryJobId)> SplitJobAsync(
        int jobId,
        string userName,
        AddressViewModel meetingPointAddress,
        int? courierIdForLegB = null);
}
