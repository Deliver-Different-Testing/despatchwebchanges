using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using Serilog;

namespace DespatchWeb.Services;

public class DispatchJobService(IJobRepository jobRepository, ICourierRepository courierRepository)
    : IDispatchJobService
{
    public async Task DispatchJobsToCourierAsync(List<int> jobIds, int courierId)
    {
        ArgumentNullException.ThrowIfNull(jobIds);
        ArgumentOutOfRangeException.ThrowIfZero(courierId);

        if (jobIds.Count == 0) throw new ArgumentException("Job list cannot be empty", nameof(jobIds));

        await DispatchJobsInternalAsync(jobIds, courierId);
    }

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