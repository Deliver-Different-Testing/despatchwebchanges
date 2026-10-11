namespace DespatchWeb.Models.Response;

public sealed record Place
{
    public Location Location { get; init; }
    public string Type { get; init; }
}
