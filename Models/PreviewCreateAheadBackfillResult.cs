namespace DespatchWeb.Models;

// Result of PreviewCreateAheadBackfill. The UI renders Candidates as
// checkboxes; already-existing dates render as read-only info rows so
// operators can see the family is not empty on those days.
public sealed class PreviewCreateAheadBackfillResult
{
    // Dates that would be materialised if the operator confirms the
    // backfill. Filtered against the template's day pattern / frequency
    // rules and holiday guard the same way uspPrebookSet filters them.
    public IReadOnlyList<CreateAheadBackfillCandidate> Candidates { get; init; } =
        new List<CreateAheadBackfillCandidate>();

    // Dates in the candidate window that are already covered by a live
    // tucJob row (BookingParentID matches the family, non-void). Shown to
    // operators so they understand why fewer candidates were offered than
    // the raw offset delta would imply.
    public IReadOnlyList<DateOnly> AlreadyExistingDates { get; init; } = new List<DateOnly>();

    // Dates in the window that were dropped for a non-existence reason
    // (weekend, out-of-pattern, holiday, no active schedule for that DOW).
    // Rendered as a diagnostics section under the checklist.
    public IReadOnlyList<CreateAheadBackfillSkippedDate> SkippedDates { get; init; } =
        new List<CreateAheadBackfillSkippedDate>();
}
