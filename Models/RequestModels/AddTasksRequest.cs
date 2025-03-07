using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class AddTasksRequest
{
    public int JobId { get; set; }
    public List<EventGroupViewModel> EventGroupViewModels { get; set; }
}
