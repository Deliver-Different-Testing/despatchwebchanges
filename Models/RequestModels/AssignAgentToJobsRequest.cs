#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class AssignAgentToJobsRequest
{
    public int? AgentId { get; init; }

    public List<int>? JobIds { get; init; }

    public bool? IncludeStopJobs { get; init; }

    public string? EmailSubject { get; init; }

    public string? EmailBody { get; init; }
}
