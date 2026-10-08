#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class JobChangeRequestResult
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public JobChangeRequestDto? Request { get; init; }

    /// <summary>
    /// Populated when the local row was saved but the IM enqueue/forward step
    /// failed. The local state is consistent; the cross-tenant relay needs a
    /// retry. UI surfaces this as a non-blocking warning so the user knows
    /// the partner side did not see the change.
    /// </summary>
    public string? PeerForwardWarning { get; init; }
}
