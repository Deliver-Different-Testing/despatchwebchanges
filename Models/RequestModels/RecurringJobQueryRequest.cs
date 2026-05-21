namespace DespatchWeb.Models.RequestModels;

public sealed class RecurringJobQueryRequest
{
    public string Order { get; init; }
    public string OrderDirection { get; init; }
    public int Limit { get; init; }
    public int Page { get; init; }
    public string SearchText { get; init; }
    public bool Active { get; init; }

    // Filters
    public int? SpeedId { get; init; }
    public int? CourierId { get; init; }
    public int? DaysOfWeek { get; init; }
    public int? RouteId { get; init; }
}