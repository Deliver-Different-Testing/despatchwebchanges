using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Low-level HTTP client to the Despatch api project (sister of DespatchWeb). All calls
/// are authenticated with a freshly-minted SC-JWT bound to the receiving tenant so the
/// api's DynamicDespatchDBContextFactory routes the write to the correct DB. Mirrors
/// IntegrationManager.Core.Interfaces.IDespatchApiClient so the two callers stay aligned.
/// </summary>
public interface IDespatchApiClient
{
    /// <summary>Insert a new tucJob via POST /api/Jobs (runs WS_stpJob_InsertAsync via BookNZ/USPickupAsync).</summary>
    Task<JobResponseDto> BookPickupAsync(int tenantId, string connection, string timeZone, int? clientId,
        int contactId, BookPickupDto request, CancellationToken ct);
}
