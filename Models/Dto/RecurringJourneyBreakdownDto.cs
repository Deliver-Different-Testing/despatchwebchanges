namespace DespatchWeb.Models.Dto;

public sealed record RecurringJourneyBreakdownDto
{
    public int Total { get; init; }
    public int Completed { get; init; }
    public int Voided { get; init; }
    public int Pending { get; init; }
}
