using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IAiSummarizationService
{
    Task<AiSummaryResponse> SummarizeJobNotesAsync(int jobId, CancellationToken ct = default);
    Task<AiSummaryResponse> SummarizeJobEventsAsync(int jobId, CancellationToken ct = default);
    Task<AiSummaryResponse> SummarizeTaskDashboardAsync(CancellationToken ct = default);
    Task<AiSummaryResponse> SummarizeJobAsync(int jobId, CancellationToken ct = default);
    Task<AiSummaryResponse> SummarizeOperationsAsync(CancellationToken ct = default);
    Task<AiSummaryResponse> SummarizeComplianceAsync(CancellationToken ct = default);
    Task<AiSummaryResponse> AnalyzeLateAlertAsync(int jobId, CancellationToken ct = default);
    Task<AiCourierSuggestionResponse> SuggestCouriersAsync(int jobId, CancellationToken ct = default);
}
