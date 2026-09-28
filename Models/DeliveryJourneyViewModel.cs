namespace DespatchWeb.Models;

public sealed class DeliveryJourneyViewModel
{
    public Guid Id { get; init; }
    public int JobId { get; init; }
    public string Title { get; init; }
    public string Icon { get; init; }
    public string Description { get; init; }
    public DateTimeOffset Date { get; init; }
    public List<string> Tags { get; init; }
    public decimal? GrandTotalAfter { get; init; }

    /// <summary>
    /// Display name of the staff member or courier who performed the change.
    /// Null when the source row records no actor — trigger-written history,
    /// webhook updates and anything predating staff attribution — in which case
    /// the timeline shows no attribution line at all.
    /// </summary>
    public string PerformedBy { get; init; }
}