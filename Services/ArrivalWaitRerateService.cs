using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using Serilog;

namespace DespatchWeb.Services;

/// <inheritdoc cref="IArrivalWaitRerateService" />
public sealed class ArrivalWaitRerateService(
    IJobQueryRepository jobQueryRepository,
    IJobCommandRepository jobCommandRepository,
    IRateJobService rateJobService,
    ITenantInfoService infoService
) : IArrivalWaitRerateService
{
    /// <inheritdoc />
    public async Task HandleArrivalEditAsync(int jobId, JobProperty field, CancellationToken ct)
    {
        if (field is not (JobProperty.PickupArrivalTime or JobProperty.DeliveryArrivalTime))
        {
            return;
        }

        try
        {
            if (await jobQueryRepository.IsJobArchived(jobId))
            {
                Log.Information(
                    "Arrival edit on archived job {JobId}: field written, waiting rerate skipped", jobId);
                return;
            }

            var waitedMinutes = await jobCommandRepository.UpdateWaitedMinutesFromArrivalAsync(jobId, field);
            if (waitedMinutes is null)
            {
                return;
            }

            // First pass is NZ urgent only. The waited minutes above are still persisted for US
            // tenants, where they already reach price through the normal DD_stpJob_Rate_Described path.
            if (infoService.IsUsTenant())
            {
                return;
            }

            var jobDetails = await jobQueryRepository.GetJobDetailsForRatingNzAsync(jobId, false);
            await rateJobService.RateJobNzAsync(jobDetails);

            Log.Information(
                "Arrival edit rerate complete: job {JobId}, field {Field}, waited minutes {WaitedMinutes}",
                jobId, field, waitedMinutes);
        }
        catch (Exception e)
        {
            // The arrival field is already written and correct — a failing rerate must not
            // turn that into an error the dispatcher reads as "nothing happened".
            Log.Error(e,
                "Failed to rerate job {JobId} after {Field} edit. Error: {Message}", jobId, field, e.Message);
        }
    }
}
