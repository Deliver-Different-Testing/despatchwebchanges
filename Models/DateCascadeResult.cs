#nullable enable
namespace DespatchWeb.Models;

/// <summary>
/// Outcome of a date cascade. A child failing must not strand the rest, so both the
/// successes and the failures are reported back for the UI to surface.
/// </summary>
public sealed record DateCascadeResult(
    IReadOnlyList<int> UpdatedJobIds,
    IReadOnlyList<int> FailedJobIds)
{
    public static DateCascadeResult Empty { get; } = new([], []);
}
