using System.Linq.Expressions;
using DespatchWeb.Enums;

namespace DespatchWeb.Helpers;

/// <summary>
/// The status fields the job list's stats header counts by, narrowed to the columns the buckets
/// actually read so the aggregate can project straight out of SQL.
/// </summary>
public readonly record struct JobStatusSnapshot(
    int? StatusId,
    bool Done,
    bool Void,
    DateTime? CompletedTime,
    bool HasCourier);

/// <summary>
/// Which column of the job list's stats header a job falls under. A voided job belongs to none of
/// them — it is counted in the total and nowhere else.
/// </summary>
public enum JobListBucket
{
    None = 0,
    Active = 1,
    Transit = 2,
    Done = 3
}

/// <summary>
/// The one rule that sorts a job into the stats header's Active / Transit / Done columns.
/// <para>
/// Held as an expression tree so the same rule serves both the counting done in SQL — EF translates
/// it into the CASE the counts group by — and the bulk list, which classifies an already-
/// materialised set through <see cref="Classify"/>. It resolves a row's status exactly as
/// <see cref="JobStatusResolver"/> does, inline, because an expression tree cannot call a method;
/// <c>JobListStatusBucketsTests</c> holds the two against each other over every combination.
/// </para>
/// </summary>
public static class JobListStatusBuckets
{
    private const int Completed = (int)JobStatus.Completed;
    private const int Undeliverable = (int)JobStatus.Undeliverable;
    private const int Void = (int)JobStatus.Void;

    /// <summary>
    /// Ordered as the resolver resolves: the void flag wins outright, then a done flag or a
    /// completion time promotes a status that records no outcome of its own, then the status itself.
    /// Done is the Completed status alone — Undeliverable is finished but not delivered, and the
    /// header has no column for it.
    /// </summary>
    public static Expression<Func<JobStatusSnapshot, JobListBucket>> ToBucket { get; } = s =>
        s.Void || s.StatusId == Void
            ? JobListBucket.None
            : s.StatusId == Completed
              || ((s.Done || s.CompletedTime != null) && s.StatusId != Undeliverable)
                ? JobListBucket.Done
                : s.StatusId == (int)JobStatus.Dispatched
                  || s.StatusId == (int)JobStatus.Accepted
                  || s.StatusId == (int)JobStatus.PickedUp
                  || s.StatusId == (int)JobStatus.InTransit
                    ? JobListBucket.Transit
                    : !s.HasCourier
                        ? JobListBucket.Active
                        : JobListBucket.None;

    /// <summary>The same rule for a set already in memory.</summary>
    public static Func<JobStatusSnapshot, JobListBucket> Classify { get; } = ToBucket.Compile();

    /// <summary>
    /// The same rule against a table, as an expression over the entity itself.
    /// <para>
    /// EF cannot carry a <see cref="JobStatusSnapshot"/> through a UNION — constructing one is a
    /// client projection, and a set operation cannot follow one — so the snapshot is folded away
    /// here and the rule reaches SQL as a plain CASE over the entity's own columns.
    /// </para>
    /// </summary>
    /// <param name="snapshot">How to read the five status columns off the entity. Must construct
    /// the snapshot directly, so its arguments can be substituted into the rule.</param>
    public static Expression<Func<TEntity, JobListBucket>> Over<TEntity>(
        Expression<Func<TEntity, JobStatusSnapshot>> snapshot)
    {
        if (snapshot.Body is not NewExpression { Constructor: not null } construction)
        {
            throw new ArgumentException(
                "The snapshot selector must construct a JobStatusSnapshot directly.", nameof(snapshot));
        }

        var columns = construction.Constructor.GetParameters()
            .Select((parameter, i) => (parameter.Name, Argument: construction.Arguments[i]))
            .ToDictionary(x => x.Name!, x => x.Argument, StringComparer.OrdinalIgnoreCase);

        var body = new SnapshotInliner(ToBucket.Parameters[0], columns).Visit(ToBucket.Body);

        return Expression.Lambda<Func<TEntity, JobListBucket>>(body!, snapshot.Parameters[0]);
    }

    /// <summary>Rewrites every <c>snapshot.Column</c> read in the rule as the entity column it came from.</summary>
    private sealed class SnapshotInliner(ParameterExpression snapshot, IReadOnlyDictionary<string, Expression> columns)
        : ExpressionVisitor
    {
        protected override Expression VisitMember(MemberExpression node) =>
            node.Expression == snapshot && columns.TryGetValue(node.Member.Name, out var column)
                ? column
                : base.VisitMember(node);
    }
}
