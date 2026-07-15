namespace DespatchWeb.Models.RequestModels;

public sealed class RestoreJobsRequest
{
    public List<int> JobIds { get; init; }

    /// <summary>
    /// When true, genuinely-completed jobs (done and not void) are re-opened and their POD
    /// is cleared. Set by the UI only after the operator confirms restoring a completed job.
    /// </summary>
    public bool ForceRestoreCompleted { get; init; }
}