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

public class PaginatedRequest
{
    public string SearchTerm { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public string OrderBy { get; set; } = string.Empty;
    public bool SortDescending { get; set; }
}