using System.Linq.Expressions;
using DespatchWeb.EntityClasses;

namespace DespatchWeb.Helpers;

/// <summary>
/// One definition of "the bulk family". tblBulkJob carries both ParentId and BulkParentId, and the
/// operations that act on a family had each picked one: releasing walked ParentId, voiding and the
/// related-jobs lookups walked BulkParentId, and the effective-id helper walked BulkParentId again.
/// A leg hung off the column an operation did not read was invisible to it, which is how the parent
/// and DEL could not be released out of bulk. Both columns are matched here rather than one being
/// declared canonical, so no member is lost while the stored data disagrees.
/// </summary>
public static class BulkJobFamily
{
    /// <summary>Every row belonging to the family rooted at <paramref name="familyRootId"/>.</summary>
    public static Expression<Func<TblBulkJob, bool>> MemberOf(int familyRootId) =>
        b => b.BulkJobId == familyRootId
             || b.ParentId == familyRootId
             || b.BulkParentId == familyRootId;

    /// <summary>
    /// The row that roots a family, resolved from any member. Mirrors
    /// <c>GetEffectiveBulkJobIdCompiled</c> but tolerates a family linked by the other column.
    /// </summary>
    public static Expression<Func<TblBulkJob, int>> RootIdOf =>
        b => b.BulkParentId ?? b.ParentId ?? b.BulkJobId;
}
