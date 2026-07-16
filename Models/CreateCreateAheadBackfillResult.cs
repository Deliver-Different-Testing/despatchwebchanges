namespace DespatchWeb.Models;

// Result of CreateCreateAheadBackfill. Handed back to the UI so the
// success toast can report the actual outcome (some requested dates may
// have raced against the nightly cron and already exist by the time the
// C# push fires).
public sealed class CreateCreateAheadBackfillResult
{
    // Count of tucJob rows created across all requested dates.
    public int JobsCreated { get; init; }

    // Count of dates that were skipped because a live tucJob for that
    // BookingParentID + service date already existed at push time.
    public int DuplicatesSkipped { get; init; }

    // Per-date errors (SP failures, transient DB issues). The push is
    // per-date so a partial batch is normal. Empty list on full success.
    public IReadOnlyList<CreateCreateAheadBackfillDateError> Errors { get; init; } =
        new List<CreateCreateAheadBackfillDateError>();

    // Dates that succeeded — surfaced so the UI can strike them off the
    // checklist without a second round-trip.
    public IReadOnlyList<DateOnly> CreatedDates { get; init; } = new List<DateOnly>();
}

public sealed class CreateCreateAheadBackfillDateError
{
    public DateOnly ServiceDate { get; init; }
    public string Message { get; init; } = string.Empty;
}
