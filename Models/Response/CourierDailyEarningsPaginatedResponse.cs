namespace DespatchWeb.Models.Response;

public sealed record CourierDailyEarningsPaginatedResponse : PaginatedResponse<CourierDailyEarningsViewModel>
{
    public decimal TotalEarningsToday { get; init; }
    public decimal AverageHourlyRate { get; init; }
    public int TotalActiveDrivers { get; init; }
    public int TotalDeliveriesToday { get; init; }
}
