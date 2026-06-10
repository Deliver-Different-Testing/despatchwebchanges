using DespatchWeb.Enums;

namespace DespatchWeb.Models.RequestModels;

public sealed class RecurringJobQueryRequest
{
    public string Order { get; init; }
    public string OrderDirection { get; init; }
    public int Limit { get; init; }
    public int Page { get; init; }
    public string SearchText { get; init; }

    // Legacy two-state filter retained for backwards compat during the
    // Active/Manual/Inactive rollout. New callers should send RecurringMode
    // instead; if both are present, RecurringMode wins.
    public bool Active { get; init; }

    // Tri-state filter (0=Inactive, 1=Active, 2=Manual). Nullable so old
    // clients continue to filter via Active. Once the UI fully migrates,
    // the Active field can be removed.
    public RecurringMode? RecurringMode { get; init; }

    // Filters
    public int? SpeedId { get; init; }
    public int? CourierId { get; init; }
    public int? DaysOfWeek { get; init; }
    public int? RouteId { get; init; }
}