#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class AssignNpAgentToJobsRequest
{
    public int? NpAgentId { get; init; }

    public List<int>? JobIds { get; init; }
}
