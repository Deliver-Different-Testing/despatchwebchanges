using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

/// <summary>
/// How each job table exposes the five status columns the stats header's buckets read. Kept beside
/// each other so a live job and its archived twin can never be classified from different fields.
/// </summary>
public static class JobStatusSnapshots
{
    public static Expression<Func<TucJob, JobStatusSnapshot>> Live { get; } =
        j => new JobStatusSnapshot(j.UcjbStatus, j.UcjbJobDone, j.UcjbVoid, j.UcjbComplTime, j.UcjbCourierId != null);

    public static Expression<Func<TucJobArchive, JobStatusSnapshot>> Archived { get; } =
        j => new JobStatusSnapshot(j.UcjbStatus, j.UcjbJobDone, j.UcjbVoid, j.UcjbComplTime, j.UcjbCourierId != null);

    /// <summary>
    /// The same five fields off a job the caller has already materialised. Courier assignment reads
    /// the code the projection resolved, which is empty exactly when the job carries no courier id.
    /// </summary>
    public static JobStatusSnapshot Of(DispatchJobViewModel job) =>
        new(job.StatusId,
            job.Done == true,
            job.Void == true,
            job.CompletedTime,
            !string.IsNullOrWhiteSpace(job.Courier));
}
