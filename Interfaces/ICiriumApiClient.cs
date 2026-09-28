#nullable enable
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

/// <summary>
/// DespatchWeb → Integration Manager client for the Cirium (FlightStats) gateway. IM owns the
/// Cirium credentials and API calls; DespatchWeb calls these endpoints instead of Cirium directly.
/// </summary>
public interface ICiriumApiClient
{
    Task<CiriumFlightSearchResponseDto> SearchFlightsAsync(CiriumFlightSearchRequestDto request, CancellationToken ct = default);
    Task<string?> CreateAlertAsync(CiriumCreateAlertRequestDto request, CancellationToken ct = default);
    Task DeleteAlertAsync(string ruleId, CancellationToken ct = default);
    Task<bool> IsAlertActiveAsync(string ruleId, CancellationToken ct = default);
}
