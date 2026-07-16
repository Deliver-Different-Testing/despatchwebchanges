namespace DespatchWeb.Models.RequestModels;

// Body for JobController.CreateCreateAheadBackfill — actually materialises
// the selected candidate dates as live tucJob rows. Called after the
// operator confirms the preview.
public sealed class CreateCreateAheadBackfillRequest
{
    // ucbkID of the parent template being backfilled. Same rules as
    // InsertRecurringToLiveRequest.JobId — must be a parent.
    public int JobId { get; init; }

    // Subset of dates the operator chose from the preview candidate list.
    // Each date is materialised via ExecuteMaterialiseParentAsync with a
    // fresh ucbkJobNumber family — same path uspPrebookSet uses nightly.
    //
    // Per-date dup guard (`NOT EXISTS tucJob WHERE BookingParentID = ct.ucbkID
    // AND ucjbDate = candidate AND ISNULL(ucjbVoid,0) = 0`) prevents
    // double-materialisation when the operator double-clicks Create.
    public IReadOnlyList<DateOnly> Dates { get; init; } = new List<DateOnly>();
}
