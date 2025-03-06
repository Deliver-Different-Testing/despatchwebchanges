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

public class TaskRepository(IDbContextFactory<DespatchContext> contextFactory)
    : BaseRepository(contextFactory),
        ITaskRepository
{
    public async Task<List<TaskViewModel>> GetAllTasksAsync(TaskTableFiltersRequest filters)
    {
        var now = DateTime.Now;
        var today = DateTime.Today;
        var query = Context.TucEvents.AsQueryable();

        query = query.Where(e =>
                e.UcevDate != null
                && (
                    e.UcevDate.Value.Date == today
                    || // Due today
                    e.UcevDate.Value < now
                ) // Due in the past
        );

        // Apply additional filters
        if (filters != null)
            query = ApplyFilters(query, filters);

        // Project to view model
        var tasksQuery = query.Select(e => new TaskViewModel
        {
            Id = e.UcevId,
            Assignee = e.UcevDespatcher,
            Description = e.UcevNotes,
            JobId = e.UcevJobId ?? 0,
            Closed = e.UcevClosed,
            DueDate =
                e.UcevDate != null && e.UcevTime != null
                    ? new DateTime(
                        e.UcevDate.Value.Year,
                        e.UcevDate.Value.Month,
                        e.UcevDate.Value.Day,
                        e.UcevTime.Value.Hour,
                        e.UcevTime.Value.Minute,
                        e.UcevTime.Value.Second
                    )
                    : (e.UcevDate ?? DateTime.MinValue),
            Title = e.UcevDescription,
            EventType =
                Context
                    .TucEventTypes.Where(jt => jt.UcetId == e.UcevType)
                    .Select(jt => jt.UcetName)
                    .FirstOrDefault() ?? "Default",
        });

        var tasks = await tasksQuery.AsNoTracking().ToListAsync();

        var filteredTasks = new List<TaskViewModel>();
        foreach (var task in tasks)
        {
            bool isOverdue = IsOverdue(task.DueDate);
            task.IsOverdue = isOverdue;

            if (isOverdue || task.DueDate.Date == today)
                filteredTasks.Add(task);
        }

        // Only return tasks that should be kept
        return filteredTasks;
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
        var eventGroups = await Context.TucEventTypeGroups
            .Select(x => new Suggestion
            {
                Id = x.Id,
                Text = x.Name,
            })
            .AsNoTracking()
            .ToListAsync();

        return eventGroups;
    }

    public async Task<List<EventGroupViewModel>> GetEventTypeGroupsAsync(int eventGroupId)
    {
        var eventGroups = await Context
            .TucEventTypeEventTypeGroups
            .Where(x => x.EventTypeGroupId == eventGroupId)
            .Select(x => new EventGroupViewModel
            {
                Active = x.IsActive,
                DueTime = x.DueTime ?? 0,
                EventType = x.EventType.UcetName,
                Sequence = x.Sequence,
                Group = x.EventTypeGroup.Name,
                AssignTo = x.EventTypeGroup.CreatedBy,
            })
            .AsNoTracking()
            .ToListAsync();

        return eventGroups;
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
            query = query.Where(e => e.UcevType == filters.EventTypeId.Value);

        // Filter by SearchText if provided
        if (!string.IsNullOrWhiteSpace(filters.SearchText))
        {
            var searchText = filters.SearchText.ToLower();
            query = query.Where(e =>
                (e.UcevDescription != null && e.UcevDescription.ToLower().Contains(searchText))
                || (
                    e.UcevNotes != null
                    && e.UcevNotes.Contains(searchText, StringComparison.CurrentCultureIgnoreCase)
                )
                || (e.UcevDespatcher != null && e.UcevDespatcher.ToLower().Contains(searchText))
            );
        }

        return query;
    }

    private static bool IsOverdue(DateTime eventDate, int extraMinutes = 0)
    {
        var isOverdue = eventDate.AddMinutes(extraMinutes) < DateTime.Now;
        return isOverdue;
    }

    private static async Task<TucEvent> GetEventByIdAsync(DespatchContext context, int eventId)
    {
        return await context.TucEvents.FirstOrDefaultAsync(e => e.UcevId == eventId);
    }
}
