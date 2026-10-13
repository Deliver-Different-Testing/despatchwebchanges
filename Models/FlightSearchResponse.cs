namespace DespatchWeb.Models;

public sealed class FlightSearchResponse
{
    public List<FlightViewModel> Flights { get; init; } = [];
    public string Message { get; init; }
}
