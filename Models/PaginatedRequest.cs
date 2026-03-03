namespace DespatchWeb.Models;

public class PaginatedRequest
{
    public string SearchTerm { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public string OrderBy { get; init; }
    public bool SortDescending { get; init; }
}

public class CourierComplianceFilterRequest : PaginatedRequest
{
    public string Type { get; init; }
    public string Status { get; init; }
    public int Fleet { get; init; }
}

public class CourierAfterHoursFilterRequest : PaginatedRequest
{
    public string Day { get; init; }
}

public class TodayActiveDriversFilterRequest : PaginatedRequest
{
    public string Status { get; init; }
    public int Fleet { get; init; }
}


