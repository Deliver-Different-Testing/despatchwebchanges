using System.Collections.Generic;

namespace DespatchWeb.Models;

public class PagedList<T>
{
    public List<T> Items { get; set; }
    public int TotalCount { get; set; }
}

public class JobInfo
{
    public string ClientItemIds { get; set; }
    public bool IsVan { get; set; }
}