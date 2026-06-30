using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IAiDraftingService
{
    Task<AiDraftResponse> DraftCourierMessageAsync(DraftMessageRequest request, CancellationToken ct = default);
    Task<AiEmailDraftResponse> DraftEmailAsync(DraftEmailRequest request, CancellationToken ct = default);
    Task<AiEmailDraftResponse> DraftPodEmailAsync(int jobId, CancellationToken ct = default);
    Task<AiDraftResponse> DraftNoteAsync(DraftNoteRequest request, CancellationToken ct = default);
}
