using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IRecurringJobRepository
{
    Task<JobViewModel> GetRecurringJobByIdAsync(int jobId);

    Task<List<PrebookListViewModel>> PreBookJobListAsync(bool active);
    Task<PrebookListViewModel> GetPrebookJobByIdAsync(int jobBookingId);

    Task UpdateTucJobRecurringAsync(int jobId, JobProperty property, string value);
    Task<List<TucNoteViewModel>> GetRecurringNotesByJobIdAsync(int jobId);
}
