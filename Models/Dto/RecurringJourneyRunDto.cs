using DespatchWeb.Enums;

namespace DespatchWeb.Models.Dto;

public sealed record RecurringJourneyRunDto
{
    public int ParentJobId { get; init; }
    public string ParentJobNumber { get; init; }
    public DateTimeOffset ServiceDate { get; init; }
    public RecurringJourneyStatus Status { get; init; }
    public decimal? Miles { get; init; }
    public RecurringJourneyPodDto Pod { get; init; }
    public IReadOnlyList<RecurringJourneyChildDto> Children { get; init; } = [];
}
