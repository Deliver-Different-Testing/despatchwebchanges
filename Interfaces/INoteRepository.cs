using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface INoteRepository
{
    // Job Notes
    Task<IReadOnlyList<TucNoteViewModel>> GetNotesByJobIdAsync(int jobId);
    Task<TucNoteViewModel?> GetNoteByIdAsync(int noteId);
    Task SaveNoteAsync(TucNoteViewModel viewModel, CancellationToken ct = default);
    Task DeleteNoteAsync(int noteId, CancellationToken ct = default);

    // Bulk Job Notes
    Task<IReadOnlyList<TucNoteViewModel>> GetBulkJobNotesByBulkJobIdAsync(int bulkJobId);
    Task<TucNoteViewModel?> GetBulkNoteByIdAsync(int noteId);
    Task SaveBulkNoteAsync(TucNoteViewModel viewModel, CancellationToken ct = default);

    // Note Types
    Task<IReadOnlyList<NoteTypeViewModel>> GetNoteTypesAsync();
    Task AddNewTucNoteTypeAsync(NoteTypeViewModel noteType);

    // Note History
    Task<IReadOnlyList<NoteHistoryViewModel>> GetNoteHistoryAsync(int noteId, NoteHistorySource source);
}
