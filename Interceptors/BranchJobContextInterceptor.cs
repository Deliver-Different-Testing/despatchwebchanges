#nullable enable
using System.Linq.Expressions;
using System.Reflection;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Query;

namespace DespatchWeb.Interceptors;

/// <summary>
/// Branches programme (B2). A branch-limited user who can see a job also sees its client and the couriers on its legs,
/// even when they belong to another branch, but those clients and couriers do not join the user's own client and courier
/// lists. So a query whose root is a job table drops the two named branch list filters (the job filter still decides
/// which jobs come back, and the network partner / customer arms are untouched). Queries rooted at clients or couriers
/// (pickers, dispatch dropdowns, courier lists) keep both filters.
/// </summary>
public sealed class BranchJobContextInterceptor : IQueryExpressionInterceptor
{
    public static readonly BranchJobContextInterceptor Instance = new();

    // TblJob (the archived-job views read through it) and TucJobChangeRequest (change requests only reach jobs the
    // caller can see) are job-rooted too: a visible job shows its client and courier names whichever table the query starts at.
    private static readonly HashSet<Type> JobRoots =
        [typeof(TucJob), typeof(TucJobArchive), typeof(TucJobBooking), typeof(TblBulkJob), typeof(TblJob), typeof(TucJobChangeRequest)];

    private static readonly string[] ListFilters = [DespatchContext.BranchClientsFilter, DespatchContext.BranchCouriersFilter];

    // IgnoreQueryFilters<T>(IQueryable<T>, IReadOnlyCollection<string>) - the overload that takes filter names.
    private static readonly MethodInfo IgnoreNamedFilters =
        typeof(EntityFrameworkQueryableExtensions).GetMethods()
            .Single(m => m.Name == nameof(EntityFrameworkQueryableExtensions.IgnoreQueryFilters)
                         && m.GetParameters().Length == 2);

    public Expression QueryCompilationStarting(Expression queryExpression, QueryExpressionEventData eventData)
    {
        // Walk to the query's root: the first argument of each Queryable / EF operator is the source it builds on.
        var source = queryExpression;
        while (source is MethodCallExpression { Arguments.Count: > 0 } call
               && (call.Method.DeclaringType == typeof(Queryable)
                   || call.Method.DeclaringType == typeof(EntityFrameworkQueryableExtensions)))
        {
            source = call.Arguments[0];
        }

        if (source is not EntityQueryRootExpression root || !JobRoots.Contains(root.EntityType.ClrType))
        {
            return queryExpression;
        }

        var ignoring = Expression.Call(
            IgnoreNamedFilters.MakeGenericMethod(root.EntityType.ClrType),
            root,
            Expression.Constant(ListFilters, typeof(IReadOnlyCollection<string>)));
        return ReplacingExpressionVisitor.Replace(root, ignoring, queryExpression);
    }
}
