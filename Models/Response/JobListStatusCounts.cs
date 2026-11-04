using DespatchWeb.Helpers;

namespace DespatchWeb.Models.Response;

/// <summary>
/// The job list's stats header, counted over every job the search matches rather than over the page
/// being returned — and, where a status filter is in play, over the set as it stands before that
/// filter, so picking a category tab cannot move the numbers.
/// <para>
/// Answered alongside the first page only; later pages leave it null and the client keeps the
/// counts it already has.
/// </para>
/// </summary>
public sealed record JobListStatusCounts
{
    public int Total { get; init; }

    /// <summary>What the Unassigned tab lists.</summary>
    public int Unassigned { get; init; }

    /// <summary>What the Active tab lists: everything not done, so <see cref="Transit"/> is a part of it.</summary>
    public int Active { get; init; }
    public int Transit { get; init; }
    public int Done { get; init; }

    /// <summary>
    /// Folds the per-bucket tallies the database groups into the numbers the header renders, each
    /// matching the tab of the same name. Total spans every bucket, voided jobs included — they show
    /// in the list, so they count; and Active is everything not done, as the Active tab filters it.
    /// </summary>
    public static JobListStatusCounts FromBuckets(IReadOnlyCollection<JobListBucketTally> tallies)
    {
        var total = tallies.Sum(t => t.Count);
        var done = tallies.Where(t => t.Bucket == JobListBucket.Done).Sum(t => t.Count);
        return new JobListStatusCounts
        {
            Total = total,
            Unassigned = tallies.Where(t => t.Bucket == JobListBucket.Unassigned).Sum(t => t.Count),
            Active = total - done,
            Transit = tallies.Where(t => t.Bucket == JobListBucket.Transit).Sum(t => t.Count),
            Done = done
        };
    }

    /// <summary>
    /// The same fold for a list that already holds every match — the bulk list pages its own deduped
    /// set in memory, so counting it costs nothing and asking the database again would be a waste.
    /// </summary>
    public static JobListStatusCounts FromJobs(IReadOnlyCollection<DispatchJobViewModel> jobs) =>
        FromBuckets(jobs
            .GroupBy(job => JobListStatusBuckets.Classify(JobStatusSnapshots.Of(job)))
            .Select(g => new JobListBucketTally(g.Key, g.Count()))
            .ToList());
}
