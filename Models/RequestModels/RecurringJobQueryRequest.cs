namespace DespatchWeb.Models.RequestModels;

public class RecurringJobQueryRequest
{
    public string Order { get; set; }
    public string OrderDirection { get; set; }
    public int Limit { get; set; }
    public int Page { get; set; }
    public string SearchText { get; set; }
    public bool Active { get; set; }
}