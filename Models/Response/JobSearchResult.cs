namespace DespatchWeb.Models.Response;

public sealed record JobSearchResult
{
    public IReadOnlyList<DispatchJobViewModel> Jobs { get; init; }
    public int TotalCount { get; init; }
    public bool HasMore { get; init; }
    public IReadOnlyList<DispatchMapItem> MapItems { get; init; }

    /// <summary>
    /// Counts for the stats header. Null on pages after the first, and on the paths that leave the
    /// counting to the client.
    /// </summary>
    public JobListStatusCounts StatusCounts { get; init; }
}
