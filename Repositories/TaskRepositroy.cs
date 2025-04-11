using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class TaskRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService
)
    : BaseRepository(contextFactory),
        ITaskRepository
{
    public async Task<List<TaskViewModel>> GetAllTasksAsync(TaskTableFiltersRequest filters)
    {
        var today = filters?.Date ?? infoService.GetCurrentTenantTime();

        var query = Context.TucEvents
            .Where(e => e.UcevDate.Value.Date > today.Date ||
                        (e.UcevDate.Value.Date <= today.Date && !e.UcevClosed));

        if (filters != null) query = ApplyFilters(query, filters);

        query = ApplyOrdering(query, filters, today);

        var tasks = await query.Select(x => new TaskViewModel
            {
                Id = x.UcevId,
                Assignee = new Suggestion
                {
                    Id = x.UcevStaffIdin ?? 0,
                    Text = x.UcevStaffIdinNavigation.UcstFirstName + " " + x.UcevStaffIdinNavigation.UcstLastName
                },
                Description = x.UcevNotes,
                JobId = x.UcevJobId ?? 0,
                Closed = x.UcevClosed,
                DueDate = x.UcevDate != null && x.UcevTime != null
                    ? EF.Functions.DateTimeFromParts(
                        x.UcevDate.Value.Year,
                        x.UcevDate.Value.Month,
                        x.UcevDate.Value.Day,
                        x.UcevTime.Value.Hour,
                        x.UcevTime.Value.Minute,
                        x.UcevTime.Value.Second,
                        x.UcevTime.Value.Millisecond)
                    : DateTime.MinValue,
                Title = x.UcevTypeNavigation.UcetName,
                EventType = x.UcevTypeNavigation.UcetGroup,
                JobNumber = x.UcevJob.UcjbNumber
            })
            .AsNoTracking()
            .ToListAsync();

        return tasks;
    }

    private static IQueryable<TucEvent> ApplyOrdering(IQueryable<TucEvent> query, TaskTableFiltersRequest filters,
        DateTime today)
    {
        if (filters == null) return query;

        if (string.IsNullOrWhiteSpace(filters.OrderBy))
            return query;

        var isDescending = string.Equals(filters.OrderDirection, "desc", StringComparison.OrdinalIgnoreCase);

        return filters.OrderBy.ToLowerInvariant() switch
        {
            "created" =>
                ApplyDateTimeOrder(query, isDescending, today),

            _ =>
                ApplyDateTimeOrder(query, isDescending, today)
        };
    }

    private static IQueryable<TucEvent> ApplyDateTimeOrder(IQueryable<TucEvent> query, bool isDescending,
        DateTime today)
    {
        return isDescending
            ? query.OrderByDescending(e => e.UcevDate < today)
                .ThenByDescending(e => e.UcevDate)
                .ThenByDescending(e => e.UcevTime)
            : query.OrderByDescending(e => e.UcevDate < today)
                .ThenBy(e => e.UcevDate)
                .ThenBy(e => e.UcevTime);
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
            .TucEventTypeGroups
            .Select(x => new Suggestion { Id = x.Id, Text = x.Name })
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
                Group = x.EventTypeGroup.Name
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
            query = query.Where(e => (int)e.UcevType == filters.EventTypeId);

        // Filter by staffId
        if (filters.StaffId.HasValue && filters.StaffId.Value != -1)
            query = query.Where(e => Equals((int)e.UcevStaffIdin, filters.StaffId.Value) || e.UcevStaffIdin == null);

        if (filters.StaffId is -1)
            query = query.Where(e => e.UcevStaffIdin == null);

        // Filter by SearchText if provided
        if (string.IsNullOrWhiteSpace(filters.SearchText)) return query;

        var searchText = filters.SearchText.ToLower();
        query = query.Where(e =>
            (e.UcevDescription != null && e.UcevDescription.ToLower().Contains(searchText))
            || (
                e.UcevNotes != null
                && e.UcevNotes.Contains(searchText)
            )
            || (e.UcevDespatcher != null && e.UcevDespatcher.ToLower().Contains(searchText))
        );

        return query;
    }

    private async Task<TucEvent> GetEventByIdAsync(int eventId) =>
        await Context.TucEvents.FirstOrDefaultAsync(e => e.UcevId == eventId);

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
