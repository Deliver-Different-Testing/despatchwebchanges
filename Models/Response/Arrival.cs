namespace DespatchWeb.Models.Response;

public sealed record Arrival
{
    public Place Place { get; init; }
    public DateTime Time { get; init; }
}
