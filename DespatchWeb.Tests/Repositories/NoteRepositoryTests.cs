using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for NoteRepository - covers note CRUD operations and note type management.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class NoteRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();

    public NoteRepositoryTests()
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
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime()).Returns(DateTime.Now);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private NoteRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object
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

    [Fact]
    public async Task GetBulkJobNotesByBulkJobIdAsync_ReturnsNotesSortedByCreatedDateDescending()
    {
        // Arrange
        const int bulkJobId = 100;
        var oldestDate = new DateTime(2024, 1, 1, 10, 0, 0);
        var middleDate = new DateTime(2024, 6, 15, 14, 30, 0);
        var newestDate = new DateTime(2024, 12, 31, 23, 59, 0);

        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        _context.TblBulkJobNotes.AddRange(
            CreateBulkJobNote(1, bulkJobId, "Middle note", middleDate),
            CreateBulkJobNote(2, bulkJobId, "Oldest note", oldestDate),
            CreateBulkJobNote(3, bulkJobId, "Newest note", newestDate)
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkJobNotesByBulkJobIdAsync(bulkJobId);

        // Assert
        result.Should().HaveCount(3);
        result[0].NoteText.Should().Be("Newest note");
        result[1].NoteText.Should().Be("Middle note");
        result[2].NoteText.Should().Be("Oldest note");
    }

    #endregion

    #region GetNotesByJobIdAsync Tests (Archived Notes)

    [Fact]
    public async Task GetNotesByJobIdAsync_WithArchivedNotes_ReturnsNotesSortedByCreatedDateDescending()
    {
        // Arrange
        const int jobId = 100;
        var oldestDate = new DateTime(2024, 1, 1, 10, 0, 0);
        var middleDate = new DateTime(2024, 6, 15, 14, 30, 0);
        var newestDate = new DateTime(2024, 12, 31, 23, 59, 0);

        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        _context.TucNoteArchives.AddRange(
            CreateArchivedNote(1, jobId, "Middle note", middleDate),
            CreateArchivedNote(2, jobId, "Oldest note", oldestDate),
            CreateArchivedNote(3, jobId, "Newest note", newestDate)
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNotesByJobIdAsync(jobId);

        // Assert
        result.Should().HaveCount(3);
        result[0].NoteText.Should().Be("Newest note");
        result[1].NoteText.Should().Be("Middle note");
        result[2].NoteText.Should().Be("Oldest note");
    }

    #endregion

    #region DeleteNoteAsync Tests

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

    #region GetNoteTypesAsync Tests

    [Fact]
    public async Task GetNoteTypesAsync_WithActiveNoteTypes_ReturnsOnlyActiveTypes()
    {
        // Arrange
        _context.TucNoteTypes.AddRange(
            new TucNoteType { NoteTypeId = 1, NoteTypeName = "Active Type 1", IsActive = true, IsPublic = false, IsSystemDefined = false },
            new TucNoteType { NoteTypeId = 2, NoteTypeName = "Inactive Type", IsActive = false, IsPublic = false, IsSystemDefined = false },
            new TucNoteType { NoteTypeId = 3, NoteTypeName = "Active Type 2", IsActive = true, IsPublic = true, IsSystemDefined = false }
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteTypesAsync();

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(nt => nt.Text == "Active Type 1");
        result.Should().Contain(nt => nt.Text == "Active Type 2");
        result.Should().NotContain(nt => nt.Text == "Inactive Type");
    }

    [Fact]
    public async Task GetNoteTypesAsync_WithNoNoteTypes_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteTypesAsync();

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region AddNewTucNoteTypeAsync Tests

    [Fact]
    public async Task AddNewTucNoteTypeAsync_CreatesNewNoteType()
    {
        // Arrange
        var repository = CreateRepository();
        var noteType = new NoteTypeViewModel
        {
            Text = "New Note Type",
            IsPublic = true,
            Description = "Test description"
        };

        // Act
        await repository.AddNewTucNoteTypeAsync(noteType);

        // Assert
        var savedType = await _context.TucNoteTypes.FirstOrDefaultAsync(nt => nt.NoteTypeName == "New Note Type");
        savedType.Should().NotBeNull();
        savedType!.IsActive.Should().BeTrue();
        savedType.IsPublic.Should().BeTrue();
        savedType.Description.Should().Be("Test description");
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

    private static TblBulkJobNote CreateBulkJobNote(int noteId, int bulkJobId, string noteText, DateTime? createdDate = null) => new()
    {
        NoteId = noteId,
        BulkJobId = bulkJobId,
        NoteText = noteText,
        NoteTypeId = 1,
        IsImportant = false,
        CreatedDate = createdDate ?? DateTime.Now
    };

    private static TucJob CreateJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

    private static TucJobArchive CreateArchivedJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

    private static TucNoteArchive CreateArchivedNote(int noteId, int jobId, string noteText, DateTime? createdDate = null) => new()
    {
        NoteId = noteId,
        JobId = jobId,
        NoteText = noteText,
        NoteTypeId = 1,
        IsImportant = false,
        CreatedDate = createdDate,
        UpdatedDate = createdDate
    };

    #endregion
}
