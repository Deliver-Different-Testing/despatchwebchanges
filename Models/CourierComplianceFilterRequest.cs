namespace DespatchWeb.Models;

public class CourierComplianceFilterRequest : PaginatedRequest
{
    public string Type { get; init; }
    public string Status { get; init; }
    public int Fleet { get; init; }
}
