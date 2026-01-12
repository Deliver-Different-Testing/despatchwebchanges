using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for BaseJobRepository - covers note operations, job queries, and helper methods.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class BaseJobRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();

    public BaseJobRepositoryTests()
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

    private BaseJobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clearListEnvelopeServiceMock.Object
    );

    #region GetBulkJobNotesByBulkJobIdAsync Tests

    [Fact]
    public async Task GetBulkJobNotesByBulkJobIdAsync_WithExistingNotes_ReturnsNotes()
    {
        // Arrange
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        _context.TblBulkJobNotes.AddRange(
            CreateBulkJobNote(1, bulkJobId, "Note 1"),
            CreateBulkJobNote(2, bulkJobId, "Note 2")
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkJobNotesByBulkJobIdAsync(bulkJobId);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(n => n.NoteText == "Note 1");
        result.Should().Contain(n => n.NoteText == "Note 2");
    }

    [Fact]
    public async Task GetBulkJobNotesByBulkJobIdAsync_WithNoNotes_ReturnsEmptyList()
    {
        // Arrange
        const int bulkJobId = 100;
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkJobNotesByBulkJobIdAsync(bulkJobId);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetBulkJobNotesByBulkJobIdAsync_OnlyReturnsNotesForSpecificJob()
    {
        // Arrange
        const int bulkJobId1 = 100;
        const int bulkJobId2 = 101;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.AddRange(
            CreateBulkJob(bulkJobId1, "BULK001"),
            CreateBulkJob(bulkJobId2, "BULK002")
        );
        _context.TblBulkJobNotes.AddRange(
            CreateBulkJobNote(1, bulkJobId1, "Note for job 1"),
            CreateBulkJobNote(2, bulkJobId2, "Note for job 2")
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkJobNotesByBulkJobIdAsync(bulkJobId1);

        // Assert
        result.Should().ContainSingle();
        result.First().NoteText.Should().Be("Note for job 1");
    }

    #endregion

    #region DeleteNoteAsync Tests

    // Note: Tests that create TucNote entities are skipped due to SQLite incompatibility
    // with SQL Server's getdate() default value configured in the entity model.

    [Fact]
    public async Task DeleteNoteAsync_WithNonExistentNote_DoesNotThrow()
    {
        // Arrange
        var repository = CreateRepository();

        // Act & Assert - Should not throw
        var act = async () => await repository.DeleteNoteAsync(999);
        await act.Should().NotThrowAsync();
    }

    #endregion

    #region IsJobArchived Tests

    [Fact]
    public async Task IsJobArchived_WithArchivedJob_ReturnsTrue()
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
    public async Task IsJobArchived_WithLiveJob_ReturnsFalse()
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

    [Fact]
    public async Task IsJobArchived_WithNonExistentJob_ReturnsFalse()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobArchived(999);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region GetRelatedJobsMultiSelectListAsync Tests

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
    public async Task GetRelatedJobsMultiSelectListAsync_WhenRequestingChild_MarksChildAsSelected()
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
        var result = await repository.GetRelatedJobsMultiSelectListAsync(childId, isArchived: false);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.Id == childId && j.Selected);
        result.Should().Contain(j => j.Id == parentId && !j.Selected);
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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(parentId, isArchived: true);

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_WithSingleJob_ReturnsSingleItem()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "SINGLE"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRelatedJobsMultiSelectListAsync(jobId, isArchived: false);

        // Assert
        result.Should().ContainSingle();
        result.First().Id.Should().Be(jobId);
        result.First().Selected.Should().BeTrue();
    }

    #endregion

    #region GetJobParentIdAsync Tests

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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobParentIdAsync(childId);

        // Assert
        result.Should().Be(parentId);
    }

    [Fact]
    public async Task GetJobParentIdAsync_WithParentJob_ReturnsNull()
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

    [Fact]
    public async Task GetJobParentIdAsync_WithNonExistentJob_ReturnsNull()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobParentIdAsync(999);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region GetJobCurrentAmountsAsync Tests

    [Fact]
    public async Task GetJobCurrentAmountsAsync_WithExistingJobs_ReturnsAmounts()
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
    public async Task GetJobCurrentAmountsAsync_WithNoMatchingJobs_ReturnsEmptyDictionary()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobCurrentAmountsAsync([999, 998]);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetJobCurrentAmountsAsync_WithNullAmounts_ReturnsZeroDefaults()
    {
        // Arrange
        _context.TucJobs.Add(CreateJob(100, "JOB001")); // No amounts set
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobCurrentAmountsAsync([100]);

        // Assert
        result.Should().ContainKey(100);
        result[100].Amount.Should().Be(0);
        result[100].RawBaseAmount.Should().Be(0);
    }

    [Fact]
    public async Task GetJobCurrentAmountsAsync_ReturnsJobNumberInResult()
    {
        // Arrange
        _context.TucJobs.Add(CreateJobWithAmounts(100, "TEST-JOB-123", amount: 100m));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobCurrentAmountsAsync([100]);

        // Assert
        result[100].JobNo.Should().Be("TEST-JOB-123");
        result[100].IsPrebook.Should().BeFalse();
    }

    #endregion

    #region Helper Methods

    private static TucNoteType CreateNoteType(int id, string name) => new()
    {
        NoteTypeId = id,
        NoteTypeName = name,
        IsActive = true,
        IsPublic = false,
        IsSystemDefined = true
    };

    private static TblBulkJob CreateBulkJob(int id, string jobNumber) => new()
    {
        BulkJobId = id,
        JobNumber = jobNumber
    };

    private static TblBulkJobNote CreateBulkJobNote(int noteId, int bulkJobId, string noteText) => new()
    {
        NoteId = noteId,
        BulkJobId = bulkJobId,
        NoteText = noteText,
        NoteTypeId = 1,
        IsImportant = false,
        CreatedDate = DateTime.Now // Explicit to avoid SQLite getdate() issue
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

    #endregion
}
