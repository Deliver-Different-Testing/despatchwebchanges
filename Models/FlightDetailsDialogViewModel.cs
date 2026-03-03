namespace DespatchWeb.Models;

public class AirportViewModel
{
    public string Code { get; init; }
    public string Name { get; init; }
    public string City { get; init; }
    public string Country { get; init; }
    public string Timezone { get; init; }
    public int Elevation { get; init; }
    public double Latitude { get; init; }
    public double Longitude { get; init; }
}