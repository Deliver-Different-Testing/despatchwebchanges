using System;

namespace DespatchWeb.Models.RequestModels;

public class TaskTableFiltersRequest
{
    public int? CourierId { get; set; }
    public int? EventTypeId { get; set; }
    public string SearchText { get; set; }
    public DateTime? Date { get; set; }
    public string OrderBy { get; set; }
    public string OrderDirection { get; set; }
    public int? StaffId { get; set; }
    public bool? ShowCompleted { get; set; }
    public int? JobId { get; set; }
}
