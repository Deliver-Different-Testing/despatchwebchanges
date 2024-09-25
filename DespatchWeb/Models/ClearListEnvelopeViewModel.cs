namespace DespatchWeb.Models;

public class ClearListEnvelopeViewModel
{
    public decimal MinimumLatitude { get; set; }
    public decimal MinimumLongitude { get; set; }
    public decimal MaximumLatitude { get; set; }
    public decimal MaximumLongitude { get; set; }
}

public class EnvelopeCoordinate
{
    public decimal Longitude { get; set; }
    public decimal Latitude { get; set; }
}