using DespatchWeb.EntityClasses;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the static ApplyFilters method and ProjectToTaskViewModel projection in TaskRepository.
/// Date filter tests use in-memory queryable (SQLite cannot translate DateTimeOffset-to-DateTime
/// comparisons that SQL Server handles implicitly).
/// SearchText tests use SQLite since EF.Functions.Like requires a real database provider.
/// </summary>
public class TaskRepositoryTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private static readonly int[] Expected = [4, 7, 9];

    // Stand-in for ITenantInfoService.ConvertTenantTimeToUtc: a fixed NZST (+12) tenant.
    private static DateTime NzToUtc(DateTime tenantLocal) => tenantLocal.AddHours(-12);

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private async Task SeedEventsAsync(params TucEvent[] events)
    {
        await using var context = _db.CreateContext();
        context.TucEvents.AddRange(events);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<TucEvent>> ApplyFiltersViaSqliteAsync(TaskTableFiltersRequest filters)
    {
        await using var context = _db.CreateContext();
        var query = context.TucEvents.AsQueryable();
        var filtered = TaskRepository.ApplyFilters(query, filters, NzToUtc);
        return await filtered.ToListAsync(TestContext.Current.CancellationToken);
    }

    private static List<TucEvent> ApplyFiltersInMemory(
        IEnumerable<TucEvent> events,
        TaskTableFiltersRequest filters)
    {
        var query = events.AsQueryable();
        var filtered = TaskRepository.ApplyFilters(query, filters, NzToUtc);
        return [.. filtered];
    }

    private static TucEvent CreateEvent(int id, Action<TucEvent>? configure = null)
    {
        var ev = new TucEvent
        {
            UcevId = id,
            UcevDueTime = new DateTime(2025, 6, 15, 12, 0, 0),
            UcevClosed = false,
            UcevDescription = $"Event {id}",
            UcevNotes = $"Notes {id}",
            UcevDespatcher = $"Despatcher {id}"
        };
        configure?.Invoke(ev);
        return ev;
    }

    private static TaskViewModel ProjectInMemory(TucEvent ev) =>
        new[] { ev }.AsQueryable().Select(TaskRepository.ProjectToTaskViewModel).Single();

    private static TucEvent CreateEventWithGroup(int id, string group) =>
        CreateEvent(id, e => e.UcevTypeNavigation = new TucEventType { UcetGroup = group });

    [Fact]
    public void ApplyTaskGroupFilter_ShowsCustomerServiceGeneralAndPartnerTaskGroups()
    {
        // The "Add Task" dialog (JobRepository.EventTypeListAsync) offers CS, GE and PT event
        // types, so the task list must surface all three — otherwise a task the user creates with
        // a 'GE' type (e.g. "dispatch to check pickup") is saved but never shown.
        var events = new[]
        {
            CreateEventWithGroup(1, "CS"),
            CreateEventWithGroup(2, "PT"),
            CreateEventWithGroup(3, "GE"),
            CreateEventWithGroup(4, "CE"),
            CreateEventWithGroup(5, "OE")
        };

        var results = TaskRepository.ApplyTaskGroupFilter(events.AsQueryable())
            .Select(e => e.UcevId)
            .OrderBy(id => id)
            .ToList();

        Assert.Equal(new[] { 1, 2, 3 }, results);
    }

    [Fact]
    public void ProjectToTaskViewModel_MapsCourierAndClientCodeFromJob()
    {
        var ev = CreateEvent(1, e => e.UcevJob = new TucJob
        {
            UcjbNumber = "JOB-001",
            UcjbClientCode = "ACME",
            UcjbCourier = new TucCourier
            {
                Code = "ABC123",
                UccrName = "John",
                UccrSurname = "Smith"
            }
        });

        var task = ProjectInMemory(ev);

        Assert.Equal("ABC123", task.CourierCode);
        Assert.Equal("John Smith", task.CourierName);
        Assert.Equal("ACME", task.ClientCode);
        Assert.Equal("JOB-001", task.JobNumber);
    }

    [Fact]
    public void ProjectToTaskViewModel_NullCourierAndClientCode_MapToNull()
    {
        var ev = CreateEvent(1, e => e.UcevJob = new TucJob
        {
            UcjbNumber = "JOB-001",
            UcjbClientCode = null,
            UcjbCourier = null
        });

        var task = ProjectInMemory(ev);

        Assert.Null(task.CourierCode);
        Assert.Null(task.CourierName);
        Assert.Null(task.ClientCode);
    }

    [Fact]
    public void ApplyFilters_DateRange_ReturnsEventsWithinRange()
    {
        var events = new[]
        {
            CreateEvent(1, e => e.UcevDueTime = new DateTime(2025, 1, 1)),
            CreateEvent(2, e => e.UcevDueTime = new DateTime(2025, 6, 15)),
            CreateEvent(3, e => e.UcevDueTime = new DateTime(2025, 12, 31))
        };

        var filters = new TaskTableFiltersRequest
        {
            StartDate = new DateTimeOffset(2025, 3, 1, 0, 0, 0, TimeSpan.Zero),
            EndDate = new DateTimeOffset(2025, 9, 1, 0, 0, 0, TimeSpan.Zero)
        };

        var results = ApplyFiltersInMemory(events, filters);

        Assert.Single(results);
        Assert.Equal(2, results[0].UcevId);
    }

    [Fact]
    public void ApplyFilters_StartDateOnly_ReturnsEventsOnOrAfter()
    {
        var events = new[]
        {
            CreateEvent(1, e => e.UcevDueTime = new DateTime(2025, 1, 1)),
            CreateEvent(2, e => e.UcevDueTime = new DateTime(2025, 6, 15))
        };

        var filters = new TaskTableFiltersRequest
        {
            StartDate = new DateTimeOffset(2025, 3, 1, 0, 0, 0, TimeSpan.Zero)
        };

        var results = ApplyFiltersInMemory(events, filters);

        Assert.Single(results);
        Assert.Equal(2, results[0].UcevId);
    }

    [Fact]
    public void ApplyFilters_EndDateOnly_ReturnsEventsOnOrBefore()
    {
        var events = new[]
        {
            CreateEvent(1, e => e.UcevDueTime = new DateTime(2025, 1, 1)),
            CreateEvent(2, e => e.UcevDueTime = new DateTime(2025, 12, 31))
        };

        var filters = new TaskTableFiltersRequest
        {
            EndDate = new DateTimeOffset(2025, 6, 1, 0, 0, 0, TimeSpan.Zero)
        };

        var results = ApplyFiltersInMemory(events, filters);

        Assert.Single(results);
        Assert.Equal(1, results[0].UcevId);
    }

    [Fact]
    public void ApplyFilters_DateOnly_ReturnsEventsOnOrBeforeDate()
    {
        var events = new[]
        {
            CreateEvent(1, e => e.UcevDueTime = new DateTime(2025, 3, 1)),
            CreateEvent(2, e => e.UcevDueTime = new DateTime(2025, 12, 31))
        };

        var filters = new TaskTableFiltersRequest
        {
            Date = new DateTimeOffset(2025, 6, 1, 0, 0, 0, TimeSpan.Zero)
        };

        var results = ApplyFiltersInMemory(events, filters);

        Assert.Single(results);
        Assert.Equal(1, results[0].UcevId);
    }

    [Fact]
    public async Task ApplyFilters_ShowCompletedFalse_ReturnsOnlyOpenEvents()
    {
        var open = CreateEvent(1, e => e.UcevClosed = false);
        var closed = CreateEvent(2, e => e.UcevClosed = true);
        await SeedEventsAsync(open, closed);

        var filters = new TaskTableFiltersRequest { ShowCompleted = false };

        var results = await ApplyFiltersViaSqliteAsync(filters);

        Assert.Single(results);
        Assert.Equal(1, results[0].UcevId);
    }

    [Fact]
    public async Task ApplyFilters_CourierId_ReturnsMatchingCourier()
    {
        var match = CreateEvent(1, e => e.UcevCourierId = 10);
        var noMatch = CreateEvent(2, e => e.UcevCourierId = 20);
        await SeedEventsAsync(match, noMatch);

        var filters = new TaskTableFiltersRequest { CourierId = 10 };

        var results = await ApplyFiltersViaSqliteAsync(filters);

        Assert.Single(results);
        Assert.Equal(1, results[0].UcevId);
    }

    [Fact]
    public async Task ApplyFilters_EventTypeId_ReturnsMatchingType()
    {
        var match = CreateEvent(1, e => e.UcevType = 5);
        var noMatch = CreateEvent(2, e => e.UcevType = 10);
        await SeedEventsAsync(match, noMatch);

        var filters = new TaskTableFiltersRequest { EventTypeId = 5 };

        var results = await ApplyFiltersViaSqliteAsync(filters);

        Assert.Single(results);
        Assert.Equal(1, results[0].UcevId);
    }

    [Fact]
    public async Task ApplyFilters_StaffId_ReturnsMatchingStaffOrUnassigned()
    {
        var assigned = CreateEvent(1, e => e.UcevStaffIdin = 7);
        var unassigned = CreateEvent(2, e => e.UcevStaffIdin = null);
        var otherStaff = CreateEvent(3, e => e.UcevStaffIdin = 99);
        await SeedEventsAsync(assigned, unassigned, otherStaff);

        var filters = new TaskTableFiltersRequest { StaffId = 7 };

        var results = await ApplyFiltersViaSqliteAsync(filters);

        Assert.Equal(2, results.Count);
        Assert.Contains(results, e => e.UcevId == 1);
        Assert.Contains(results, e => e.UcevId == 2);
    }

    [Fact]
    public async Task ApplyFilters_StaffIdMinusOne_ReturnsOnlyUnassigned()
    {
        var assigned = CreateEvent(1, e => e.UcevStaffIdin = 7);
        var unassigned = CreateEvent(2, e => e.UcevStaffIdin = null);
        await SeedEventsAsync(assigned, unassigned);

        var filters = new TaskTableFiltersRequest { StaffId = -1 };

        var results = await ApplyFiltersViaSqliteAsync(filters);

        Assert.Single(results);
        Assert.Equal(2, results[0].UcevId);
    }

    [Fact]
    public async Task ApplyFilters_SearchText_MatchesDescriptionNotesAndDespatcher()
    {
        var matchDesc = CreateEvent(1, e => e.UcevDescription = "Urgent pickup needed");
        var matchNotes = CreateEvent(2, e => e.UcevNotes = "Call about urgent matter");
        var matchDesp = CreateEvent(3, e => e.UcevDespatcher = "Urgent Team");
        var noMatch = CreateEvent(4, e =>
        {
            e.UcevDescription = "Normal task";
            e.UcevNotes = "Nothing special";
            e.UcevDespatcher = "Regular";
        });
        await SeedEventsAsync(matchDesc, matchNotes, matchDesp, noMatch);

        var filters = new TaskTableFiltersRequest { SearchText = "Urgent" };

        var results = await ApplyFiltersViaSqliteAsync(filters);

        Assert.Equal(3, results.Count);
        Assert.DoesNotContain(results, e => e.UcevId == 4);
    }

    [Fact]
    public async Task ApplyFilters_NoFilters_ReturnsAllEvents()
    {
        await SeedEventsAsync(CreateEvent(1), CreateEvent(2), CreateEvent(3));

        var filters = new TaskTableFiltersRequest();

        var results = await ApplyFiltersViaSqliteAsync(filters);

        Assert.Equal(3, results.Count);
    }

    [Fact]
    public void ApplyFilters_CombinedFilters_AppliesAllTogether()
    {
        var events = new[]
        {
            // Open event for courier 10, matching staff, within date range
            CreateEvent(1, e =>
            {
                e.UcevDueTime = new DateTime(2025, 6, 15);
                e.UcevClosed = false;
                e.UcevCourierId = 10;
                e.UcevStaffIdin = 5;
                e.UcevDescription = "Target event";
            }),
            // Wrong courier
            CreateEvent(2, e =>
            {
                e.UcevDueTime = new DateTime(2025, 6, 15);
                e.UcevClosed = false;
                e.UcevCourierId = 20;
                e.UcevStaffIdin = 5;
            }),
            // Closed event
            CreateEvent(3, e =>
            {
                e.UcevDueTime = new DateTime(2025, 6, 15);
                e.UcevClosed = true;
                e.UcevCourierId = 10;
                e.UcevStaffIdin = 5;
            }),
            // Outside date range
            CreateEvent(4, e =>
            {
                e.UcevDueTime = new DateTime(2025, 12, 31);
                e.UcevClosed = false;
                e.UcevCourierId = 10;
                e.UcevStaffIdin = 5;
            })
        };

        var filters = new TaskTableFiltersRequest
        {
            StartDate = new DateTimeOffset(2025, 1, 1, 0, 0, 0, TimeSpan.Zero),
            EndDate = new DateTimeOffset(2025, 9, 1, 0, 0, 0, TimeSpan.Zero),
            ShowCompleted = false,
            CourierId = 10,
            StaffId = 5
        };

        var results = ApplyFiltersInMemory(events, filters);

        Assert.Single(results);
        Assert.Equal(1, results[0].UcevId);
    }

    private static List<int> ApplyOrderingInMemory(
        IEnumerable<TucEvent> events,
        TaskTableFiltersRequest filters,
        DateTime today) =>
    [
        .. TaskRepository.ApplyOrdering(events.AsQueryable(), filters, today, NzToUtc)
            .Select(e => e.UcevId)
    ];

    [Fact]
    public void ApplyOrdering_WithoutOrderBy_SortsTiesByDueTimeThenId()
    {
        // GetAllTasksAsync applies Take(500) straight after ordering, and the task dashboard
        // sends no OrderBy. Ordering only by the overdue boolean leaves every row in a group
        // tied, so SQL Server may return a different arbitrary 500 on each call and a task can
        // vanish between refreshes. The sort must be total.
        var today = new DateTime(2025, 6, 1, 8, 0, 0);
        var events = new[]
        {
            CreateEvent(3, e => e.UcevDueTime = new DateTime(2025, 6, 15, 12, 0, 0)),
            CreateEvent(1, e => e.UcevDueTime = new DateTime(2025, 6, 15, 12, 0, 0)),
            CreateEvent(2, e => e.UcevDueTime = new DateTime(2025, 6, 15, 9, 0, 0))
        };

        var results = ApplyOrderingInMemory(events, new TaskTableFiltersRequest(), today);

        Assert.Equal(new[] { 2, 1, 3 }, results);
    }

    [Fact]
    public void ApplyOrdering_WithoutOrderBy_KeepsOverdueFirstThenSortsDeterministically()
    {
        var today = new DateTime(2025, 6, 15, 12, 0, 0);
        var events = new[]
        {
            CreateEvent(10, e => e.UcevDueTime = new DateTime(2025, 6, 20, 9, 0, 0)),
            CreateEvent(20, e => e.UcevDueTime = new DateTime(2025, 6, 10, 9, 0, 0)),
            CreateEvent(30, e => e.UcevDueTime = new DateTime(2025, 6, 20, 9, 0, 0)),
            CreateEvent(40, e => e.UcevDueTime = new DateTime(2025, 6, 9, 9, 0, 0))
        };

        var results = ApplyOrderingInMemory(events, new TaskTableFiltersRequest(), today);

        Assert.Equal(new[] { 40, 20, 10, 30 }, results);
    }

    [Fact]
    public void ApplyOrdering_WithDateTimeOrder_BreaksDueTimeTiesById()
    {
        var today = new DateTime(2025, 6, 1, 8, 0, 0);
        var dueTime = new DateTime(2025, 6, 15, 12, 0, 0);
        var events = new[]
        {
            CreateEvent(7, e => e.UcevDueTime = dueTime),
            CreateEvent(4, e => e.UcevDueTime = dueTime),
            CreateEvent(9, e => e.UcevDueTime = dueTime)
        };

        var filters = new TaskTableFiltersRequest { OrderBy = "datetime", OrderDirection = "asc" };

        var results = ApplyOrderingInMemory(events, filters, today);

        Assert.Equal(Expected, results);
    }

    // ---- UTC-first due-time handling (ucevDueTimeUtc preferred, ucevDueTime fallback) ----

    private static TucEvent UtcStamped(int id, DateTime wallClock, DateTime tenantLocalTruth) =>
        CreateEvent(id, e =>
        {
            e.UcevDueTime = wallClock;
            e.UcevDueTimeUtc = NzToUtc(tenantLocalTruth);
        });

    [Fact]
    public void ApplyFilters_DateRange_PrefersUtcTwinOverWallClock_AndFallsBackWhenNull()
    {
        var filters = new TaskTableFiltersRequest
        {
            StartDate = new DateTimeOffset(2025, 6, 18, 0, 0, 0, TimeSpan.FromHours(12)),
            EndDate = new DateTimeOffset(2025, 6, 18, 23, 59, 59, TimeSpan.FromHours(12))
        };
        var events = new[]
        {
            // wall-clock is wrong (15th) but the UTC twin says it is due on the 18th, tenant time
            UtcStamped(1, new DateTime(2025, 6, 15, 9, 0, 0), new DateTime(2025, 6, 18, 9, 0, 0)),
            // wall-clock says the 18th but the UTC twin says the 20th
            UtcStamped(2, new DateTime(2025, 6, 18, 9, 0, 0), new DateTime(2025, 6, 20, 9, 0, 0)),
            // legacy row, no twin: wall-clock on the 18th
            CreateEvent(3, e => e.UcevDueTime = new DateTime(2025, 6, 18, 15, 0, 0)),
            // legacy row, no twin: wall-clock on the 15th
            CreateEvent(4, e => e.UcevDueTime = new DateTime(2025, 6, 15, 15, 0, 0))
        };

        var results = ApplyFiltersInMemory(events, filters);

        Assert.Equal(new[] { 1, 3 }, results.Select(e => e.UcevId).Order());
    }

    [Fact]
    public void ApplyFilters_StartDateOnly_And_EndDateOnly_UseUtcTwinWhenPresent()
    {
        var events = new[]
        {
            UtcStamped(1, new DateTime(2025, 6, 1, 9, 0, 0), new DateTime(2025, 6, 20, 9, 0, 0)),
            UtcStamped(2, new DateTime(2025, 6, 30, 9, 0, 0), new DateTime(2025, 6, 10, 9, 0, 0)),
            CreateEvent(3, e => e.UcevDueTime = new DateTime(2025, 6, 15, 9, 0, 0))
        };
        var boundary = new DateTimeOffset(2025, 6, 15, 12, 0, 0, TimeSpan.FromHours(12));

        var after = ApplyFiltersInMemory(events, new TaskTableFiltersRequest { StartDate = boundary });
        var before = ApplyFiltersInMemory(events, new TaskTableFiltersRequest { EndDate = boundary });

        Assert.Equal(new[] { 1 }, after.Select(e => e.UcevId));
        Assert.Equal(new[] { 2, 3 }, before.Select(e => e.UcevId).Order());
    }

    [Fact]
    public void ApplyFilters_DateFilter_IncludesWholeTenantDay_UsingUtcTwinWhenPresent()
    {
        var filters = new TaskTableFiltersRequest { Date = new DateTimeOffset(2025, 6, 15, 0, 0, 0, TimeSpan.FromHours(12)) };
        var events = new[]
        {
            UtcStamped(1, new DateTime(2025, 6, 20, 9, 0, 0), new DateTime(2025, 6, 15, 23, 30, 0)), // due late on the 15th
            UtcStamped(2, new DateTime(2025, 6, 10, 9, 0, 0), new DateTime(2025, 6, 16, 0, 30, 0)), // due just after the 15th
            CreateEvent(3, e => e.UcevDueTime = new DateTime(2025, 6, 15, 18, 0, 0)),
            CreateEvent(4, e => e.UcevDueTime = new DateTime(2025, 6, 16, 1, 0, 0))
        };

        var results = ApplyFiltersInMemory(events, filters);

        Assert.Equal(new[] { 1, 3 }, results.Select(e => e.UcevId).Order());
    }

    [Fact]
    public void ApplyOrdering_FlagsOverdueFromUtcTwin_AndFallsBackToWallClock()
    {
        var today = new DateTime(2025, 6, 15, 12, 0, 0);
        var events = new[]
        {
            UtcStamped(1, new DateTime(2025, 6, 25, 9, 0, 0), new DateTime(2025, 6, 10, 9, 0, 0)), // really overdue
            UtcStamped(2, new DateTime(2025, 6, 5, 9, 0, 0), new DateTime(2025, 6, 25, 9, 0, 0)), // really future
            CreateEvent(3, e => e.UcevDueTime = new DateTime(2025, 6, 12, 9, 0, 0)),             // legacy overdue
            CreateEvent(4, e => e.UcevDueTime = new DateTime(2025, 6, 28, 9, 0, 0))              // legacy future
        };

        var results = ApplyOrderingInMemory(events, new TaskTableFiltersRequest(), today);

        Assert.Equal(new[] { 1, 3 }, results.Take(2).Order());
        Assert.Equal(new[] { 2, 4 }, results.Skip(2).Order());
    }

    [Fact]
    public void ResolveDueDate_UsesUtcTwinConvertedToTenantTime_ElseLegacyWallClockWithOffset()
    {
        var info = Substitute.For<ITenantInfoService>();
        info.ConvertUtcToTenantTimeZone(Arg.Any<DateTime>())
            .Returns(c => new DateTimeOffset(c.Arg<DateTime>().AddHours(12), TimeSpan.FromHours(12)));

        var withTwin = new TaskViewModel
        {
            DueDate = new DateTime(2025, 6, 1, 9, 0, 0),
            DueDateUtc = new DateTime(2025, 6, 15, 0, 0, 0)
        };
        var legacy = new TaskViewModel { DueDate = new DateTime(2025, 6, 1, 9, 0, 0) };

        Assert.Equal(new DateTimeOffset(2025, 6, 15, 12, 0, 0, TimeSpan.FromHours(12)),
            TaskRepository.ResolveDueDate(withTwin, info, "Pacific/Auckland"));
        Assert.Equal(new DateTimeOffset(2025, 6, 1, 9, 0, 0, TimeSpan.FromHours(12)),
            TaskRepository.ResolveDueDate(legacy, info, "Pacific/Auckland"));
    }

    [Fact]
    public void ProjectToTaskViewModel_CarriesDueTimeUtc()
    {
        var ev = CreateEvent(1, e =>
        {
            e.UcevDueTimeUtc = new DateTime(2025, 6, 15, 0, 0, 0);
            e.UcevJob = new TucJob();
        });

        Assert.Equal(new DateTime(2025, 6, 15, 0, 0, 0), ProjectInMemory(ev).DueDateUtc);
    }
}
