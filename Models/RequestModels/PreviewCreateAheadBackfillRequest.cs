namespace DespatchWeb.Models.RequestModels;

// Body for JobController.PreviewCreateAheadBackfill — asks the backend
// which interim service dates would be created if RecurringInitialDays
// were raised from OldValue to NewValue on this recurring template.
//
// Idempotent: this endpoint reads only, never writes. Safe to call from
// the UI as the user is typing / previewing before commit.
public sealed class PreviewCreateAheadBackfillRequest
{
    // ucbkID of the recurring booking's parent template. Children are
    // ignored — they inherit from the parent via the materialiser SP.
    public int JobId { get; init; }

    // The current value of tucJobBooking.RecurringInitialDays on the row.
    // Used to bound the candidate window (candidates = today + OldValue + 1
    // through today + NewValue). Pass 0 for a NULL / never-set field.
    public int OldValue { get; init; }

    // The value the user is proposing to save. Only NewValue > OldValue
    // yields candidates; equal or lower returns an empty list.
    public int NewValue { get; init; }
}
