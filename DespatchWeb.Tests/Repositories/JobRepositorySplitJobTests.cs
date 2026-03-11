using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository split job functionality.
/// </summary>
public class JobRepositorySplitJobTests : IAsyncDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly Mock<ICreateJobService> _createJobServiceMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositorySplitJobTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        // Register SQL Server functions that SQLite doesn't have
        _connection.CreateFunction("getdate", () => TestDates.Now);
        _connection.CreateFunction("getutcdate", () => DateTime.UtcNow);

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        var options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new DespatchContext(options);
        _context.Database.EnsureCreated();
        _contextFactoryMock.Setup(f => f.CreateDbContext()).Returns(_context);
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock,
        _clearListEnvelopeServiceMock.Object,
        _createJobServiceMock.Object
    );

    #region CanJobBeSplitAsync Tests

    [Fact]
    public async Task CanJobBeSplitAsync_JobWithNoParent_ReturnsTrue()
    {
        _context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "JOB-100" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().CanJobBeSplitAsync(100);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task CanJobBeSplitAsync_ChildJob_ReturnsTrue()
    {
        // Child jobs can now be split (unless they have flights assigned)
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = 100, UcjbNumber = "PARENT" },
            new TucJob { UcjbId = 101, UcjbNumber = "CHILD", ParentId = 100 }
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().CanJobBeSplitAsync(101);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task CanJobBeSplitAsync_NonExistentJob_ReturnsFalse()
    {
        var result = await CreateRepository().CanJobBeSplitAsync(999);
        result.Should().BeFalse();
    }

    [Fact]
    public async Task CanJobBeSplitAsync_JobWithChildren_ReturnsTrue()
    {
        // Jobs with children can now be split (unless they have flights assigned)
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = 100, UcjbNumber = "PARENT", ParentId = 100 }, // Self-referencing parent
            new TucJob { UcjbId = 101, UcjbNumber = "CHILD-1", ParentId = 100 },
            new TucJob { UcjbId = 102, UcjbNumber = "CHILD-2", ParentId = 100 }
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().CanJobBeSplitAsync(100);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task CanJobBeSplitAsync_JobWithFlightAssigned_ReturnsFalse()
    {
        // Jobs with flights assigned cannot be split
        _context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "JOB-FLIGHT" });
        _context.TucJobNationwides.Add(new TucJobNationwide
        {
            UcnwJobId = 100,
            UcnwJobNumber = "JOB-FLIGHT",
            UcnwClientId = 1,
            UcnwDestinationId = 1,
            UcnwItb = 0,
            UcnwPickUpJobId = 0,
            UcnwDeliveryJobId = 0,
            UcnwAirportOnly = false,
            UcnwLegNumber = 1
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().CanJobBeSplitAsync(100);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task CanJobBeSplitAsync_JobWithNoParentAndNoChildren_ReturnsTrue()
    {
        _context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "STANDALONE" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().CanJobBeSplitAsync(100);

        result.Should().BeTrue();
    }

    #endregion

    #region GetSplitJobChildrenAsync Tests

    [Fact]
    public async Task GetSplitJobChildrenAsync_ParentWithChildren_ReturnsChildIds()
    {
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = 100, UcjbNumber = "PARENT" },
            new TucJob { UcjbId = 101, UcjbNumber = "CHILD-1", ParentId = 100 },
            new TucJob { UcjbId = 102, UcjbNumber = "CHILD-2", ParentId = 100 }
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetSplitJobChildrenAsync(100);

        result.Should().HaveCount(2);
        result.Should().Contain([101, 102]);
    }

    [Fact]
    public async Task GetSplitJobChildrenAsync_JobWithNoChildren_ReturnsEmptyList()
    {
        _context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "JOB" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetSplitJobChildrenAsync(100);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetSplitJobChildrenAsync_OnlyReturnsDirectChildren()
    {
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = 100, UcjbNumber = "PARENT" },
            new TucJob { UcjbId = 101, UcjbNumber = "CHILD", ParentId = 100 },
            new TucJob { UcjbId = 200, UcjbNumber = "UNRELATED" }
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetSplitJobChildrenAsync(100);

        result.Should().ContainSingle().Which.Should().Be(101);
    }

    #endregion

    #region RestoreSplitJobsAsync Tests

    [Fact]
    public async Task RestoreSplitJobsAsync_WithEmptyOrNullList_DoesNotThrow()
    {
        var repository = CreateRepository();

        await repository.Invoking(r => r.RestoreSplitJobsAsync([])).Should().NotThrowAsync();
        await repository.Invoking(r => r.RestoreSplitJobsAsync(null!)).Should().NotThrowAsync();
    }

    #endregion

    #region GetJobParentIdAsync Tests

    [Fact]
    public async Task GetJobParentIdAsync_ChildJob_ReturnsParentId()
    {
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = 100, UcjbNumber = "PARENT" },
            new TucJob { UcjbId = 101, UcjbNumber = "CHILD", ParentId = 100 }
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetJobParentIdAsync(101);

        result.Should().Be(100);
    }

    [Fact]
    public async Task GetJobParentIdAsync_ParentJob_ReturnsNull()
    {
        _context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "PARENT" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetJobParentIdAsync(100);

        result.Should().BeNull();
    }

    #endregion
}
