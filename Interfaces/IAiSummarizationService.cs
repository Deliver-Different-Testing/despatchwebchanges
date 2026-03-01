using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IAiSummarizationService
{
    Task<AiSummaryResponse> SummarizeJobNotesAsync(int jobId, CancellationToken ct = default);
    Task<AiSummaryResponse> SummarizeJobEventsAsync(int jobId, CancellationToken ct = default);
}
