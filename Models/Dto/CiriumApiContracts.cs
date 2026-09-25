#nullable enable
namespace DespatchWeb.Models.Dto;

// Wire DTOs for the DespatchWeb -> Integration Manager Cirium gateway. These mirror the neutral
// contracts in IntegrationManager.Core/Carriers/Cirium/Contracts by JSON shape (camelCase, matched
// case-insensitively on deserialize). DespatchWeb does not reference the IM assembly — these POCOs
// ARE the contract; a parity test guards against drift.

public sealed class CiriumFlightSearchRequestDto
{
    public int JobId { get; init; }
    public DateTimeOffset? DepartureDateTime { get; init; }
    public DateTime TenantNow { get; init; }
    public int? AirlineId { get; init; }
    public int? DepartureAirportId { get; init; }
    public int? ArrivalAirportId { get; init; }
    public string? CodeType { get; init; }
    public IReadOnlyList<string>? ExtendedOptions { get; init; }
    public int MinimumLayoverMinutes { get; init; } = 60;
    public bool AllowNearbyDepartures { get; init; }
    public bool AllowNearbyArrivals { get; init; }
}

public sealed class CiriumFlightSearchResponseDto
{
    public List<CiriumFlightDto> Flights { get; init; } = [];
    public string? Message { get; init; }
}

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

public sealed class CiriumCreateAlertRequestDto
{
    public string CompleteFlightNumber { get; init; } = string.Empty;
    public DateTimeOffset DepartureTime { get; init; }
    public string DepartureAirportCode { get; init; } = string.Empty;
    public string? DeliverToUrl { get; init; }
    public string? DeliverToToken { get; init; }
    public string? Events { get; init; }
}

public sealed class CiriumAlertResultDto
{
    public string? RuleId { get; init; }
}

public sealed class CiriumAlertStatusDto
{
    public bool Active { get; init; }
}
