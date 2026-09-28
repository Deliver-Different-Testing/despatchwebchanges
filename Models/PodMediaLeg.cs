#nullable enable

namespace DespatchWeb.Models;

/// <summary>
/// One job whose id may key POD media in S3 for the job that was actually asked for.
/// </summary>
/// <remarks>
/// The courier device writes the signature and photos against the leg it completed, so a multi-leg
/// family's media is scattered across the leg ids and never exists under the parent's. The parent is
/// the number the client knows, searches for and downloads a POD against, so resolving media for it
/// has to sweep its legs as well as itself.
/// </remarks>
public record PodMediaLeg
{
    public required int JobId { get; init; }

    public required string JobNumber { get; init; }

    /// <summary>True for the job the caller asked about, false for a leg swept in alongside it.</summary>
    public bool IsRequestedJob { get; init; }

    public DateTime? CompletedTime { get; init; }

    public DateTime? PickUpTime { get; init; }

    public DateTime? DispatchedTime { get; init; }
}
