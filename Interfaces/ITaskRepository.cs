using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface ITaskRepository
{
    Task<IReadOnlyList<TaskViewModel>> GetAllTasksAsync(TaskTableFiltersRequest filters);
    Task SetEventAsClosedAsync(int eventId, bool closed);
    Task UpdateEventDueTimeAsync(int eventId, DateTimeOffset dueTime);
    Task ReassignEventToUserAsync(int eventId, int staffId);
    Task UnassignEventAsync(int eventId);
    Task<IReadOnlyList<Suggestion>> GetEventGroupsAsync();
    Task<IReadOnlyList<EventGroupViewModel>> GetEventTypeGroupsAsync(int eventGroupId);

    Task CreateEventsForJobAsync(int jobId, List<EventGroupViewModel> eventGroupViewModels);
    Task<IReadOnlyList<Suggestion>> GetActiveStaffAsync();

    Task AddEventAsync(
        int jobId,
        string notes,
        int eventType,
        DateTimeOffset? dueDate = null,
        int? lateTime = null,
        DateTimeOffset? etaTime = null,
        bool close = false
    ); 
}
