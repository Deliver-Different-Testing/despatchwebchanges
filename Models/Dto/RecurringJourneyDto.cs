namespace DespatchWeb.Models.Dto;

public sealed record RecurringJourneyDto
{
    public RecurringJourneyBreakdownDto Breakdown { get; init; } = new();
    public IReadOnlyList<RecurringJourneyRunDto> Runs { get; init; } = [];
}
