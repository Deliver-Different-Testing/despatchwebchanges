#nullable enable
namespace DespatchWeb.Models.Dto;

// Wire DTOs for the DespatchWeb -> Integration Manager Cirium gateway. These mirror the neutral
// contracts in IntegrationManager.Core/Carriers/Cirium/Contracts by JSON shape (camelCase, matched
// case-insensitively on deserialize). DespatchWeb does not reference the IM assembly — these POCOs
// ARE the contract; a parity test guards against drift.

public sealed class CiriumFlightDto
{
    public string? Airline { get; init; }
    public string? AirlineCode { get; init; }
    public string? FlightNumber { get; init; }
    public DateTimeOffset DepartureTime { get; init; }
    public DateTimeOffset ArrivalTime { get; init; }
    public string? DepartureAirport { get; init; }
    public string? ArrivalAirport { get; init; }
    public TimeSpan Duration { get; init; }
    public int Stops { get; init; }
    public string? Aircraft { get; init; }
    public List<string>? ServiceClasses { get; init; }
    public bool IsCodeShare { get; init; }
    public string? ServiceType { get; init; }
    public bool IsCharter { get; init; }
    public string? ServiceTypeDescription { get; init; }
    public string? CodeShareAirline { get; init; }
    public bool IsMultiSegment { get; init; }
    public int ElapsedTime { get; init; }
    public int Score { get; init; }
    public string? ConnectionId { get; init; }
    public string? DepartureTimeZone { get; init; }
    public string? ArrivalTimeZone { get; init; }
    public List<CiriumFlightSegmentDto> FlightSegments { get; init; } = [];
}
