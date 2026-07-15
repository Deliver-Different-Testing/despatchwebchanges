using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository split job functionality.
/// </summary>
public class JobRepositorySplitJobTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositorySplitJobTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _createJobServiceMock,
        Substitute.For<ICourierRepository>()
    );

    [Fact]
    public async Task CanJobBeSplitAsync_JobWithNoParent_ReturnsTrue()
    {
        _context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "JOB-100" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().CanJobBeSplitAsync(100);

        Assert.True(result);
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

        Assert.True(result);
    }

    [Fact]
    public async Task CanJobBeSplitAsync_NonExistentJob_ReturnsFalse()
    {
        var result = await CreateRepository().CanJobBeSplitAsync(999);
        Assert.False(result);
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

        Assert.True(result);
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

        Assert.False(result);
    }

    [Fact]
    public async Task CanJobBeSplitAsync_JobWithNoParentAndNoChildren_ReturnsTrue()
    {
        _context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "STANDALONE" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().CanJobBeSplitAsync(100);

        Assert.True(result);
    }

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

        Assert.Equal(2, result.Count);
        Assert.Contains(101, result);
        Assert.Contains(102, result);
    }

    [Fact]
    public async Task GetSplitJobChildrenAsync_JobWithNoChildren_ReturnsEmptyList()
    {
        _context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "JOB" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetSplitJobChildrenAsync(100);

        Assert.Empty(result);
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

        var single = Assert.Single(result);
        Assert.Equal(101, single);
    }

    [Fact]
    public async Task RestoreSplitJobsAsync_WithEmptyOrNullList_DoesNotThrow()
    {
        var repository = CreateRepository();

        await repository.RestoreSplitJobsAsync([]);
        await repository.RestoreSplitJobsAsync(null!);
    }

    [Fact]
    public async Task GetJobParentIdAsync_ChildJob_ReturnsParentId()
    {
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = 100, UcjbNumber = "PARENT" },
            new TucJob { UcjbId = 101, UcjbNumber = "CHILD", ParentId = 100 }
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetJobParentIdAsync(101);

        Assert.Equal(100, result);
    }

    [Fact]
    public async Task GetJobParentIdAsync_ParentJob_ReturnsNull()
    {
        _context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "PARENT" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await CreateRepository().GetJobParentIdAsync(100);

        Assert.Null(result);
    }

}
