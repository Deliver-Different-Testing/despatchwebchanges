namespace DespatchWeb.Models;

public class CourierAfterHoursFilterRequest : PaginatedRequest
{
    public string Day { get; init; }
}
