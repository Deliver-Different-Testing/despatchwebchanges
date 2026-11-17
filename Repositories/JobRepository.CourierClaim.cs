using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    private const int OnHoldStatus = 100;

    private static readonly int[] UnclaimableStatuses =
    [
        (int)JobStatus.Preassigned,
        OnHoldStatus,
        (int)JobStatus.OutboundAgentAssigned,
        (int)JobStatus.InboundAgentAssigned,
        (int)JobStatus.GroundAgentAssigned
    ];

    public async Task<CourierClaimOutcome> ClaimJobForCourierAsync(int jobId, int courierId, int staffId,
        CancellationToken cancellationToken = default)
    {
        var context = Context;
        int[] jobIds = [jobId];

        return await context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            var tenantTime = _clock.TenantNow;
            await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

            var claimed = await context.TucJobs
                .Where(j => j.UcjbId == jobId
                            && j.UcjbCourierId == null
                            && j.AgentId == null
                            && j.FdcourierId == null
                            && j.ParentId == null
                            && !j.UcjbVoid
                            && !j.UcjbJobDone
                            && (j.UcjbStatus == null || !UnclaimableStatuses.Contains(j.UcjbStatus.Value)))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbCourierId, courierId)
                    .SetProperty(j => j.AgentId, (int?)null)
                    .SetProperty(j => j.UcjbDispId, staffId)
                    .SetProperty(j => j.DesCheck, false)
                    .SetProperty(j => j.FdcourierId, (int?)null)
                    .SetProperty(j => j.UcjbDispDate, tenantTime)
                    .SetProperty(j => j.UcjbDispTime, tenantTime)
                    .SetProperty(j => j.UcjbStatus, (int)JobStatus.Dispatched)
                    .SetProperty(j => j.InternalStatus, (int)InternalJobStatus.AwaitingPod), cancellationToken);

            if (claimed == 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return await ClassifyLostClaimAsync(context, jobId, courierId, cancellationToken);
            }

            await courierRepository.ResetClearListAreaOrderAsync(courierId, context);
            await CascadeCourierToChildJobsAsync(jobIds, InternalJobStatus.AwaitingPod);
            await transaction.CommitAsync(cancellationToken);
            return CourierClaimOutcome.Assigned;
        });
    }

    // The decision was made by the conditional UPDATE; this read only chooses the answer, so it takes no lock.
    private static async Task<CourierClaimOutcome> ClassifyLostClaimAsync(DespatchContext context, int jobId,
        int courierId, CancellationToken cancellationToken)
    {
        var current = await context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new { j.UcjbCourierId })
            .FirstOrDefaultAsync(cancellationToken);

        return current is null ? CourierClaimOutcome.NotFound
            : current.UcjbCourierId == courierId ? CourierClaimOutcome.AlreadyYours
            : CourierClaimOutcome.Unavailable;
    }

    public async Task<bool> IsActiveStaffAsync(int staffId, CancellationToken cancellationToken = default) =>
        await Context.TucStaffs.AnyAsync(s => s.UcstId == staffId && s.UcstActive, cancellationToken);

    public async Task<bool> IsActiveCourierAsync(int courierId, CancellationToken cancellationToken = default) =>
        await Context.TucCouriers.AnyAsync(c => c.UccrId == courierId && c.Active, cancellationToken);
}
