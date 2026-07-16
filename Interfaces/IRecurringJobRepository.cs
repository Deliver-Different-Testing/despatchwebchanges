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

    // Atomically stamp a recurring booking's route airports + saved flight
    // number so the push-to-live flight auto-assign (which requires both
    // airports non-null) can match. Used by the "add flight" flow on
    // recurring bookings that were created without airports.
    Task SaveRecurringFlightAsync(int jobId, int fromAirportId, int toAirportId, string flightNumber);
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

    // Read-only preview for the CreateAheadDays backfill flow. Given a
    // proposed RecurringInitialDays value on a parent template, returns
    // the interim service dates that would be materialised, plus dates
    // in the window that already have live jobs (rendered as info rows
    // in the UI) and dates dropped for pattern / holiday / schedule
    // reasons (rendered as diagnostics).
    //
    // Filters mirror uspPrebookSet's target-date checks. Idempotent —
    // safe to call repeatedly as the operator adjusts the value.
    Task<PreviewCreateAheadBackfillResult> PreviewCreateAheadBackfillAsync(
        PreviewCreateAheadBackfillRequest request);

    // Materialises the operator-confirmed subset of dates from the
    // preview. Reuses the Manual-mode Insert-to-Live materialiser path
    // (ExecuteMaterialiseParentAsync) so each date gets a fresh
    // ucbkJobNumber family and no ucjbNumber UNIQUE collision is possible.
    //
    // Per-date dup guard: skips dates where a live tucJob for this
    // BookingParentID + service date already exists (non-void), so a
    // double-click on Create yields JobsCreated=0 on the second call.
    Task<CreateCreateAheadBackfillResult> CreateCreateAheadBackfillAsync(
        CreateCreateAheadBackfillRequest request);
}