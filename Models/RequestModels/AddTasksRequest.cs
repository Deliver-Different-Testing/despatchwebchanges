using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class AddTasksRequest
{
    public int JobId { get; init; }
    public List<EventGroupViewModel> EventGroupViewModels { get; init; }
}
