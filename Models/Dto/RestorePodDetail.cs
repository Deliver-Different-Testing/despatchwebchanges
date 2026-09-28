namespace DespatchWeb.Models.Dto;

/// <summary>
/// The per-job columns a restore-impact check needs: the POD name it would clear, and the
/// completion time that anchors the S3 month folders holding the captured images.
/// </summary>
public sealed record RestorePodDetail
{
    public int JobId { get; init; }
    public string PodName { get; init; }
    public DateTime? CompletedTime { get; init; }
}
