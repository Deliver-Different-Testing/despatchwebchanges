using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class TaskRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService) : BaseRepository(contextFactory), ITaskRepository
{
    public async Task<List<TaskViewModel>> GetAllTasksAsync(TaskTableFiltersRequest filters)
    {
        var today = filters?.Date ?? infoService.GetCurrentTenantTime().AddDays(1);

        var query = Context.TucEvents.Where(t => t.UcevTypeNavigation.UcetGroup == nameof(TaskGroup.CS));

        if (filters != null) query = ApplyFilters(query, filters);

        query = ApplyOrdering(query, filters, today.DateTime);

        var tasks = await query
            .Select(TaskMapping)
            .AsNoTracking()
            .ToListAsync();

        return tasks;
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
        DateTime today)
    {
        return isDescending
            ? query.OrderByDescending(e => e.UcevDueTime < today)
                .ThenByDescending(e => e.UcevDueTime)
            : query.OrderByDescending(e => e.UcevDueTime < today)
                .ThenBy(e => e.UcevDueTime);
    }

    public async Task SetEventAsClosedAsync(int eventId, bool closed)
    {
        var rowsAffected = await Context.TucEvents
            .Where(e => e.UcevId == eventId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(e => e.UcevClosed, closed));

        if (rowsAffected == 0) throw new ArgumentException($"Event with ID {eventId} not found.");
    }

    public async Task UpdateEventDateAsync(int eventId, string date)
    {
        var newDate = DateTime.Parse(date).Date;

        var existingEvent = await Context.TucEvents
            .Where(e => e.UcevId == eventId)
            .Select(e => new { e.UcevDueTime })
            .FirstOrDefaultAsync();
        ArgumentNullException.ThrowIfNull(existingEvent);

        var existingTime = existingEvent.UcevDueTime.TimeOfDay;

        await Context.TucEvents
            .Where(e => e.UcevId == eventId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(e => e.UcevDueTime, newDate.Add(existingTime)));
    }

    public async Task UpdateEventTimeAsync(int eventId, string time)
    {
        var rowsAffected = await Context.TucEvents
            .Where(e => e.UcevId == eventId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(e => e.UcevDueTime, DateTime.Parse(time)));

        if (rowsAffected == 0)
            throw new ArgumentException($"Event with ID {eventId} not found.");
    }

    public async Task ReassignEventToUserAsync(int eventId, int staffId)
    {
        var rowsAffected = await Context.TucEvents
            .Where(e => e.UcevId == eventId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(e => e.UcevStaffIdin, staffId));

        if (rowsAffected == 0)
            throw new ArgumentException($"Event with ID {eventId} not found.");
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
        var now = infoService.GetCurrentTenantTime();
        var eventGroups = await Context
            .TucEventTypeEventTypeGroups.Where(x => x.EventTypeGroupId == eventGroupId)
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
            .AsNoTracking()
            .ToListAsync();

        return eventGroups;
    }

    public async Task CreateEventsForJobAsync(int jobId, List<EventGroupViewModel> eventGroupViewModels)
    {
        var job = await Context.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job);
        ArgumentNullException.ThrowIfNull(job.UcjbClientId);

        var currentDate = infoService.GetCurrentTenantTime();
        var staffId = infoService.GetStaffId();
        var dispatcherName = await Context.TucStaffs
            .Where(s => s.UcstId == staffId)
            .Select(s => s.UcstFirstName + " " + s.UcstLastName)
            .FirstOrDefaultAsync();

        foreach (var eventGroup in eventGroupViewModels)
        {
            await InsertEventAsync(
                jobNo: job.UcjbNumber,
                clientId: job.UcjbClientId ?? 0,
                contact: job.UcjbContact,
                date: currentDate,
                time: currentDate,
                type: eventGroup.EventType.Id,
                lateTime: null,
                etaTime: null,
                staffIdIn: eventGroup.AssignTo?.Id,
                staffIdOut: null,
                responseTime: null,
                notes: eventGroup.Notes,
                pageCourier: false,
                closed: false,
                originator: staffId,
                description: eventGroup.EventType.Text,
                courierId: job.UcjbCourierId,
                jobId: job.UcjbId,
                despatcher: dispatcherName,
                jobType: job.UcjbSpeed,
                dueTime: eventGroup.DueTime
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

        var searchText = filters.SearchText.ToLower();
        query = query.Where(e =>
            (e.UcevDescription != null && e.UcevDescription.ToLower().Contains(searchText))
            || (e.UcevNotes != null && e.UcevNotes.Contains(searchText))
            || (e.UcevDespatcher != null && e.UcevDespatcher.ToLower().Contains(searchText))
            || (e.UcevJob != null && e.UcevJob.UcjbNumber != null &&
                e.UcevJob.UcjbNumber.ToLower().Contains(searchText))
            || (e.UcevJob != null && e.UcevJob.Parent != null && e.UcevJob.Parent.UcjbNumber != null &&
                e.UcevJob.Parent.UcjbNumber.ToLower().Contains(searchText))
            || (e.UcevJob != null && e.UcevJob.Parent != null && e.UcevJob.Parent.InverseParent != null &&
                e.UcevJob.Parent.InverseParent.Any(j =>
                    j.UcjbNumber != null && j.UcjbNumber.ToLower().Contains(searchText)))
        );

        return query;
    }

    public async Task AddEventAsync(
        int jobId,
        string notes,
        int eventType,
        DateTime? dueDate = null,
        int? lateTime = null,
        DateTime? etaTime = null,
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

        var currentDate = infoService.GetCurrentTenantTime();

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

    private static readonly HashSet<string> AutoResponseTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Web", "Email", "Text"
    };

    private async Task InsertEventAsync(
        string jobNo,
        int clientId,
        string contact,
        DateTime date,
        DateTime time,
        int type,
        int? lateTime,
        DateTime? etaTime,
        int? staffIdIn,
        int? staffIdOut,
        DateTime? responseTime,
        string notes,
        bool pageCourier,
        bool closed,
        int originator,
        string description,
        int? courierId,
        int jobId,
        string despatcher,
        int? jobType,
        DateTime? dueTime)
    {
        var currentDate = infoService.GetCurrentTenantTime();

        if (type is (int)EventType.LatePickUp or (int)EventType.LateDelivery)
        {
            var automaticResponse = false;

            var job = await Context.TucJobs.FindAsync(jobId);
            if (job != null)
            {
                // Find the relevant ClientContactJobType record
                var clientContactJobType =
                    Context.TblClientContactJobTypes.First(x => x.JobTypeId == job.UcjbSpeed);

                if (clientContactJobType != null)
                {
                    automaticResponse = type switch
                    {
                        // Late pickup
                        (int)EventType.LatePickUp => AutoResponseTypes.Contains(clientContactJobType.PickupType),
                        // Late delivery
                        (int)EventType.LateDelivery => AutoResponseTypes.Contains(clientContactJobType.DeliveryType),
                        _ => false
                    };
                }
            }

            // Set fields for automatic response
            if (automaticResponse)
            {
                closed = true;
                staffIdOut = 33; // INTERNET USER
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
            UcevDate = date,
            UcevTime = time,
            UcevType = type,
            UcevLateTime = lateTime,
            UcevEtatime = etaTime,
            UcevStaffIdin = staffIdIn,
            UcevStaffIdout = staffIdOut,
            UcevResponseTime = responseTime,
            UcevNotes = notes,
            UcevPageCourier = pageCourier,
            UcevClosed = closed,
            UcevOriginator = originator,
            UcevDescription = description,
            UcevCourierId = courierId,
            UcevJobId = jobId,
            UcevDespatcher = despatcher,
            UcevJobType = jobType,
            UcevDueTime = dueTime ?? currentDate
        };

        await Context.AddAsync(newEvent);
        await Context.SaveChangesAsync();
    }

    private static readonly Expression<Func<TucEvent, TaskViewModel>> TaskMapping = e => new TaskViewModel
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
    };
}