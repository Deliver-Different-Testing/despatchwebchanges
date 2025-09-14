namespace DespatchWeb.Models.Dto;

public class GetArrivalAndDepartureAirportsDto
{
    public int AirportId { get; set; }
    public string AirportCode { get; set; }
    public int FlightBufferMinutes { get; set; }
}