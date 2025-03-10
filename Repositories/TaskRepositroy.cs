using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class TaskRepository(IDbContextFactory<DespatchContext> contextFactory, IHttpContextAccessor contextAccessor)
    : BaseRepository(contextFactory),
        ITaskRepository
{
    public async Task<List<TaskViewModel>> GetAllTasksAsync(TaskTableFiltersRequest filters)
    {
        var tenantTimeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var tenantTimeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(tenantTimeZone ?? string.Empty);
        var utcDateTime = DateTime.UtcNow;
        var tenantTime = TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, tenantTimeZoneInfo);

        var selectedDate = tenantTime.Date;
        if (filters is { Date: not null }) selectedDate = filters.Date.Value;

        var query = Context.TucEvents.AsQueryable();

        query = query.Where(e =>
                e.UcevDate != null
                && (
                    e.UcevDate.Value.Date == selectedDate
                    ||
                    e.UcevDate.Value < tenantTime
                )
        );

        // Apply additional filters
        if (filters != null)
            query = ApplyFilters(query, filters);

        var simpleQuery = query.Select(e => new
        {
            e.UcevId,
            e.UcevDespatcher,
            e.UcevNotes,
            e.UcevJobId,
            e.UcevClosed,
            e.UcevDate,
            e.UcevTime,
            e.UcevDescription,
            e.UcevType
        });

        var results = await simpleQuery.AsNoTracking().ToListAsync();

        var tasks = new List<TaskViewModel>();
        foreach (var e in results)
        {
            var eventTypeName = await GetEventTypeName(e.UcevType);

            var task = new TaskViewModel
            {
                Id = e.UcevId,
                Assignee = e.UcevDespatcher,
                Description = e.UcevNotes,
                JobId = e.UcevJobId ?? 0,
                Closed = e.UcevClosed,
                DueDate = CombineDateAndTime(e.UcevDate, e.UcevTime),
                Title = e.UcevDescription,
                EventType = eventTypeName
            };

            tasks.Add(task);
        }

        // Order by newest first
        return tasks.OrderByDescending(e => e.DueDate).ToList();
    }

    public async Task SetEventAsClosed(int eventId, bool closed)
    {
        var eventToUpdate =
            await GetEventByIdAsync(Context, eventId)
            ?? throw new KeyNotFoundException($"Event with ID {eventId} not found.");
        eventToUpdate.UcevClosed = closed;
        await Context.SaveChangesAsync();
    }

    public async Task UpdateEventDate(int eventId, DateTime date)
    {
        var eventToUpdate =
            await GetEventByIdAsync(Context, eventId)
            ?? throw new KeyNotFoundException($"Event with ID {eventId} not found.");
        eventToUpdate.UcevDate = date.Date;
        await Context.SaveChangesAsync();
    }

    public async Task UpdateEventTime(int eventId, DateTime time)
    {
        var eventToUpdate =
            await GetEventByIdAsync(Context, eventId)
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

    private static bool IsOverdue(DateTime dueDate, DateTime referenceDate) =>
        dueDate.Date < referenceDate.Date ||
        (dueDate.Date == referenceDate.Date && dueDate.TimeOfDay < DateTime.Now.TimeOfDay);

    private static async Task<TucEvent> GetEventByIdAsync(DespatchContext context, int eventId) => await context.TucEvents.FirstOrDefaultAsync(e => e.UcevId == eventId);

    private static DateTime CombineDateAndTime(DateTime? date, DateTime? time)
    {
        if (date == null)
            return DateTime.MinValue;

        if (time == null)
            return date.Value;

        return new DateTime(
            date.Value.Year,
            date.Value.Month,
            date.Value.Day,
            time.Value.Hour,
            time.Value.Minute,
            time.Value.Second
        );
    }

    private async Task<string> GetEventTypeName(double? eventTypeId)
    {
        if (eventTypeId == null)
            return "Default";

        var eventType = await Context.TucEventTypes
            .Where(jt => Equals(jt.UcetId, eventTypeId))
            .Select(jt => jt.UcetName)
            .FirstOrDefaultAsync();

        return eventType ?? "Default";
    }
}
