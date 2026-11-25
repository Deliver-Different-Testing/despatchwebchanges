#nullable enable
using DeliverDifferent.AgentAlerts.Rendering;

namespace DespatchWeb.Models.Response;

/// <summary>An agent alert rendered for one leg: what the Dispatch dialog previews and what is sent.</summary>
public sealed record AgentAlertEmail(AgentAlertType AlertType, string Subject, string HtmlBody, string ReplyTo);
