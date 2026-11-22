using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

public sealed class PartnerJobLinkService(
    IDbContextFactory<DespatchContext> contextFactory,
    IJobCommandRepository jobCommands,
    IJobQueryRepository jobQueries,
    IRateJobService rating,
    ITaskRepository tasks,
    ITenantInfoService tenantInfo) : IPartnerJobLinkService
{
    /// <summary>Statuses before the consignment is collected. Anything else counts as picked up or finished.</summary>
    internal static readonly int[] PrePickupStatuses =
    [
        (int)JobStatus.New, (int)JobStatus.Dispatched, (int)JobStatus.Accepted, (int)JobStatus.Rejected,
        (int)JobStatus.LatePickup, (int)JobStatus.Acknowledge, (int)JobStatus.ReadyForPacking,
        (int)JobStatus.ReadyToPickup, (int)JobStatus.AwaitingProcessing, (int)JobStatus.Preassigned
    ];

    private static readonly int[] FinishedStatuses =
        [(int)JobStatus.Completed, (int)JobStatus.AssumingCompleted, (int)JobStatus.Void];

    public async Task<PartnerUnlinkOutcome> UnlinkAsync(Guid partnerJobGuid, PartnerUnlinkReason reason, string? partnerName,
        CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var job = await ctx.TucJobs
            .Where(j => j.PartnerJobGuid == partnerJobGuid)
            .Where(PartnerJobDirection.IsOutbound)
            .Select(j => new LinkedJob(j.UcjbId, j.UcjbNumber, partnerJobGuid, j.PartnerPairing.PartnerTenantName))
            .FirstOrDefaultAsync(ct);

        if (job is null)
        {
            return PartnerUnlinkOutcome.NotFound;
        }

        return await UnlinkOneAsync(ctx, job, reason, partnerName ?? job.PartnerName, ct)
            ? PartnerUnlinkOutcome.Unlinked
            : PartnerUnlinkOutcome.NotFound;
    }

    public async Task<PartnerReleaseResult> ReleaseAsync(int pairingId, PartnerReleaseScope scope, string? partnerName,
        CancellationToken ct) =>
        scope == PartnerReleaseScope.Outbound
            ? await ReleaseOutboundAsync(pairingId, partnerName, ct)
            : await ReleaseInboundAsync(pairingId, partnerName, ct);

    private async Task<PartnerReleaseResult> ReleaseOutboundAsync(int pairingId, string? partnerName, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var jobs = await ctx.TucJobs
            .Where(j => j.PartnerPairingId == pairingId && !j.UcjbVoid)
            .Where(PartnerJobDirection.IsOutbound)
            .Select(j => new
            {
                Job = new LinkedJob(j.UcjbId, j.UcjbNumber, j.PartnerJobGuid!.Value, j.PartnerPairing.PartnerTenantName),
                Finished = j.UcjbJobDone || j.UcjbComplTime != null
                                         || (j.UcjbStatus != null && FinishedStatuses.Contains(j.UcjbStatus.Value))
            })
            .ToListAsync(ct);

        var unlinked = 0;
        foreach (var candidate in jobs.Where(j => !j.Finished))
        {
            if (await UnlinkOneAsync(ctx, candidate.Job, PartnerUnlinkReason.PairingRevoked, partnerName ?? candidate.Job.PartnerName, ct))
            {
                unlinked++;
            }
        }

        return new PartnerReleaseResult(unlinked, 0, 0, jobs.Count(j => j.Finished));
    }

    private async Task<PartnerReleaseResult> ReleaseInboundAsync(int pairingId, string? partnerName, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var copies = await ctx.TucJobs
            .Where(j => j.PartnerPairingId == pairingId && !j.UcjbVoid)
            .Where(PartnerJobDirection.IsInboundCopy)
            .Select(j => new
            {
                j.UcjbId,
                j.UcjbNumber,
                PartnerName = j.PartnerPairing.PartnerTenantName,
                Finished = j.UcjbJobDone || j.UcjbComplTime != null
                                         || (j.UcjbStatus != null && FinishedStatuses.Contains(j.UcjbStatus.Value))
            })
            .ToListAsync(ct);

        int voided = 0, afterPickup = 0;
        foreach (var copy in copies.Where(c => !c.Finished))
        {
            var pickedUp = await ClaimForVoidAsync(ctx, copy.UcjbId, prePickupOnly: true, ct) == 0;
            if (pickedUp && await ClaimForVoidAsync(ctx, copy.UcjbId, prePickupOnly: false, ct) == 0)
            {
                continue;
            }

            var partner = partnerName ?? copy.PartnerName;
            await jobCommands.VoidJobAsync(new VoidJobRequest
            {
                JobId = copy.UcjbId,
                VoidSingleJobOnly = true,
                VoidReason = $"Partnership with {partner} revoked"
            });
            voided++;

            if (pickedUp)
            {
                afterPickup++;
                await RaiseTaskAsync(copy.UcjbId,
                    $"Job {copy.UcjbNumber} was voided because the partnership with {partner} was revoked, but it had " +
                    "already been picked up. Arrange what happens to the freight.");
            }
        }

        return new PartnerReleaseResult(0, voided, afterPickup, copies.Count(c => c.Finished));
    }

    /// <summary>
    /// Marks the job void in one conditional UPDATE, so a pickup landing at the same moment either beats it (0 rows)
    /// or loses to it. The full void (amounts, courier slot, bulk rows) runs only once the claim is won.
    /// </summary>
    internal static Task<int> ClaimForVoidAsync(DespatchContext ctx, int jobId, bool prePickupOnly, CancellationToken ct) =>
        ctx.TucJobs
            .Where(j => j.UcjbId == jobId && !j.UcjbVoid && !j.UcjbJobDone && j.UcjbComplTime == null
                        && (j.UcjbStatus == null || !FinishedStatuses.Contains(j.UcjbStatus.Value)))
            .Where(j => !prePickupOnly || j.UcjbStatus == null || PrePickupStatuses.Contains(j.UcjbStatus.Value))
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.UcjbStatus, (int)JobStatus.Void)
                .SetProperty(j => j.UcjbVoid, true), ct);

    private async Task<bool> UnlinkOneAsync(DespatchContext ctx, LinkedJob job, PartnerUnlinkReason reason, string? partnerName,
        CancellationToken ct)
    {
        var partner = string.IsNullOrWhiteSpace(partnerName) ? "The partner" : partnerName;
        var because = reason switch
        {
            PartnerUnlinkReason.PartnerVoided => "they voided their copy",
            PartnerUnlinkReason.RecallApplied => "it was recalled",
            _ => "the partnership was revoked"
        };

        var won = false;
        var strategy = ctx.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await ctx.Database.BeginTransactionAsync(ct);

            // Guarded on the GUID: whichever channel (status webhook, Applied notice, revoke) arrives first wins, and
            // every later one finds nothing to do.
            var rows = await ctx.TucJobs
                .Where(j => j.UcjbId == job.Id && j.PartnerJobGuid == job.PartnerJobGuid)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(j => j.PartnerJobGuid, (Guid?)null)
                    .SetProperty(j => j.PartnerAgreedRate, (decimal?)null), ct);

            if (rows == 0)
            {
                await tx.RollbackAsync(ct);
                won = false;
                return;
            }

            ctx.JobDeliveryJourneys.Add(new JobDeliveryJourney
            {
                JobId = job.Id,
                ChangeType = nameof(DeliveryJourneyChangeType.JobUpdate),
                FieldName = "partnerJobGuid",
                OldValue = job.PartnerJobGuid.ToString(),
                NewValue = null,
                StaffId = null,
                UpdatedAt = DateTime.UtcNow,
                UpdatedByType = DeliveryJourneyUpdatedBy.TypeForStaffId(null),
                Comments = $"{partner} no longer has this job ({because}); returned to dispatch"
            });
            await ctx.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            won = true;
        });

        if (!won)
        {
            return false;
        }

        await RaiseTaskAsync(job.Id, $"{partner} returned job {job.Number} ({because}). It's back in your dispatch: re-plan it.");
        await ReRateAsync(job.Id);
        return true;
    }

    // The sell amount may still be the partner-derived cost-plus figure, so price the job again from the rate card.
    private async Task ReRateAsync(int jobId)
    {
        try
        {
            if (tenantInfo.IsUsTenant())
            {
                var details = await jobQueries.GetJobDetailsForRatingAsync(jobId);
                if (!details.IsManuallyRated)
                {
                    await rating.RateJobUsAsync(details);
                }
            }
            else
            {
                var details = await jobQueries.GetJobDetailsForRatingNzAsync(jobId, false);
                if (!details.IsManuallyRated)
                {
                    await rating.RateJobNzAsync(details);
                }
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Job {JobId}: re-rating after its partner hand-off ended failed; the dispatcher's task still stands", jobId);
        }
    }

    private async Task RaiseTaskAsync(int jobId, string notes)
    {
        try
        {
            await tasks.AddEventAsync(jobId, notes, (int)EventType.Other);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Job {JobId}: couldn't raise the dispatch task \"{Notes}\"", jobId, notes);
        }
    }

    private sealed record LinkedJob(int Id, string Number, Guid PartnerJobGuid, string? PartnerName);
}
