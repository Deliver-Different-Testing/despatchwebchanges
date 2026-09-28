namespace DespatchWeb.Models;

public class JobQueryParams
{
    public DateTimeOffset? DateCutoff { get; init; }
    public DateTimeOffset? StartDate { get; init; }
    public DateTimeOffset? EndDate { get; init; }
    public bool UseTime { get; init; }

    public int? Page { get; init; }
    public int? PageSize { get; init; }

    public string SearchText { get; init; }
    public string StatusFilter { get; init; } // 'needs-dispatch', 'all', 'active', etc.
}
