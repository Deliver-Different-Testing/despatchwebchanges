using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for TaskRepository.ReassignEventToUserAsync - sets the assigned staff member,
/// audits the change on the event, and records a delivery-journey entry on the job
/// (mirroring the unassign path). Uses a SQLite in-memory database (foreign keys are
/// off, so related rows only need to exist where a navigation is read).
/// </summary>
public class TaskRepositoryReassignTests : IAsyncDisposable
{
    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _infoServiceMock = Substitute.For<ITenantInfoService>();

    public TaskRepositoryReassignTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);
        _infoServiceMock.GetStaffId().Returns(99);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private TaskRepository CreateRepository() => new(_contextFactoryMock, _infoServiceMock, _clock);

    private static TucStaff Staff(int id, string first, string last) => new()
    {
        UcstId = id,
        UcstFirstName = first,
        UcstLastName = last,
        CreatedBy = "test",
        LastModifiedBy = "test"
    };

    private async Task SeedAsync(
        TucStaff[]? staff = null,
        TucEventType[]? eventTypes = null,
        TucEvent[]? events = null)
    {
        await using var context = _db.CreateContext();
        if (staff is not null)
        {
            context.TucStaffs.AddRange(staff);
        }

        if (eventTypes is not null)
        {
            context.TucEventTypes.AddRange(eventTypes);
        }

        if (events is not null)
        {
            context.TucEvents.AddRange(events);
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ReassignEventToUserAsync_ChangesStaff_Audits_AndRecordsJourney()
    {
        await SeedAsync(
            staff: [Staff(7, "John", "Doe"), Staff(8, "Jane", "Roe")],
            eventTypes: [new TucEventType { UcetId = 3, UcetName = "Delivery" }],
            events:
            [
                new TucEvent
                {
                    UcevId = 1,
                    UcevStaffIdin = 7,
                    UcevJobId = 555,
                    UcevType = 3,
                    UcevDueTime = TestDates.Now,
                    UcevClosed = false
                }
            ]);

        var repository = CreateRepository();

        await repository.ReassignEventToUserAsync(1, 8);

        await using var assertContext = _db.CreateContext();

        var updatedEvent = await assertContext.TucEvents.SingleAsync(e => e.UcevId == 1,
            TestContext.Current.CancellationToken);
        Assert.Equal(8, updatedEvent.UcevStaffIdin);

        var audit = await assertContext.TucEventAudits.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(1, audit.UceaEventId);
        Assert.Equal("UcevStaffIdin", audit.UceaColumnName);
        Assert.Equal("7", audit.UceaOldValue);
        Assert.Equal("8", audit.UceaNewValue);

        var journey = await assertContext.JobDeliveryJourneys.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(555, journey.JobId);
        Assert.Equal(nameof(DeliveryJourneyChangeType.JobUpdate), journey.ChangeType);
        Assert.Equal("TaskAssignment", journey.FieldName);
        Assert.Equal("John Doe", journey.OldValue);
        Assert.Equal("Jane Roe", journey.NewValue);
        Assert.Equal(99, journey.StaffId);
        Assert.Equal(nameof(DeliveryJourneyUpdatedByType.Staff), journey.UpdatedByType);
        Assert.Equal("Task 'Delivery' reassigned from John Doe to Jane Roe", journey.Comments);
    }

    [Fact]
    public async Task ReassignEventToUserAsync_FromUnassigned_RecordsJourneyWithNullOldValue()
    {
        await SeedAsync(
            staff: [Staff(8, "Jane", "Roe")],
            eventTypes: [new TucEventType { UcetId = 3, UcetName = "Delivery" }],
            events:
            [
                new TucEvent
                {
                    UcevId = 1,
                    UcevStaffIdin = null,
                    UcevJobId = 555,
                    UcevType = 3,
                    UcevDueTime = TestDates.Now,
                    UcevClosed = false
                }
            ]);

        var repository = CreateRepository();

        await repository.ReassignEventToUserAsync(1, 8);

        await using var assertContext = _db.CreateContext();

        var journey = await assertContext.JobDeliveryJourneys.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Null(journey.OldValue);
        Assert.Equal("Jane Roe", journey.NewValue);
        Assert.Equal("Task 'Delivery' assigned to Jane Roe", journey.Comments);

        var audit = await assertContext.TucEventAudits.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal("null", audit.UceaOldValue);
        Assert.Equal("8", audit.UceaNewValue);
    }

    [Fact]
    public async Task ReassignEventToUserAsync_SameStaff_IsNoOp()
    {
        await SeedAsync(
            staff: [Staff(8, "Jane", "Roe")],
            events:
            [
                new TucEvent
                {
                    UcevId = 1,
                    UcevStaffIdin = 8,
                    UcevJobId = 555,
                    UcevDueTime = TestDates.Now,
                    UcevClosed = false
                }
            ]);

        var repository = CreateRepository();

        await repository.ReassignEventToUserAsync(1, 8);

        await using var assertContext = _db.CreateContext();
        Assert.Empty(assertContext.TucEventAudits);
        Assert.Empty(assertContext.JobDeliveryJourneys);
    }

    [Fact]
    public async Task ReassignEventToUserAsync_EventWithoutJob_AuditsButNoJourney()
    {
        await SeedAsync(
            staff: [Staff(7, "John", "Doe"), Staff(8, "Jane", "Roe")],
            events:
            [
                new TucEvent
                {
                    UcevId = 1,
                    UcevStaffIdin = 7,
                    UcevJobId = null,
                    UcevDueTime = TestDates.Now,
                    UcevClosed = false
                }
            ]);

        var repository = CreateRepository();

        await repository.ReassignEventToUserAsync(1, 8);

        await using var assertContext = _db.CreateContext();

        var updatedEvent = await assertContext.TucEvents.SingleAsync(e => e.UcevId == 1,
            TestContext.Current.CancellationToken);
        Assert.Equal(8, updatedEvent.UcevStaffIdin);
        Assert.Single(assertContext.TucEventAudits);
        Assert.Empty(assertContext.JobDeliveryJourneys);
    }

    [Fact]
    public async Task ReassignEventToUserAsync_EventNotFound_Throws()
    {
        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArgumentException>(() => repository.ReassignEventToUserAsync(999, 8));
    }
}