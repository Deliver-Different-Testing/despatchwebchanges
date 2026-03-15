namespace DespatchWeb.Models.RequestModels;

public class TaskTableFiltersRequest
{
    public int? CourierId { get; init; }
    public int? EventTypeId { get; init; }
    public string SearchText { get; init; }
    public DateTimeOffset? Date { get; init; }
    public string OrderBy { get; init; }
    public string OrderDirection { get; init; }
    public int? StaffId { get; init; }
    public bool? ShowCompleted { get; init; }
    public int? JobId { get; init; }
    public DateTimeOffset? StartDate { get; init; }
    public DateTimeOffset? EndDate { get; init; }
}
