#nullable enable
namespace DespatchWeb.Models.Dto;

// Wire DTOs for the DespatchWeb -> Integration Manager Cirium gateway. These mirror the neutral
// contracts in IntegrationManager.Core/Carriers/Cirium/Contracts by JSON shape (camelCase, matched
// case-insensitively on deserialize). DespatchWeb does not reference the IM assembly — these POCOs
// ARE the contract; a parity test guards against drift.

public sealed class CiriumFlightSegmentDto
{
    public int SegmentOrder { get; init; }
    public string? CarrierFsCode { get; init; }
    public string? FlightNumber { get; init; }
    public string? ServiceType { get; init; }
    public DateTimeOffset DepartureTime { get; init; }
    public DateTimeOffset ArrivalTime { get; init; }
    public int DepartureAirportId { get; init; }
    public string? DepartureAirportFsCode { get; init; }
    public string? DepartureTerminal { get; init; }
    public int ArrivalAirportId { get; init; }
    public string? ArrivalAirportFsCode { get; init; }
    public string? ArrivalTerminal { get; init; }
    public string? FlightEquipmentIataCode { get; init; }
    public int? ElapsedTime { get; init; }
    public int StopsInSegment { get; init; }
    public string? DepartureAirportName { get; init; }
    public string? DepartureAirportCity { get; init; }
    public string? DepartureAirportCountry { get; init; }
    public string? DepartureAirportTimeZone { get; init; }
    public string? ArrivalAirportName { get; init; }
    public string? ArrivalAirportCity { get; init; }
    public string? ArrivalAirportCountry { get; init; }
    public string? ArrivalAirportTimeZone { get; init; }
    public string? AircraftName { get; init; }
    public string? AircraftType { get; init; }
    public string? AirlineName { get; init; }
}
