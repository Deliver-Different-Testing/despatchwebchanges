using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class TaskRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantTimeService tenantTimeService
)
    : BaseRepository(contextFactory),
        ITaskRepository
{
    public async Task<List<TaskViewModel>> GetAllTasksAsync(TaskTableFiltersRequest filters)
    {
        var selectedDate = filters?.Date ?? tenantTimeService.GetCurrentTenantTime();

        var query = Context.TucEvents
            .Where(e => e.UcevDate != null && e.UcevDate.Value.Date <= selectedDate.Date);

        if (filters != null)
        {
            query = ApplyFilters(query, filters);
            query = ApplyOrdering(query, filters);
        }

        var eventTypes = await Context.TucEventTypes
            .ToDictionaryAsync(et => et.UcetId, et => et.UcetName);

        var tasks = await query
            .GroupJoin(
                Context.TucStaffs,
                events => events.UcevStaffIdin,
                staff => staff.UcstId,
                (events, staffs) => new { events, staffs }
            )
            .SelectMany(
                x => x.staffs.DefaultIfEmpty(),
                (x, staff) => new TaskViewModel
                {
                    Id = x.events.UcevId,
                    Assignee = new Suggestion
                    {
                        Id = staff != null ? staff.UcstId : 0,
                        Text = staff != null ? $"{staff.UcstFirstName} {staff.UcstLastName}" : string.Empty
                    },
                    Description = x.events.UcevNotes,
                    JobId = x.events.UcevJobId ?? 0,
                    Closed = x.events.UcevClosed,
                    DueDate = x.events.UcevDate != null && x.events.UcevTime != null
                        ? EF.Functions.DateTimeFromParts(
                            x.events.UcevDate.Value.Year,
                            x.events.UcevDate.Value.Month,
                            x.events.UcevDate.Value.Day,
                            x.events.UcevTime.Value.Hour,
                            x.events.UcevTime.Value.Minute,
                            x.events.UcevTime.Value.Second,
                            x.events.UcevTime.Value.Millisecond)
                        : DateTime.MinValue,
                    Title = x.events.UcevType != null && eventTypes.ContainsKey((int)x.events.UcevType) ? eventTypes[(int)x.events.UcevType] : string.Empty,
                    EventType = x.events.UcevType != null && eventTypes.ContainsKey((int)x.events.UcevType)
                        ? eventTypes[(int)x.events.UcevType]
                        : string.Empty
                }
            )
            .ToListAsync();

        return tasks;
    }

    private static IQueryable<TucEvent> ApplyOrdering(IQueryable<TucEvent> query, TaskTableFiltersRequest filters)
    {
        if (string.IsNullOrWhiteSpace(filters.OrderBy))
            return query;

        var isDescending = string.Equals(filters.OrderDirection, "desc", StringComparison.OrdinalIgnoreCase);

        return filters.OrderBy.ToLowerInvariant() switch
        {
            "assignedto" when filters.StaffId is null =>
                ApplyOrder(query, e => e.UcevStaffIdout == null, isDescending),

            "assignedto" when filters.StaffId is not null =>
                ApplyOrder(query, e => (int)e.UcevStaffIdout == filters.StaffId, isDescending),

            "created" =>
                ApplyDateTimeOrder(query, isDescending),

            _ =>
                ApplyDateTimeOrder(query, isDescending)
        };
    }

    private static IQueryable<TucEvent> ApplyOrder<TKey>(IQueryable<TucEvent> query,
        Expression<Func<TucEvent, TKey>> keySelector, bool isDescending)
    {
        return isDescending
            ? query.OrderByDescending(keySelector)
                .ThenByDescending(e => e.UcevDate)
                .ThenByDescending(e => e.UcevTime)
            : query.OrderBy(keySelector)
                .ThenBy(e => e.UcevDate)
                .ThenBy(e => e.UcevTime);
    }

    private static IQueryable<TucEvent> ApplyDateTimeOrder(IQueryable<TucEvent> query, bool isDescending)
    {
        return isDescending
            ? query.OrderByDescending(e => e.UcevDate).ThenByDescending(e => e.UcevTime)
            : query.OrderBy(e => e.UcevDate).ThenBy(e => e.UcevTime);
    }

    public async Task SetEventAsClosedAsync(int eventId, bool closed)
    {
        var eventToUpdate =
            await GetEventByIdAsync(eventId)
            ?? throw new KeyNotFoundException($"Event with ID {eventId} not found.");
        eventToUpdate.UcevClosed = closed;
        await Context.SaveChangesAsync();
    }

    public async Task UpdateEventDateAsync(int eventId, DateTime date)
    {
        var eventToUpdate =
            await GetEventByIdAsync(eventId)
            ?? throw new KeyNotFoundException($"Event with ID {eventId} not found.");
        eventToUpdate.UcevDate = date.Date;
        await Context.SaveChangesAsync();
    }

    public async Task UpdateEventTime(int eventId, DateTime time)
    {
        var eventToUpdate =
            await GetEventByIdAsync(eventId)
            ?? throw new KeyNotFoundException($"Event with ID {eventId} not found.");
        var existingDate = eventToUpdate.UcevTime?.Date ?? DateTime.Today;

        // Update only the time component
        eventToUpdate.UcevTime = new DateTime(
            existingDate.Year,
            existingDate.Month,
            existingDate.Day,
            time.Hour,
            time.Minute,
            time.Second,
            time.Millisecond
        );

        await Context.SaveChangesAsync();
    }

    public async Task ReassignEventToUser(int eventId, int staffId)
    {
        var eventToUpdate =
            await GetEventByIdAsync(eventId)
            ?? throw new KeyNotFoundException($"Event with ID {eventId} not found.");

        // Update only the time component
        eventToUpdate.UcevStaffIdin = staffId;
        await Context.SaveChangesAsync();
    }

    public async Task<List<Suggestion>> GetEventGroupsAsync()
    {
        var eventGroups = await Context
            .TucEventTypeGroups.Select(x => new Suggestion { Id = x.Id, Text = x.Name })
            .OrderBy(x => x.Text)
            .AsNoTracking()
            .ToListAsync();

        return eventGroups;
    }

    public async Task<List<EventGroupViewModel>> GetEventTypeGroupsAsync(int eventGroupId)
    {
        var eventGroups = await Context
            .TucEventTypeEventTypeGroups.Where(x => x.EventTypeGroupId == eventGroupId)
            .Select(x => new EventGroupViewModel
            {
                EventTypeGroupTypeGroupId = x.Id,
                Active = x.IsActive,
                DueTime = x.DueTime ?? 0,
                EventType = new Suggestion
                {
                    Id = x.EventType.UcetId,
                    Text = x.EventType.UcetName
                },
                Sequence = x.Sequence,
                Group = x.EventTypeGroup.Name,
                AssignTo = new Suggestion
                {
                    Text = x.EventTypeGroup.CreatedBy
                }
            })
            .OrderBy(x => x.Sequence)
            .AsNoTracking()
            .ToListAsync();

        return eventGroups;
    }

    public async Task CreateEventsForJobAsync(
        int jobId,
        List<EventGroupViewModel> eventGroupViewModels)
    {
        var job = await Context.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job, nameof(job));

        foreach (var eventGroup in eventGroupViewModels)
        {
            // Call the stored procedure for each agent
            await Context.Procedures.DES_qdfEvent_InsertAsync(
                jobNo: job.UcjbNumber,
                clientID: job.UcjbClientId,
                contact: job.UcjbContact,
                date: DateTime.Now,
                time: DateTime.Now,
                type: eventGroup.EventType.Id,
                lateTime: null,
                eTATime: null,
                staffIDIn: eventGroup.AssignTo.Id,
                staffIDOut: null,
                responseTime: null,
                notes: eventGroup.Notes,
                pageCourier: false,
                closed: false,
                originator: eventGroup.AssignTo.Id,
                description: eventGroup.EventType.Text,
                courierID: job.UcjbCourierId,
                jobID: job.UcjbId,
                despatcher: eventGroup.AssignTo.Text,
                jobType: job.UcjbSpeed
            );
        }
    }

    public async Task<List<Suggestion>> GetActiveStaffAsync()
    {
        var staff = await Context.TucStaffs
            .Where(s => s.UcstActive)
            .Select(s => new Suggestion
            {
                Id = s.UcstId,
                Text = s.UcstFirstName + " " + s.UcstLastName
            })
            .OrderBy(s => s.Text)
            .AsNoTracking()
            .ToListAsync();

        return staff;
    }

    private static IQueryable<TucEvent> ApplyFilters(
        IQueryable<TucEvent> query,
        TaskTableFiltersRequest filters
    )
    {
        // Filter by CourierId if provided
        if (filters.CourierId.HasValue)
            query = query.Where(e => e.UcevCourierId == filters.CourierId.Value);

        // Filter by EventTypeId if provided
        if (filters.EventTypeId.HasValue)
            query = query.Where(e => Equals(e.UcevType, filters.EventTypeId.Value));

        // Filter by SearchText if provided
        if (string.IsNullOrWhiteSpace(filters.SearchText)) return query;

        var searchText = filters.SearchText.ToLower();
        query = query.Where(e =>
            (e.UcevDescription != null && e.UcevDescription.Contains(searchText, StringComparison.OrdinalIgnoreCase))
            || (
                e.UcevNotes != null
                && e.UcevNotes.Contains(searchText, StringComparison.CurrentCultureIgnoreCase)
            )
            || (e.UcevDespatcher != null && e.UcevDespatcher.Contains(searchText, StringComparison.OrdinalIgnoreCase))
        );

        return query;
    }

    private async Task<TucEvent> GetEventByIdAsync(int eventId) =>
        await Context.TucEvents.FirstOrDefaultAsync(e => e.UcevId == eventId);

    private async Task<string> GetEventTypeNameAsync(double? eventTypeId)
    {
        const string defaultEvent = "Default";
        if (eventTypeId == null)
            return defaultEvent;

        var eventType = await Context.TucEventTypes
            .Where(jt => Equals(jt.UcetId, eventTypeId))
            .Select(jt => jt.UcetName)
            .FirstOrDefaultAsync();

        return eventType ?? defaultEvent;
    }

    public async Task AddEventAsync(
        int jobId,
        int staffId,
        string despatcherName,
        string notes,
        int eventType,
        float? lateTime = null,
        DateTime? etaTime = null,
        bool close = false
    )
    {
        var job = await Context.TucJobs.FindAsync(jobId);
        ArgumentNullException.ThrowIfNull(job, "Job not found");

        await Context.Procedures.DES_qdfEvent_InsertAsync(
            jobNo: job.UcjbNumber,
            clientID: job.UcjbClientId,
            contact: job.UcjbContact,
            date: DateTime.Today,
            time: DateTime.Now,
            type: eventType,
            lateTime: lateTime,
            eTATime: etaTime,
            staffIDIn: staffId,
            staffIDOut: null,
            responseTime: null,
            notes: notes,
            pageCourier: false,
            closed: close,
            originator: staffId,
            description: notes,
            courierID: job.UcjbCourierId,
            jobID: jobId,
            despatcher: despatcherName,
            jobType: job.UcjbSpeed
        );
    }
}
