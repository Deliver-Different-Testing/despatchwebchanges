using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
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
       // Determine date for filtering
       var selectedDate = filters?.Date ?? tenantTimeService.GetCurrentTenantTime();

       // Build initial query
       var query = Context.TucEvents
           .Where(e => e.UcevDate != null && e.UcevDate.Value.Date <= selectedDate.Date);

       if (filters != null) query = ApplyFilters(query, filters);

       var taskData = await query
           .GroupJoin(
               Context.TucStaffs,
               events => events.UcevStaffIdin,
               staff => staff.UcstId,
               (events, staffs) => new { events, staffs }
           )
           .SelectMany(
               x => x.staffs.DefaultIfEmpty(),
               (x, staff) => new TaskDto
               {
                   Id = x.events.UcevId,
                   Despatcher = x.events.UcevDespatcher,
                   Notes = x.events.UcevNotes,
                   JobId = x.events.UcevJobId,
                   Closed = x.events.UcevClosed,
                   Date = x.events.UcevDate,
                   Time = x.events.UcevTime,
                   Description = x.events.UcevDescription,
                   EventType = x.events.UcevType ?? 0,
                   StaffId = staff != null ? staff.UcstId : 0,
                   StaffFirstName = staff != null ? staff.UcstFirstName : string.Empty,
                   StaffLastName = staff != null ? staff.UcstLastName : string.Empty
               }
           )
           .ToListAsync();

       // Map to view models and sort by due date descending
       var taskViewModels = await MapToViewModelsAsync(taskData);
       return taskViewModels.OrderByDescending(vm => vm.DueDate).ToList();
   }

   private async Task<List<TaskViewModel>> MapToViewModelsAsync(List<TaskDto> taskData)
   {
       var eventTypeIds = taskData.Select(dto => (int)dto.EventType).Distinct().ToList();
       var eventTypeDict = new Dictionary<int, string>();

       foreach (var typeId in eventTypeIds) eventTypeDict[typeId] = await GetEventTypeNameAsync(typeId);

       return taskData.Select(dto => new TaskViewModel
       {
           Id = dto.Id,
           Assignee = new Suggestion
           {
               Id = dto.StaffId,
               Text = $"{dto.StaffFirstName} {dto.StaffLastName}"
           },
           Description = dto.Notes,
           JobId = dto.JobId ?? 0,
           Closed = dto.Closed ?? false,
           DueDate = CombineDateAndTime(dto.Date, dto.Time),
           Title = dto.Description,
           EventType = eventTypeDict[(int)dto.EventType]
       }).ToList();
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
