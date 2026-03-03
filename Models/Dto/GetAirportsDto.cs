namespace DespatchWeb.Models.Dto;

public class GetAirportsDto
{
    public int AirportId { get; init; }
    public int FlightBufferMinutes { get; init; }
    public string AirportCode { get; init; }
    public string Timezone { get; init; }
}