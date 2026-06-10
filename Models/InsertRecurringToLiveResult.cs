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
}
