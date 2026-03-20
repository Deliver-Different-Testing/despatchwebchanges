using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for DeliveryJourneyService - tests delivery journey timeline building.
/// Uses SQLite in-memory database for realistic query execution.
/// </summary>
public class DeliveryJourneyServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();

    public DeliveryJourneyServiceTests()
    {
        // Default tenant info setup
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("UTC");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
        _tenantInfoServiceMock.Setup(x => x.ConvertUtcToTenantTimeZone(It.IsAny<DateTime>()))
            .Returns((DateTime dt) => new DateTimeOffset(dt, TimeSpan.Zero));
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DeliveryJourneyService CreateService() => new(
        _db.CreateFactoryMock().Object,
        _tenantInfoServiceMock.Object
    );

    private async Task SeedJobsAsync(params TucJob[] jobs)
    {
        await using var context = _db.CreateContext();
        context.TucJobs.AddRange(jobs);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task SeedEventsAsync(params TucEvent[] events)
    {
        await using var context = _db.CreateContext();
        context.TucEvents.AddRange(events);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task SeedNotesAsync(params TucNote[] notes)
    {
        await using var context = _db.CreateContext();
        context.TucNotes.AddRange(notes);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task SeedArchivedNotesAsync(params TucNoteArchive[] notes)
    {
        await using var context = _db.CreateContext();
        context.TucNoteArchives.AddRange(notes);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task SeedStaffAsync(params TucStaff[] staff)
    {
        await using var context = _db.CreateContext();
        context.TucStaffs.AddRange(staff);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task SeedMessagesAsync(params TucManualMessage[] messages)
    {
        await using var context = _db.CreateContext();
        context.TucManualMessages.AddRange(messages);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public void Constructor_WithValidDependencies_CreatesService()
    {
        // Act
        var service = CreateService();

        // Assert
        Assert.NotNull(service);
        Assert.IsType<IDeliveryJourneyService>(service, exactMatch: false);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithNoData_ReturnsEmptyList()
    {
        // Arrange - seed a live job but no journey data
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithArchivedJob_ReturnsEmptyListWhenNoData()
    {
        // Arrange - no live job seeded, so job is treated as archived
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(999);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithEvents_ReturnsTaskEntries()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedEventsAsync(new TucEvent
        {
            UcevId = 1,
            UcevJobId = 1,
            UcevDescription = "Call customer",
            UcevDate = new DateTime(2024, 1, 15),
            UcevTime = new DateTime(1, 1, 1, 10, 30, 0),
            UcevClosed = false,
            UcevDespatcher = "John Doe"
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Call customer", result[0].Title);
        Assert.Equal("task", result[0].Icon);
        Assert.Contains("Task", result[0].Tags);
        Assert.Contains("In Progress", result[0].Tags);
        Assert.Contains("Created by John Doe", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithClosedEvent_ShowsCompletedTag()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedEventsAsync(new TucEvent
        {
            UcevId = 1,
            UcevJobId = 1,
            UcevDescription = "Completed task",
            UcevDate = new DateTime(2024, 1, 15),
            UcevTime = new DateTime(1, 1, 1, 10, 30, 0),
            UcevClosed = true,
            UcevDespatcher = "Jane Smith"
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Contains("Completed", result[0].Tags);
        Assert.Contains("Created by Jane Smith", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithMultipleEvents_ReturnsAllEvents()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedEventsAsync(
            new TucEvent
            {
                UcevId = 1,
                UcevJobId = 1,
                UcevDescription = "First task",
                UcevDate = new DateTime(2024, 1, 15),
                UcevTime = new DateTime(1, 1, 1, 8, 0, 0),
                UcevClosed = true,
                UcevDespatcher = "User A"
            },
            new TucEvent
            {
                UcevId = 2,
                UcevJobId = 1,
                UcevDescription = "Second task",
                UcevDate = new DateTime(2024, 1, 15),
                UcevTime = new DateTime(1, 1, 1, 12, 0, 0),
                UcevClosed = false,
                UcevDespatcher = "User B"
            });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, e => e.Title == "First task");
        Assert.Contains(result, e => e.Title == "Second task");
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithLiveNotes_ReturnsNoteEntries()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedNotesAsync(new TucNote
        {
            NoteId = 1,
            JobId = 1,
            NoteText = "Customer called about delivery",
            CreatedDate = new DateTime(2024, 1, 15, 9, 0, 0),
            NoteTypeId = 1
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Note added by System", result[0].Title);
        Assert.Equal("Customer called about delivery", result[0].Description);
        Assert.Equal("sticky_note_2", result[0].Icon);
        Assert.Contains("Note", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithMultipleNotes_ReturnsAllNotes()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedNotesAsync(
            new TucNote
            {
                NoteId = 1,
                JobId = 1,
                NoteText = "First note",
                CreatedDate = new DateTime(2024, 1, 15, 8, 0, 0),
                NoteTypeId = 1
            },
            new TucNote
            {
                NoteId = 2,
                JobId = 1,
                NoteText = "Second note",
                CreatedDate = new DateTime(2024, 1, 15, 10, 0, 0),
                NoteTypeId = 1
            });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, n => n.Description == "First note");
        Assert.Contains(result, n => n.Description == "Second note");
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithLiveNotes_ConvertsDatePropertyTimezone()
    {
        // Arrange — Notes store tenant local time, so SetDateTimeWithTimeZone should
        // preserve the wall-clock time and only attach the offset label
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedNotesAsync(new TucNote
        {
            NoteId = 1, JobId = 1, NoteText = "TZ test",
            CreatedDate = new DateTime(2024, 1, 15, 9, 0, 0),
            UpdatedDate = new DateTime(2024, 1, 15, 9, 0, 0),
            NoteTypeId = 1
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert — wall-clock time preserved (09:00 stays 09:00), only offset label applied
        Assert.Single(result);
        Assert.Equal(9, result[0].Date.Hour);
        Assert.Equal(TimeSpan.FromHours(13), result[0].Date.Offset);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithLiveNotes_UsesUpdatedDateForDatePropertyWhenPresent()
    {
        // Arrange — UpdatedDate should take precedence over CreatedDate
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedNotesAsync(new TucNote
        {
            NoteId = 1, JobId = 1, NoteText = "Updated note",
            CreatedDate = new DateTime(2024, 1, 15, 2, 0, 0),
            UpdatedDate = new DateTime(2024, 1, 15, 9, 0, 0),
            NoteTypeId = 1
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert — should use UpdatedDate (09:00 local preserved), not CreatedDate (02:00)
        Assert.Single(result);
        Assert.Equal(9, result[0].Date.Hour);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithLiveNotes_TagCreatedDateConvertsTimezone()
    {
        // Arrange — 15:00 local time should stay 15:00 (wall-clock preserved, offset label applied)
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        await SeedStaffAsync(new TucStaff { UcstId = 1, UcstFirstName = "Alice", UcstLastName = "Smith", CreatedBy = "test", LastModifiedBy = "test" });
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedNotesAsync(new TucNote
        {
            NoteId = 1, JobId = 1, NoteText = "Tag TZ test",
            CreatedDate = new DateTime(2024, 1, 15, 15, 0, 0),
            CreatedBy = 1, NoteTypeId = 1
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert — tag should show 01/15/2024 15:00 (same day, wall-clock preserved)
        Assert.Single(result);
        Assert.Contains(result[0].Tags, t => t.Contains("Alice Smith") && t.Contains("01/15/2024 15:00"));
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithLiveNotes_TagUpdatedDateConvertsTimezone()
    {
        // Arrange — note with UpdatedBy staff and UpdatedDate; wall-clock time should be preserved
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        await SeedStaffAsync(
            new TucStaff { UcstId = 1, UcstFirstName = "Alice", UcstLastName = "Smith", CreatedBy = "test", LastModifiedBy = "test" },
            new TucStaff { UcstId = 2, UcstFirstName = "Bob", UcstLastName = "Jones", CreatedBy = "test", LastModifiedBy = "test" });
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedNotesAsync(new TucNote
        {
            NoteId = 1, JobId = 1, NoteText = "Updated tag TZ test",
            CreatedDate = new DateTime(2024, 1, 15, 2, 0, 0), CreatedBy = 1,
            UpdatedDate = new DateTime(2024, 1, 15, 15, 0, 0), UpdatedBy = 2,
            NoteTypeId = 1
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert — Updated tag should show preserved wall-clock date (01/15/2024 15:00)
        Assert.Single(result);
        Assert.Contains(result[0].Tags, t => t.Contains("Bob Jones") && t.Contains("01/15/2024 15:00"));
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithArchivedNotes_ReturnsNoteEntries()
    {
        // Arrange - no live job, so archived notes will be queried
        await SeedArchivedNotesAsync(new TucNoteArchive
        {
            NoteId = 1,
            JobId = 1,
            NoteText = "Archived note content",
            CreatedDate = new DateTime(2024, 1, 15, 9, 0, 0),
            NoteTypeId = 1
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Note added by System", result[0].Title);
        Assert.Equal("Archived note content", result[0].Description);
        Assert.Equal("sticky_note_2", result[0].Icon);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithArchivedNotes_ConvertsDatePropertyTimezone()
    {
        // Arrange — Notes store tenant local time, so wall-clock time should be preserved
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        await SeedArchivedNotesAsync(new TucNoteArchive
        {
            NoteId = 1, JobId = 1, NoteText = "Archived TZ test",
            CreatedDate = new DateTime(2024, 1, 15, 9, 0, 0),
            UpdatedDate = new DateTime(2024, 1, 15, 9, 0, 0),
            NoteTypeId = 1
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert — wall-clock time preserved (09:00 stays 09:00), only offset label applied
        Assert.Single(result);
        Assert.Equal(9, result[0].Date.Hour);
        Assert.Equal(TimeSpan.FromHours(13), result[0].Date.Offset);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithArchivedNotes_UsesUpdatedDateForDatePropertyWhenPresent()
    {
        // Arrange — UpdatedDate should take precedence over CreatedDate
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        await SeedArchivedNotesAsync(new TucNoteArchive
        {
            NoteId = 1, JobId = 1, NoteText = "Updated archived note",
            CreatedDate = new DateTime(2024, 1, 15, 2, 0, 0),
            UpdatedDate = new DateTime(2024, 1, 15, 9, 0, 0),
            NoteTypeId = 1
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert — should use UpdatedDate (09:00 local preserved), not CreatedDate
        Assert.Single(result);
        Assert.Equal(9, result[0].Date.Hour);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithArchivedNotes_TagDatesConvertTimezone()
    {
        // Arrange — wall-clock times should be preserved (no shifting, only offset label applied)
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        await SeedArchivedNotesAsync(new TucNoteArchive
        {
            NoteId = 1, JobId = 1, NoteText = "Archived tag TZ test",
            CreatedDate = new DateTime(2024, 1, 15, 15, 0, 0),
            UpdatedDate = new DateTime(2024, 1, 16, 15, 0, 0),
            NoteTypeId = 1
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert — tags should show preserved wall-clock dates (same day, not shifted)
        Assert.Single(result);
        Assert.Contains(result[0].Tags, t => t.Contains("Created on") && t.Contains("01/15/2024 15:00"));
        Assert.Contains(result[0].Tags, t => t.Contains("Updated on") && t.Contains("01/16/2024 15:00"));
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithArchivedNotes_FallsBackToMinDateWhenNoDates()
    {
        // Arrange — neither CreatedDate nor UpdatedDate set; uses default UTC timezone.
        // SQLite applies getdate() defaults on insert, so we clear them via raw SQL
        // to simulate the null-dates scenario.
        await SeedArchivedNotesAsync(new TucNoteArchive
        {
            NoteId = 1, JobId = 1, NoteText = "No dates note",
            NoteTypeId = 1
        });
        await using (var ctx = _db.CreateContext()) await ctx.Database.ExecuteSqlRawAsync("UPDATE TucNoteArchive SET CreatedDate = NULL, UpdatedDate = NULL WHERE NoteId = 1", cancellationToken: TestContext.Current.CancellationToken);
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert — should fall back to DateTime.MinValue with offset applied
        Assert.Single(result);
        Assert.Equal(DateTime.MinValue, result[0].Date.DateTime);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithEmailMessage_ReturnsEmailEntry()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedMessagesAsync(new TucManualMessage
        {
            UcmmId = 1,
            JobId = 1,
            Subject = "Delivery confirmation",
            UcmmMessage = "Your package has been delivered",
            UcmmDate = new DateTime(2024, 1, 15, 15, 0, 0),
            SendToEmailAddress = "customer@example.com"
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Delivery confirmation", result[0].Title);
        Assert.Equal("Your package has been delivered", result[0].Description);
        Assert.Contains("Email", result[0].Tags);
        Assert.Contains("Sent to customer@example.com", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithSmsMessage_ReturnsSmsEntry()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedMessagesAsync(new TucManualMessage
        {
            UcmmId = 1,
            JobId = 1,
            Subject = "SMS notification",
            UcmmMessage = "Your package is on the way",
            UcmmDate = new DateTime(2024, 1, 15, 12, 0, 0),
            SendToMobile = "+1234567890"
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Contains("SMS", result[0].Tags);
        Assert.Contains("Sent to +1234567890", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithMixedData_ReturnsSortedByDateDescending()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedEventsAsync(new TucEvent
        {
            UcevId = 1,
            UcevJobId = 1,
            UcevDescription = "Early task",
            UcevDate = new DateTime(2024, 1, 15),
            UcevTime = new DateTime(1, 1, 1, 8, 0, 0),
            UcevClosed = false,
            UcevDespatcher = "Admin"
        });
        await SeedMessagesAsync(new TucManualMessage
        {
            UcmmId = 1,
            JobId = 1,
            Subject = "Mid-day message",
            UcmmMessage = "Update",
            UcmmDate = new DateTime(2024, 1, 15, 12, 0, 0),
            SendToMobile = "+1234567890"
        });
        await SeedNotesAsync(new TucNote
        {
            NoteId = 1,
            JobId = 1,
            NoteText = "Late note",
            NoteTypeId = 1,
            CreatedDate = new DateTime(2024, 1, 15, 16, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Equal(3, result.Count);
        // Should be sorted descending by date
        Assert.Equal("Late note", result[0].Description); // 16:00
        Assert.Equal("Mid-day message", result[1].Title); // 12:00
        Assert.Equal("Early task", result[2].Title); // 08:00
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_NzTenant_UsesCorrectDateFormat()
    {
        // Arrange
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        // Don't seed in TucJobs so IsLiveJobAsync returns false (archived job path)
        // Archived notes have simpler tags that include date without navigation properties
        await SeedArchivedNotesAsync(new TucNoteArchive
        {
            NoteId = 1,
            JobId = 1,
            NoteText = "NZ formatted note",
            NoteTypeId = 1,
            CreatedDate = new DateTime(2024, 1, 15, 9, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        // NZ format: dd/MM/yyyy HH:mm - archived notes use "Created on {date}"
        Assert.Contains(result[0].Tags, t => t.Contains("15/01/2024"));
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_UsTenant_UsesCorrectDateFormat()
    {
        // Arrange
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
        // Don't seed in TucJobs so IsLiveJobAsync returns false (archived job path)
        // Archived notes have simpler tags that include date without navigation properties
        await SeedArchivedNotesAsync(new TucNoteArchive
        {
            NoteId = 1,
            JobId = 1,
            NoteText = "US formatted note",
            NoteTypeId = 1,
            CreatedDate = new DateTime(2024, 1, 15, 9, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        // US format: MM/dd/yyyy HH:mm - archived notes use "Created on {date}"
        Assert.Contains(result[0].Tags, t => t.Contains("01/15/2024"));
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_FiltersByJobId()
    {
        // Arrange - multiple jobs with events
        await SeedJobsAsync(
            new TucJob { UcjbId = 1 },
            new TucJob { UcjbId = 2 });
        await SeedEventsAsync(
            new TucEvent
            {
                UcevId = 1,
                UcevJobId = 1,
                UcevDescription = "Job 1 event",
                UcevDate = new DateTime(2024, 1, 15),
                UcevDespatcher = "Admin"
            },
            new TucEvent
            {
                UcevId = 2,
                UcevJobId = 2,
                UcevDescription = "Job 2 event",
                UcevDate = new DateTime(2024, 1, 15),
                UcevDespatcher = "Admin"
            });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Job 1 event", result[0].Title);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_GeneratesUniqueIds()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedEventsAsync(
            new TucEvent
            {
                UcevId = 1,
                UcevJobId = 1,
                UcevDescription = "Event 1",
                UcevDate = new DateTime(2024, 1, 15),
                UcevDespatcher = "Admin"
            },
            new TucEvent
            {
                UcevId = 2,
                UcevJobId = 1,
                UcevDescription = "Event 2",
                UcevDate = new DateTime(2024, 1, 15),
                UcevDespatcher = "Admin"
            });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.NotEqual(result[1].Id, result[0].Id);
        Assert.NotEqual(Guid.Empty, result[0].Id);
        Assert.NotEqual(Guid.Empty, result[1].Id);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_SetsCorrectJobIdOnAllEntries()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 42 });
        await SeedEventsAsync(new TucEvent
        {
            UcevId = 1,
            UcevJobId = 42,
            UcevDescription = "Test event",
            UcevDate = new DateTime(2024, 1, 15),
            UcevDespatcher = "Admin"
        });
        await SeedNotesAsync(new TucNote
        {
            NoteId = 1,
            JobId = 42,
            NoteText = "Test note",
            NoteTypeId = 1,
            CreatedDate = new DateTime(2024, 1, 15)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(42);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.All(result, e => Assert.Equal(42, e.JobId));
    }

    private async Task SeedStatusUpdatesAsync(params JobDeliveryJourney[] updates)
    {
        await using var context = _db.CreateContext();
        context.JobDeliveryJourneys.AddRange(updates);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithJobStatusChange_ReturnsStatusUpdateEntry()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobStatus",
            UpdatedByType = "Staff",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Status Changed", result[0].Title);
        Assert.Equal(1, result[0].JobId);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithCourierAssignment_ReturnsCourierEntry()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "CourierAssignment",
            UpdatedByType = "Staff",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Courier Assignment Changed", result[0].Title);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithAgentAssignment_ReturnsAgentEntry()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "AgentAssignment",
            UpdatedByType = "Staff",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Agent Assignment Changed", result[0].Title);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithJobUpdate_ReturnsFieldUpdateEntry()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobUpdate",
            UpdatedByType = "Staff",
            FieldName = "ucjbStatus",
            OldValue = "Booked",
            NewValue = "Dispatched",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Status Updated", result[0].Title);
        Assert.Contains("Status: Booked → Dispatched", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithJobUpdate_FormatsCurrencyFields()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobUpdate",
            UpdatedByType = "Staff",
            FieldName = "ucjbAmount",
            OldValue = "100.00",
            NewValue = "150.50",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Amount Updated", result[0].Title);
        // Currency formatting is locale-dependent, so check the tag contains the field name
        Assert.Contains(result[0].Tags, t => t.StartsWith("Amount:"));
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithJobUpdate_FormatsBooleanValues()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobUpdate",
            UpdatedByType = "Staff",
            FieldName = "ucjbVoid",
            OldValue = "False",
            NewValue = "True",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Voided Updated", result[0].Title);
        Assert.Contains("Voided: No → Yes", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithJobUpdate_ClearedField()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobUpdate",
            UpdatedByType = "Staff",
            FieldName = "ucjbClientRefa",
            OldValue = "REF-123",
            NewValue = null,
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Contains("Client Ref A: REF-123 → (cleared)", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithJobUpdate_NewFieldValueOnly()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobUpdate",
            UpdatedByType = "Staff",
            FieldName = "Connote",
            OldValue = null,
            NewValue = "CON-456",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Contains("Connote: CON-456", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_FiltersOutInternalStatusChanges()
    {
        // Arrange - InternalStatus should be filtered out
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(
            new JobDeliveryJourney
            {
                JourneyId = 1,
                JobId = 1,
                ChangeType = "InternalStatus",
                UpdatedByType = "Staff",
                UpdatedAt = new DateTime(2024, 1, 15, 13, 0, 0)
            },
            new JobDeliveryJourney
            {
                JourneyId = 2,
                JobId = 1,
                ChangeType = "JobUpdate",
                UpdatedByType = "Staff",
                FieldName = "ucjbLocked",
                NewValue = "True",
                UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
            });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert - only the JobUpdate should be returned, not InternalStatus
        Assert.Single(result);
        Assert.Equal("Locked Updated", result[0].Title);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_GroupsByTimestamp()
    {
        // Arrange - two updates at the same timestamp should be grouped
        var sharedTimestamp = new DateTime(2024, 1, 15, 14, 0, 0);
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(
            new JobDeliveryJourney
            {
                JourneyId = 1,
                JobId = 1,
                ChangeType = "JobUpdate",
                UpdatedByType = "Staff",
                FieldName = "ucjbStatus",
                NewValue = "Dispatched",
                UpdatedAt = sharedTimestamp
            },
            new JobDeliveryJourney
            {
                JourneyId = 2,
                JobId = 1,
                ChangeType = "JobUpdate",
                UpdatedByType = "Staff",
                FieldName = "ucjbCourierId",
                NewValue = "5",
                UpdatedAt = sharedTimestamp
            });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert - both updates at same timestamp should be grouped into one entry
        Assert.Single(result);
        Assert.Contains(result[0].Tags, t => t.StartsWith("Status:"));
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_MultipleStatusUpdatesAtDifferentTimes()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(
            new JobDeliveryJourney
            {
                JourneyId = 1,
                JobId = 1,
                ChangeType = "JobUpdate",
                UpdatedByType = "Staff",
                FieldName = "ucjbAmount",
                NewValue = "100.00",
                UpdatedAt = new DateTime(2024, 1, 15, 10, 0, 0)
            },
            new JobDeliveryJourney
            {
                JourneyId = 2,
                JobId = 1,
                ChangeType = "JobUpdate",
                UpdatedByType = "Staff",
                FieldName = "ucjbWeight",
                NewValue = "5.50",
                UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
            });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert - different timestamps = separate entries
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithJobUpdate_FormatsWeightField()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobUpdate",
            UpdatedByType = "Staff",
            FieldName = "ucjbWeight",
            OldValue = "2.50",
            NewValue = "5.75",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Weight Updated", result[0].Title);
        Assert.Contains("Weight: 2.50 kg → 5.75 kg", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithJobUpdate_FormatsDistanceField()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobUpdate",
            UpdatedByType = "Staff",
            FieldName = "ucjbKm",
            NewValue = "12.3",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Distance (km) Updated", result[0].Title);
        Assert.Contains("Distance (km): 12.3 km", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_StatusUpdates_IntegrateWithOtherEntries()
    {
        // Arrange - status update + event + note should all appear
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobUpdate",
            UpdatedByType = "Staff",
            FieldName = "ucjbAttention",
            NewValue = "True",
            UpdatedAt = new DateTime(2024, 1, 15, 8, 0, 0)
        });
        await SeedNotesAsync(new TucNote
        {
            NoteId = 1,
            JobId = 1,
            NoteText = "Flagged for attention",
            NoteTypeId = 1,
            CreatedDate = new DateTime(2024, 1, 15, 9, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, e => e.Title == "Attention Flag Updated");
        Assert.Contains(result, e => e.Description == "Flagged for attention");
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_FormatsAddressFieldNames()
    {
        // Arrange
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobUpdate",
            UpdatedByType = "Staff",
            FieldName = "ucjbFromAddr",
            OldValue = "123 Old St",
            NewValue = "456 New Ave",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        Assert.Equal("Pickup Address Updated", result[0].Title);
        Assert.Contains("Pickup Address: 123 Old St → 456 New Ave", result[0].Tags);
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_FormatsCamelCaseFieldNames()
    {
        // Arrange - unknown camelCase field should use ConvertToTitleCase fallback
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        await SeedStatusUpdatesAsync(new JobDeliveryJourney
        {
            JourneyId = 1,
            JobId = 1,
            ChangeType = "JobUpdate",
            UpdatedByType = "Staff",
            FieldName = "CustomNewField",
            NewValue = "SomeValue",
            UpdatedAt = new DateTime(2024, 1, 15, 14, 0, 0)
        });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        Assert.Single(result);
        // ConvertToTitleCase should split camelCase: "CustomNewField" -> "Custom New Field"
        Assert.Equal("Custom New Field Updated", result[0].Title);
    }

}
