using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository IJobRepository interface methods.
/// Verifies that the public wrapper methods correctly delegate to the protected base implementations.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class JobRepositoryInterfaceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();

    public JobRepositoryInterfaceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

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

        // Default tenant setup
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private IJobRepository CreateRepository() => new JobRepository(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clearListEnvelopeServiceMock.Object
    );

    #region Interface Contract Tests

    [Fact]
    public void JobRepository_ImplementsIJobRepository()
    {
        // Arrange & Act
        var repository = CreateRepository();

        // Assert
        repository.Should().BeAssignableTo<IJobRepository>();
    }

    #endregion

    #region IsJobArchived Interface Tests

    [Fact]
    public async Task IsJobArchived_ViaInterface_WithArchivedJob_ReturnsTrue()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobArchived(jobId);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsJobArchived_ViaInterface_WithLiveJob_ReturnsFalse()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobArchived(jobId);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region GetRelatedJobsMultiSelectListAsync Interface Tests

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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(parentId, isArchived: false);

        // Assert
        result.Should().HaveCount(3);
        result.Should().Contain(j => j.Id == parentId && j.Selected);
        result.Should().Contain(j => j.Id == childId1 && !j.Selected);
        result.Should().Contain(j => j.Id == childId2 && !j.Selected);
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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(parentId, isArchived: true);

        // Assert
        result.Should().HaveCount(2);
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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(parentId, isArchived: false, isBulkJob: true);

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(j => j.IsBulkJob == true);
    }

    #endregion

    #region GetJobParentIdAsync Interface Tests

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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobParentIdAsync(childId);

        // Assert
        result.Should().Be(parentId);
    }

    [Fact]
    public async Task GetJobParentIdAsync_ViaInterface_WithParentJob_ReturnsNull()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "PARENT"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobParentIdAsync(jobId);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region GetJobCurrentAmountsAsync Interface Tests

    [Fact]
    public async Task GetJobCurrentAmountsAsync_ViaInterface_WithExistingJobs_ReturnsAmounts()
    {
        // Arrange
        _context.TucJobs.AddRange(
            CreateJobWithAmounts(100, "JOB001", amount: 150.00m, rawBase: 130.00m, fuel: 20.00m),
            CreateJobWithAmounts(101, "JOB002", amount: 200.00m, rawBase: 175.00m, fuel: 25.00m)
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobCurrentAmountsAsync([100, 101]);

        // Assert
        result.Should().HaveCount(2);
        result[100].Amount.Should().Be(150.00m);
        result[100].RawBaseAmount.Should().Be(130.00m);
        result[100].Fuel.Should().Be(20.00m);
        result[101].Amount.Should().Be(200.00m);
    }

    [Fact]
    public async Task GetJobCurrentAmountsAsync_ViaInterface_WithNoMatchingJobs_ReturnsEmptyDictionary()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobCurrentAmountsAsync([999, 998]);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region Helper Methods

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

    #endregion
}
