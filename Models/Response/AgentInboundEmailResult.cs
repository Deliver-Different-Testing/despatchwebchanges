#nullable enable
using DeliverDifferent.AgentAlerts.Rendering;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;

namespace DespatchWeb.Models.Response;

/// <summary>
/// Result of assigning a job to an agent, describing whether the inbound-agent link email
/// was (or would be) sent and to whom. Used both as the assignment outcome and as a
/// pre-flight preview so the dispatcher knows what will happen before confirming.
/// </summary>
public sealed record AgentInboundEmailResult(
    AgentInboundEmailStatus Status,
    string? AgentEmail,
    AgentAlertType? AlertType = null)
{
    /// <summary>True when a link email was/would be queued to the agent.</summary>
    public bool WillEmail => Status == AgentInboundEmailStatus.Queued;
}
