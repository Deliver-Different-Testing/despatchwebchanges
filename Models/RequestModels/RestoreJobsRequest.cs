namespace DespatchWeb.Models.RequestModels;

public sealed class RestoreJobsRequest
{
    public List<int> JobIds { get; init; }
}