#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class AgentJobRequestModel
{
    public int? AgentId { get; init; }

    public int? JobId { get; init; }

    public bool? IncludeStopJobs { get; init; }

    /// <summary>Optional per-send subject; null or blank uses the tenant's (or the built-in) subject.</summary>
    public string? EmailSubject { get; init; }

    /// <summary>The dispatcher's plain-text note, shown above the alert message.</summary>
    public string? EmailNote { get; init; }

    /// <summary>Send the alert even though this agent already has it for this job (the dialog's "Send again").</summary>
    public bool Resend { get; init; }
}
