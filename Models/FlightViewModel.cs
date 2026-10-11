namespace DespatchWeb.Models;

public sealed class FlightViewModel
{
    public string Airline { get; init; }
    public string AirlineCode { get; init; }
    public string FlightNumber { get; init; }
    public DateTimeOffset DepartureTime { get; init; }
    public DateTimeOffset ArrivalTime { get; init; }
    public string DepartureAirport { get; init; }
    public string ArrivalAirport { get; init; }
    public TimeSpan Duration { get; init; }
    public int Stops { get; init; }
    public string Aircraft { get; init; }
    public List<string> ServiceClasses { get; init; }
    public bool IsCodeShare { get; init; }
    public string ServiceType { get; init; }
    public bool IsCharter { get; init; }
    public string ServiceTypeDescription { get; init; }
    public decimal Amount { get; set; }
    public string CodeShareAirline { get; init; }
    public bool IsMultiSegment { get; init; }
    public int ElapsedTime { get; init; }
    public int Score { get; init; }
    public string ConnectionId { get; init; }
    public List<FlightSegmentViewModel> FlightSegments { get; init; } = [];
    public string DepartureTimeZone { get; init; }
    public string ArrivalTimeZone { get; init; }
}
