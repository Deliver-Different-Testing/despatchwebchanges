using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IAiInsightsService
{
    Task<ExtractBlockersResponse> ExtractBlockersAsync(int jobId, CancellationToken ct = default);
    Task<PricingAnalysisResponse> AnalyzePricingAsync(int jobId, int accessorialChargeGroupId, CancellationToken ct = default);
    Task<ChangeRequestTriageResponse> TriageChangeRequestAsync(int requestId, int jobId, CancellationToken ct = default);
}
