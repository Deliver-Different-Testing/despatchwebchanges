namespace DespatchWeb.Models.Dto;

public sealed record RecurringJourneyPodDto
{
    public DateTimeOffset Time { get; init; }
    public string SignedBy { get; init; }
}
