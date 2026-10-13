namespace DespatchWeb.Models;

public class PaginatedRequest
{
    public string SearchTerm { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public string OrderBy { get; init; }
    public bool SortDescending { get; init; }
}
