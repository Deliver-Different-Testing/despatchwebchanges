namespace DespatchWeb.Enums;

/// <summary>
/// Outcome of the best-effort attempt to email an agent the inbound-agent job link
/// when a job is assigned to them. Surfaced to the dispatcher so they know whether the
/// agent was actually notified.
/// </summary>
public enum AgentInboundEmailStatus
{
    /// <summary>A message with the inbound-agent link was queued to the agent's email.</summary>
    Queued,

    /// <summary>The agent has no email address on file; nothing was sent.</summary>
    NoAgentEmail,

    /// <summary>The tenant has no InboundUrl configured, so there is no link to send; nothing was sent.</summary>
    NoInboundUrl,

    /// <summary>An unexpected failure occurred while sending (logged); nothing was sent.</summary>
    Failed
}
