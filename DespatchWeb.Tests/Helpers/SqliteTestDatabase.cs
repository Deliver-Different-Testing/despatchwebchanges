using DespatchWeb.EntityClasses;

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

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
        Connection.CreateFunction("getutcdate", () => DateTime.UtcNow);

        using var cmd = Connection.CreateCommand();
        cmd.CommandText = "PRAGMA foreign_keys = OFF;";
        cmd.ExecuteNonQuery();

        Options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(Connection)
            .Options;

        using var context = new DespatchContext(Options);
        context.Database.EnsureCreated();
    }

    public DespatchContext CreateContext() => new(Options);

    /// <summary>
    /// Creates a factory mock that returns a new context per call (for parallel queries).
    /// </summary>
    public Mock<IDbContextFactory<DespatchContext>> CreateFactoryMock()
    {
        var mock = new Mock<IDbContextFactory<DespatchContext>>();
        mock.Setup(f => f.CreateDbContext())
            .Returns(() => new DespatchContext(Options));
        mock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(Options));
        return mock;
    }

    /// <summary>
    /// Creates a factory mock that always returns the same context instance.
    /// Use when tests don't need parallel query support.
    /// </summary>
    public Mock<IDbContextFactory<DespatchContext>> CreateFactoryMock(DespatchContext sharedContext)
    {
        var mock = new Mock<IDbContextFactory<DespatchContext>>();
        mock.Setup(f => f.CreateDbContext())
            .Returns(sharedContext);
        mock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(sharedContext);
        return mock;
    }

    public async ValueTask DisposeAsync() => await Connection.DisposeAsync();
}
