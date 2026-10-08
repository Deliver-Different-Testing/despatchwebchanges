using DespatchWeb.Enums;

namespace DespatchWeb.Models.Dto;

public sealed record RecurringJourneyChildDto
{
    public int JobId { get; init; }
    public string JobNumber { get; init; }

    /// <summary>
    /// The leg's own resolved status. Legs used to carry none at all, so a run could render as
    /// Completed above a row of legs showing nothing — the "complete and null" pair.
    /// </summary>
    public RecurringJourneyStatus Status { get; init; }
}
