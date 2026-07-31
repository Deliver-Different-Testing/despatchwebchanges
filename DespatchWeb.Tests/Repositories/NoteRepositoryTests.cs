using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for NoteRepository - covers note CRUD operations and note type management.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class NoteRepositoryTests : IAsyncDisposable
{
    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public NoteRepositoryTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);

        // Default tenant setup
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
        _tenantInfoServiceMock.ConvertUtcToTenantTimeZone(Arg.Any<DateTime>())
            .Returns(ci => new DateTimeOffset(ci.Arg<DateTime>(), TimeSpan.FromHours(12)));
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private NoteRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
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
    public async Task SaveNoteAsync_NewNoteOnChildJob_IsReturnedByGetNotesByJobIdAsync()
    {
        // Arrange — child job 500 with ParentId = 100
        const int parentJobId = 100;
        const int childJobId = 500;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucJobs.Add(CreateJob(parentJobId, "PARENT001"));
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = childJobId,
            UcjbNumber = "CHILD001",
            ParentId = parentJobId
        });
        _context.TucStaffs.Add(CreateStaff(1, "Test", "User"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = 0,
            JobId = childJobId,
            NoteText = "Note on child job",
            NoteTypeId = 1,
            IsImportant = false
        };

        // Act — create a note on the child job, then read notes for the child job
        await repository.SaveNoteAsync(viewModel, TestContext.Current.CancellationToken);
        var notes = await repository.GetNotesByJobIdAsync(childJobId);

        // Assert — the note should be returned
        Assert.Single(notes);
        Assert.Equal("Note on child job", notes[0].NoteText);
    }

    [Fact]
    public async Task SaveNoteAsync_NewActiveNote_SetsCreatedDateUtcFromClock()
    {
        // Arrange
        const int jobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucJobs.Add(CreateJob(jobId, "JOB100"));
        _context.TucStaffs.Add(CreateStaff(1, "Test", "User"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new TucNoteViewModel
        {
            NoteId = 0,
            JobId = jobId,
            NoteText = "UTC note",
            NoteTypeId = 1,
            IsImportant = false
        };

        // Act
        await repository.SaveNoteAsync(viewModel, TestContext.Current.CancellationToken);

        // Assert — UTC column captures the clock's UTC instant
        var note = await _context.TucNotes.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(_clock.UtcNow, note.CreatedDateUtc);
    }

    [Fact]
    public async Task GetNotesByJobIdAsync_NoTucNoteRows_FallsBackToUcjbNotesColumn()
    {
        // Arrange — a job whose pickup note only ever landed in the UcjbNotes column
        // (no tucNote row), e.g. a programmatically created return job.
        const int jobId = 100;
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = jobId,
            UcjbNumber = "JOB001",
            UcjbNotes = "Pickup at rear dock",
            UcjbTime = new DateTime(2024, 6, 15, 9, 0, 0)
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNotesByJobIdAsync(jobId);

        // Assert — the column note is surfaced as a single synthesized pickup note
        Assert.Single(result);
        Assert.Equal("Pickup at rear dock", result[0].NoteText);
        Assert.Equal((int)NoteType.PickupNotes, result[0].NoteTypeId);
    }

    [Fact]
    public async Task GetNotesByJobIdAsync_WithTucNoteRows_DoesNotAddUcjbNotesFallback()
    {
        // Arrange — a real tucNote row exists; the UcjbNotes column mirror must not be duplicated
        const int jobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucStaffs.Add(CreateStaff(1, "Test", "User"));
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = jobId,
            UcjbNumber = "JOB001",
            UcjbNotes = "Mirrored column text"
        });
        _context.TucNotes.Add(new TucNote
        {
            NoteId = 1,
            JobId = jobId,
            NoteText = "Real tucNote",
            NoteTypeId = 1,
            IsImportant = false,
            CreatedDate = TestDates.Now
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNotesByJobIdAsync(jobId);

        // Assert — only the real note, no synthesized fallback
        Assert.Single(result);
        Assert.Equal("Real tucNote", result[0].NoteText);
    }

    [Fact]
    public async Task GetNotesByJobIdAsync_ChildReturnJobWithNoNotes_FallsBackToRootUcjbNotes()
    {
        // Arrange — child return job (ParentId set) with no notes anywhere; the original
        // job's pickup note lives in the parent's UcjbNotes column.
        const int parentJobId = 100;
        const int childJobId = 500;
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = parentJobId,
            UcjbNumber = "PARENT001",
            UcjbNotes = "Original pickup note"
        });
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = childJobId,
            UcjbNumber = "CHILD001",
            ParentId = parentJobId
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act — read notes for the child return job
        var result = await repository.GetNotesByJobIdAsync(childJobId);

        // Assert — the root's pickup note is surfaced
        Assert.Single(result);
        Assert.Equal("Original pickup note", result[0].NoteText);
        Assert.Equal((int)NoteType.PickupNotes, result[0].NoteTypeId);
    }

    [Fact]
    public async Task GetNotesByJobIdAsync_ActiveReturnLegWithArchivedParent_FallsBackToArchivedRootUcjbNotes()
    {
        // Arrange — a still-active return leg (ParentId set) whose original/parent job has
        // already been completed and archived. The original's pickup note lives only in the
        // parent's UcjbNotes column, which now sits in TucJobArchives. The return leg has no
        // notes of its own. Before this fix the note only surfaced once the return leg itself
        // was completed (archived read), so notes appeared to "only show when completed".
        const int parentJobId = 100;
        const int returnLegId = 500;
        _context.TucJobArchives.Add(new TucJobArchive
        {
            UcjbId = parentJobId,
            UcjbNumber = "PARENT001",
            UcjbNotes = "Original pickup note",
            UcjbDate = new DateTime(2024, 1, 1),
            UcjbTime = new DateTime(2024, 1, 1, 8, 0, 0)
        });
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = returnLegId,
            UcjbNumber = "RETURN001",
            ParentId = parentJobId
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act — read notes for the active return leg
        var result = await repository.GetNotesByJobIdAsync(returnLegId);

        // Assert — the archived root's pickup note is surfaced even though the return leg is live
        Assert.Single(result);
        Assert.Equal("Original pickup note", result[0].NoteText);
        Assert.Equal((int)NoteType.PickupNotes, result[0].NoteTypeId);
    }

    [Fact]
    public async Task GetNotesByJobIdAsync_NoNotesAndWhitespaceUcjbNotes_ReturnsEmpty()
    {
        // Arrange — no tucNote row and a blank UcjbNotes column → nothing to surface
        const int jobId = 100;
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = jobId,
            UcjbNumber = "JOB001",
            UcjbNotes = "   "
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNotesByJobIdAsync(jobId);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetNotesByJobIdAsync_ArchivedJobNoNotes_FallsBackToUcjbNotesColumn()
    {
        // Arrange — archived job whose pickup note only exists in the UcjbNotes column
        const int jobId = 200;
        _context.TucJobArchives.Add(new TucJobArchive
        {
            UcjbId = jobId,
            UcjbNumber = "ARCH001",
            UcjbNotes = "Archived pickup note",
            UcjbDate = new DateTime(2024, 1, 1),
            UcjbTime = new DateTime(2024, 1, 1, 8, 0, 0)
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNotesByJobIdAsync(jobId);

        // Assert
        Assert.Single(result);
        Assert.Equal("Archived pickup note", result[0].NoteText);
        Assert.Equal((int)NoteType.PickupNotes, result[0].NoteTypeId);
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
        Assert.All(result, h => Assert.True(h.NewNoteText is "New2" or "New3"));
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
        await repository.DeleteNoteAsync(noteId, cancellationToken: TestContext.Current.CancellationToken);

        // Assert — query is untracked by the global QueryTrackingBehavior so we see
        // the post-ExecuteDeleteAsync state, not a stale tracker entry.
        var note = await _context.TucNotes.FirstOrDefaultAsync(n => n.NoteId == noteId,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(note);

        var history = await _context.TucNoteHistories
            .Where(h => h.NoteId == noteId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Empty(history);
    }

    [Fact]
    public async Task GetNoteByIdAsync_CollidingId_ArchivedJob_ReturnsArchivedNote()
    {
        const int noteId = 1;
        const int archivedJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucJobArchives.Add(CreateArchivedJob(archivedJobId, "ARCH001"));
        _context.TucNoteArchives.Add(CreateArchivedNote(noteId, archivedJobId, "Archived note", TestDates.Now));
        _context.TucNotes.Add(new TucNote
        {
            NoteId = noteId,
            JobId = 999,
            NoteText = "Active note",
            NoteTypeId = 1,
            IsImportant = false,
            CreatedDate = TestDates.Now
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var result = await repository.GetNoteByIdAsync(noteId, archivedJobId);

        Assert.NotNull(result);
        Assert.Equal("Archived note", result.NoteText);
    }

    [Fact]
    public async Task GetNoteByIdAsync_CollidingId_LiveJob_ReturnsActiveNote()
    {
        const int noteId = 1;
        const int liveJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucJobs.Add(CreateJob(liveJobId, "JOB001"));
        _context.TucNotes.Add(new TucNote
        {
            NoteId = noteId,
            JobId = liveJobId,
            NoteText = "Active note",
            NoteTypeId = 1,
            IsImportant = false,
            CreatedDate = TestDates.Now
        });
        _context.TucNoteArchives.Add(CreateArchivedNote(noteId, 999, "Archived note", TestDates.Now));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var result = await repository.GetNoteByIdAsync(noteId, liveJobId);

        Assert.NotNull(result);
        Assert.Equal("Active note", result.NoteText);
    }

    [Fact]
    public async Task GetNoteByIdAsync_NullJobId_ReturnsActiveNote()
    {
        const int noteId = 1;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucNotes.Add(new TucNote
        {
            NoteId = noteId,
            JobId = 100,
            NoteText = "Active note",
            NoteTypeId = 1,
            IsImportant = false,
            CreatedDate = TestDates.Now
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var result = await repository.GetNoteByIdAsync(noteId);

        Assert.NotNull(result);
        Assert.Equal("Active note", result.NoteText);
    }

    [Fact]
    public async Task GetNoteByIdAsync_NonExistentNote_ReturnsNull()
    {
        var repository = CreateRepository();

        var result = await repository.GetNoteByIdAsync(999, 100);

        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteNoteAsync_ArchivedJob_DeletesArchivedNoteAndHistory_LeavesCollidingActiveNote()
    {
        const int noteId = 1;
        const int archivedJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucJobArchives.Add(CreateArchivedJob(archivedJobId, "ARCH001"));
        _context.TucStaffs.Add(CreateStaff(1, "John", "Doe"));
        _context.TucNoteArchives.Add(CreateArchivedNote(noteId, archivedJobId, "Archived note", TestDates.Now));
        _context.TucNotes.Add(new TucNote
        {
            NoteId = noteId,
            JobId = 999,
            NoteText = "Active note",
            NoteTypeId = 1,
            IsImportant = false,
            CreatedDate = TestDates.Now
        });
        _context.TucNoteHistories.Add(CreateNoteHistory(1, NoteHistorySource.Archive, noteId, 1,
            DateTime.UtcNow, "Old", "Archived note"));
        _context.TucNoteHistories.Add(CreateNoteHistory(2, NoteHistorySource.Note, noteId, 1,
            DateTime.UtcNow, "Old", "Active note"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await repository.DeleteNoteAsync(noteId, archivedJobId,
            cancellationToken: TestContext.Current.CancellationToken);

        var archived = await _context.TucNoteArchives
            .FirstOrDefaultAsync(n => n.NoteId == noteId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(archived);

        var archiveHistory = await _context.TucNoteHistories
            .Where(h => h.ArchiveNoteId == noteId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Empty(archiveHistory);

        var active = await _context.TucNotes
            .FirstOrDefaultAsync(n => n.NoteId == noteId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.NotNull(active);

        var activeHistory = await _context.TucNoteHistories
            .Where(h => h.NoteId == noteId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(activeHistory);
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
        var note = await _context.TblBulkJobNotes.FirstOrDefaultAsync(n => n.NoteId == noteId,
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
        Assert.All(result, h => Assert.True(h.NewNoteText is "New1" or "New3"));
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
        _context.TucStaffs.Add(CreateStaff(1, "Test", "User"));
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
    public async Task SaveBulkNoteAsync_WithNewNote_RecordsCreationHistory()
    {
        // Arrange
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        _context.TucStaffs.Add(CreateStaff(1, "Test", "User"));
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

        // Assert - history is created for new notes with OldNoteText = empty string
        var history =
            await _context.TucNoteHistories.ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(history);
        var record = history[0];
        Assert.Null(record.NoteId);
        Assert.NotNull(record.BulkNoteId);
        Assert.Null(record.ArchiveNoteId);
        Assert.Equal("", record.OldNoteText);
        Assert.Equal("Brand new note", record.NewNoteText);
        Assert.Null(record.OldNoteTypeId);
        Assert.Equal(1, record.NewNoteTypeId);
        Assert.False(record.OldIsImportant);
        Assert.False(record.NewIsImportant);
        Assert.Equal(1, record.EditedBy);
        Assert.Equal(_clock.UtcNow, record.EditedAtUtc);
    }

    [Fact]
    public async Task SaveBulkNoteAsync_WithInvalidNoteType_DefaultsToInternalNote()
    {
        // Arrange
        const int bulkJobId = 100;
        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TblBulkJobs.Add(CreateBulkJob(bulkJobId, "BULK001"));
        _context.TucStaffs.Add(CreateStaff(1, "Test", "User"));
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
        await repository.DeleteNoteAsync(noteId, cancellationToken: TestContext.Current.CancellationToken);

        // Assert — bulk note history is untouched
        var remaining = await _context.TucNoteHistories
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
        var remaining = await _context.TucNoteHistories
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