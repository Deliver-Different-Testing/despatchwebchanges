namespace DespatchWeb.Models;

public sealed class ClearListEnvelopeViewModel
{
    public decimal MinimumLatitude { get; init; }
    public decimal MinimumLongitude { get; init; }
    public decimal MaximumLatitude { get; init; }
    public decimal MaximumLongitude { get; init; }
}

public sealed class EnvelopeCoordinate
{
    public decimal Longitude { get; init; }
    public decimal Latitude { get; init; }
}