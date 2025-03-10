using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface ITaskRepository
{
    Task<List<TaskViewModel>> GetAllTasksAsync(TaskTableFiltersRequest filters);
    Task SetEventAsClosed(int eventId, bool closed);
    Task UpdateEventDate(int eventId, DateTime date);
    Task UpdateEventTime(int eventId, DateTime time);
    Task<List<Suggestion>> GetEventGroupsAsync();
    Task<List<EventGroupViewModel>> GetEventTypeGroupsAsync(int eventGroupId);

    Task CreateEventsForJobAsync(
        int jobId,
        List<EventGroupViewModel> eventGroupViewModels);
    Task<List<Suggestion>> GetActiveStaffAsync();
}
