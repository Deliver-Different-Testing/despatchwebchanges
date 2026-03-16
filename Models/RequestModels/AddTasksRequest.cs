namespace DespatchWeb.Models.RequestModels;

public sealed class AddTasksRequest
{
    public int JobId { get; init; }
    public List<EventGroupViewModel> EventGroupViewModels { get; init; }
}
