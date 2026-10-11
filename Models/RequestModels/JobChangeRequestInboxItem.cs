#nullable enable
namespace DespatchWeb.Models.RequestModels;

/// <summary>
/// Approver inbox row — a Pending change request the local tenant must
/// review, enriched with enough job context that the inbox page can list it
/// without an N+1 round-trip back to /job/Detail for each row.
/// </summary>
public sealed class JobChangeRequestInboxItem
{
    public JobChangeRequestDto Request { get; init; } = null!;
    public string JobNo { get; init; } = string.Empty;
    public string? ClientName { get; init; }
}
