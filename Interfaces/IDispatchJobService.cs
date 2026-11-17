using DespatchWeb.Enums;

namespace DespatchWeb.Interfaces;

public interface IDispatchJobService
{
    Task DispatchJobsToCourierAsync(List<int> jobIds, int courierId);

    /// <summary>
    /// Assigns an open job to a courier on behalf of the voice agent, losing to any dispatcher who got there first.
    /// </summary>
    Task<CourierClaimOutcome> ClaimJobForCourierAsync(int jobId, int courierId, int staffId, CancellationToken cancellationToken = default);
}