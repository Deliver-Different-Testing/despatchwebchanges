namespace DespatchWeb.Models.RequestModels;

public sealed class UpdatePodDetailsRequest
{
    public int JobId { get; init; }
    public int JobStatus { get; init; }
    public string PodName { get; init; }
    public string PodTime { get; init; }
}
