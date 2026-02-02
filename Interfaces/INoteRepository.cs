using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface INoteRepository
{
    // Job Notes
    Task<List<TucNoteViewModel>> GetNotesByJobIdAsync(int jobId);
    Task<TucNoteViewModel> GetNoteByIdAsync(int noteId);
    Task SaveNoteAsync(TucNoteViewModel viewModel, CancellationToken ct = default);
    Task DeleteNoteAsync(int noteId, CancellationToken ct = default);

    // Bulk Job Notes
    Task<List<TucNoteViewModel>> GetBulkJobNotesByBulkJobIdAsync(int bulkJobId);
    Task SaveBulkNoteAsync(TucNoteViewModel viewModel, CancellationToken ct = default);

    // Note Types
    Task<List<NoteTypeViewModel>> GetNoteTypesAsync();
    Task AddNewTucNoteTypeAsync(NoteTypeViewModel noteType);

    // Utility (needed by note operations)
    Task<bool> IsJobArchived(int jobId);
}
