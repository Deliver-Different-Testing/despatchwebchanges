using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for DeliveryJourneyService - tests delivery journey timeline building.
/// Note: Full integration tests with a real database are recommended to test the complex
/// LINQ queries and entity relationships. These tests validate service construction,
/// interface contracts, and basic behavior with mocked dependencies.
/// </summary>
public class DeliveryJourneyServiceTests : IDisposable
{
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly string _databaseName;

    public DeliveryJourneyServiceTests()
    {
        _databaseName = Guid.NewGuid().ToString();

        // Default tenant info setup
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("UTC");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
        _tenantInfoServiceMock.Setup(x => x.ConvertUtcToTenantTimeZone(It.IsAny<DateTime>()))
            .Returns((DateTime dt) => new DateTimeOffset(dt, TimeSpan.Zero));
    }

    public void Dispose()
    {
        // Cleanup if needed
        GC.SuppressFinalize(this);
    }

    private DbContextOptions<DespatchContext> CreateDbContextOptions() =>
        new DbContextOptionsBuilder<DespatchContext>()
            .UseInMemoryDatabase(_databaseName)
            .Options;

    private IDbContextFactory<DespatchContext> CreateContextFactory()
    {
        var options = CreateDbContextOptions();
        var factoryMock = new Mock<IDbContextFactory<DespatchContext>>();
        factoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(options));
        return factoryMock.Object;
    }

    private DeliveryJourneyService CreateService() => new(
        CreateContextFactory(),
        _tenantInfoServiceMock.Object
    );

    private async Task SeedJobsAsync(params TucJob[] jobs)
    {
        var options = CreateDbContextOptions();
        await using var context = new DespatchContext(options);
        context.TucJobs.AddRange(jobs);
        await context.SaveChangesAsync();
    }

    private async Task SeedEventsAsync(params TucEvent[] events)
    {
        var options = CreateDbContextOptions();
        await using var context = new DespatchContext(options);
        context.TucEvents.AddRange(events);
        await context.SaveChangesAsync();
    }

    private async Task SeedNotesAsync(params TucNote[] notes)
    {
        var options = CreateDbContextOptions();
        await using var context = new DespatchContext(options);
        context.TucNotes.AddRange(notes);
        await context.SaveChangesAsync();
    }

    private async Task SeedArchivedNotesAsync(params TucNoteArchive[] notes)
    {
        var options = CreateDbContextOptions();
        await using var context = new DespatchContext(options);
        context.TucNoteArchives.AddRange(notes);
        await context.SaveChangesAsync();
    }

    private async Task SeedMessagesAsync(params TucManualMessage[] messages)
    {
        var options = CreateDbContextOptions();
        await using var context = new DespatchContext(options);
        context.TucManualMessages.AddRange(messages);
        await context.SaveChangesAsync();
    }

    #region Constructor Tests

    [Fact]
    public void Constructor_WithValidDependencies_CreatesService()
    {
        // Act
        var service = CreateService();

        // Assert
        service.Should().NotBeNull();
        service.Should().BeAssignableTo<IDeliveryJourneyService>();
    }

    #endregion

    #region GetDeliveryJourneyForJobAsync - Basic Tests

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithNoData_ReturnsEmptyList()
    {
        // Arrange - seed a live job but no journey data
        await SeedJobsAsync(new TucJob { UcjbId = 1 });
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(1);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_WithArchivedJob_ReturnsEmptyListWhenNoData()
    {
        // Arrange - no live job seeded, so job is treated as archived
        var service = CreateService();

        // Act
        var result = await service.GetDeliveryJourneyForJobAsync(999);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeEmpty();
    }

    #endregion

    #region GetDeliveryJourneyForJobAsync - Tasks (Events)

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
        result.Should().HaveCount(1);
        result[0].Title.Should().Be("Call customer");
        result[0].Icon.Should().Be("task");
        result[0].Tags.Should().Contain("Task");
        result[0].Tags.Should().Contain("In Progress");
        result[0].Tags.Should().Contain("Created by John Doe");
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
        result.Should().HaveCount(1);
        result[0].Tags.Should().Contain("Completed");
        result[0].Tags.Should().Contain("Created by Jane Smith");
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
        result.Should().HaveCount(2);
        result.Should().Contain(e => e.Title == "First task");
        result.Should().Contain(e => e.Title == "Second task");
    }

    #endregion

    #region GetDeliveryJourneyForJobAsync - Notes (Live)

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
        result.Should().HaveCount(1);
        result[0].Title.Should().Be("Note added by System");
        result[0].Description.Should().Be("Customer called about delivery");
        result[0].Icon.Should().Be("sticky_note_2");
        result[0].Tags.Should().Contain("Note");
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
        result.Should().HaveCount(2);
        result.Should().Contain(n => n.Description == "First note");
        result.Should().Contain(n => n.Description == "Second note");
    }

    #endregion

    #region GetDeliveryJourneyForJobAsync - Notes (Archived)

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
        result.Should().HaveCount(1);
        result[0].Title.Should().Be("Note added by System");
        result[0].Description.Should().Be("Archived note content");
        result[0].Icon.Should().Be("sticky_note_2");
    }

    #endregion

    #region GetDeliveryJourneyForJobAsync - Messages

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
        result.Should().HaveCount(1);
        result[0].Title.Should().Be("Delivery confirmation");
        result[0].Description.Should().Be("Your package has been delivered");
        result[0].Tags.Should().Contain("Email");
        result[0].Tags.Should().Contain("Sent to customer@example.com");
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
        result.Should().HaveCount(1);
        result[0].Tags.Should().Contain("SMS");
        result[0].Tags.Should().Contain("Sent to +1234567890");
    }

    #endregion

    #region GetDeliveryJourneyForJobAsync - Combined Results & Ordering

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
        result.Should().HaveCount(3);
        // Should be sorted descending by date
        result[0].Description.Should().Be("Late note"); // 16:00
        result[1].Title.Should().Be("Mid-day message"); // 12:00
        result[2].Title.Should().Be("Early task"); // 08:00
    }

    #endregion

    #region GetDeliveryJourneyForJobAsync - Tenant Configuration

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
        result.Should().HaveCount(1);
        // NZ format: dd/MM/yyyy HH:mm - archived notes use "Created on {date}"
        result[0].Tags.Should().Contain(t => t.Contains("15/01/2024"));
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
        result.Should().HaveCount(1);
        // US format: MM/dd/yyyy HH:mm - archived notes use "Created on {date}"
        result[0].Tags.Should().Contain(t => t.Contains("01/15/2024"));
    }

    #endregion

    #region GetDeliveryJourneyForJobAsync - Edge Cases

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
        result.Should().HaveCount(1);
        result[0].Title.Should().Be("Job 1 event");
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
        result.Should().HaveCount(2);
        result[0].Id.Should().NotBe(result[1].Id);
        result[0].Id.Should().NotBe(Guid.Empty);
        result[1].Id.Should().NotBe(Guid.Empty);
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
        result.Should().HaveCount(2);
        result.Should().OnlyContain(e => e.JobId == 42);
    }

    #endregion
}
