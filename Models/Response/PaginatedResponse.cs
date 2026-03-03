using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class PaginatedResponse<T>
{
    public IEnumerable<T> Items { get; init; }
    public int Total { get; init; }
    public int Page { get; init; }
    public int Pages { get; init; }
}

public class CourierCompliancePaginatedResponse : PaginatedResponse<CourierComplianceViewModel>
{
    public int TotalExpired { get; init; }
    public int TotalExpiringSoon { get; init; }
    public int TotalValid { get; init; }
}

public class CourierAfterHoursPaginatedResponse : PaginatedResponse<AfterHoursCourierScheduleViewModel>
{
    public int TotalActiveDrivers { get; init; }
}

public class TodayActiveDriversPaginatedResponse : PaginatedResponse<TodayActiveDriversViewModel>
{
    public int TotalActiveDrivers { get; init; }
    public int TotalDriversActiveToday { get; init; }
    public double AverageSessionTime { get; init; }
}

public class CourierDailyEarningsPaginatedResponse : PaginatedResponse<CourierDailyEarningsViewModel>
{
    public decimal TotalEarningsToday { get; init; }
    public decimal AverageHourlyRate { get; init; }
    public int TotalActiveDrivers { get; init; }
    public int TotalDeliveriesToday { get; init; }
}