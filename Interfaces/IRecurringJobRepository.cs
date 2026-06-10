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
    Task<IReadOnlyList<TucNoteViewModel>> GetRecurringNotesByJobIdAsync(int jobBookingId);
    Task SaveRecurringJobNote(TucNoteViewModel note);
    Task UpdateBookingDeliveryAddressAsync(UpdateAddressRequest request);
    Task UpdateBookingPickupAddressAsync(UpdateAddressRequest request);
    Task<IReadOnlyList<PrebookListViewModel>> GetAllRecurringJobsForExportAsync(RecurringJobQueryRequest request);

    // Manual-mode operator push. Materialises one or more recurring
    // bookings into live tucJob for the requested service date, prices
    // each new row from tucJobBooking.RawBaseAmount via current fuel
    // rules, and leaves the source bookings on RecurringMode = Manual.
    // Scope determines whether a single standalone, the booking's full
    // parent/child group, or every Manual booking on the same RouteId
    // is materialised.
    Task<InsertRecurringToLiveResult> InsertRecurringToLiveAsync(InsertRecurringToLiveRequest request);
}