namespace DespatchWeb.Models.Response;

public record PaginatedResponse<T>
{
    public IEnumerable<T> Items { get; init; }
    public int Total { get; init; }
    public int Page { get; init; }
    public int Pages { get; init; }
}

public sealed record CourierCompliancePaginatedResponse : PaginatedResponse<CourierComplianceViewModel>
{
    public int TotalExpired { get; init; }
    public int TotalExpiringSoon { get; init; }
    public int TotalValid { get; init; }
}

public sealed record CourierAfterHoursPaginatedResponse : PaginatedResponse<AfterHoursCourierScheduleViewModel>
{
    public int TotalActiveDrivers { get; init; }
}

public sealed record TodayActiveDriversPaginatedResponse : PaginatedResponse<TodayActiveDriversViewModel>
{
    public int TotalActiveDrivers { get; init; }
    public int TotalDriversActiveToday { get; init; }
    public double AverageSessionTime { get; init; }
}

public sealed record CourierDailyEarningsPaginatedResponse : PaginatedResponse<CourierDailyEarningsViewModel>
{
    public decimal TotalEarningsToday { get; init; }
    public decimal AverageHourlyRate { get; init; }
    public int TotalActiveDrivers { get; init; }
    public int TotalDeliveriesToday { get; init; }
}