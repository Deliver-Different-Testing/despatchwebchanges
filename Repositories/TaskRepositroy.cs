using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
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

        var query = Context.TucEvents.AsQueryable();

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
                DueDate = x.UcevDueTime,
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
        var dfrntEvent = await Context.TucEvents.FindAsync(eventId);
        ArgumentNullException.ThrowIfNull(dfrntEvent);

        dfrntEvent.UcevClosed = closed;

        await Context.SaveChangesAsync();
    }

    public async Task UpdateEventDateAsync(int eventId, string date)
    {
        var dfrntEvent = await Context.TucEvents.FindAsync(eventId);
        ArgumentNullException.ThrowIfNull(dfrntEvent);

        var newDate = DateTime.Parse(date).Date;
        var existingTime = dfrntEvent.UcevDueTime.TimeOfDay;

        dfrntEvent.UcevDueTime = newDate.Add(existingTime);
        await Context.SaveChangesAsync();
    }

    public async Task UpdateEventTime(int eventId, string time)
    {
        var dfrntEvent = await Context.TucEvents.FindAsync(eventId);
        ArgumentNullException.ThrowIfNull(dfrntEvent);

        dfrntEvent.UcevDueTime = DateTime.Parse(time);
        await Context.SaveChangesAsync();
    }

    public async Task ReassignEventToUser(int eventId, int staffId)
    {
        var dfrntEvent = await Context.TucEvents.FindAsync(eventId);
        ArgumentNullException.ThrowIfNull(dfrntEvent);

        dfrntEvent.UcevStaffIdin = staffId;
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
                DueTime = x.DueTime != null ? DateTime.Now.AddMinutes((double)x.DueTime) : null,
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

        var currentDate = infoService.GetCurrentTenantTime();
        var staffId = infoService.GetStaffId();
        var despatcher = await Context.TucStaffs
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
                despatcher: despatcher,
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
        if (filters.Date.HasValue)
            query = query.Where(e => e.UcevDueTime.Date <= filters.Date);

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
            || (e.UcevJob != null && e.UcevJob.UcjbNumber != null && e.UcevJob.UcjbNumber.ToLower().Contains(searchText))
            || (e.UcevJob != null && e.UcevJob.Parent != null && e.UcevJob.Parent.UcjbNumber != null && e.UcevJob.Parent.UcjbNumber.ToLower().Contains(searchText))
            || (e.UcevJob != null && e.UcevJob.Parent != null && e.UcevJob.Parent.InverseParent != null && e.UcevJob.Parent.InverseParent.Any(j =>
                j.UcjbNumber != null && j.UcjbNumber.ToLower().Contains(searchText)))
        );

        return query;
    }

    public async Task AddEventAsync(
        int jobId,
        int staffId,
        string despatcherName,
        string notes,
        int eventType,
        DateTime? dueDate = null,
        int? lateTime = null,
        DateTime? etaTime = null,
        bool close = false
    )
    {
        var job = await Context.TucJobs.FindAsync(jobId);
        ArgumentNullException.ThrowIfNull(job, "Job not found");

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
            staffIdIn: staffId,
            staffIdOut: null,
            responseTime: null,
            notes: notes,
            pageCourier: false,
            closed: close,
            originator: staffId,
            description: notes,
            courierId: job.UcjbCourierId,
            jobId: jobId,
            despatcher: despatcherName,
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
                    switch (type)
                    {
                        // Late pickup
                        case (int)EventType.LatePickUp:
                            automaticResponse = AutoResponseTypes.Contains(clientContactJobType.PickupType);
                            break;
                        // Late delivery
                        case (int)EventType.LateDelivery:
                            automaticResponse = AutoResponseTypes.Contains(clientContactJobType.DeliveryType);
                            break;
                    }
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
            UcevDueTime = dueTime.HasValue ? infoService.ConvertUtcToTenantTime(dueTime.Value) : currentDate
        };

        await Context.TucEvents.AddAsync(newEvent);
        await Context.SaveChangesAsync();
    }
}
