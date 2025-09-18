using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class PaginatedResponse<T>
{
    public IEnumerable<T> Items { get; set; }
    public int Total { get; set; }
    public int Page { get; set; }
    public int Pages { get; set; }
}

public class CourierCompliancePaginatedResponse : PaginatedResponse<CourierComplianceViewModel>
{
    public int TotalExpired { get; set; }
    public int TotalExpiringSoon { get; set; }
    public int TotalValid { get; set; }
}

public class CourierAfterHoursPaginatedResponse : PaginatedResponse<AfterHoursCourierScheduleViewModel>
{
    public int TotalActiveDrivers { get; set; }
}

public class TodayActiveDriversPaginatedResponse : PaginatedResponse<TodayActiveDriversViewModel>
{
    public int TotalActiveDrivers { get; set; }
    public int TotalDriversActiveToday { get; set; }
    public double AverageSessionTime { get; set; }
}

public class CourierDailyEarningsPaginatedResponse : PaginatedResponse<CourierDailyEarningsViewModel>
{
    public decimal TotalEarningsToday { get; set; }
    public decimal AverageHourlyRate { get; set; }
    public int TotalActiveDrivers { get; set; }
    public int TotalDeliveriesToday { get; set; }
}