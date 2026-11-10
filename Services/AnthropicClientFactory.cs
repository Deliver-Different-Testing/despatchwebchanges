using Anthropic;
using Anthropic.Core;
using Anthropic.Credentials;
using DespatchWeb.Models;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Builds the app's one Anthropic client. It must stay one: each projected service-account token can be exchanged
/// only once, so a second client holding its own credentials would be refused with jti_reused.
/// </summary>
public static class AnthropicClientFactory
{
    public static AnthropicClient Create(AnthropicSettings settings, int maxRetries, HttpClient httpClient = null)
    {
        var federation = settings.Federation;
        var options = new ClientOptions { MaxRetries = maxRetries };
        if (httpClient is not null)
        {
            options.HttpClient = httpClient;
        }

        if (!federation.IsConfigured)
        {
            Log.Warning("Anthropic workload identity federation is not configured; the AI features will report they are not connected");
            // An explicit empty key stops the SDK falling back to ANTHROPIC_API_KEY from the environment.
            options.ApiKey = string.Empty;
            return new AnthropicClient(options);
        }

        Log.Information("Anthropic client authenticating via workload identity federation (rule {RuleId})", federation.RuleId);
        options.Credentials = new WorkloadIdentityCredentials(new WorkloadIdentityOptions
        {
            FederationRuleId = federation.RuleId,
            OrganizationId = federation.OrganizationId,
            ServiceAccountId = federation.ServiceAccountId,
            WorkspaceId = string.IsNullOrWhiteSpace(federation.WorkspaceId) ? null : federation.WorkspaceId,
            IdentityTokenProvider = new FileIdentityTokenProvider(federation.IdentityTokenFile),
            HttpClient = httpClient
        });
        return new AnthropicClient(options);
    }
}
