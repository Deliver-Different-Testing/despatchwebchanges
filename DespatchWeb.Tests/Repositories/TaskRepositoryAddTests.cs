using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the two add-task paths (<see cref="TaskRepository.CreateEventsForJobAsync"/> and
/// <see cref="TaskRepository.AddEventAsync"/>). They assert that every value written to a
/// length-constrained <c>tucEvent</c> column is clipped to fit, so an over-length insert can't
/// raise SQL Server error 8152 (the cause of the "adding a task gets a 500" bug). SQLite doesn't
/// enforce varchar length, so these tests verify the app-level invariant (written length ≤ column
/// max) rather than relying on the provider to reject the row.
/// </summary>
public class TaskRepositoryAddTests : IAsyncDisposable
{
    private const int DespatcherMax = 15;
    private const int ContactMax = 30;
    private const int NotesMax = 1000;

    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _infoServiceMock = Substitute.For<ITenantInfoService>();

    public TaskRepositoryAddTests()
    {
        // Stand-in for the tenant timezone conversion: a fixed NZST (+12) tenant.
        _infoServiceMock.ConvertTenantTimeToUtc(Arg.Any<DateTime>()).Returns(c => c.Arg<DateTime>().AddHours(-12));
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    // CreateEventsForJobAsync opens two contexts in parallel, so use the per-call factory mock.
    private TaskRepository CreateRepository() =>
        new(_db.CreateFactoryMock(), _infoServiceMock, _clock);

    private async Task SeedAsync(params object[] entities)
    {
        await using var context = _db.CreateContext();
        context.AddRange(entities);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static TucStaff Staff(int id, string first, string last) => new()
    {
        UcstId = id,
        UcstFirstName = first,
        UcstLastName = last,
        CreatedBy = "test",
        LastModifiedBy = "test"
    };

    private static TucJob Job(int id, string contact) => new()
    {
        UcjbId = id,
        UcjbNumber = "JOB001",
        UcjbClientId = 42,
        UcjbContact = contact
    };

    private async Task<TucEvent> SingleEventAsync()
    {
        await using var context = _db.CreateContext();
        return await context.TucEvents.SingleAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CreateEventsForJobAsync_TruncatesDespatcherContactAndNotes_ToColumnLimits()
    {
        // "Christopher Anderson" (20) overflows ucevDespatcher (15); the contact and notes overflow
        // their columns too. All three must be clipped, not passed through as an 8152 landmine.
        _infoServiceMock.GetStaffId().Returns(7);
        await SeedAsync(
            Staff(7, "Christopher", "Anderson"),
            Job(555, contact: new string('c', 50)));

        var eventGroup = new EventGroupViewModel
        {
            EventType = new Suggestion { Id = 3, Text = "Delivery" },
            Notes = new string('x', 1200)
        };

        await CreateRepository().CreateEventsForJobAsync(555, [eventGroup]);

        var created = await SingleEventAsync();
        Assert.Equal("Christopher And", created.UcevDespatcher);
        Assert.True(created.UcevDespatcher!.Length <= DespatcherMax);
        Assert.True(created.UcevContact!.Length <= ContactMax);
        Assert.True(created.UcevNotes!.Length <= NotesMax);
        Assert.StartsWith(created.UcevContact, new string('c', 50));
        Assert.StartsWith(created.UcevNotes, new string('x', 1200));
    }

    [Fact]
    public async Task CreateEventsForJobAsync_ShortValues_StoredUnchanged()
    {
        _infoServiceMock.GetStaffId().Returns(7);
        await SeedAsync(
            Staff(7, "Jo", "Bloggs"),
            Job(556, contact: "Front desk"));

        var eventGroup = new EventGroupViewModel
        {
            EventType = new Suggestion { Id = 3, Text = "Delivery" },
            Notes = "Call on arrival"
        };

        await CreateRepository().CreateEventsForJobAsync(556, [eventGroup]);

        var created = await SingleEventAsync();
        Assert.Equal("Jo Bloggs", created.UcevDespatcher);
        Assert.Equal("Front desk", created.UcevContact);
        Assert.Equal("Call on arrival", created.UcevNotes);
    }

    [Fact]
    public async Task CreateEventsForJobAsync_StampsCreatedAtUtc_FromUtcClock()
    {
        _infoServiceMock.GetStaffId().Returns(7);
        await SeedAsync(Staff(7, "Jo", "Bloggs"), Job(558, contact: "Front desk"));

        await CreateRepository().CreateEventsForJobAsync(558,
            [new EventGroupViewModel { EventType = new Suggestion { Id = 3, Text = "Delivery" } }]);

        var created = await SingleEventAsync();
        Assert.Equal(_clock.UtcNow, created.UcevCreatedAtUtc);
    }

    [Fact]
    public async Task AddEventAsync_StampsCreatedAtUtc_FromUtcClock()
    {
        _infoServiceMock.GetStaffId().Returns(7);
        _infoServiceMock.GetStaffInfoAsync().Returns(new Suggestion { Id = 7, Text = "Jo Bloggs" });
        await SeedAsync(Job(559, contact: "Front desk"));

        await CreateRepository().AddEventAsync(559, notes: "Chase POD", eventType: 3);

        var created = await SingleEventAsync();
        Assert.Equal(_clock.UtcNow, created.UcevCreatedAtUtc);
    }

    [Fact]
    public async Task AddEventAsync_TruncatesDespatcher_ToColumnLimit()
    {
        _infoServiceMock.GetStaffId().Returns(7);
        _infoServiceMock.GetStaffInfoAsync()
            .Returns(new Suggestion { Id = 7, Text = "Christopher Anderson" });
        await SeedAsync(Job(557, contact: "Front desk"));

        await CreateRepository().AddEventAsync(557, notes: "Chase POD", eventType: 3);

        var created = await SingleEventAsync();
        Assert.Equal("Christopher And", created.UcevDespatcher);
        Assert.True(created.UcevDespatcher!.Length <= DespatcherMax);
    }

    [Fact]
    public async Task AddEventAsync_LeavesTaskUnassigned_ButRecordsTheCreator()
    {
        _infoServiceMock.GetStaffId().Returns(7);
        _infoServiceMock.GetStaffInfoAsync()
            .Returns(new Suggestion { Id = 7, Text = "Christopher Anderson" });
        await SeedAsync(Job(558, contact: "Front desk"));

        await CreateRepository().AddEventAsync(558, notes: "Chase POD", eventType: 3);

        var created = await SingleEventAsync();
        Assert.Null(created.UcevStaffIdin);
        Assert.Equal(7, created.UcevOriginator);
        Assert.Equal("Christopher And", created.UcevDespatcher);
    }

    [Fact]
    public async Task CreateEventsForJobAsync_WritesDueTimeUtc_FromTenantWallClock()
    {
        _infoServiceMock.GetStaffId().Returns(7);
        await SeedAsync(Staff(7, "Jo", "Bloggs"), Job(560, contact: "Front desk"), new TucJob { UcjbId = 561, UcjbNumber = "JOB002", UcjbClientId = 42, UcjbContact = "Front desk" });
        var due = new DateTime(2024, 6, 20, 9, 0, 0);

        await CreateRepository().CreateEventsForJobAsync(560,
            [new EventGroupViewModel { EventType = new Suggestion { Id = 3, Text = "Delivery" }, DueTime = due }]);
        await CreateRepository().CreateEventsForJobAsync(561,
            [new EventGroupViewModel { EventType = new Suggestion { Id = 3, Text = "Delivery" } }]);

        await using var context = _db.CreateContext();
        var events = await context.TucEvents.OrderBy(e => e.UcevJobId).ToListAsync(TestContext.Current.CancellationToken);
        Assert.Equal(due, events[0].UcevDueTime);
        Assert.Equal(due.AddHours(-12), events[0].UcevDueTimeUtc);
        Assert.Equal(_clock.TenantNow, events[1].UcevDueTime);
        Assert.Equal(_clock.TenantNow.AddHours(-12), events[1].UcevDueTimeUtc);
    }

    [Fact]
    public async Task AddEventAsync_WritesEtaAndDueTimeUtc_FromTenantWallClock()
    {
        _infoServiceMock.GetStaffId().Returns(7);
        _infoServiceMock.GetStaffInfoAsync().Returns(new Suggestion { Id = 7, Text = "Jo Bloggs" });
        await SeedAsync(Job(562, contact: "Front desk"));
        var due = new DateTimeOffset(2024, 6, 20, 9, 0, 0, TimeSpan.FromHours(12));
        var eta = new DateTimeOffset(2024, 6, 20, 15, 30, 0, TimeSpan.FromHours(12));

        await CreateRepository().AddEventAsync(562, notes: "Chase POD", eventType: 3, dueDate: due, etaTime: eta);

        var created = await SingleEventAsync();
        Assert.Equal(due.DateTime.AddHours(-12), created.UcevDueTimeUtc);
        Assert.Equal(eta.DateTime.AddHours(-12), created.UcevEtatimeUtc);
        Assert.Null(created.UcevResponseTimeUtc);
    }

    [Fact]
    public async Task AddEventAsync_NoEtaOrDueDate_LeavesEtaUtcNull_AndDefaultsDueTimeUtcToNow()
    {
        _infoServiceMock.GetStaffId().Returns(7);
        _infoServiceMock.GetStaffInfoAsync().Returns(new Suggestion { Id = 7, Text = "Jo Bloggs" });
        await SeedAsync(Job(563, contact: "Front desk"));

        await CreateRepository().AddEventAsync(563, notes: "Chase POD", eventType: 3);

        var created = await SingleEventAsync();
        Assert.Null(created.UcevEtatimeUtc);
        Assert.Equal(_clock.TenantNow.AddHours(-12), created.UcevDueTimeUtc);
    }

    [Fact]
    public async Task AddEventAsync_AutomaticResponse_WritesResponseTimeUtc()
    {
        _infoServiceMock.GetStaffId().Returns(7);
        _infoServiceMock.GetStaffInfoAsync().Returns(new Suggestion { Id = 7, Text = "Jo Bloggs" });
        await SeedAsync(
            new TucJob { UcjbId = 564, UcjbNumber = "JOB001", UcjbClientId = 42, UcjbContact = "x", UcjbSpeed = 5 },
            new TblClientContactJobType { ClientContactJobTypeId = 1, ClientContactId = 1, JobTypeId = 5, PickupType = "Web", DeliveryType = "Web", CreatedBy = "test", LastModifiedBy = "test" });

        await CreateRepository().AddEventAsync(564, notes: "Late", eventType: (int)EventType.LatePickUp);

        var created = await SingleEventAsync();
        Assert.Equal(_clock.TenantNow, created.UcevResponseTime);
        Assert.Equal(_clock.TenantNow.AddHours(-12), created.UcevResponseTimeUtc);
    }

    [Fact]
    public async Task UpdateEventDueTimeAsync_KeepsDueTimeUtcInSyncWithWallClock()
    {
        _infoServiceMock.GetStaffId().Returns(7);
        await SeedAsync(Staff(7, "Jo", "Bloggs"), Job(565, contact: "Front desk"));
        await SeedAsync(new TucEvent
        {
            UcevId = 1, UcevJobId = 565, UcevDueTime = new DateTime(2024, 6, 1, 9, 0, 0),
            UcevDueTimeUtc = new DateTime(2024, 5, 31, 21, 0, 0)
        });
        var newDue = new DateTimeOffset(2024, 6, 20, 9, 0, 0, TimeSpan.FromHours(12));

        await CreateRepository().UpdateEventDueTimeAsync(1, newDue);

        var updated = await SingleEventAsync();
        Assert.Equal(newDue.DateTime, updated.UcevDueTime);
        Assert.Equal(newDue.DateTime.AddHours(-12), updated.UcevDueTimeUtc);
    }
}
