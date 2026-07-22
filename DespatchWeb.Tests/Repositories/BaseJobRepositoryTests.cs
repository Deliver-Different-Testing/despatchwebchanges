using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for BaseJobRepository - covers job queries and helper methods.
/// Note: Note-related tests have been moved to NoteRepositoryTests.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class BaseJobRepositoryTests : IAsyncDisposable
{
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private FakeTenantClock _clock = new(new DateTime(2024, 6, 15, 10, 0, 0));

    public BaseJobRepositoryTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);

        // Default tenant setup
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private TestableBaseJobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock
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
        Assert.Contains(result, j => j is { Id: parentId, Selected: true });
        Assert.Contains(result, j => j is { Id: childId1, Selected: false });
        Assert.Contains(result, j => j is { Id: childId2, Selected: false });
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
        Assert.Contains(result, j => j is { Id: childId, Selected: true });
        Assert.Contains(result, j => j is { Id: parentId, Selected: false });
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
        Assert.Contains(result, j => j is { Id: parentId, Selected: true });
        Assert.Contains(result, j => j is { Id: childId1, Selected: false });
        Assert.Contains(result, j => j is { Id: childId2, Selected: false });
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
        Assert.Contains(result, j => j is { Id: childId, Selected: true });
        Assert.Contains(result, j => j is { Id: parentId, Selected: false });
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
        _tenantInfoServiceMock.GetStaffId().Returns(staffId);
        _clock = new FakeTenantClock(currentTime);

        _context.TucNoteTypes.Add(new TucNoteType
        {
            NoteTypeId = 1, NoteTypeName = "Internal Note", IsActive = true, IsPublic = false, IsSystemDefined = true
        });
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
        var notes = await _context.TblBulkJobNotes.ToListAsync(
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(3, notes.Count);
        Assert.All(notes, n => Assert.Equal(staffId, n.CreatedBy));
        Assert.All(notes, n => Assert.Equal(currentTime, n.CreatedDate));
        Assert.All(notes, n => Assert.Equal("Test bulk note", n.NoteText));
    }

    [Fact]
    public async Task SaveMultipleBulkNotesAsync_AllNotesHaveSameCreatorAndTimestamp()
    {
        // Arrange
        _context.TucNoteTypes.Add(new TucNoteType
        {
            NoteTypeId = 1, NoteTypeName = "Internal Note", IsActive = true, IsPublic = false, IsSystemDefined = true
        });
        _context.TblBulkJobs.AddRange(
            CreateBulkJob(200, "BULK-A"),
            CreateBulkJob(201, "BULK-B")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.SaveMultipleBulkNotesAsync([200, 201], "Batch note", isImportant: true);

        // Assert
        var notes = await _context.TblBulkJobNotes.ToListAsync(
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(2, notes.Count);

        var distinctCreatedBy = notes.Select(n => n.CreatedBy).Distinct().ToList();
        Assert.Single(distinctCreatedBy);

        var distinctCreatedDate = notes.Select(n => n.CreatedDate).Distinct().ToList();
        Assert.Single(distinctCreatedDate);

        Assert.All(notes, n => Assert.True(n.IsImportant));
    }

    // ---- Sargable date filters (fix: avoid .Date/.TimeOfDay on the column) ----
    // These predicates are tested in-memory (LINQ-to-objects) because SQLite cannot translate the
    // legacy .Date/.TimeOfDay forms; the rewrite must preserve the original calendar-day semantics.

    [Fact]
    public void JobDateOnOrAfter_IncludesStartDayMidnightAndLater_ExcludesPriorDay()
    {
        var jobs = new List<TucJob>
        {
            JobOn(1, new DateTime(2024, 6, 14, 23, 59, 0)),
            JobOn(2, new DateTime(2024, 6, 15, 0, 0, 0)),
            JobOn(3, new DateTime(2024, 6, 15, 9, 0, 0)),
            JobOn(4, new DateTime(2024, 6, 16, 0, 0, 0))
        }.AsQueryable();

        var result = jobs.Where(BaseJobRepository.JobDateOnOrAfter(new DateTime(2024, 6, 15)))
            .Select(j => j.UcjbId)
            .ToList();

        Assert.Equal([2, 3, 4], result);
    }

    [Fact]
    public void JobDateOnOrBefore_IncludesWholeCutoffDay_ExcludesNextDay()
    {
        var jobs = new List<TucJob>
        {
            JobOn(1, new DateTime(2024, 6, 14, 0, 0, 0)),
            JobOn(2, new DateTime(2024, 6, 15, 0, 0, 0)),
            // Late on the cutoff day: the old `.Date <=` kept it, the `< nextMidnight` rewrite must too.
            JobOn(3, new DateTime(2024, 6, 15, 23, 59, 0)),
            JobOn(4, new DateTime(2024, 6, 16, 0, 0, 0))
        }.AsQueryable();

        var result = jobs.Where(BaseJobRepository.JobDateOnOrBefore(new DateTime(2024, 6, 15)))
            .Select(j => j.UcjbId)
            .ToList();

        Assert.Equal([1, 2, 3], result);
    }

    [Fact]
    public void JobDateTimeOnOrBefore_FiltersByDateThenTime()
    {
        var filter = new DateTime(2024, 6, 15, 14, 30, 0);
        var jobs = new List<TucJob>
        {
            JobOn(1, new DateTime(2024, 6, 14), new DateTime(1, 1, 1, 23, 0, 0)), // earlier day, any time
            JobOn(2, new DateTime(2024, 6, 15), new DateTime(1, 1, 1, 14, 0, 0)), // same day, before
            JobOn(3, new DateTime(2024, 6, 15), new DateTime(1, 1, 1, 14, 30, 0)), // same day, exact
            JobOn(4, new DateTime(2024, 6, 15), new DateTime(1, 1, 1, 15, 0, 0)), // same day, after
            JobOn(5, new DateTime(2024, 6, 15), time: null), // same day, no time
            JobOn(6, new DateTime(2024, 6, 16), new DateTime(1, 1, 1, 0, 0, 0)) // later day
        }.AsQueryable();

        var result = jobs.Where(BaseJobRepository.JobDateTimeOnOrBefore(filter))
            .Select(j => j.UcjbId)
            .ToList();

        Assert.Equal([1, 2, 3, 5], result);
    }

    // ---- Current-work predicate (fix: count and drill-down list must share one definition) ----
    // Tested in-memory (LINQ-to-objects) for the same reason as the date filters above.

    [Fact]
    public void CurrentWorkJob_KeepsUndeliveredTodayAndOverdue_ExcludesDoneVoidAndFuture()
    {
        var asOf = new DateTime(2024, 6, 15, 10, 0, 0);
        var jobs = new List<TucJob>
        {
            // kept: not void, not done, dated today or earlier
            CurrentWorkJobOn(1, new DateTime(2024, 6, 15)), // today, undelivered
            CurrentWorkJobOn(2, new DateTime(2024, 6, 14)), // overdue (yesterday), undelivered
            // excluded:
            CurrentWorkJobOn(3, new DateTime(2024, 6, 15), done: true), // today, done
            CurrentWorkJobOn(4, new DateTime(2024, 6, 14), done: true), // overdue, done
            CurrentWorkJobOn(5, new DateTime(2024, 6, 15), isVoid: true), // today, void flag
            CurrentWorkJobOn(6, new DateTime(2024, 6, 15), status: (int)JobStatus.Void), // today, void status
            CurrentWorkJobOn(7, new DateTime(2024, 6, 16)) // future prebooking
        }.AsQueryable();

        var result = jobs.Where(BaseJobRepository.CurrentWorkJob(asOf))
            .Select(j => j.UcjbId)
            .ToList();

        Assert.Equal([1, 2], result);
    }

    [Fact]
    public void CurrentWorkListJob_KeepsDoneWithinWindowAndOverdueUndelivered_ExcludesOlderDoneVoidAndFuture()
    {
        var startDate = new DateTime(2024, 6, 10);
        var endDate = new DateTime(2024, 6, 15, 10, 0, 0);
        var jobs = new List<TucJob>
        {
            // kept: undelivered, unbounded below (overdue) through the end day
            CurrentWorkJobOn(1, new DateTime(2024, 6, 15)), // today, undelivered
            CurrentWorkJobOn(2, new DateTime(2024, 6, 5)), // before startDate, undelivered → still kept
            // kept: done jobs within [startDate, endDate]
            CurrentWorkJobOn(3, new DateTime(2024, 6, 15), done: true), // today, done
            CurrentWorkJobOn(4, new DateTime(2024, 6, 10), done: true), // on startDate, done
            // excluded:
            CurrentWorkJobOn(5, new DateTime(2024, 6, 9), done: true), // done before startDate
            CurrentWorkJobOn(6, new DateTime(2024, 6, 15), isVoid: true), // void flag
            CurrentWorkJobOn(7, new DateTime(2024, 6, 15), status: (int)JobStatus.Void), // void status
            CurrentWorkJobOn(8, new DateTime(2024, 6, 16)) // future prebooking
        }.AsQueryable();

        var result = jobs.Where(BaseJobRepository.CurrentWorkListJob(startDate, endDate))
            .Select(j => j.UcjbId)
            .ToList();

        Assert.Equal([1, 2, 3, 4], result);
    }

    private static TucJob CurrentWorkJobOn(int id, DateTime date, bool done = false, bool isVoid = false,
        int status = (int)JobStatus.Dispatched) => new()
    {
        UcjbId = id,
        UcjbNumber = $"JOB{id:000}",
        UcjbDate = date,
        UcjbJobDone = done,
        UcjbVoid = isVoid,
        UcjbStatus = status
    };

    // ---- Bounded pagination helper (fix: non-paginated path must not be unbounded) ----

    [Fact]
    public async Task ResolveJobIdPageAsync_NonPaginatedUnderCap_ReturnsAllAndHasMoreFalse()
    {
        await SeedJobIdsAsync(1, 2, 3, 4, 5);
        var distinctIds = _context.TucJobs.Select(j => j.UcjbId).Distinct();

        var result = await BaseJobRepository.ResolveJobIdPageAsync(
            distinctIds, requestedPage: 0, pageSize: 500, nonPaginatedCap: 10,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(5, result.JobIds.Count);
        Assert.Equal(5, result.TotalCount);
        Assert.False(result.HasMore);
    }

    [Fact]
    public async Task ResolveJobIdPageAsync_NonPaginatedOverCap_TruncatesAndReportsTrueTotal()
    {
        await SeedJobIdsAsync(1, 2, 3, 4, 5);
        var distinctIds = _context.TucJobs.Select(j => j.UcjbId).Distinct();

        var result = await BaseJobRepository.ResolveJobIdPageAsync(
            distinctIds, requestedPage: 0, pageSize: 500, nonPaginatedCap: 3,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal([1, 2, 3], result.JobIds); // capped to the first 3 by id order
        Assert.Equal(5, result.TotalCount); // true total still reported
        Assert.True(result.HasMore);
    }

    [Fact]
    public async Task ResolveJobIdPageAsync_RequestedPage_ReturnsThatPageAndHasMoreWhenMoreRemain()
    {
        await SeedJobIdsAsync(1, 2, 3, 4, 5);
        var distinctIds = _context.TucJobs.Select(j => j.UcjbId).Distinct();

        var result = await BaseJobRepository.ResolveJobIdPageAsync(
            distinctIds, requestedPage: 2, pageSize: 2,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal([3, 4], result.JobIds);
        Assert.Equal(5, result.TotalCount);
        Assert.True(result.HasMore);
    }

    [Fact]
    public async Task ResolveJobIdPageAsync_LastPage_HasMoreFalse()
    {
        await SeedJobIdsAsync(1, 2, 3, 4, 5);
        var distinctIds = _context.TucJobs.Select(j => j.UcjbId).Distinct();

        var result = await BaseJobRepository.ResolveJobIdPageAsync(
            distinctIds, requestedPage: 3, pageSize: 2,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal([5], result.JobIds);
        Assert.False(result.HasMore);
    }

    private async Task SeedJobIdsAsync(params int[] ids)
    {
        _context.TucJobs.AddRange(ids.Select(id => CreateJob(id, $"JOB{id:000}")));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static TucJob JobOn(int id, DateTime date, DateTime? time = null) => new()
    {
        UcjbId = id,
        UcjbNumber = $"JOB{id:000}",
        UcjbDate = date,
        UcjbTime = time
    };

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

        public new Task<IReadOnlyList<MultiSuggestion>> GetRelatedJobsMultiSelectListAsync(int jobId, bool isArchived,
            bool isBulkJob = false)
            => base.GetRelatedJobsMultiSelectListAsync(jobId, isArchived, isBulkJob);

        public new Task<int?> GetJobParentIdAsync(int jobId)
            => base.GetJobParentIdAsync(jobId);

        public Task<Dictionary<int, JobCurrentAmountInfo>> GetJobCurrentAmountsAsync(List<int> jobIds)
            => base.GetJobCurrentAmountsAsync(jobIds);

        public new Task SaveMultipleBulkNotesAsync(IReadOnlyList<int> bulkJobIds, string noteText,
            bool isImportant = false,
            NoteType noteType = NoteType.InternalNote)
            => base.SaveMultipleBulkNotesAsync(bulkJobIds, noteText, isImportant, noteType);
    }
}