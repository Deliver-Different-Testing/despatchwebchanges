namespace DespatchWeb.Models.Response;

public readonly record struct Location
{
    public double Lat { get; init; }
    public double Lng { get; init; }
}
