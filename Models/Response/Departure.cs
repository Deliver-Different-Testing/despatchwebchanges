namespace DespatchWeb.Models.Response;

public sealed record Departure
{
    public Place Place { get; init; }
    public DateTime Time { get; init; }
}
