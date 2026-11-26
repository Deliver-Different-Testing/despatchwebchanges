#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class AssignAgentToJobsRequest
{
    public int? AgentId { get; init; }

    public List<int>? JobIds { get; init; }

    public bool? IncludeStopJobs { get; init; }

    public string? EmailSubject { get; init; }

    /// <summary>The dispatcher's plain-text note, shown above the alert message.</summary>
    public string? EmailNote { get; init; }

    /// <summary>Send the alert even though this agent already has it for this job (the dialog's "Send again").</summary>
    public bool Resend { get; init; }
}
