namespace DespatchWeb.Models;

public sealed class UndeliverableLocation
{
    public int Id { get; init; }
    public string Text { get; init; }
    public int JobStatusId { get; init; }
}