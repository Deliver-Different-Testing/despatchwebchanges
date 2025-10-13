using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IRecurringJobRepository
{
    Task<JobViewModel> GetRecurringJobByIdAsync(int jobId);

    Task<PaginatedResponse<PrebookListViewModel>> PreBookJobListAsync(RecurringJobQueryRequest request);
    Task UpdateTucJobRecurringAsync(int jobId, JobProperty property, string value);
    Task<List<TucNoteViewModel>> GetRecurringNotesByJobIdAsync(int jobId);
    Task<int> SaveRecurringJobNote(TucNoteViewModel note);
}
