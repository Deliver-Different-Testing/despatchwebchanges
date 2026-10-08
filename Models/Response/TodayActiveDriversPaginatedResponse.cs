namespace DespatchWeb.Models.Response;

public sealed record TodayActiveDriversPaginatedResponse : PaginatedResponse<TodayActiveDriversViewModel>
{
    public int TotalActiveDrivers { get; init; }
    public int TotalDriversActiveToday { get; init; }
    public double AverageSessionTime { get; init; }
}
