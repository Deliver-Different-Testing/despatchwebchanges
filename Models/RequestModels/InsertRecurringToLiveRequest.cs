using DespatchWeb.Enums;

namespace DespatchWeb.Models.RequestModels;

// Body for JobController.InsertRecurringToLive — Manual-mode operator
// push of a recurring booking into live tucJob for a specific service date.
public sealed class InsertRecurringToLiveRequest
{
    // ucbkID of the recurring booking the operator initiated from. Must
    // be a parent booking (BookingParentID = self or NULL) — the UI
    // hides the Insert-to-live menu item for children so this is
    // enforced at both ends.
    public int JobId { get; init; }

    // Service date the new live job(s) should be created for. Required.
    //
    // DateOnly (not DateTimeOffset) so the wire format is a plain
    // `YYYY-MM-DD` calendar date with no TZ math. Earlier this was
    // DateTimeOffset which the front-end populated via dayjs
    // `.toISOString()`, producing a UTC instant - for any tenant east
    // of UTC the resulting `.Date` extraction landed on the *previous*
    // calendar day (e.g. NZ +12 picking 12 Jun -> 11 Jun 12:00 UTC
    // -> `.Date` = 11 Jun). DateOnly is round-trip-safe via the
    // standard ASP.NET DateOnlyJsonConverter (built in to .NET 8).
    public DateOnly InsertDate { get; init; }

    // Which set of bookings to materialise (Group / Route).
    public InsertToLiveScope Scope { get; init; }
}
