using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
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
    private static readonly int[] Expected2 = [1, 2, 3];
    private static readonly int[] Expected3 = [2, 1, 3];
    private static readonly int[] Expected4 = [40, 20, 10, 30];

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
        var filtered = TaskRepository.ApplyFilters(query, filters);
        return await filtered.ToListAsync(TestContext.Current.CancellationToken);
    }

    private static List<TucEvent> ApplyFiltersInMemory(
        IEnumerable<TucEvent> events,
        TaskTableFiltersRequest filters)
    {
        var query = events.AsQueryable();
        var filtered = TaskRepository.ApplyFilters(query, filters);
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

        Assert.Equal(Expected2, results);
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

        var item = Assert.Single(results);
        Assert.Equal(2, item.UcevId);
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

        var item = Assert.Single(results);
        Assert.Equal(2, item.UcevId);
    }

    [Fact]
    public void ApplyFilters_IncludeOverdue_KeepsOpenTasksDueBeforeTheWindow()
    {
        var events = new[]
        {
            CreateEvent(1, e => { e.UcevDueTime = new DateTime(2025, 1, 1); e.UcevClosed = false; }),
            CreateEvent(2, e => { e.UcevDueTime = new DateTime(2025, 1, 1); e.UcevClosed = true; }),
            CreateEvent(3, e => e.UcevDueTime = new DateTime(2025, 6, 15)),
            CreateEvent(4, e => { e.UcevDueTime = new DateTime(2025, 12, 31); e.UcevClosed = false; })
        };

        var filters = new TaskTableFiltersRequest
        {
            StartDate = new DateTimeOffset(2025, 3, 1, 0, 0, 0, TimeSpan.Zero),
            EndDate = new DateTimeOffset(2025, 9, 1, 0, 0, 0, TimeSpan.Zero),
            IncludeOverdue = true
        };

        var results = ApplyFiltersInMemory(events, filters);

        Assert.Equal([1, 3], results.Select(e => e.UcevId).Order());
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

        var item = Assert.Single(results);
        Assert.Equal(1, item.UcevId);
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

        var item = Assert.Single(results);
        Assert.Equal(1, item.UcevId);
    }

    [Fact]
    public async Task ApplyFilters_ShowCompletedFalse_ReturnsOnlyOpenEvents()
    {
        var open = CreateEvent(1, e => e.UcevClosed = false);
        var closed = CreateEvent(2, e => e.UcevClosed = true);
        await SeedEventsAsync(open, closed);

        var filters = new TaskTableFiltersRequest { ShowCompleted = false };

        var results = await ApplyFiltersViaSqliteAsync(filters);

        var item = Assert.Single(results);
        Assert.Equal(1, item.UcevId);
    }

    [Fact]
    public async Task ApplyFilters_CourierId_ReturnsMatchingCourier()
    {
        var match = CreateEvent(1, e => e.UcevCourierId = 10);
        var noMatch = CreateEvent(2, e => e.UcevCourierId = 20);
        await SeedEventsAsync(match, noMatch);

        var filters = new TaskTableFiltersRequest { CourierId = 10 };

        var results = await ApplyFiltersViaSqliteAsync(filters);

        var item = Assert.Single(results);
        Assert.Equal(1, item.UcevId);
    }

    [Fact]
    public async Task ApplyFilters_EventTypeId_ReturnsMatchingType()
    {
        var match = CreateEvent(1, e => e.UcevType = 5);
        var noMatch = CreateEvent(2, e => e.UcevType = 10);
        await SeedEventsAsync(match, noMatch);

        var filters = new TaskTableFiltersRequest { EventTypeId = 5 };

        var results = await ApplyFiltersViaSqliteAsync(filters);

        var item = Assert.Single(results);
        Assert.Equal(1, item.UcevId);
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

        var item = Assert.Single(results);
        Assert.Equal(2, item.UcevId);
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

        var item = Assert.Single(results);
        Assert.Equal(1, item.UcevId);
    }

    private static List<int> ApplyOrderingInMemory(
        IEnumerable<TucEvent> events,
        TaskTableFiltersRequest filters,
        DateTime today) =>
    [
        .. TaskRepository.ApplyOrdering(events.AsQueryable(), filters, today)
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

        Assert.Equal(Expected3, results);
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

        Assert.Equal(Expected4, results);
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

    [Fact]
    public void ResolveCreatedAt_UsesUtcStamp_ElseLegacyDateAndTime_ElseNull()
    {
        var info = Substitute.For<ITenantInfoService>();
        info.ConvertUtcToTenantTimeZone(Arg.Any<DateTime>())
            .Returns(c => new DateTimeOffset(c.Arg<DateTime>().AddHours(12), TimeSpan.FromHours(12)));

        var withStamp = new TaskViewModel
        {
            CreatedAtUtc = new DateTime(2025, 6, 15, 0, 0, 0),
            CreatedDate = new DateTime(2025, 6, 1),
            CreatedTime = new DateTime(1900, 1, 1, 9, 0, 0)
        };
        var legacy = new TaskViewModel
        {
            CreatedDate = new DateTime(2025, 6, 1),
            CreatedTime = new DateTime(1900, 1, 1, 9, 30, 0)
        };

        Assert.Equal(new DateTimeOffset(2025, 6, 15, 12, 0, 0, TimeSpan.FromHours(12)),
            TaskRepository.ResolveCreatedAt(withStamp, info, "Pacific/Auckland"));
        Assert.Equal(new DateTimeOffset(2025, 6, 1, 9, 30, 0, TimeSpan.FromHours(12)),
            TaskRepository.ResolveCreatedAt(legacy, info, "Pacific/Auckland"));
        Assert.Null(TaskRepository.ResolveCreatedAt(new TaskViewModel(), info, "Pacific/Auckland"));
    }

    private static TaskViewModel UnlinkedTask(int id, string? storedJobNumber, int? clientId = 7) =>
        new() { Id = id, StoredJobNumber = storedJobNumber, ClientId = clientId };

    [Fact]
    public void ProjectToTaskViewModel_CarriesStoredJobNumberAndClient()
    {
        var ev = CreateEvent(1, e =>
        {
            e.UcevJobNumber = "P3765V";
            e.UcevClientId = 7;
            e.UcevJob = new TucJob();
        });

        var vm = ProjectInMemory(ev);

        Assert.Equal("P3765V", vm.StoredJobNumber);
        Assert.Equal(7, vm.ClientId);
    }

    [Fact]
    public async Task LinkUnlinkedTasksByJobNumber_LinksOnlyWhenOneLiveOrArchivedJobOfTheClientMatches()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 100, UcjbNumber = "LIVE1", UcjbClientId = 7 },
                new TucJob { UcjbId = 101, UcjbNumber = "TWICE", UcjbClientId = 7 },
                new TucJob { UcjbId = 102, UcjbNumber = "OTHERCLIENT", UcjbClientId = 8 });
            seed.TucJobArchives.AddRange(
                new TucJobArchive { UcjbId = 200, UcjbNumber = "ARCH1", UcjbClientId = 7 },
                new TucJobArchive { UcjbId = 201, UcjbNumber = "TWICE", UcjbClientId = 7 });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var live = UnlinkedTask(1, "LIVE1");
        var archived = UnlinkedTask(2, " ARCH1 ");
        var ambiguous = UnlinkedTask(3, "TWICE");
        var otherClient = UnlinkedTask(4, "OTHERCLIENT");
        var placeholder = UnlinkedTask(5, "-");
        var blank = UnlinkedTask(6, "  ");
        var noClient = UnlinkedTask(7, "OTHERCLIENT", clientId: null);
        var alreadyLinked = new TaskViewModel { Id = 8, JobId = 555, JobNumber = "KEEP", StoredJobNumber = "LIVE1", ClientId = 7 };
        TaskViewModel[] tasks = [live, archived, ambiguous, otherClient, placeholder, blank, noClient, alreadyLinked];

        await using var context = _db.CreateContext();
        await TaskRepository.LinkUnlinkedTasksByJobNumberAsync(context, tasks);

        Assert.Equal((100, "LIVE1"), (live.JobId, live.JobNumber));
        Assert.Equal((200, "ARCH1"), (archived.JobId, archived.JobNumber));
        Assert.Equal((102, "OTHERCLIENT"), (noClient.JobId, noClient.JobNumber));
        Assert.Equal((555, "KEEP"), (alreadyLinked.JobId, alreadyLinked.JobNumber));
        Assert.All([ambiguous, otherClient, placeholder, blank], t =>
        {
            Assert.Equal(0, t.JobId);
            Assert.Null(t.JobNumber);
        });
    }

    [Fact]
    public void ProjectToTaskViewModel_CarriesCreatedFields()
    {
        var ev = CreateEvent(1, e =>
        {
            e.UcevCreatedAtUtc = new DateTime(2025, 6, 15, 0, 0, 0);
            e.UcevDate = new DateTime(2025, 6, 1);
            e.UcevTime = new DateTime(1900, 1, 1, 9, 0, 0);
            e.UcevJob = new TucJob();
        });

        var vm = ProjectInMemory(ev);

        Assert.Equal(new DateTime(2025, 6, 15, 0, 0, 0), vm.CreatedAtUtc);
        Assert.Equal(new DateTime(2025, 6, 1), vm.CreatedDate);
        Assert.Equal(new DateTime(1900, 1, 1, 9, 0, 0), vm.CreatedTime);
    }
}