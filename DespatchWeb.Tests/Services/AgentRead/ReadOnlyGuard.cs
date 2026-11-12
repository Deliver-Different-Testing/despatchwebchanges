using System.Data.Common;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AgentRead;

/// <summary>
/// Hands out SQLite contexts that record (and refuse) anything but a SELECT, so a query service's test can prove it
/// wrote nothing even where the service swallows the exception.
/// </summary>
internal sealed class ReadOnlyGuard : DbCommandInterceptor
{
    private readonly List<string> _writes = [];

    public IReadOnlyList<string> Writes => _writes;

    public IDbContextFactory<DespatchContext> Factory(SqliteTestDatabase db)
    {
        var options = new DbContextOptionsBuilder<DespatchContext>(db.Options).AddInterceptors(this).Options;
        var factory = Substitute.For<IDbContextFactory<DespatchContext>>();
        factory.CreateDbContext().Returns(_ => new DespatchContext(options));
        factory.CreateDbContextAsync(Arg.Any<CancellationToken>()).Returns(_ => new DespatchContext(options));
        return factory;
    }

    private void Check(DbCommand command)
    {
        var sql = string.Join("\n", command.CommandText.Split('\n').Where(l => !l.TrimStart().StartsWith("--", StringComparison.Ordinal))).TrimStart();
        if (sql.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase)
            || sql.StartsWith("WITH", StringComparison.OrdinalIgnoreCase)
            || sql.StartsWith("PRAGMA", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        _writes.Add(sql);
        throw new InvalidOperationException("Read-only guard: " + sql);
    }

    public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    {
        Check(command);
        return result;
    }

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        Check(command);
        return new(result);
    }

    public override InterceptionResult<int> NonQueryExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<int> result)
    {
        Check(command);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Check(command);
        return new(result);
    }
}
