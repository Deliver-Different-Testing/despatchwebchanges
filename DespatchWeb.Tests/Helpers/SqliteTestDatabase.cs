using System.Runtime.CompilerServices;
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
    // Building the 124-table DespatchContext schema via EnsureCreated() is expensive
    // (this used to run ~1,189 times, once per test method). Build it once per process
    // into a template connection, then clone it into each instance via SQLite's backup
    // API, which just copies pages instead of re-running all the DDL.
    //
    // The static initializer below runs under the CLR's type-init lock: whichever
    // thread hits it first pays the full build cost while every other thread that
    // concurrently constructs a SqliteTestDatabase blocks on the same lock. With
    // parallel test execution that shows up as several unrelated tests each taking
    // several seconds. A module initializer forces this to happen once, single-
    // threaded, when the test assembly loads - before any parallel test worker starts -
    // so no test ever pays (or blocks behind) the build cost.
    private static readonly Lock TemplateLock = new();
    private static readonly SqliteConnection TemplateConnection = CreateTemplateConnection();

    [ModuleInitializer]
    internal static void WarmUpTemplate() => _ = TemplateConnection;

    public SqliteConnection Connection { get; }
    public DbContextOptions<DespatchContext> Options { get; }

    public SqliteTestDatabase()
    {
        Connection = new SqliteConnection("DataSource=:memory:");
        Connection.Open();

        lock (TemplateLock)
        {
            TemplateConnection.BackupDatabase(Connection);
        }

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
    }

    private static SqliteConnection CreateTemplateConnection()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(connection)
            .Options;

        using var context = new DespatchContext(options);
        context.Database.EnsureCreated();

        return connection;
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
