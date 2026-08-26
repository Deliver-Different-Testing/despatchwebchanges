#nullable enable

using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Extensions;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public partial class JobRepository
{
    /// <summary>A resolved job plus the parent link needed to decide whether it is a leg.</summary>
    private sealed record PodMediaLegRow : PodMediaLeg
    {
        public int? ParentId { get; init; }
    }

    // Dispatch is stored as a separate date and time, and an unset date arrives as a 1900 sentinel
    // rather than NULL (see JobMappings.Core).
    private static readonly Expression<Func<TucJob, PodMediaLegRow>> LivePodMediaLeg =
        j => new PodMediaLegRow
        {
            JobId = j.UcjbId,
            JobNumber = j.UcjbNumber,
            ParentId = j.ParentId,
            CompletedTime = j.UcjbComplTime,
            PickUpTime = j.PickUpTime,
            DispatchedTime = j.UcjbDispDate.HasValue && j.UcjbDispDate.Value.Year > 1900
                ? j.UcjbDispDate.Value.CombineWithTime(j.UcjbDispTime)
                : null
        };

    private static readonly Expression<Func<TucJobArchive, PodMediaLegRow>> ArchivedPodMediaLeg =
        j => new PodMediaLegRow
        {
            JobId = j.UcjbId,
            JobNumber = j.UcjbNumber,
            ParentId = j.ParentId,
            CompletedTime = j.UcjbComplTime,
            PickUpTime = j.PickUpTime,
            DispatchedTime = j.UcjbDispDate.HasValue && j.UcjbDispDate.Value.Year > 1900
                ? j.UcjbDispDate.Value.CombineWithTime(j.UcjbDispTime)
                : null
        };

    /// <summary>
    /// Resolves every job whose id may key POD media in S3 for <paramref name="jobId"/>.
    /// </summary>
    /// <remarks>
    /// Media is written against the leg the courier completed, never against the parent, so the
    /// parent — the number the client searches for and downloads a POD against — has to sweep its
    /// legs. A leg resolves to itself alone so the per-leg tabs keep showing only what happened on
    /// that leg. A family row carries its own id in <c>ParentId</c>, so the family root is
    /// <c>ParentId ?? UcjbId</c>, matching the family query in <c>GetLiveJobByIdAsync</c>. Both
    /// tables are swept because a leg can be archived independently of its parent.
    /// </remarks>
    public async Task<IReadOnlyList<PodMediaLeg>> GetPodMediaLegsAsync(int jobId)
    {
        var self = await Context.TucJobs
                       .Where(j => j.UcjbId == jobId)
                       .Select(LivePodMediaLeg)
                       .FirstOrDefaultAsync()
                   ?? await Context.TucJobArchives
                       .Where(j => j.UcjbId == jobId)
                       .Select(ArchivedPodMediaLeg)
                       .FirstOrDefaultAsync();

        if (self is null)
        {
            return [];
        }

        var requested = self with { IsRequestedJob = true };

        if ((self.ParentId ?? self.JobId) != self.JobId)
        {
            return [requested];
        }

        var liveLegs = await Context.TucJobs
            .Where(j => j.ParentId == jobId && j.UcjbId != jobId && !j.UcjbVoid)
            .Select(LivePodMediaLeg)
            .ToListAsync();

        var archivedLegs = await Context.TucJobArchives
            .Where(j => j.ParentId == jobId && j.UcjbId != jobId && !j.UcjbVoid)
            .Select(ArchivedPodMediaLeg)
            .ToListAsync();

        return
        [
            .. liveLegs
                .Concat(archivedLegs)
                .Prepend(requested)
                .DistinctBy(leg => leg.JobId)
        ];
    }
}
