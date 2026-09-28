using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for TaskRepository.UnassignEventAsync - clears the assigned staff member,
/// audits the change on the event, and records a delivery-journey entry on the job.
/// Uses a SQLite in-memory database (foreign keys are off, so related rows only need
/// to exist where a navigation is read).
/// </summary>
public class TaskRepositoryUnassignTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _infoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public TaskRepositoryUnassignTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);
        _infoServiceMock.GetStaffId().Returns(99);
        _infoServiceMock.GetStaffIdOrNull().Returns(99);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private TaskRepository CreateRepository() => new(_contextFactoryMock, _infoServiceMock, _clock);

    private async Task SeedStaffAsync(params TucStaff[] staff)
    {
        await using var context = _db.CreateContext();
        context.TucStaffs.AddRange(staff);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task SeedEventsAsync(params TucEvent[] events)
    {
        await using var context = _db.CreateContext();
        context.TucEvents.AddRange(events);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task UnassignEventAsync_ClearsStaff_AuditsChange_AndRecordsJourney()
    {
        await SeedStaffAsync(new TucStaff
        {
            UcstId = 7,
            UcstFirstName = "John",
            UcstLastName = "Doe",
            CreatedBy = "test",
            LastModifiedBy = "test"
        });
        await SeedEventsAsync(new TucEvent
        {
            UcevId = 1,
            UcevStaffIdin = 7,
            UcevJobId = 555,
            UcevDueTime = TestDates.Now,
            UcevClosed = false
        });

        var repository = CreateRepository();

        await repository.UnassignEventAsync(1);

        await using var assertContext = _db.CreateContext();

        var updatedEvent = await assertContext.TucEvents.SingleAsync(e => e.UcevId == 1,
            TestContext.Current.CancellationToken);
        Assert.Null(updatedEvent.UcevStaffIdin);

        var audit = await assertContext.TucEventAudits.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(1, audit.UceaEventId);
        Assert.Equal("UcevStaffIdin", audit.UceaColumnName);
        Assert.Equal("7", audit.UceaOldValue);
        Assert.Equal("null", audit.UceaNewValue);

        var journey = await assertContext.JobDeliveryJourneys.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(555, journey.JobId);
        Assert.Equal(nameof(DeliveryJourneyChangeType.JobUpdate), journey.ChangeType);
        Assert.Equal("TaskAssignment", journey.FieldName);
        Assert.Equal("John Doe", journey.OldValue);
        Assert.Null(journey.NewValue);
        Assert.Equal(99, journey.StaffId);
        Assert.Equal(nameof(DeliveryJourneyUpdatedByType.Staff), journey.UpdatedByType);
    }

    [Fact]
    public async Task UnassignEventAsync_AlreadyUnassigned_IsNoOp()
    {
        await SeedEventsAsync(new TucEvent
        {
            UcevId = 2,
            UcevStaffIdin = null,
            UcevJobId = 555,
            UcevDueTime = TestDates.Now,
            UcevClosed = false
        });

        var repository = CreateRepository();

        await repository.UnassignEventAsync(2);

        await using var assertContext = _db.CreateContext();
        Assert.Empty(assertContext.TucEventAudits);
        Assert.Empty(assertContext.JobDeliveryJourneys);
    }

    [Fact]
    public async Task UnassignEventAsync_EventNotFound_Throws()
    {
        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArgumentException>(() => repository.UnassignEventAsync(999));
    }
}
