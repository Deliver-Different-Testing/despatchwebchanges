namespace DespatchWeb.Models.RequestModels;

public sealed class AllocateJobsToCourierRequest
{
    public int CourierId { get; init; }
    public List<int> JobIds { get; init; }
}