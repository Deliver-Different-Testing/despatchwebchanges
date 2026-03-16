namespace DespatchWeb.Models.RequestModels;

public sealed class AgentJobRequestModel
{
    public int? AgentId { get; init; }

    public int? JobId { get; init; }

    public bool? IncludeStopJobs { get; init; }
}
