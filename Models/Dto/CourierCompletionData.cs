namespace DespatchWeb.Models.Dto;

public sealed record CourierCompletionData
{
    public int CompletedToday { get; init; }
    public DateTime? LastCompleted { get; init; }
}
