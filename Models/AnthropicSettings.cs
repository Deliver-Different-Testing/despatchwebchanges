namespace DespatchWeb.Models;

/// <summary>
/// Model, pricing and rate-limit values are configured in appsettings.json's
/// "Anthropic" section (the single source of truth for all environments) rather than
/// defaulted here, so a missing or incomplete profile fails validation at startup
/// instead of silently running on a stale hardcoded value.
/// </summary>
public sealed class AnthropicSettings
{
    /// <summary>
    /// Message, note and email drafts. A dispatcher reviews every one before sending,
    /// and is waiting on the button while it generates, so latency is the quality bar.
    /// </summary>
    public AiModelProfile Drafting { get; init; } = new();

    /// <summary>
    /// Structured briefings and insights. Low effort keeps the cost close to the
    /// drafting tier while retaining the stronger model's judgment.
    /// </summary>
    public AiModelProfile Judgment { get; init; } = new();

    /// <summary>
    /// The Auto-mate chat. A whole turn, tool rounds included, must finish within TimeoutSeconds.
    /// </summary>
    public AiModelProfile Chat { get; init; } = new();

    public int RateLimitPerUserPerMinute { get; init; }
    public int RateLimitPerTenantPerMinute { get; init; }

    // Deduplicate identical read-only AI requests (job/ops/compliance briefings,
    // insights) via a short-lived response cache. 0 disables it.
    public int ResponseCacheSeconds { get; init; }

    /// <summary>
    /// Workload identity federation: the pod's projected service-account token is exchanged for a short-lived
    /// Anthropic token. There is no API key; without the token file the AI features report they are not connected.
    /// </summary>
    public FederationSettings Federation { get; init; } = new();

    public bool IsConnected => Federation.IsConfigured && File.Exists(Federation.IdentityTokenFile);

    public AiModelProfile For(AiTaskClass taskClass) => taskClass switch
    {
        AiTaskClass.Judgment => Judgment,
        AiTaskClass.Chat => Chat,
        _ => Drafting
    };

    public sealed class FederationSettings
    {
        public string RuleId { get; init; }
        public string OrganizationId { get; init; }
        public string ServiceAccountId { get; init; }
        public string WorkspaceId { get; init; }
        public string IdentityTokenFile { get; init; } = "/var/run/secrets/anthropic.com/token";

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(RuleId)
            && !string.IsNullOrWhiteSpace(OrganizationId)
            && !string.IsNullOrWhiteSpace(ServiceAccountId);
    }
}
