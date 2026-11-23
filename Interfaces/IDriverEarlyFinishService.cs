#nullable enable
namespace DespatchWeb.Interfaces;

public sealed class EarlyFinishReason
{
    public byte Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public sealed class EarlyFinishOptions
{
    /// <summary>False when the caller lacks dw-driver-early-finish.</summary>
    public bool Available { get; set; }
    public IReadOnlyList<EarlyFinishReason> Reasons { get; set; } = [];
}

public sealed class RecordEarlyFinishRequest
{
    public int CourierId { get; set; }
    public byte ReasonId { get; set; }
    /// <summary>Tenant-local wall clock, "yyyy-MM-ddTHH:mm". It becomes the driver's finish time for that day.</summary>
    public string FinishTime { get; set; } = string.Empty;
    public string? Note { get; set; }
}

/// <summary>
/// Records that a driver finished early, disappeared, was unavailable or broke down (minimum hourly top-up, spec 2a).
/// The note only informs the manager approving the top-up in Accounts; it never changes hours by itself.
/// </summary>
public interface IDriverEarlyFinishService
{
    Task<EarlyFinishOptions> GetOptionsAsync();

    /// <exception cref="UnauthorizedAccessException">The caller lacks dw-driver-early-finish.</exception>
    /// <exception cref="ArgumentException">The request is not valid (message is safe to show).</exception>
    Task RecordAsync(RecordEarlyFinishRequest request);
}
