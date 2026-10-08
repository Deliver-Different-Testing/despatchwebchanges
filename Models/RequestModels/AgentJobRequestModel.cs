#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class AgentJobRequestModel
{
    public int? AgentId { get; init; }

    public int? JobId { get; init; }

    public bool? IncludeStopJobs { get; init; }

    /// <summary>Optional per-send override of the agent email subject template; null uses the hardcoded default.</summary>
    public string? EmailSubject { get; init; }

    /// <summary>Optional per-send override of the agent email body template; null uses the hardcoded default.</summary>
    public string? EmailBody { get; init; }
}
