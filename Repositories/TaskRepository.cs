using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class TaskRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    ITenantClock clock) : BaseRepository(contextFactory), ITaskRepository
{
    private const int InternetUserStaffId = 33;

    private static readonly HashSet<string> AutoResponseTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Web", "Email", "Text"
    };

    public async Task<IReadOnlyList<TaskViewModel>> GetAllTasksAsync(TaskTableFiltersRequest filters)
    {
        var tenantTimeZone = infoService.GetTenantTimeZone();
        var today = filters?.Date ?? clock.TenantNow.AddDays(1);

        var query = Context.TucEvents
            .AsNoTracking()
            .Where(t => t.UcevTypeNavigation.UcetGroup == nameof(TaskGroup.CS));

        if (filters != null) query = ApplyFilters(query, filters);

        query = ApplyOrdering(query, filters, today.DateTime);

        query = query.Take(filters?.Limit is > 0 ? filters.Limit.Value : 500);

        var tasks = await query
            .Select(e => new TaskViewModel
            {
                Id = e.UcevId,
                Assignee = e.UcevStaffIdinNavigation != null
                    ? new Suggestion
                    {
                        Id = e.UcevStaffIdinNavigation.UcstId,
                        Text = e.UcevStaffIdinNavigation.UcstFirstName + " " + e.UcevStaffIdinNavigation.UcstLastName
                    }
                    : null,
                Description = e.UcevNotes,
                JobId = e.UcevJobId ?? 0,
                Closed = e.UcevClosed,
                DueDate = e.UcevDueTime,
                Title = e.UcevTypeNavigation != null ? e.UcevTypeNavigation.UcetName : string.Empty,
                EventType = e.UcevTypeNavigation != null ? e.UcevTypeNavigation.UcetGroup : string.Empty,
                JobNumber = e.UcevJob.UcjbNumber
            })
            .ToListAsync();

        foreach (var task in tasks)
            task.DueDate = TimeZoneHelper.SetDateTimeWithTimeZone(task.DueDate, tenantTimeZone);

        return tasks;
    }

    public async Task SetEventAsClosedAsync(int eventId, bool closed)
    {
        await using var transaction = await Context.Database.BeginTransactionAsync();

        try
        {
            var existingEvent = await Context.TucEvents
                .Where(e => e.UcevId == eventId)
                .Select(e => new { e.UcevClosed })
                .FirstOrDefaultAsync();

            if (existingEvent == null)
                throw new ArgumentException($"Event with ID {eventId} not found.");

            // Only create audit record if value actually changed
            if (existingEvent.UcevClosed != closed)
            {
                await Context.TucEvents
                    .Where(e => e.UcevId == eventId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(e => e.UcevClosed, closed));

                await CreateEventAuditRecord(
                    eventId,
                    infoService.GetStaffId(),
                    TucEventChangeType.Update,
                    "UcevClosed",
                    existingEvent.UcevClosed.ToString(),
                    closed.ToString()
                );
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task UpdateEventDueTimeAsync(int eventId, DateTimeOffset dueTime)
    {
        await using var transaction = await Context.Database.BeginTransactionAsync();

        try
        {
            var existingEvent = await Context.TucEvents
                .Where(e => e.UcevId == eventId)
                .Select(e => new { e.UcevDueTime })
                .FirstOrDefaultAsync();

            if (existingEvent == null)
                throw new ArgumentException($"Event with ID {eventId} not found.");

            if (existingEvent.UcevDueTime != dueTime.DateTime)
            {
                await Context.TucEvents
                    .Where(e => e.UcevId == eventId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(e => e.UcevDueTime, dueTime.DateTime));

                await CreateEventAuditRecord(
                    eventId,
                    infoService.GetStaffId(),
                    TucEventChangeType.Update,
                    "UcevDueTime",
                    existingEvent.UcevDueTime.ToString("O"),
                    dueTime.ToString("O")
                );
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task ReassignEventToUserAsync(int eventId, int staffId)
    {
        await using var transaction = await Context.Database.BeginTransactionAsync();

        try
        {
            var existingEvent = await Context.TucEvents
                .Where(e => e.UcevId == eventId)
                .Select(e => new { e.UcevStaffIdin })
                .FirstOrDefaultAsync();

            if (existingEvent == null)
                throw new ArgumentException($"Event with ID {eventId} not found.");

            if (existingEvent.UcevStaffIdin != staffId)
            {
                await Context.TucEvents
                    .Where(e => e.UcevId == eventId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(e => e.UcevStaffIdin, staffId));

                await CreateEventAuditRecord(
                    eventId,
                    infoService.GetStaffId(),
                    TucEventChangeType.Update,
                    "UcevStaffIdin",
                    existingEvent.UcevStaffIdin?.ToString() ?? "null",
                    staffId.ToString()
                );
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<IReadOnlyList<Suggestion>> GetEventGroupsAsync() =>
        await Context.TucEventTypeGroups
            .AsNoTracking()
            .Select(x => new Suggestion { Id = x.Id, Text = x.Name })
            .OrderBy(x => x.Text)
            .ToListAsync();

    public async Task<IReadOnlyList<EventGroupViewModel>> GetEventTypeGroupsAsync(int eventGroupId)
    {
        var now = clock.TenantNow;
        var eventGroups = await Context.TucEventTypeEventTypeGroups
            .AsNoTracking()
            .Where(x => x.EventTypeGroupId == eventGroupId)
            .Select(x => new EventGroupViewModel
            {
                EventTypeGroupTypeGroupId = x.Id,
                Active = x.IsActive,
                DueTime = x.DueTime != null ? now.AddMinutes((double)x.DueTime) : null,
                EventType = new Suggestion
                {
                    Id = x.EventType.UcetId,
                    Text = x.EventType.UcetName
                },
                Sequence = x.Sequence,
                Group = x.EventTypeGroup.Name
            })
            .OrderBy(x => x.Sequence)
            .ToListAsync();

        return eventGroups;
    }

    public async Task CreateEventsForJobAsync(int jobId, List<EventGroupViewModel> eventGroupViewModels)
    {
        var currentDate = clock.TenantNow;
        var staffId = infoService.GetStaffId();

        // Run both queries in parallel using separate contexts (DbContext is not thread-safe)
        await using var jobContext = CreateNewContext();
        await using var staffContext = CreateNewContext();

        var jobTask = jobContext.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new
            {
                j.UcjbId,
                j.UcjbNumber,
                j.UcjbClientId,
                j.UcjbContact,
                j.UcjbCourierId,
                j.UcjbSpeed
            })
            .FirstOrDefaultAsync();

        var dispatcherTask = staffContext.TucStaffs
            .Where(s => s.UcstId == staffId)
            .Select(s => s.UcstFirstName + " " + s.UcstLastName)
            .FirstOrDefaultAsync();

        await Task.WhenAll(jobTask, dispatcherTask);

        var job = await jobTask;
        var dispatcherName = await dispatcherTask;

        ArgumentNullException.ThrowIfNull(job);
        if (!job.UcjbClientId.HasValue) throw new ArgumentNullException(nameof(job.UcjbClientId));

        // Batch create all events
        var events = eventGroupViewModels.Select(eventGroup => new TucEvent
        {
            UcevJobNumber = job.UcjbNumber,
            UcevClientId = job.UcjbClientId ?? 0,
            UcevContact = job.UcjbContact,
            UcevDate = currentDate,
            UcevTime = currentDate,
            UcevType = eventGroup.EventType.Id,
            UcevLateTime = null,
            UcevEtatime = null,
            UcevStaffIdin = eventGroup.AssignTo?.Id,
            UcevStaffIdout = null,
            UcevResponseTime = null,
            UcevNotes = eventGroup.Notes,
            UcevPageCourier = false,
            UcevClosed = false,
            UcevOriginator = staffId,
            UcevDescription = eventGroup.EventType.Text,
            UcevCourierId = job.UcjbCourierId,
            UcevJobId = job.UcjbId,
            UcevDespatcher = dispatcherName,
            UcevJobType = job.UcjbSpeed,
            UcevDueTime = eventGroup.DueTime ?? currentDate
        }).ToList();

        await Context.TucEvents.AddRangeAsync(events);
        await Context.SaveChangesAsync();
    }

    public async Task<IReadOnlyList<Suggestion>> GetActiveStaffAsync()
    {
        var staff = await Context.TucStaffs
            .AsNoTracking()
            .Where(s => s.UcstActive)
            .Select(s => new Suggestion
            {
                Id = s.UcstId,
                Text = s.UcstFirstName + " " + s.UcstLastName
            })
            .OrderBy(s => s.Text)
            .ToListAsync();

        return staff;
    }

    public async Task AddEventAsync(
        int jobId,
        string notes,
        int eventType,
        DateTimeOffset? dueDate = null,
        int? lateTime = null,
        DateTimeOffset? etaTime = null,
        bool close = false
    )
    {
        var staffInfoTask = infoService.GetStaffInfoAsync();
        var jobTask = Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new JobEventDto
            {
                UcjbNumber = j.UcjbNumber,
                UcjbClientId = j.UcjbClientId,
                UcjbContact = j.UcjbContact,
                UcjbCourierId = j.UcjbCourierId,
                UcjbSpeed = j.UcjbSpeed
            })
            .FirstOrDefaultAsync();

        await Task.WhenAll(staffInfoTask, jobTask);

        var staffInfo = await staffInfoTask;
        var job = await jobTask;

        ArgumentNullException.ThrowIfNull(job);

        var currentDate = clock.TenantNow;

        await InsertEventAsync(
            jobNo: job.UcjbNumber,
            clientId: job.UcjbClientId ?? 0,
            contact: job.UcjbContact,
            date: currentDate,
            time: currentDate,
            type: eventType,
            lateTime: lateTime,
            etaTime: etaTime,
            staffIdIn: staffInfo.Id,
            staffIdOut: null,
            responseTime: null,
            notes: notes,
            pageCourier: false,
            closed: close,
            originator: staffInfo.Id,
            description: notes,
            courierId: job.UcjbCourierId,
            jobId: jobId,
            despatcher: staffInfo.Text,
            jobType: job.UcjbSpeed,
            dueTime: dueDate
        );
    }

    private static IQueryable<TucEvent> ApplyOrdering(IQueryable<TucEvent> query, TaskTableFiltersRequest filters,
        DateTime today)
    {
        query = query
            .OrderByDescending(e =>
                e.UcevDueTime.Date < today.Date ||
                (e.UcevDueTime.Date == today.Date &&
                 e.UcevDueTime.TimeOfDay < today.TimeOfDay &&
                 !e.UcevClosed)
            );

        if (filters == null || string.IsNullOrWhiteSpace(filters.OrderBy)) return query;

        var isDescending = string.Equals(filters.OrderDirection, "desc", StringComparison.OrdinalIgnoreCase);

        return filters.OrderBy.ToLowerInvariant() switch
        {
            _ =>
                ApplyDateTimeOrder(query, isDescending, today)
        };
    }

    private static IQueryable<TucEvent> ApplyDateTimeOrder(IQueryable<TucEvent> query, bool isDescending,
        DateTime today) =>
        isDescending
            ? query.OrderByDescending(e => e.UcevDueTime.Date < today.Date)
                .ThenByDescending(e => e.UcevDueTime)
            : query.OrderByDescending(e => e.UcevDueTime.Date < today)
                .ThenBy(e => e.UcevDueTime);

    private static IQueryable<TucEvent> ApplyFilters(
        IQueryable<TucEvent> query,
        TaskTableFiltersRequest filters
    )
    {
        // Apply date filters based on the available parameters
        if (filters.StartDate.HasValue && filters.EndDate.HasValue)
        {
            // If both start and end dates are provided, filter for events within that range
            query = query.Where(e => e.UcevDueTime >= filters.StartDate.Value &&
                                     e.UcevDueTime <= filters.EndDate.Value);
        }
        else if (filters.StartDate.HasValue)
        {
            // If only startDate is provided, filter for events on or after that date
            query = query.Where(e => e.UcevDueTime >= filters.StartDate.Value);
        }
        else if (filters.EndDate.HasValue)
        {
            // If only endDate is provided, filter for events on or before that date
            query = query.Where(e => e.UcevDueTime <= filters.EndDate.Value);
        }
        else if (filters.Date.HasValue)
        {
            // Fall back to the original date filter if no range is specified
            query = query.Where(e => e.UcevDueTime.Date <= filters.Date);
        }

        if (filters.JobId.HasValue)
            query = query.Where(e => e.UcevJobId == filters.JobId.Value
                                     || e.UcevJob.ParentId == filters.JobId.Value
                                     || e.UcevJob.Parent.InverseParent.Any(j => j.UcjbId == filters.JobId.Value));

        if (filters.ShowCompleted is false)
            query = query.Where(e => e.UcevClosed == filters.ShowCompleted);

        // Filter by CourierId if provided
        if (filters.CourierId.HasValue)
            query = query.Where(e => e.UcevCourierId == filters.CourierId.Value);

        // Filter by EventTypeId if provided
        if (filters.EventTypeId.HasValue)
            query = query.Where(e => (int)e.UcevType == filters.EventTypeId);

        // Filter by staffId
        if (filters.StaffId.HasValue && filters.StaffId.Value != -1)
            query = query.Where(e => Equals((int)e.UcevStaffIdin, filters.StaffId.Value) || e.UcevStaffIdin == null);

        if (filters.StaffId is -1)
            query = query.Where(e => e.UcevStaffIdin == null);

        // Filter by SearchText if provided
        if (string.IsNullOrWhiteSpace(filters.SearchText)) return query;

        var searchPattern = $"%{filters.SearchText}%";
        query = query.Where(e =>
            EF.Functions.Like(e.UcevDescription, searchPattern)
            || EF.Functions.Like(e.UcevNotes, searchPattern)
            || EF.Functions.Like(e.UcevDespatcher, searchPattern)
            || (e.UcevJob != null && EF.Functions.Like(e.UcevJob.UcjbNumber, searchPattern))
            || (e.UcevJob != null && e.UcevJob.Parent != null &&
                EF.Functions.Like(e.UcevJob.Parent.UcjbNumber, searchPattern))
            || (e.UcevJob != null && e.UcevJob.Parent != null &&
                e.UcevJob.Parent.InverseParent.Any(j => EF.Functions.Like(j.UcjbNumber, searchPattern)))
        );

        return query;
    }

    private async Task InsertEventAsync(
        string jobNo,
        int clientId,
        string contact,
        DateTimeOffset date,
        DateTimeOffset time,
        int type,
        int? lateTime,
        DateTimeOffset? etaTime,
        int? staffIdIn,
        int? staffIdOut,
        DateTimeOffset? responseTime,
        string notes,
        bool pageCourier,
        bool closed,
        int originator,
        string description,
        int? courierId,
        int jobId,
        string despatcher,
        int? jobType,
        DateTimeOffset? dueTime)
    {
        var currentDate = clock.TenantNow;

        if (type is (int)EventType.LatePickUp or (int)EventType.LateDelivery)
        {
            // Single query to get job speed and contact type info
            var jobContactInfo = await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(j => new
                {
                    j.UcjbSpeed,
                    ContactJobType = Context.TblClientContactJobTypes
                        .Where(x => x.JobTypeId == j.UcjbSpeed)
                        .Select(x => new { x.PickupType, x.DeliveryType })
                        .FirstOrDefault()
                })
                .FirstOrDefaultAsync();

            var automaticResponse = false;
            if (jobContactInfo?.ContactJobType != null)
            {
                automaticResponse = type switch
                {
                    (int)EventType.LatePickUp => AutoResponseTypes.Contains(jobContactInfo.ContactJobType.PickupType),
                    (int)EventType.LateDelivery => AutoResponseTypes.Contains(
                        jobContactInfo.ContactJobType.DeliveryType),
                    _ => false
                };
            }

            // Set fields for automatic response
            if (automaticResponse)
            {
                closed = true;
                staffIdOut = InternetUserStaffId;
                responseTime = currentDate;
                contact = "Automatic Response";
                despatcher = "Internet";
            }
        }

        // Create and add the new event
        var newEvent = new TucEvent
        {
            UcevJobNumber = jobNo,
            UcevClientId = clientId,
            UcevContact = contact,
            UcevDate = date.DateTime,
            UcevTime = time.DateTime,
            UcevType = type,
            UcevLateTime = lateTime,
            UcevEtatime = etaTime?.DateTime,
            UcevStaffIdin = staffIdIn,
            UcevStaffIdout = staffIdOut,
            UcevResponseTime = responseTime?.DateTime,
            UcevNotes = notes,
            UcevPageCourier = pageCourier,
            UcevClosed = closed,
            UcevOriginator = originator,
            UcevDescription = description,
            UcevCourierId = courierId,
            UcevJobId = jobId,
            UcevDespatcher = despatcher,
            UcevJobType = jobType,
            UcevDueTime = dueTime?.DateTime ?? currentDate
        };

        await Context.AddAsync(newEvent);
        await Context.SaveChangesAsync();
    }

    private async Task CreateEventAuditRecord(int eventId, int staffIdId, TucEventChangeType changeType,
        string columnName, string oldValue, string newValue)
    {
        var newAudit = new TucEventAudit
        {
            UceaEventId = eventId,
            UceaStaffId = staffIdId,
            UceaChangedAt = DateTime.UtcNow,
            UceaColumnName = columnName,
            UceaChangeType = changeType.ToDbString(),
            UceaOldValue = oldValue,
            UceaNewValue = newValue
        };

        await Context.TucEventAudits.AddAsync(newAudit);
        await Context.SaveChangesAsync();
    }
}