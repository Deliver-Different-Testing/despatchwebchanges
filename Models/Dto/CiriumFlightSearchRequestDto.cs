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
