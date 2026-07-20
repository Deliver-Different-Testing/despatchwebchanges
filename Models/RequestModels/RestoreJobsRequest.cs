namespace DespatchWeb.Models.RequestModels;

public sealed class RestoreJobsRequest
{
    public List<int> JobIds { get; init; }

    /// <summary>
    /// When true, the images captured against the job's completion (delivery/pickup photos and
    /// signatures) are archived (soft-deleted) from S3 as part of the restore.
    /// </summary>
    public bool RemoveCapturedImages { get; init; }
}