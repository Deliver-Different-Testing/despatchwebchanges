namespace DespatchWeb.Models.Response;

public sealed record CourierAfterHoursPaginatedResponse : PaginatedResponse<AfterHoursCourierScheduleViewModel>
{
    public int TotalActiveDrivers { get; init; }
}
