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

    /// <summary>How a job-number search matched: "exact", "prefix" or "contains". Null for other searches.</summary>
    public string MatchMode { get; init; }

    /// <summary>
    /// Set on an empty job-number search: how many jobs starting with the term exist outside the date
    /// window, up to a cap of 50 (51 means "more than 50").
    /// </summary>
    public int? OutsideWindowCount { get; init; }

    /// <summary>
    /// Earliest and latest dates of those out-of-window matches, set only when all of them were found
    /// (count within the cap), so widening the search to this span is sure to show them.
    /// </summary>
    public DateTime? OutsideWindowFrom { get; init; }

    public DateTime? OutsideWindowTo { get; init; }

    /// <summary>The search hit its match cap, so <see cref="TotalCount"/> is a lower bound.</summary>
    public bool TotalIsCapped { get; init; }

    /// <summary>The search was too broad to run (term too short, or it timed out); nothing was returned.</summary>
    public bool SearchTooBroad { get; init; }
}
