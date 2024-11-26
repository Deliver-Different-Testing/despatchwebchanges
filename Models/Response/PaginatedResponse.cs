using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class PaginatedResponse<T>
{
    public IEnumerable<T> Items { get; set; }
    public int Total { get; set; }
    public int Page { get; set; }
    public int Pages { get; set; }
}