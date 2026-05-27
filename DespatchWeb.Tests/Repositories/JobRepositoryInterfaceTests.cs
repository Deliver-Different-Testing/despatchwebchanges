using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository IJobQueryRepository/IJobCommandRepository interface methods.
/// Verifies that the public wrapper methods correctly delegate to the protected base implementations.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class JobRepositoryInterfaceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock;
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly Mock<ICreateJobService> _createJobServiceMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryInterfaceTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateMoqFactoryMock(_context);

        // Default tenant setup
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock,
        _clearListEnvelopeServiceMock.Object,
        _createJobServiceMock.Object,
        Mock.Of<IJobApiClient>()
    );

    [Fact]
    public async Task IsJobArchived_ViaInterface_WithArchivedJob_ReturnsTrue()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobArchived(jobId);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task IsJobArchived_ViaInterface_WithLiveJob_ReturnsFalse()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobArchived(jobId);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_ViaInterface_WithParentAndChildren_ReturnsAllRelated()
    {
        // Arrange
        const int parentId = 100;
        const int childId1 = 101;
        const int childId2 = 102;

        _context.TucJobs.AddRange(
            CreateJob(parentId, "PARENT"),
            CreateJobWithParent(childId1, "CHILD1", parentId),
            CreateJobWithParent(childId2, "CHILD2", parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(parentId, isArchived: false);

        // Assert
        Assert.Equal(3, result.Count);
        Assert.Contains(result, j => j.Id == parentId && j.Selected);
        Assert.Contains(result, j => j.Id == childId1 && !j.Selected);
        Assert.Contains(result, j => j.Id == childId2 && !j.Selected);
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_ViaInterface_WithArchivedJob_QueriesArchiveTable()
    {
        // Arrange
        const int parentId = 100;
        const int childId = 101;

        _context.TucJobArchives.AddRange(
            CreateArchivedJob(parentId, "PARENT"),
            CreateArchivedJobWithParent(childId, "CHILD", parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(parentId, isArchived: true);

        // Assert
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_ViaInterface_WithBulkJob_QueriesBulkTable()
    {
        // Arrange
        const int parentId = 200;
        const int childId = 201;

        _context.TblBulkJobs.AddRange(
            CreateBulkJob(parentId, "BULK-PARENT"),
            CreateBulkJobWithParent(childId, "BULK-CHILD", parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(parentId, isArchived: false, isBulkJob: true);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.All(result, j => Assert.True(j.IsBulkJob));
    }

    [Fact]
    public async Task GetJobParentIdAsync_ViaInterface_WithChildJob_ReturnsParentId()
    {
        // Arrange
        const int parentId = 100;
        const int childId = 101;

        _context.TucJobs.AddRange(
            CreateJob(parentId, "PARENT"),
            CreateJobWithParent(childId, "CHILD", parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobParentIdAsync(childId);

        // Assert
        Assert.Equal(parentId, result);
    }

    [Fact]
    public async Task GetJobParentIdAsync_ViaInterface_WithParentJob_ReturnsNull()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "PARENT"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobParentIdAsync(jobId);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetJobCurrentAmountsAsync_ViaInterface_WithExistingJobs_ReturnsAmounts()
    {
        // Arrange
        _context.TucJobs.AddRange(
            CreateJobWithAmounts(100, "JOB001", amount: 150.00m, rawBase: 130.00m, fuel: 20.00m),
            CreateJobWithAmounts(101, "JOB002", amount: 200.00m, rawBase: 175.00m, fuel: 25.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobCurrentAmountsAsync([100, 101]);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Equal(150.00m, result[100].Amount);
        Assert.Equal(130.00m, result[100].RawBaseAmount);
        Assert.Equal(20.00m, result[100].Fuel);
        Assert.Equal(200.00m, result[101].Amount);
    }

    [Fact]
    public async Task GetJobCurrentAmountsAsync_ViaInterface_WithNoMatchingJobs_ReturnsEmptyDictionary()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobCurrentAmountsAsync([999, 998]);

        // Assert
        Assert.Empty(result);
    }

    private static TucJob CreateJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

    private static TucJob CreateJobWithParent(int id, string jobNumber, int parentId) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        ParentId = parentId
    };

    private static TucJob CreateJobWithAmounts(int id, string jobNumber, decimal? amount = null,
        decimal? rawBase = null, decimal? fuel = null, decimal? ppd = null) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        UcjbAmount = amount,
        RawBaseAmount = rawBase,
        FuelSurchargeAmount = fuel ?? 0,
        Ppdamount = ppd
    };

    private static TucJobArchive CreateArchivedJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

    private static TucJobArchive CreateArchivedJobWithParent(int id, string jobNumber, int parentId) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        ParentId = parentId
    };

    private static TblBulkJob CreateBulkJob(int id, string jobNumber) => new()
    {
        BulkJobId = id, JobNumber = jobNumber
    };

    private static TblBulkJob CreateBulkJobWithParent(int id, string jobNumber, int parentId) => new()
    {
        BulkJobId = id, JobNumber = jobNumber, BulkParentId = parentId
    };
}
