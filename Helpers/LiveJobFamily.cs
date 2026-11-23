using System.Linq.Expressions;
using DespatchWeb.EntityClasses;

namespace DespatchWeb.Helpers;

/// <summary>
/// The schedule procs give a leg that goes live before its parent the bulk parent's id as ParentId,
/// and only repoint it when the parent is released. Until then ParentId == BulkParentId, and because
/// tblBulkJob ids overlap tucJob ids, that value can name an unrelated live job.
/// </summary>
public static class LiveJobFamily
{
    /// <summary>The leg's ParentId still holds its parked bulk parent's id, not a tucJob id.</summary>
    public static Expression<Func<TucJob, bool>> HasParkedBulkParent =>
        j => j.BulkParentId != null && j.ParentId == j.BulkParentId;

    /// <summary>
    /// A live child of <paramref name="parentJobId"/>: a leg pointing at it by ParentId (never through a
    /// bulk id that merely collides with it), or a leg not yet repointed after its bulk parent was
    /// released as <paramref name="parentJobId"/>.
    /// </summary>
    public static Expression<Func<TucJob, bool>> ChildOf(DespatchContext db, int parentJobId) =>
        j => (j.ParentId == parentJobId && (j.BulkParentId == null || j.ParentId != j.BulkParentId))
             || (j.BulkParentId != null && j.ParentId == j.BulkParentId
                 && db.TblBulkJobs.Any(b => b.BulkJobId == j.BulkParentId && b.JobId == parentJobId));

    /// <summary>The archived counterpart of <see cref="ChildOf"/>.</summary>
    public static Expression<Func<TucJobArchive, bool>> ArchivedChildOf(DespatchContext db, int parentJobId) =>
        j => (j.ParentId == parentJobId && (j.BulkParentId == null || j.ParentId != j.BulkParentId))
             || (j.BulkParentId != null && j.ParentId == j.BulkParentId
                 && db.TblBulkJobs.Any(b => b.BulkJobId == j.BulkParentId && b.JobId == parentJobId));
}
