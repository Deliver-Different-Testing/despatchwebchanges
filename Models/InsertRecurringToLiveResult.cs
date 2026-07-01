namespace DespatchWeb.Models;

// Summary of what InsertRecurringToLive produced — handed back to the
// caller so the UI can show toast text without a second round-trip.
// No duplicate handling needed: each push mints a fresh ucbkJobNumber
// via the same UTL_stpJob_Insert_JobNumber path uspPrebookSet uses
// daily, so collisions on tucJob.ucjbNumber are impossible.
public sealed class InsertRecurringToLiveResult
{
    public int BookingsMaterialised { get; init; }
    public int JobsInserted { get; init; }
    public int JobsRepriced { get; init; }
    public IReadOnlyList<int> InsertedJobIds { get; init; } = [];
    public IReadOnlyList<int> ParentBookingIds { get; init; } = [];

    // Saved-flight auto-assignment outcome (set after the push, post-materialise).
    // FlightsAutoAssigned: jobs whose saved flight number matched a flight on
    // the day and got webhooks + assignment. FlightsUnmatched: jobs that had a
    // saved flight number but no match (schedule change / custom number / no
    // results) — left for the operator to assign manually.
    public int FlightsAutoAssigned { get; set; }
    public int FlightsUnmatched { get; set; }
}
