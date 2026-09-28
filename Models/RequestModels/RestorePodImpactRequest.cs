namespace DespatchWeb.Models.RequestModels;

/// <summary>
/// Asks what proof of delivery a restore of these jobs would destroy, so the UI can warn the
/// operator before anything is changed. Read-only.
/// </summary>
public sealed class RestorePodImpactRequest
{
    public List<int> JobIds { get; init; }
}
