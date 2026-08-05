namespace DespatchWeb.Models.RequestModels;

/// <summary>
/// Request model for previewing how a job's pricing would divide across the legs of a split.
/// </summary>
public sealed class SplitPricingPreviewRequest
{
    /// <summary>The ID of the job that would be split.</summary>
    public int JobId { get; init; }

    /// <summary>The proposed meeting point, which determines each leg's distance.</summary>
    public required AddressViewModel MeetingPointAddress { get; init; }
}
