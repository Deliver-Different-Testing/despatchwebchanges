using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for dispatching jobs to couriers and managing courier assignments.
/// </summary>
public class DispatchJobService(IJobRepository jobRepository, ICourierRepository courierRepository)
    : IDispatchJobService
{
    /// <summary>
    /// Dispatches one or more jobs to a courier, updating job assignments and resetting clear list ordering.
    /// Also dispatches associated child jobs.
    /// </summary>
    /// <param name="jobIds">The list of job IDs to dispatch.</param>
    /// <param name="courierId">The courier ID to assign the jobs to.</param>
    public async Task DispatchJobsToCourierAsync(List<int> jobIds, int courierId)
    {
        ArgumentNullException.ThrowIfNull(jobIds);
        ArgumentOutOfRangeException.ThrowIfZero(courierId);

        if (jobIds.Count == 0) throw new ArgumentException("Job list cannot be empty", nameof(jobIds));

        await DispatchJobsInternalAsync(jobIds, courierId);
    }

    /// <summary>
    /// Internal implementation that assigns courier to jobs, resets clear list order, and dispatches child jobs.
    /// </summary>
    private async Task DispatchJobsInternalAsync(List<int> jobIds, int courierId)
    {
        try
        {
            var jobIdsList = jobIds.ToList();

            // Assign courier to job(s)
            await jobRepository.AssignCourierToJobAsync(jobIdsList, courierId);

            // Reset the couriers clear list area order
            await courierRepository.ResetClearListAreaOrderAsync(courierId);

            // Dispatch child jobs
            await jobRepository.AssignCourierToChildJobsAsync(jobIds, InternalJobStatus.AwaitingPod);

            if (jobIdsList.Count == 1)
            {
                Log.Debug("Successfully dispatched job {JobId} to courier {CourierId}", jobIdsList[0], courierId);
            }
            else
            {
                Log.Debug("Successfully dispatched {JobCount} jobs to courier {CourierId}: {JobIds}",
                    jobIdsList.Count, courierId, string.Join(", ", jobIdsList));
            }
        }
        catch (Exception e)
        {
            var jobIdsList = jobIds.ToList();
            if (jobIdsList.Count == 1)
            {
                Log.Error(e, "Error dispatching job {JobId} to courier {CourierId}", jobIdsList[0], courierId);
            }
            else
            {
                Log.Error(e, "Error dispatching {JobCount} jobs to courier {CourierId}: {JobIds}",
                    jobIdsList.Count, courierId, string.Join(", ", jobIdsList));
            }

            throw;
        }
    }
}