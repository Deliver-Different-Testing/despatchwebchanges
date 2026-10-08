namespace DespatchWeb.Models;

public class TodayActiveDriversFilterRequest : PaginatedRequest
{
    public string Status { get; init; }
    public int Fleet { get; init; }
}
