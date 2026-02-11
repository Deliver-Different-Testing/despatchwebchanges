using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Service for splitting a job into a pickup leg and a delivery child job.
/// </summary>
public interface ISplitJobService
{
    /// <summary>
    /// Splits a job by converting it in-place to the pickup leg and creating
    /// a new delivery child job via the CreateMinimalTucJob stored procedure.
    /// The meeting point address becomes the pickup leg's destination and the
    /// delivery leg's pickup location.
    /// </summary>
    /// <param name="jobId">The ID of the job to split.</param>
    /// <param name="userName">The username performing the split.</param>
    /// <param name="meetingPointAddress">The meeting point address data including all address lines.</param>
    /// <returns>
    /// A tuple where PickupJobId is the original job (now the pickup leg)
    /// and DeliveryJobId is the newly created delivery child job.
    /// </returns>
    Task<(int PickupJobId, int DeliveryJobId)> SplitJobAsync(
        int jobId,
        string userName,
        AddressViewModel meetingPointAddress);
}
