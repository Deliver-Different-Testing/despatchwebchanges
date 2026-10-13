#nullable enable
namespace DespatchWeb.Models.Dto;

// Wire DTOs for the DespatchWeb -> Integration Manager Cirium gateway. These mirror the neutral
// contracts in IntegrationManager.Core/Carriers/Cirium/Contracts by JSON shape (camelCase, matched
// case-insensitively on deserialize). DespatchWeb does not reference the IM assembly — these POCOs
// ARE the contract; a parity test guards against drift.

public sealed class CiriumCreateAlertRequestDto
{
    public string CompleteFlightNumber { get; init; } = string.Empty;
    public DateTimeOffset DepartureTime { get; init; }
    public string DepartureAirportCode { get; init; } = string.Empty;
    public string? DeliverToUrl { get; init; }
    public string? DeliverToToken { get; init; }
    public string? Events { get; init; }
}
