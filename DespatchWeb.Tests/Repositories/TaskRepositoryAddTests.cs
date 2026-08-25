using DespatchWeb.EntityClasses;
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
}
