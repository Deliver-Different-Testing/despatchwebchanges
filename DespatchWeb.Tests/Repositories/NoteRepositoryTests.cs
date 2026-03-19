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
/// Tests for NoteRepository - covers note CRUD operations and note type management.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class NoteRepositoryTests : IAsyncDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public NoteRepositoryTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        _connection.CreateFunction("getdate", () => TestDates.Now);

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
        _tenantInfoServiceMock.Setup(x => x.ConvertUtcToTenantTimeZone(It.IsAny<DateTime>()))
            .Returns((DateTime dt) => new DateTimeOffset(dt, TimeSpan.FromHours(12)));
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private NoteRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkJobNotesByBulkJobIdAsync(bulkJobId1);

        // Assert
        result.Should().ContainSingle();
        result[0].NoteText.Should().Be("Note for job 1");
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

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

    [Fact]
    public async Task DeleteNoteAsync_WithHistory_DeletesHistoryAndNote()
    {
        // Arrange
        const int noteId = 1;
        const int jobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.TucNotes.Add(new TucNote
        {
            NoteId = noteId,
            JobId = jobId,
            NoteText = "Test note",
            NoteTypeId = 1,
            IsImportant = false,
            CreatedDate = TestDates.Now
        });
        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteHistories.Add(CreateNoteHistory(1, NoteHistorySource.Note, noteId, 1,
            DateTime.UtcNow, "Old text", "Test note"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.DeleteNoteAsync(noteId, TestContext.Current.CancellationToken);

        // Assert — use AsNoTracking since ExecuteDeleteAsync bypasses the change tracker
        var note = await _context.TucNotes.AsNoTracking().FirstOrDefaultAsync(n => n.NoteId == noteId, cancellationToken: TestContext.Current.CancellationToken);
        note.Should().BeNull();

        var history = await _context.TucNoteHistories
            .Where(h => h.NoteId == noteId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        history.Should().BeEmpty();
    }

    #endregion

    #region DeleteBulkNoteAsync Tests

    [Fact]
    public async Task DeleteBulkNoteAsync_WithHistory_DeletesHistoryAndNote()
    {
        // Arrange
        const int noteId = 1;
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        _context.TblBulkJobNotes.Add(CreateBulkJobNote(noteId, bulkJobId, "Test bulk note"));
        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteHistories.Add(CreateNoteHistory(1, NoteHistorySource.BulkNote, noteId, 1,
            DateTime.UtcNow, "Old text", "Test bulk note"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.DeleteBulkNoteAsync(noteId, TestContext.Current.CancellationToken);

        // Assert
        var note = await _context.TblBulkJobNotes.AsNoTracking().FirstOrDefaultAsync(n => n.NoteId == noteId, cancellationToken: TestContext.Current.CancellationToken);
        note.Should().BeNull();

        var history = await _context.TucNoteHistories
            .Where(h => h.BulkNoteId == noteId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        history.Should().BeEmpty();
    }

    [Fact]
    public async Task DeleteBulkNoteAsync_WithNonExistentNote_DoesNotThrow()
    {
        // Arrange
        var repository = CreateRepository();

        // Act & Assert
        var act = async () => await repository.DeleteBulkNoteAsync(999);
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

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

    #region GetNoteHistoryAsync Tests

    [Fact]
    public async Task GetNoteHistoryAsync_WithExistingHistory_ReturnsHistoryOrderedByNewest()
    {
        // Arrange
        const int noteId = 1;
        var oldest = new DateTime(2024, 1, 1, 10, 0, 0);
        var middle = new DateTime(2024, 6, 15, 14, 0, 0);
        var newest = new DateTime(2024, 12, 31, 23, 0, 0);

        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteHistories.AddRange(
            CreateNoteHistory(1, NoteHistorySource.Note, noteId, 1, middle, "Old middle", "New middle"),
            CreateNoteHistory(2, NoteHistorySource.Note, noteId, 1, oldest, "Old oldest", "New oldest"),
            CreateNoteHistory(3, NoteHistorySource.Note, noteId, 1, newest, "Old newest", "New newest")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(noteId, NoteHistorySource.Note);

        // Assert
        result.Should().HaveCount(3);
        result[0].NewNoteText.Should().Be("New newest");
        result[1].NewNoteText.Should().Be("New middle");
        result[2].NewNoteText.Should().Be("New oldest");
    }

    [Fact]
    public async Task GetNoteHistoryAsync_WithNoHistory_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(999, NoteHistorySource.Note);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetNoteHistoryAsync_FiltersByNoteSource()
    {
        // Arrange
        const int noteId = 1;
        var timestamp = new DateTime(2024, 6, 15, 10, 0, 0);

        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteHistories.AddRange(
            CreateNoteHistory(1, NoteHistorySource.Note, noteId, 1, timestamp, "Old1", "New1"),
            CreateNoteHistory(2, NoteHistorySource.BulkNote, noteId, 1, timestamp, "Old2", "New2"),
            CreateNoteHistory(3, NoteHistorySource.Note, noteId, 1, timestamp, "Old3", "New3")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(noteId, NoteHistorySource.Note);

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(h => h.NewNoteText == "New1" || h.NewNoteText == "New3");
    }

    [Fact]
    public async Task GetNoteHistoryAsync_IncludesNoteTypeNames()
    {
        // Arrange
        const int noteId = 1;
        _context.TucNoteTypes.AddRange(
            CreateNoteType(1, "Internal Note"),
            CreateNoteType(2, "Client Note")
        );
        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteHistories.Add(CreateNoteHistory(1, NoteHistorySource.Note, noteId, 1,
            new DateTime(2024, 6, 15, 10, 0, 0), "Old text", "New text", oldNoteTypeId: 1, newNoteTypeId: 2));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(noteId, NoteHistorySource.Note);

        // Assert
        result.Should().ContainSingle();
        result[0].OldNoteTypeName.Should().Be("Internal Note");
        result[0].NewNoteTypeName.Should().Be("Client Note");
    }

    [Fact]
    public async Task GetNoteHistoryAsync_IncludesEditorName()
    {
        // Arrange
        const int noteId = 1;
        _context.TucStaffs.Add(CreateStaff(1, "Jane", "Smith"));
        _context.TucNoteHistories.Add(CreateNoteHistory(1, NoteHistorySource.Note, noteId, 1,
            new DateTime(2024, 6, 15, 10, 0, 0), "Old", "New"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(noteId, NoteHistorySource.Note);

        // Assert
        result.Should().ContainSingle();
        result[0].EditedByName.Should().Be("Jane Smith");
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

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
        var savedType = await _context.TucNoteTypes.FirstOrDefaultAsync(nt => nt.NoteTypeName == "New Note Type", cancellationToken: TestContext.Current.CancellationToken);
        savedType.Should().NotBeNull();
        savedType!.IsActive.Should().BeTrue();
        savedType.IsPublic.Should().BeTrue();
        savedType.Description.Should().Be("Test description");
    }

    #endregion

    #region GetBulkNoteByIdAsync Tests

    [Fact]
    public async Task GetBulkNoteByIdAsync_WithExistingNote_ReturnsNote()
    {
        // Arrange
        const int noteId = 1;
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        _context.TblBulkJobNotes.Add(CreateBulkJobNote(noteId, bulkJobId, "Test note text"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkNoteByIdAsync(noteId);

        // Assert
        result.Should().NotBeNull();
        result!.NoteId.Should().Be(noteId);
        result.NoteText.Should().Be("Test note text");
        result.BulkJobId.Should().Be(bulkJobId);
        result.NoteTypeId.Should().Be(1);
        result.IsImportant.Should().BeFalse();
    }

    [Fact]
    public async Task GetBulkNoteByIdAsync_WithNonExistentNote_ReturnsNull()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkNoteByIdAsync(999);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region SaveBulkNoteAsync Tests

    [Fact]
    public async Task SaveBulkNoteAsync_WithNewNote_CreatesNote()
    {
        // Arrange
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = 0,
            BulkJobId = bulkJobId,
            NoteText = "Brand new note",
            NoteTypeId = 1,
            IsImportant = false
        };

        // Act
        await repository.SaveBulkNoteAsync(viewModel, TestContext.Current.CancellationToken);

        // Assert
        var savedNote = await _context.TblBulkJobNotes.FirstOrDefaultAsync(n => n.NoteText == "Brand new note", cancellationToken: TestContext.Current.CancellationToken);
        savedNote.Should().NotBeNull();
        savedNote!.BulkJobId.Should().Be(bulkJobId);
        savedNote.NoteTypeId.Should().Be(1);
        savedNote.IsImportant.Should().BeFalse();
        savedNote.CreatedBy.Should().Be(1);
    }

    [Fact]
    public async Task SaveBulkNoteAsync_WithExistingNote_UpdatesInPlace()
    {
        // Arrange
        const int noteId = 1;
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucNoteTypes.Add(CreateNoteType(2, "Client Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        _context.TblBulkJobNotes.Add(CreateBulkJobNote(noteId, bulkJobId, "Original text"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = noteId,
            BulkJobId = bulkJobId,
            NoteText = "Updated text",
            NoteTypeId = 2,
            IsImportant = true
        };

        // Act
        await repository.SaveBulkNoteAsync(viewModel, TestContext.Current.CancellationToken);

        // Assert - note is updated, not duplicated
        var allNotes = await _context.TblBulkJobNotes.Where(n => n.BulkJobId == bulkJobId).ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        allNotes.Should().ContainSingle();

        var updatedNote = allNotes.First();
        updatedNote.NoteText.Should().Be("Updated text");
        updatedNote.NoteTypeId.Should().Be(2);
        updatedNote.IsImportant.Should().BeTrue();
        updatedNote.UpdatedBy.Should().Be(1);
        updatedNote.UpdatedDate.Should().NotBeNull();
    }

    [Fact]
    public async Task SaveBulkNoteAsync_WithExistingNote_RecordsHistory()
    {
        // Arrange
        const int noteId = 1;
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucNoteTypes.Add(CreateNoteType(2, "Client Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        _context.TblBulkJobNotes.Add(CreateBulkJobNote(noteId, bulkJobId, "Original text"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = noteId,
            BulkJobId = bulkJobId,
            NoteText = "Updated text",
            NoteTypeId = 2,
            IsImportant = true
        };

        // Act
        await repository.SaveBulkNoteAsync(viewModel, TestContext.Current.CancellationToken);

        // Assert - history record was created with BulkNoteId set
        var history = await _context.TucNoteHistories
            .Where(h => h.BulkNoteId == noteId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        history.Should().ContainSingle();
        var record = history.First();
        record.NoteId.Should().BeNull();
        record.BulkNoteId.Should().Be(noteId);
        record.ArchiveNoteId.Should().BeNull();
        record.OldNoteText.Should().Be("Original text");
        record.NewNoteText.Should().Be("Updated text");
        record.OldNoteTypeId.Should().Be(1);
        record.NewNoteTypeId.Should().Be(2);
        record.OldIsImportant.Should().BeFalse();
        record.NewIsImportant.Should().BeTrue();
        record.EditedBy.Should().Be(1);
        record.EditedAt.Should().Be(_clock.UtcNow);
    }

    [Fact]
    public async Task SaveBulkNoteAsync_WithNewNote_DoesNotRecordHistory()
    {
        // Arrange
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = 0,
            BulkJobId = bulkJobId,
            NoteText = "Brand new note",
            NoteTypeId = 1,
            IsImportant = false
        };

        // Act
        await repository.SaveBulkNoteAsync(viewModel, TestContext.Current.CancellationToken);

        // Assert - no history for new notes
        var history = await _context.TucNoteHistories.ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        history.Should().BeEmpty();
    }

    [Fact]
    public async Task SaveBulkNoteAsync_WithInvalidNoteType_DefaultsToInternalNote()
    {
        // Arrange
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = 0,
            BulkJobId = bulkJobId,
            NoteText = "Note with invalid type",
            NoteTypeId = 999,
            IsImportant = false
        };

        // Act
        await repository.SaveBulkNoteAsync(viewModel, TestContext.Current.CancellationToken);

        // Assert
        var savedNote = await _context.TblBulkJobNotes.FirstOrDefaultAsync(n => n.BulkJobId == bulkJobId, cancellationToken: TestContext.Current.CancellationToken);
        savedNote.Should().NotBeNull();
        savedNote!.NoteTypeId.Should().Be(1); // Internal Note default
    }

    [Fact]
    public async Task SaveBulkNoteAsync_WithNullBulkJobId_ThrowsArgumentNullException()
    {
        // Arrange
        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = 0,
            BulkJobId = null,
            NoteText = "Test note",
            NoteTypeId = 1
        };

        // Act & Assert
        var act = async () => await repository.SaveBulkNoteAsync(viewModel);
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task SaveBulkNoteAsync_WithEmptyNoteText_ThrowsArgumentException()
    {
        // Arrange
        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = 0,
            BulkJobId = 100,
            NoteText = "",
            NoteTypeId = 1
        };

        // Act & Assert
        var act = async () => await repository.SaveBulkNoteAsync(viewModel);
        await act.Should().ThrowAsync<ArgumentException>();
    }

    #endregion

    #region GetNoteHistoryAsync - BulkNote Source Tests

    [Fact]
    public async Task GetNoteHistoryAsync_WithBulkNoteSource_ReturnsOnlyBulkNoteHistory()
    {
        // Arrange
        const int noteId = 1;
        var timestamp = new DateTime(2024, 6, 15, 10, 0, 0);

        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteHistories.AddRange(
            CreateNoteHistory(1, NoteHistorySource.Note, noteId, 1, timestamp, "Old1", "New1"),
            CreateNoteHistory(2, NoteHistorySource.BulkNote, noteId, 1, timestamp, "Old2", "New2"),
            CreateNoteHistory(3, NoteHistorySource.BulkNote, noteId, 1, timestamp, "Old3", "New3")
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(noteId, NoteHistorySource.BulkNote);

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(h => h.NewNoteText == "New2" || h.NewNoteText == "New3");
    }

    #endregion

    #region GetNoteHistoryAsync - Archive Source Tests

    [Fact]
    public async Task GetNoteHistoryAsync_WithArchiveSource_ReturnsOnlyArchiveHistory()
    {
        // Arrange
        const int noteId = 1;
        var timestamp = new DateTime(2024, 6, 15, 10, 0, 0);

        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteHistories.AddRange(
            CreateNoteHistory(1, NoteHistorySource.Note, noteId, 1, timestamp, "Old1", "New1"),
            CreateNoteHistory(2, NoteHistorySource.Archive, noteId, 1, timestamp, "Old2", "New2"),
            CreateNoteHistory(3, NoteHistorySource.BulkNote, noteId, 1, timestamp, "Old3", "New3")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(noteId, NoteHistorySource.Archive);

        // Assert
        result.Should().ContainSingle();
        result[0].NewNoteText.Should().Be("New2");
    }

    [Fact]
    public async Task GetNoteHistoryAsync_WithArchiveSource_ReturnsNoteIdFromArchiveNoteId()
    {
        // Arrange
        const int archiveNoteId = 42;
        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteHistories.Add(CreateNoteHistory(1, NoteHistorySource.Archive, archiveNoteId, 1,
            new DateTime(2024, 6, 15, 10, 0, 0), "Old", "New"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(archiveNoteId, NoteHistorySource.Archive);

        // Assert
        result.Should().ContainSingle();
        result[0].NoteId.Should().Be(archiveNoteId);
    }

    #endregion

    #region GetNoteHistoryAsync - NoteId Resolution Tests

    [Fact]
    public async Task GetNoteHistoryAsync_NoteSource_ReturnsNoteIdFromNoteColumn()
    {
        // Arrange
        const int noteId = 10;
        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteHistories.Add(CreateNoteHistory(1, NoteHistorySource.Note, noteId, 1,
            new DateTime(2024, 6, 15, 10, 0, 0), "Old", "New"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(noteId, NoteHistorySource.Note);

        // Assert
        result.Should().ContainSingle();
        result[0].NoteId.Should().Be(noteId);
    }

    [Fact]
    public async Task GetNoteHistoryAsync_BulkNoteSource_ReturnsNoteIdFromBulkNoteColumn()
    {
        // Arrange
        const int bulkNoteId = 20;
        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteHistories.Add(CreateNoteHistory(1, NoteHistorySource.BulkNote, bulkNoteId, 1,
            new DateTime(2024, 6, 15, 10, 0, 0), "Old", "New"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(bulkNoteId, NoteHistorySource.BulkNote);

        // Assert
        result.Should().ContainSingle();
        result[0].NoteId.Should().Be(bulkNoteId);
    }

    #endregion

    #region Nullable FK Column Isolation Tests

    [Fact]
    public async Task SaveBulkNoteAsync_HistoryRow_HasOnlyBulkNoteIdSet()
    {
        // Arrange
        const int noteId = 1;
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        _context.TblBulkJobNotes.Add(CreateBulkJobNote(noteId, bulkJobId, "Original text"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = noteId,
            BulkJobId = bulkJobId,
            NoteText = "Updated",
            NoteTypeId = 1,
            IsImportant = false
        };

        // Act
        await repository.SaveBulkNoteAsync(viewModel, TestContext.Current.CancellationToken);

        // Assert — exactly one FK column is populated
        var history = await _context.TucNoteHistories.SingleAsync(cancellationToken: TestContext.Current.CancellationToken);
        history.NoteId.Should().BeNull();
        history.BulkNoteId.Should().Be(noteId);
        history.ArchiveNoteId.Should().BeNull();
    }

    [Fact]
    public async Task DeleteNoteAsync_DoesNotDeleteBulkNoteHistory()
    {
        // Arrange
        const int noteId = 1;
        const int jobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.TucNotes.Add(new TucNote
        {
            NoteId = noteId,
            JobId = jobId,
            NoteText = "Active note",
            NoteTypeId = 1,
            IsImportant = false,
            CreatedDate = TestDates.Now
        });
        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));

        // History for the active note (NoteId = 1)
        _context.TucNoteHistories.Add(CreateNoteHistory(1, NoteHistorySource.Note, noteId, 1,
            DateTime.UtcNow, "Old", "New"));
        // History for a bulk note that happens to have BulkNoteId = 1
        _context.TucNoteHistories.Add(CreateNoteHistory(2, NoteHistorySource.BulkNote, noteId, 1,
            DateTime.UtcNow, "Bulk old", "Bulk new"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.DeleteNoteAsync(noteId, TestContext.Current.CancellationToken);

        // Assert — bulk note history is untouched
        var remaining = await _context.TucNoteHistories.AsNoTracking().ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        remaining.Should().ContainSingle();
        remaining[0].BulkNoteId.Should().Be(noteId);
        remaining[0].NoteId.Should().BeNull();
    }

    [Fact]
    public async Task DeleteBulkNoteAsync_DoesNotDeleteActiveNoteHistory()
    {
        // Arrange
        const int noteId = 1;
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        _context.TblBulkJobNotes.Add(CreateBulkJobNote(noteId, bulkJobId, "Bulk note"));
        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));

        // History for the bulk note (BulkNoteId = 1)
        _context.TucNoteHistories.Add(CreateNoteHistory(1, NoteHistorySource.BulkNote, noteId, 1,
            DateTime.UtcNow, "Old", "New"));
        // History for an active note that happens to have NoteId = 1
        _context.TucNoteHistories.Add(CreateNoteHistory(2, NoteHistorySource.Note, noteId, 1,
            DateTime.UtcNow, "Active old", "Active new"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.DeleteBulkNoteAsync(noteId, TestContext.Current.CancellationToken);

        // Assert — active note history is untouched
        var remaining = await _context.TucNoteHistories.AsNoTracking().ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        remaining.Should().ContainSingle();
        remaining[0].NoteId.Should().Be(noteId);
        remaining[0].BulkNoteId.Should().BeNull();
    }

    #endregion

    #region SaveNoteAsync - Active Note History FK Tests

    [Fact]
    public async Task SaveNoteAsync_ActiveNoteUpdate_RecordsHistoryWithNoteIdOnly()
    {
        // Arrange
        const int noteId = 1;
        const int jobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucNoteTypes.Add(CreateNoteType(2, "Client Note"));
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.TucNotes.Add(new TucNote
        {
            NoteId = noteId,
            JobId = jobId,
            NoteText = "Original text",
            NoteTypeId = 1,
            IsImportant = false,
            CreatedDate = TestDates.Now
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = noteId,
            JobId = jobId,
            NoteText = "Updated text",
            NoteTypeId = 2,
            IsImportant = true
        };

        // Act
        await repository.SaveNoteAsync(viewModel, TestContext.Current.CancellationToken);

        // Assert — history row has only NoteId set
        var history = await _context.TucNoteHistories.SingleAsync(cancellationToken: TestContext.Current.CancellationToken);
        history.NoteId.Should().Be(noteId);
        history.BulkNoteId.Should().BeNull();
        history.ArchiveNoteId.Should().BeNull();
        history.OldNoteText.Should().Be("Original text");
        history.NewNoteText.Should().Be("Updated text");
        history.OldNoteTypeId.Should().Be(1);
        history.NewNoteTypeId.Should().Be(2);
        history.OldIsImportant.Should().BeFalse();
        history.NewIsImportant.Should().BeTrue();
    }

    #endregion

    #region SaveNoteAsync - Archived Note History FK Tests

    [Fact]
    public async Task SaveNoteAsync_ArchivedNoteUpdate_RecordsHistoryWithArchiveNoteIdOnly()
    {
        // Arrange
        const int noteId = 1;
        const int jobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        _context.TucNoteArchives.Add(new TucNoteArchive
        {
            NoteId = noteId,
            JobId = jobId,
            NoteText = "Archived original",
            NoteTypeId = 1,
            IsImportant = false,
            CreatedDate = TestDates.Now
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = noteId,
            JobId = jobId,
            NoteText = "Archived updated",
            NoteTypeId = 1,
            IsImportant = true
        };

        // Act
        await repository.SaveNoteAsync(viewModel, TestContext.Current.CancellationToken);

        // Assert — history row has only ArchiveNoteId set
        var history = await _context.TucNoteHistories.SingleAsync(cancellationToken: TestContext.Current.CancellationToken);
        history.NoteId.Should().BeNull();
        history.BulkNoteId.Should().BeNull();
        history.ArchiveNoteId.Should().Be(noteId);
        history.OldNoteText.Should().Be("Archived original");
        history.NewNoteText.Should().Be("Archived updated");
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
        CreatedDate = createdDate ?? TestDates.Now
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

    private static TucStaff CreateStaff(int id, string firstName, string lastName) => new()
    {
        UcstId = id,
        UcstFirstName = firstName,
        UcstLastName = lastName,
        Created = TestDates.Now,
        CreatedBy = "test",
        LastModified = TestDates.Now,
        LastModifiedBy = "test"
    };

    private static TucNoteHistory CreateNoteHistory(int id, NoteHistorySource source, int noteId, int editedBy,
        DateTime editedAt, string oldText, string newText,
        int? oldNoteTypeId = null, int? newNoteTypeId = null,
        bool? oldIsImportant = null, bool? newIsImportant = null) => new()
    {
        NoteHistoryId = id,
        NoteId = source == NoteHistorySource.Note ? noteId : null,
        BulkNoteId = source == NoteHistorySource.BulkNote ? noteId : null,
        ArchiveNoteId = source == NoteHistorySource.Archive ? noteId : null,
        EditedBy = editedBy,
        EditedAt = editedAt,
        OldNoteText = oldText,
        NewNoteText = newText,
        OldNoteTypeId = oldNoteTypeId,
        NewNoteTypeId = newNoteTypeId,
        OldIsImportant = oldIsImportant,
        NewIsImportant = newIsImportant
    };

    #endregion
}
