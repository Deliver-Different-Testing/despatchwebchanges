using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface ITaskRepository
{
    Task<List<TaskViewModel>> GetAllTasksAsync(TaskTableFiltersRequest filters);
    Task SetEventAsClosedAsync(int eventId, bool closed);
    Task UpdateEventDateAsync(int eventId, DateTime date);
    Task UpdateEventTime(int eventId, DateTime time);
    Task ReassignEventToUser(int eventId, int staffId);
    Task<List<Suggestion>> GetEventGroupsAsync();
    Task<List<EventGroupViewModel>> GetEventTypeGroupsAsync(int eventGroupId);

    Task CreateEventsForJobAsync(
        int jobId,
        List<EventGroupViewModel> eventGroupViewModels);
    Task<List<Suggestion>> GetActiveStaffAsync();

    Task AddEventAsync(
        int jobId,
        int staffId,
        string despatcherName,
        string notes,
        int eventType,
        int? lateTime = null,
        DateTime? etaTime = null,
        bool close = false
    );
}
