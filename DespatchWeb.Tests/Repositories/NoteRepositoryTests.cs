using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for NoteRepository - covers note CRUD operations and note type management.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class NoteRepositoryTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock;
    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();

    public NoteRepositoryTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = _db.CreateFactoryMock(_context);

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
        await _db.DisposeAsync();
    }

    private NoteRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock
    );

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
        Assert.Equal(3, result.Count);
        Assert.Equal("Newest note", result[0].NoteText);
        Assert.Equal("Middle note", result[1].NoteText);
        Assert.Equal("Oldest note", result[2].NoteText);
    }

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
        var savedType = await _context.TucNoteTypes.FirstOrDefaultAsync(nt => nt.NoteTypeName == "New Note Type",
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.NotNull(savedType);
        Assert.True(savedType.IsActive);
        Assert.True(savedType.IsPublic);
        Assert.Equal("Test description", savedType.Description);
    }

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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(noteId, NoteHistorySource.BulkNote);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.All(result, h => Assert.True(h.NewNoteText == "New2" || h.NewNoteText == "New3"));
    }

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
        var history =
            await _context.TucNoteHistories.SingleAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(noteId, history.NoteId);
        Assert.Null(history.BulkNoteId);
        Assert.Null(history.ArchiveNoteId);
        Assert.Equal("Original text", history.OldNoteText);
        Assert.Equal("Updated text", history.NewNoteText);
        Assert.Equal(1, history.OldNoteTypeId);
        Assert.Equal(2, history.NewNoteTypeId);
        Assert.False(history.OldIsImportant);
        Assert.True(history.NewIsImportant);
    }

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
        var history =
            await _context.TucNoteHistories.SingleAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(history.NoteId);
        Assert.Null(history.BulkNoteId);
        Assert.Equal(noteId, history.ArchiveNoteId);
        Assert.Equal("Archived original", history.OldNoteText);
        Assert.Equal("Archived updated", history.NewNoteText);
    }

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
        Assert.Equal(2, result.Count);
        Assert.Contains(result, n => n.NoteText == "Note 1");
        Assert.Contains(result, n => n.NoteText == "Note 2");
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
        Assert.Empty(result);
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
        Assert.Single(result);
        Assert.Equal("Note for job 1", result[0].NoteText);
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
        Assert.Equal(3, result.Count);
        Assert.Equal("Newest note", result[0].NoteText);
        Assert.Equal("Middle note", result[1].NoteText);
        Assert.Equal("Oldest note", result[2].NoteText);
    }

    [Fact]
    public async Task DeleteNoteAsync_WithNonExistentNote_DoesNotThrow()
    {
        // Arrange
        var repository = CreateRepository();

        var exception = await Record.ExceptionAsync(Act);
        Assert.Null(exception);
        return;

        // Act & Assert - Should not throw
        async Task Act() => await repository.DeleteNoteAsync(999);
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
        var note = await _context.TucNotes.AsNoTracking().FirstOrDefaultAsync(n => n.NoteId == noteId,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(note);

        var history = await _context.TucNoteHistories
            .Where(h => h.NoteId == noteId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Empty(history);
    }

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
        var note = await _context.TblBulkJobNotes.AsNoTracking().FirstOrDefaultAsync(n => n.NoteId == noteId,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(note);

        var history = await _context.TucNoteHistories
            .Where(h => h.BulkNoteId == noteId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Empty(history);
    }

    [Fact]
    public async Task DeleteBulkNoteAsync_WithNonExistentNote_DoesNotThrow()
    {
        // Arrange
        var repository = CreateRepository();

        var exception = await Record.ExceptionAsync(Act);
        Assert.Null(exception);
        return;

        // Act & Assert
        async Task Act() => await repository.DeleteBulkNoteAsync(999);
    }

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
        Assert.Equal(3, result.Count);
        Assert.Equal("New newest", result[0].NewNoteText);
        Assert.Equal("New middle", result[1].NewNoteText);
        Assert.Equal("New oldest", result[2].NewNoteText);
    }

    [Fact]
    public async Task GetNoteHistoryAsync_WithNoHistory_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteHistoryAsync(999, NoteHistorySource.Note);

        // Assert
        Assert.Empty(result);
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
        Assert.Equal(2, result.Count);
        Assert.All(result, h => Assert.True(h.NewNoteText == "New1" || h.NewNoteText == "New3"));
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
        Assert.Single(result);
        Assert.Equal("Internal Note", result[0].OldNoteTypeName);
        Assert.Equal("Client Note", result[0].NewNoteTypeName);
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
        Assert.Single(result);
        Assert.Equal("Jane Smith", result[0].EditedByName);
    }

    [Fact]
    public async Task GetNoteTypesAsync_WithActiveNoteTypes_ReturnsOnlyActiveTypes()
    {
        // Arrange
        _context.TucNoteTypes.AddRange(
            new TucNoteType
            {
                NoteTypeId = 1, NoteTypeName = "Active Type 1", IsActive = true, IsPublic = false,
                IsSystemDefined = false
            },
            new TucNoteType
            {
                NoteTypeId = 2, NoteTypeName = "Inactive Type", IsActive = false, IsPublic = false,
                IsSystemDefined = false
            },
            new TucNoteType
            {
                NoteTypeId = 3, NoteTypeName = "Active Type 2", IsActive = true, IsPublic = true,
                IsSystemDefined = false
            }
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteTypesAsync();

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, nt => nt.Text == "Active Type 1");
        Assert.Contains(result, nt => nt.Text == "Active Type 2");
        Assert.DoesNotContain(result, nt => nt.Text == "Inactive Type");
    }

    [Fact]
    public async Task GetNoteTypesAsync_WithNoNoteTypes_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetNoteTypesAsync();

        // Assert
        Assert.Empty(result);
    }

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
        Assert.NotNull(result);
        Assert.Equal(noteId, result.NoteId);
        Assert.Equal("Test note text", result.NoteText);
        Assert.Equal(bulkJobId, result.BulkJobId);
        Assert.Equal(1, result.NoteTypeId);
        Assert.False(result.IsImportant);
    }

    [Fact]
    public async Task GetBulkNoteByIdAsync_WithNonExistentNote_ReturnsNull()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkNoteByIdAsync(999);

        // Assert
        Assert.Null(result);
    }

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
        var savedNote = await _context.TblBulkJobNotes.FirstOrDefaultAsync(n => n.NoteText == "Brand new note",
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.NotNull(savedNote);
        Assert.Equal(bulkJobId, savedNote.BulkJobId);
        Assert.Equal(1, savedNote.NoteTypeId);
        Assert.False(savedNote.IsImportant);
        Assert.Equal(1, savedNote.CreatedBy);
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
        var allNotes = await _context.TblBulkJobNotes.Where(n => n.BulkJobId == bulkJobId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(allNotes);

        var updatedNote = allNotes.First();
        Assert.Equal("Updated text", updatedNote.NoteText);
        Assert.Equal(2, updatedNote.NoteTypeId);
        Assert.True(updatedNote.IsImportant);
        Assert.Equal(1, updatedNote.UpdatedBy);
        Assert.NotNull(updatedNote.UpdatedDate);
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

        Assert.Single(history);
        var record = history.First();
        Assert.Null(record.NoteId);
        Assert.Equal(noteId, record.BulkNoteId);
        Assert.Null(record.ArchiveNoteId);
        Assert.Equal("Original text", record.OldNoteText);
        Assert.Equal("Updated text", record.NewNoteText);
        Assert.Equal(1, record.OldNoteTypeId);
        Assert.Equal(2, record.NewNoteTypeId);
        Assert.False(record.OldIsImportant);
        Assert.True(record.NewIsImportant);
        Assert.Equal(1, record.EditedBy);
        Assert.Equal(_clock.UtcNow, record.EditedAtUtc);
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
        var history =
            await _context.TucNoteHistories.ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Empty(history);
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
        var savedNote = await _context.TblBulkJobNotes.FirstOrDefaultAsync(n => n.BulkJobId == bulkJobId,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.NotNull(savedNote);
        Assert.Equal(1, savedNote.NoteTypeId); // Internal Note default
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

        await Assert.ThrowsAsync<ArgumentNullException>(Act);
        return;

        // Act & Assert
        async Task Act() => await repository.SaveBulkNoteAsync(viewModel);
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

        await Assert.ThrowsAsync<ArgumentException>(Act);
        return;

        // Act & Assert
        async Task Act() => await repository.SaveBulkNoteAsync(viewModel);
    }

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
        Assert.Single(result);
        Assert.Equal("New2", result[0].NewNoteText);
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
        Assert.Single(result);
        Assert.Equal(archiveNoteId, result[0].NoteId);
    }

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
        Assert.Single(result);
        Assert.Equal(noteId, result[0].NoteId);
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
        Assert.Single(result);
        Assert.Equal(bulkNoteId, result[0].NoteId);
    }

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
        var history =
            await _context.TucNoteHistories.SingleAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(history.NoteId);
        Assert.Equal(noteId, history.BulkNoteId);
        Assert.Null(history.ArchiveNoteId);
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
        var remaining = await _context.TucNoteHistories.AsNoTracking()
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(remaining);
        Assert.Equal(noteId, remaining[0].BulkNoteId);
        Assert.Null(remaining[0].NoteId);
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
        var remaining = await _context.TucNoteHistories.AsNoTracking()
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(remaining);
        Assert.Equal(noteId, remaining[0].NoteId);
        Assert.Null(remaining[0].BulkNoteId);
    }

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

    private static TblBulkJobNote CreateBulkJobNote(int noteId, int bulkJobId, string noteText,
        DateTime? createdDate = null) => new()
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

    private static TucNoteArchive CreateArchivedNote(int noteId, int jobId, string noteText,
        DateTime? createdDate = null) => new()
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
        EditedAtUtc = editedAt,
        OldNoteText = oldText,
        NewNoteText = newText,
        OldNoteTypeId = oldNoteTypeId,
        NewNoteTypeId = newNoteTypeId,
        OldIsImportant = oldIsImportant,
        NewIsImportant = newIsImportant
    };

}
