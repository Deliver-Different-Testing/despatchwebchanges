#nullable enable
using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Query;

namespace DespatchWeb.Interceptors;

/// <summary>
/// Branches spec section 4.1: a branch-limited user who can see a job sees its client and
/// the couriers on its legs even when they belong to another branch, but those clients and
/// couriers do not join the user's client and courier lists. A query whose primary source
/// is a job table therefore drops the branch client / courier list filters; the job filter
/// itself still decides which jobs come back, and the NP / customer arms are untouched.
/// Queries rooted at clients or couriers (pickers, dispatch dropdowns) keep both filters.
/// </summary>
public sealed class BranchJobContextInterceptor : IQueryExpressionInterceptor
{
    public static readonly BranchJobContextInterceptor Instance = new();

    private static readonly HashSet<Type> JobTypes =
        [typeof(TucJob), typeof(TucJobArchive), typeof(TucJobBooking), typeof(TblBulkJob)];

    private static readonly string[] ContextFilters =
        [DespatchContext.BranchClientsFilter, DespatchContext.BranchCouriersFilter];

    private static readonly System.Reflection.MethodInfo IgnoreNamedFilters =
        typeof(EntityFrameworkQueryableExtensions).GetMethods()
            .Single(m => m.Name == nameof(EntityFrameworkQueryableExtensions.IgnoreQueryFilters)
                         && m.GetParameters().Length == 2);

    public Expression QueryCompilationStarting(Expression queryExpression, QueryExpressionEventData eventData)
    {
        var source = queryExpression;
        while (source is MethodCallExpression { Arguments.Count: > 0 } call
               && (call.Method.DeclaringType == typeof(Queryable)
                   || call.Method.DeclaringType == typeof(EntityFrameworkQueryableExtensions)))
        {
            source = call.Arguments[0];
        }

        if (source is not EntityQueryRootExpression root || !JobTypes.Contains(root.EntityType.ClrType))
        {
            return queryExpression;
        }

        var ignoring = Expression.Call(
            IgnoreNamedFilters.MakeGenericMethod(root.EntityType.ClrType),
            root,
            Expression.Constant(ContextFilters, typeof(IReadOnlyCollection<string>)));
        return ReplacingExpressionVisitor.Replace(root, ignoring, queryExpression);
    }
}
