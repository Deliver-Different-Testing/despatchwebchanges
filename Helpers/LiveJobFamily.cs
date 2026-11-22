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

    /// <summary>A live child of <paramref name="parentJobId"/>, ignoring legs whose ParentId is a bulk id.</summary>
    public static Expression<Func<TucJob, bool>> ChildOf(int parentJobId) =>
        j => j.ParentId == parentJobId && (j.BulkParentId == null || j.ParentId != j.BulkParentId);

    /// <summary>An archived child of <paramref name="parentJobId"/>, ignoring legs whose ParentId is a bulk id.</summary>
    public static Expression<Func<TucJobArchive, bool>> ArchivedChildOf(int parentJobId) =>
        j => j.ParentId == parentJobId && (j.BulkParentId == null || j.ParentId != j.BulkParentId);
}
