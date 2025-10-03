namespace DespatchWeb.Models.Dto;

public class GetAirportsDto
{
    public int AirportId { get; set; }
    public int FlightBufferMinutes { get; set; }
    public string AirportCode { get; set; }
    public string Timezone { get; set; }
}