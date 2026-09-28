namespace DespatchWeb.Models.Dto;

/// <summary>
/// What a restore would cost one job in proof-of-delivery terms: the POD name (always cleared by
/// the restore) and how many captured photos/signatures are held against it (only archived when
/// the operator opts in).
/// </summary>
public sealed record RestorePodImpact
{
    public int JobId { get; init; }

    /// <summary>The job's current POD name, or null when it has none. Cleared by every restore.</summary>
    public string PodName { get; init; }

    public int CapturedImageCount { get; init; }

    /// <summary>
    /// False when the S3 probe was skipped (selection too large) or failed. The UI then falls back
    /// to generic copy rather than quoting a count it can't stand behind.
    /// </summary>
    public bool ImageCountKnown { get; init; }
}
