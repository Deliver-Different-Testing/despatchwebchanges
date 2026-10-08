namespace DespatchWeb.Models.Response;

public readonly record struct Coordinates
{
    public decimal Lat { get; init; }
    public decimal Lng { get; init; }
}
