using DespatchWeb.Models;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Builds the pricing split proposed for a job, so the user can confirm it before the split is
/// committed. Read-only — nothing is written.
/// </summary>
public interface ISplitPricingPreviewService
{
    /// <summary>
    /// Proposes how the job's pricing lines would divide across the two legs created by splitting
    /// at <paramref name="meetingPointAddress"/>.
    /// </summary>
    Task<SplitPricingPreviewDto> PreviewAsync(
        int jobId,
        AddressViewModel meetingPointAddress,
        CancellationToken ct = default);
}
