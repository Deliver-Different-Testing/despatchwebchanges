namespace DespatchWeb.Models;

public class PaginatedRequest
{
    public string SearchTerm { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public string OrderBy { get; set; }
    public bool SortDescending { get; set; }
}

public class CourierComplianceFilterRequest : PaginatedRequest
{
    public string Type { get; set; }
    public string Status { get; set; }
    public int Fleet { get; set; }
}

public class CourierAfterHoursFilterRequest : PaginatedRequest
{
    public string Day { get; set; }
}

public class TodayActiveDriversFilterRequest : PaginatedRequest
{
    public string Location { get; set; }
    public string Status { get; set; }
    public int Fleet { get; set; }
}