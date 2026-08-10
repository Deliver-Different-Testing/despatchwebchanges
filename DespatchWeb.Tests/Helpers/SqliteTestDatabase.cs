using DespatchWeb.EntityClasses;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Reusable SQLite in-memory database for repository and service tests.
/// Eliminates duplicated connection/schema setup boilerplate across test classes.
/// </summary>
public sealed class SqliteTestDatabase : IAsyncDisposable
{
    public SqliteConnection Connection { get; }
    public DbContextOptions<DespatchContext> Options { get; }

    public SqliteTestDatabase()
    {
        Connection = new SqliteConnection("DataSource=:memory:");
        Connection.Open();

        Connection.CreateFunction("getdate", () => TestDates.Now);
        Connection.CreateFunction("getutcdate", () => TestDates.UtcNow);
        Connection.CreateFunction("sysutcdatetime", () => TestDates.UtcNow);
        Connection.CreateFunction("newsequentialid", Guid.NewGuid);
        Connection.RegisterDateDiffMinute();

        using var cmd = Connection.CreateCommand();
        cmd.CommandText = "PRAGMA foreign_keys = OFF;";
        cmd.ExecuteNonQuery();

        Options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(Connection)
            .AddSqliteDateDiffTranslation()
            .Options;

        using var context = new DespatchContext(Options);
        context.Database.EnsureCreated();
    }

    public DespatchContext CreateContext() => new(Options);

    /// <summary>
    /// Creates an NSubstitute factory mock that returns a new context per call (for parallel queries).
    /// </summary>
    /// <param name="procedures">
    /// Stamped onto every context the factory hands out, so a service that calls a stored procedure
    /// through <c>context.Procedures</c> can be verified rather than failing against SQLite.
    /// </param>
    public IDbContextFactory<DespatchContext> CreateFactoryMock(IDespatchContextProcedures? procedures = null)
    {
        var mock = Substitute.For<IDbContextFactory<DespatchContext>>();
        mock.CreateDbContext()
            .Returns(_ => Create());
        mock.CreateDbContextAsync(Arg.Any<CancellationToken>())
            .Returns(_ => Create());
        return mock;

        DespatchContext Create()
        {
            var context = new DespatchContext(Options);
            if (procedures is not null)
            {
                context.Procedures = procedures;
            }

            return context;
        }
    }

    /// <summary>
    /// Creates an NSubstitute factory mock that always returns the same context instance.
    /// Use when tests don't need parallel query support.
    /// </summary>
    public static IDbContextFactory<DespatchContext> CreateFactoryMock(DespatchContext sharedContext)
    {
        var mock = Substitute.For<IDbContextFactory<DespatchContext>>();
        mock.CreateDbContext()
            .Returns(sharedContext);
        mock.CreateDbContextAsync(Arg.Any<CancellationToken>())
            .Returns(sharedContext);
        return mock;
    }

    public async ValueTask DisposeAsync() => await Connection.DisposeAsync();
}
