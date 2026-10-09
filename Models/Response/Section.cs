namespace DespatchWeb.Models.Response;

public sealed record Section
{
    public Arrival Arrival { get; init; }
    public Departure Departure { get; init; }
    public string Id { get; init; }
    public Summary Summary { get; init; }
    public Transport Transport { get; init; }
    public string Type { get; init; }
}
