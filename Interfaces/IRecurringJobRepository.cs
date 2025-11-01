using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IRecurringJobRepository
{
    Task<JobGroupViewModel> GetRecurringJobByIdAsync(int jobId);
    Task<PaginatedResponse<PrebookListViewModel>> GetRecurringJobsListAsync(RecurringJobQueryRequest request);
    Task UpdateTucJobRecurringAsync(int jobId, JobProperty property, string value);
    Task<List<TucNoteViewModel>> GetRecurringNotesByJobIdAsync(int jobId);
    Task SaveRecurringJobNote(TucNoteViewModel note);
    Task UpdateBookingDeliveryAddressAsync(UpdateAddressRequest request);
    Task UpdateBookingPickupAddressAsync(UpdateAddressRequest request);
}