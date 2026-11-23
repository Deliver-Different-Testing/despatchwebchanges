#nullable enable
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

public interface IForwardAirApiClient
{
    Task<ForwardAirQuoteResponseDto> GetLegQuoteAsync(int legId, CancellationToken ct = default);
    Task<ForwardAirJobDto?> GetJobAsync(int legId, CancellationToken ct = default);
    Task<ForwardAirDocument?> GetDocumentAsync(int legId, string type, CancellationToken ct = default);
}
