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

public sealed class FlightSearchResponse
{
    public List<FlightViewModel> Flights { get; init; } = [];
    public string Message { get; init; }
}

public sealed class FlightSegmentViewModel
{
    public DateTimeOffset DepartureTime { get; set; }
    public DateTimeOffset ArrivalTime { get; set; }
    public int SegmentOrder { get; init; }
    public int StopsInSegment { get; init; }
    public int DepartureAirportId { get; init; }
    public string DepartureAirportName { get; init; }
    public string DepartureAirportCity { get; init; }
    public string DepartureAirportCountry { get; init; }
    public string DepartureAirportTimeZone { get; init; }
    public int DepartureAirportTimeZoneId { get; init; }
    public int ArrivalAirportId { get; init; }
    public string ArrivalAirportName { get; init; }
    public string ArrivalAirportCity { get; init; }
    public string ArrivalAirportCountry { get; init; }
    public string ArrivalAirportTimeZone { get; init; }
    public int ArrivalAirportTimeZoneId { get; init; }
    public string AircraftName { get; init; }
    public string AircraftType { get; init; }
    public string AirlineName { get; init; }
    public string CarrierFsCode { get; init; }
    public string FlightNumber { get; init; }
    public string ServiceType { get; init; }
    public string DepartureAirportFsCode { get; init; }
    public string ArrivalAirportFsCode { get; init; }
    public string FlightEquipmentIataCode { get; init; }
    public int? ElapsedTime { get; init; }
    public string ArrivalTerminal { get; set; }
    public string DepartureTerminal { get; set; }
}