namespace DespatchWeb.Models.RequestModels;

public class TaskTableFiltersRequest
{
    public int? CourierId { get; set; }
    public int? EventTypeId { get; set; }
    public string SearchText { get; set; }
}
