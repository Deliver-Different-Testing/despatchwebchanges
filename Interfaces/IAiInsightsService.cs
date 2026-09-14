using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IAiInsightsService
{
    Task<ExtractBlockersResponse> ExtractBlockersAsync(int jobId, CancellationToken ct = default);
    Task<PricingAnalysisResponse> AnalyzePricingAsync(int jobId, int accessorialChargeGroupId, CancellationToken ct = default);
    Task<ChangeRequestTriageResponse> TriageChangeRequestAsync(int requestId, int jobId, CancellationToken ct = default);

    /// <summary>
    /// Triages every open conversation in one call. The dispatcher reads each message
    /// themselves; this only orders the list they are about to work down.
    /// </summary>
    Task<InboxTriageResponse> TriageInboxAsync(CancellationToken ct = default);

    /// <summary>
    /// Turns a job's rate lines into sentences a dispatcher can read to a customer
    /// querying the price. It never recalculates — every number comes from the job.
    /// </summary>
    Task<PriceExplanationResponse> ExplainPriceAsync(
        int jobId, bool isPrebook = false, bool isArchived = false, CancellationToken ct = default);
}
