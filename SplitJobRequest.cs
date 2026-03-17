namespace DespatchWeb.Models.RequestModels;

/// <summary>
/// Request model for splitting a job with a meeting point address.
/// </summary>
public class SplitJobRequest
{
    /// <summary>
    /// The ID of the job to split.
    /// </summary>
    public int JobId { get; set; }

    /// <summary>
    /// The meeting point address data including all address lines.
    /// </summary>
    public required AddressViewModel MeetingPointAddress { get; set; }

    /// <summary>
    /// Optional courier ID to assign to Leg B (delivery leg).
    /// If null, Leg B will appear as unallocated on the dispatcher's screen.
    /// </summary>
    public int? CourierIdForLegB { get; set; }
}
