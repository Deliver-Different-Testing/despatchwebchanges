using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for BaseJobRepository - covers job queries and helper methods.
/// Note: Note-related tests have been moved to NoteRepositoryTests.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class BaseJobRepositoryTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock;
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private FakeTenantClock _clock = new(new DateTime(2024, 6, 15, 10, 0, 0));

    public BaseJobRepositoryTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = _db.CreateFactoryMock(_context);

        // Default tenant setup
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    /// <summary>
    /// Test wrapper that exposes protected methods from BaseJobRepository for unit testing.
    /// </summary>
    private class TestableBaseJobRepository(
        IDbContextFactory<DespatchContext> contextFactory,
        ITenantInfoService infoService,
        ITenantClock tenantClock,
        IClearListEnvelopeService clearListEnvelopeService)
        : BaseJobRepository(contextFactory, infoService, tenantClock, clearListEnvelopeService)
    {
        public new Task<bool> IsJobArchived(int jobId)
            => base.IsJobArchived(jobId);

        public new Task<IReadOnlyList<MultiSuggestion>> GetRelatedJobsMultiSelectListAsync(int jobId, bool isArchived, bool isBulkJob = false)
            => base.GetRelatedJobsMultiSelectListAsync(jobId, isArchived, isBulkJob);

        public new Task<int?> GetJobParentIdAsync(int jobId)
            => base.GetJobParentIdAsync(jobId);

        public Task<Dictionary<int, JobCurrentAmountInfo>> GetJobCurrentAmountsAsync(List<int> jobIds)
            => base.GetJobCurrentAmountsAsync(jobIds);

        public new Task SaveMultipleBulkNotesAsync(IReadOnlyList<int> bulkJobIds, string noteText, bool isImportant = false,
            NoteType noteType = NoteType.InternalNote)
            => base.SaveMultipleBulkNotesAsync(bulkJobIds, noteText, isImportant, noteType);
    }

    private TestableBaseJobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock,
        _clearListEnvelopeServiceMock.Object
    );

    [Fact]
    public async Task IsJobArchived_WithArchivedJob_ReturnsTrue()
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
    public async Task IsJobArchived_WithLiveJob_ReturnsFalse()
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
    public async Task IsJobArchived_WithNonExistentJob_ReturnsFalse()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobArchived(999);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_WithParentAndChildren_ReturnsAllRelated()
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
        Assert.All(result, j => Assert.False(j.IsBulkJob));
        Assert.All(result, j => Assert.False(j.IsArchived));
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_WhenRequestingChild_MarksChildAsSelected()
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
        var result = await repository.GetRelatedJobsMultiSelectListAsync(childId, isArchived: false);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, j => j.Id == childId && j.Selected);
        Assert.Contains(result, j => j.Id == parentId && !j.Selected);
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_WithArchivedJob_QueriesArchiveTable()
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
        Assert.All(result, j => Assert.True(j.IsArchived));
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_WithSingleJob_ReturnsSingleItem()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "SINGLE"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(jobId, isArchived: false);

        // Assert
        Assert.Single(result);
        Assert.Equal(jobId, result[0].Id);
        Assert.True(result[0].Selected);
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_WithBulkParentAndChildren_ReturnsAllRelated()
    {
        // Arrange
        const int parentId = 200;
        const int childId1 = 201;
        const int childId2 = 202;

        _context.TblBulkJobs.AddRange(
            CreateBulkJob(parentId, "BULK-PARENT"),
            CreateBulkJobWithParent(childId1, "BULK-CHILD1", parentId),
            CreateBulkJobWithParent(childId2, "BULK-CHILD2", parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(parentId, isArchived: false, isBulkJob: true);

        // Assert
        Assert.Equal(3, result.Count);
        Assert.Contains(result, j => j.Id == parentId && j.Selected);
        Assert.Contains(result, j => j.Id == childId1 && !j.Selected);
        Assert.Contains(result, j => j.Id == childId2 && !j.Selected);
        Assert.All(result, j => Assert.True(j.IsBulkJob));
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_WithBulkChild_MarksChildAsSelected()
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
        var result = await repository.GetRelatedJobsMultiSelectListAsync(childId, isArchived: false, isBulkJob: true);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, j => j.Id == childId && j.Selected);
        Assert.Contains(result, j => j.Id == parentId && !j.Selected);
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_WithSingleBulkJob_ReturnsSingleItem()
    {
        // Arrange
        const int jobId = 200;
        _context.TblBulkJobs.Add(CreateBulkJob(jobId, "BULK-SINGLE"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(jobId, isArchived: false, isBulkJob: true);

        // Assert
        Assert.Single(result);
        Assert.Equal(jobId, result[0].Id);
        Assert.True(result[0].Selected);
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_WithNonExistentBulkJob_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(999, isArchived: false, isBulkJob: true);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetJobParentIdAsync_WithChildJob_ReturnsParentId()
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
    public async Task GetJobParentIdAsync_WithParentJob_ReturnsNull()
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
    public async Task GetJobParentIdAsync_WithNonExistentJob_ReturnsNull()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobParentIdAsync(999);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetJobCurrentAmountsAsync_WithExistingJobs_ReturnsAmounts()
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
    public async Task GetJobCurrentAmountsAsync_WithNoMatchingJobs_ReturnsEmptyDictionary()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobCurrentAmountsAsync([999, 998]);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetJobCurrentAmountsAsync_WithNullAmounts_ReturnsZeroDefaults()
    {
        // Arrange
        _context.TucJobs.Add(CreateJob(100, "JOB001")); // No amounts set
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobCurrentAmountsAsync([100]);

        // Assert
        Assert.True(result.ContainsKey(100));
        Assert.Equal(0, result[100].Amount);
        Assert.Equal(0, result[100].RawBaseAmount);
    }

    [Fact]
    public async Task GetJobCurrentAmountsAsync_ReturnsJobNumberInResult()
    {
        // Arrange
        _context.TucJobs.Add(CreateJobWithAmounts(100, "TEST-JOB-123", amount: 100m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobCurrentAmountsAsync([100]);

        // Assert
        Assert.Equal("TEST-JOB-123", result[100].JobNo);
        Assert.False(result[100].IsPrebook);
    }

    [Fact]
    public async Task SaveMultipleBulkNotesAsync_SetsCreatedByAndCreatedDate()
    {
        // Arrange
        const int staffId = 42;
        var currentTime = new DateTime(2024, 8, 20, 15, 30, 0);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(staffId);
        _clock = new FakeTenantClock(currentTime);

        _context.TucNoteTypes.Add(new TucNoteType { NoteTypeId = 1, NoteTypeName = "Internal Note", IsActive = true, IsPublic = false, IsSystemDefined = true });
        _context.TblBulkJobs.AddRange(
            CreateBulkJob(100, "BULK001"),
            CreateBulkJob(101, "BULK002"),
            CreateBulkJob(102, "BULK003")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.SaveMultipleBulkNotesAsync([100, 101, 102], "Test bulk note");

        // Assert
        var notes = await _context.TblBulkJobNotes.ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(3, notes.Count);
        Assert.All(notes, n => Assert.Equal(staffId, n.CreatedBy));
        Assert.All(notes, n => Assert.Equal(currentTime, n.CreatedDate));
        Assert.All(notes, n => Assert.Equal("Test bulk note", n.NoteText));
    }

    [Fact]
    public async Task SaveMultipleBulkNotesAsync_AllNotesHaveSameCreatorAndTimestamp()
    {
        // Arrange
        _context.TucNoteTypes.Add(new TucNoteType { NoteTypeId = 1, NoteTypeName = "Internal Note", IsActive = true, IsPublic = false, IsSystemDefined = true });
        _context.TblBulkJobs.AddRange(
            CreateBulkJob(200, "BULK-A"),
            CreateBulkJob(201, "BULK-B")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.SaveMultipleBulkNotesAsync([200, 201], "Batch note", isImportant: true);

        // Assert
        var notes = await _context.TblBulkJobNotes.ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(2, notes.Count);

        var distinctCreatedBy = notes.Select(n => n.CreatedBy).Distinct().ToList();
        Assert.Single(distinctCreatedBy);

        var distinctCreatedDate = notes.Select(n => n.CreatedDate).Distinct().ToList();
        Assert.Single(distinctCreatedDate);

        Assert.All(notes, n => Assert.True(n.IsImportant));
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
