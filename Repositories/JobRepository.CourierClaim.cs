using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    // An allow-list, so a status added later is refused until someone decides it means "waiting for a courier".
    private static readonly int[] ClaimableStatuses =
        [(int)JobStatus.New, (int)JobStatus.Rejected, (int)JobStatus.LatePickup, (int)JobStatus.Warning];

    private static readonly int[] FinishedStatuses =
        [(int)JobStatus.Completed, (int)JobStatus.Undeliverable, (int)JobStatus.Void, (int)JobStatus.Missing];

    public async Task<CourierClaimOutcome> ClaimJobForCourierAsync(int jobId, int courierId, int staffId,
        CancellationToken cancellationToken = default)
    {
        var context = Context;

        return await context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            var tenantTime = _clock.TenantNow;
            var localTenantId = _infoService.GetCurrentTenantId();
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
                            && (j.UcjbStatus == null || ClaimableStatuses.Contains(j.UcjbStatus.Value))
                            // Same rule as JobController.Allocate: a job sent out to a partner is managed from the pairing.
                            && (localTenantId == null || j.PartnerPairing == null || j.PartnerPairing.OwnerTenantId != localTenantId)
                            // An inbound partner job may still be waiting on rate acceptance, which this caller can't check.
                            && j.PartnerJobGuid == null
                            && context.TucCouriers.Any(c => c.UccrId == courierId && c.Active)
                            && context.TucStaffs.Any(s => s.UcstId == staffId && s.UcstActive))
                .ExecuteUpdateAsync(setters => setters.AssignToCourier(courierId, staffId, tenantTime), cancellationToken);

            if (claimed == 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return await ClassifyLostClaimAsync(context, jobId, courierId, staffId, cancellationToken);
            }

            await courierRepository.ResetClearListAreaOrderAsync(courierId, context, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return CourierClaimOutcome.Assigned;
        });
    }

    // The decision was made by the conditional UPDATE; these reads only choose the answer, so they take no lock.
    private static async Task<CourierClaimOutcome> ClassifyLostClaimAsync(DespatchContext context, int jobId,
        int courierId, int staffId, CancellationToken cancellationToken)
    {
        if (!await context.TucStaffs.AnyAsync(s => s.UcstId == staffId && s.UcstActive, cancellationToken))
        {
            return CourierClaimOutcome.InvalidStaff;
        }

        if (!await context.TucCouriers.AnyAsync(c => c.UccrId == courierId && c.Active, cancellationToken))
        {
            return CourierClaimOutcome.InvalidCourier;
        }

        var current = await context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new { j.UcjbCourierId, j.UcjbVoid, j.UcjbJobDone, j.UcjbComplTime, j.UcjbStatus })
            .FirstOrDefaultAsync(cancellationToken);

        return current is null ? CourierClaimOutcome.NotFound
            : current.UcjbCourierId == courierId && !current.UcjbVoid && !current.UcjbJobDone && current.UcjbComplTime == null
              && !(current.UcjbStatus is { } status && FinishedStatuses.Contains(status))
                ? CourierClaimOutcome.AlreadyYours
            : CourierClaimOutcome.Unavailable;
    }
}
