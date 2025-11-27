using System;

namespace DespatchWeb.Models;

public class JobQueryParams
{
    public DateTimeOffset? DateCutoff { get; set; }
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }
    public bool UseTime { get; set; }

    public int? Page { get; set; }
    public int? PageSize { get; set; }

    public string SearchText { get; set; }
    public string StatusFilter { get; set; } // 'needs-dispatch', 'all', 'active', etc.
}
