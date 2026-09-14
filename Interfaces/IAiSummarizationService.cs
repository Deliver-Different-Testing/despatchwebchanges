using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IAiSummarizationService
{
    Task<AiSummaryResponse> SummarizeJobNotesAsync(int jobId, CancellationToken ct = default);
    Task<AiSummaryResponse> SummarizeJobEventsAsync(int jobId, CancellationToken ct = default);
    Task<StructuredSummaryResponse> SummarizeTaskDashboardAsync(CancellationToken ct = default);
    Task<StructuredSummaryResponse> SummarizeJobAsync(int jobId, CancellationToken ct = default);
    Task<StructuredSummaryResponse> SummarizeOperationsAsync(CancellationToken ct = default);
    Task<StructuredSummaryResponse> SummarizeComplianceAsync(CancellationToken ct = default);
}
