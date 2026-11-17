using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    private const int OnHoldStatus = 100;

    // Everything JobListStatusBuckets keeps out of "needs dispatch" (on the road, completed, void), finished outcomes
    // (Undeliverable, Missing), Preassigned (allocated, per JobChangeRequestService), held jobs and agent statuses.
    private static readonly int[] UnclaimableStatuses =
    [
        (int)JobStatus.Dispatched,
        (int)JobStatus.Accepted,
        (int)JobStatus.PickedUp,
        (int)JobStatus.InTransit,
        (int)JobStatus.Completed,
        (int)JobStatus.Undeliverable,
        (int)JobStatus.Preassigned,
        OnHoldStatus,
        (int)JobStatus.OutboundAgentAssigned,
        (int)JobStatus.InboundAgentAssigned,
        (int)JobStatus.GroundAgentAssigned,
        (int)JobStatus.Void,
        (int)JobStatus.Missing
    ];

    public async Task<CourierClaimOutcome> ClaimJobForCourierAsync(int jobId, int courierId, int staffId,
        CancellationToken cancellationToken = default)
    {
        var context = Context;

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
                            && j.UcjbComplTime == null
                            && (j.UcjbStatus == null || !UnclaimableStatuses.Contains(j.UcjbStatus.Value))
                            // Re-checked here, not only before the claim, so a courier or staff member made inactive
                            // in between is never written to the job.
                            && context.TucCouriers.Any(c => c.UccrId == courierId && c.Active)
                            && context.TucStaffs.Any(s => s.UcstId == staffId && s.UcstActive))
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
