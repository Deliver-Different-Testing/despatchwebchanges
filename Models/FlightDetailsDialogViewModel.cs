namespace DespatchWeb.Models;

public class AirportViewModel
{
    public string Code { get; set; }
    public string Name { get; set; }
    public string City { get; set; }
    public string Country { get; set; }
    public string Timezone { get; set; }
    public int Elevation { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}