using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IRecurringJobRepository
{
    Task<JobGroupViewModel> GetRecurringJobByIdAsync(int jobId);
    Task<PaginatedResponse<PrebookListViewModel>> GetRecurringJobsListAsync(RecurringJobQueryRequest request);
    Task UpdateRecurringJobAsync(int jobId, JobProperty property, string value);
    Task SaveRecurringFlightAsync(int jobId, int fromAirportId, int toAirportId, string flightNumber);
    Task<IReadOnlyList<TucNoteViewModel>> GetRecurringNotesByJobIdAsync(int jobBookingId);
    Task SaveRecurringJobNote(TucNoteViewModel note);
    Task UpdateBookingDeliveryAddressAsync(UpdateAddressRequest request);
    Task UpdateBookingPickupAddressAsync(UpdateAddressRequest request);
    Task<IReadOnlyList<PrebookListViewModel>> GetAllRecurringJobsForExportAsync(RecurringJobQueryRequest request);
    Task<InsertRecurringToLiveResult> InsertRecurringToLiveAsync(InsertRecurringToLiveRequest request);

    Task<PreviewCreateAheadBackfillResult> PreviewCreateAheadBackfillAsync(
        PreviewCreateAheadBackfillRequest request);

    Task<CreateCreateAheadBackfillResult> CreateCreateAheadBackfillAsync(
        CreateCreateAheadBackfillRequest request);
}