namespace DespatchWeb.Models.RequestModels;

/// <summary>
/// Request model for splitting a job with a meeting point address.
/// </summary>
public sealed class SplitJobRequest
{
    /// <summary>
    /// The ID of the job to split.
    /// </summary>
    public int JobId { get; init; }

    /// <summary>
    /// The meeting point address data including all address lines.
    /// </summary>
    public required AddressViewModel MeetingPointAddress { get; init; }

    /// <summary>
    /// Optional courier ID to assign to the delivery leg (Leg B) at split time.
    /// When null, the delivery leg is created without a courier assignment.
    /// </summary>
    public int? CourierIdForLegB { get; init; }
}
