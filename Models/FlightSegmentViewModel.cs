namespace DespatchWeb.Models;

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
