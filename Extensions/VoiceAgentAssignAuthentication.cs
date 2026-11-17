using System.Collections.Concurrent;
using System.Globalization;
using System.Net.Http.Json;
using System.Security.Claims;
using DeliverDifferent.AgentAccess;
using DespatchWeb.Enums;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;
using Serilog;

namespace DespatchWeb.Extensions;

/// <summary>
/// Settings for the one endpoint Integration Manager's voice agent calls (VoiceAgentAssign__*). The cluster issuer
/// resolves the way DfrntMcp's does: the issuer of this pod's own projected token when none is configured.
/// </summary>
public sealed class VoiceAgentAssignOptions
{
    public const string Section = "VoiceAgentAssign";
    private const string SubjectPrefix = "system:serviceaccount:";

    public string Audience { get; set; } = "despatchweb";
    public string ClusterIssuer { get; set; } = string.Empty;
    public string ServiceAccountTokenPath { get; set; } = "/var/run/secrets/kubernetes.io/serviceaccount/token";
    public string ClusterIssuerNote { get; private set; } = string.Empty;

    /// <summary>Exact service-account subject to the tenant it may act for.</summary>
    public IReadOnlyDictionary<string, int> ServiceAccounts { get; private set; } = new Dictionary<string, int>();

    public IReadOnlyList<string> InvalidEntries { get; private set; } = [];

    public bool IsConfigured => ClusterIssuer.Length > 0 && ServiceAccounts.Count > 0;

    public static VoiceAgentAssignOptions From(IConfiguration configuration)
    {
        var section = configuration.GetSection(Section);
        var options = new VoiceAgentAssignOptions();
        if (!string.IsNullOrWhiteSpace(section["Audience"])) options.Audience = section["Audience"]!.Trim();
        if (!string.IsNullOrWhiteSpace(section["ServiceAccountTokenPath"])) options.ServiceAccountTokenPath = section["ServiceAccountTokenPath"]!;

        var entries = new List<string>();
        var accounts = section.GetSection("ServiceAccounts");
        if (!string.IsNullOrWhiteSpace(accounts.Value))
        {
            entries.AddRange(accounts.Value.Split([',', ';', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        }

        entries.AddRange(accounts.GetChildren().Select(c => c.Value).Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v!.Trim()));
        options.ParseAccounts(entries);

        var configuredIssuer = section["ClusterIssuer"];
        if (!string.IsNullOrWhiteSpace(configuredIssuer))
        {
            if (IsHttpsUrl(configuredIssuer.Trim()))
            {
                options.ClusterIssuer = configuredIssuer.Trim();
                options.ClusterIssuerNote = "from VoiceAgentAssign:ClusterIssuer";
            }
            else
            {
                options.ClusterIssuerNote = "VoiceAgentAssign:ClusterIssuer is not an https URL";
            }
        }
        else
        {
            options.ResolveClusterIssuer();
        }

        return options;
    }

    private void ParseAccounts(IEnumerable<string> entries)
    {
        var accounts = new Dictionary<string, int>(StringComparer.Ordinal);
        var invalid = new List<string>();
        var duplicated = new HashSet<string>(StringComparer.Ordinal);
        foreach (var entry in entries)
        {
            var split = entry.LastIndexOf('=');
            var subject = split > 0 ? entry[..split].Trim() : string.Empty;
            var parts = subject.StartsWith(SubjectPrefix, StringComparison.Ordinal) ? subject[SubjectPrefix.Length..].Split(':') : [];
            if (split <= 0
                || parts is not [{ Length: > 0 } ns, { Length: > 0 } name]
                || ns.Contains('*') || name.Contains('*')
                || !int.TryParse(entry[(split + 1)..].Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var tenantId) || tenantId <= 0)
            {
                invalid.Add(entry);
                continue;
            }

            if (!accounts.TryAdd(subject, tenantId) && accounts[subject] != tenantId) duplicated.Add(subject);
        }

        foreach (var subject in duplicated)
        {
            accounts.Remove(subject);
            invalid.Add($"{subject} (mapped to more than one tenant)");
        }

        ServiceAccounts = accounts;
        InvalidEntries = invalid;
    }

    private void ResolveClusterIssuer()
    {
        try
        {
            if (!File.Exists(ServiceAccountTokenPath))
            {
                ClusterIssuerNote = "no service-account token is mounted";
                return;
            }

            var issuer = new JsonWebToken(File.ReadAllText(ServiceAccountTokenPath).Trim()).Issuer;
            if (IsHttpsUrl(issuer))
            {
                ClusterIssuer = issuer;
                ClusterIssuerNote = $"from {ServiceAccountTokenPath}";
            }
            else
            {
                ClusterIssuerNote = $"{ServiceAccountTokenPath} has issuer '{issuer}', not an https URL";
            }
        }
        catch (Exception ex)
        {
            ClusterIssuerNote = $"{ServiceAccountTokenPath} could not be read ({ex.GetType().Name})";
        }
    }

    private static bool IsHttpsUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
}

/// <summary>
/// The tenant's wall-clock zone from Hub, which a service-account call has no claim for. Dispatch times are written in
/// it, so an unknown zone refuses the call instead of stamping UTC.
/// </summary>
public sealed class HubTenantTimeZoneSource(IHttpClientFactory httpClientFactory, AgentAccessOptions options)
{
    public const string HttpClientName = "DespatchWeb.HubTimeZone";
    private static readonly ConcurrentDictionary<int, string> Cache = new();

    public async Task<string?> GetAsync(int tenantId, CancellationToken cancellationToken)
    {
        if (Cache.TryGetValue(tenantId, out var cached)) return cached;
        if (string.IsNullOrWhiteSpace(options.HubApiKey)) return null;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{options.HubAuthority.TrimEnd('/')}/api/tenants/{tenantId}/time-zone");
            request.Headers.Add("X-Api-Key", options.HubApiKey);
            using var response = await httpClientFactory.CreateClient(HttpClientName).SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            var body = await response.Content.ReadFromJsonAsync<TimeZoneResponse>(cancellationToken);
            if (string.IsNullOrWhiteSpace(body?.TimeZone)) return null;

            Cache[tenantId] = body.TimeZone;
            return body.TimeZone;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            Log.Warning(ex, "VoiceAgentAssign: Hub could not give tenant {TenantId}'s time zone", tenantId);
            return null;
        }
    }

    private sealed record TimeZoneResponse(string? TimeZone);
}

public static class VoiceAgentAssignAuthentication
{
    public const string Scheme = "ImServiceAccount";
    public const string Policy = "VoiceAgentAssign";
    public const string PathPrefix = "/internal/voice-agent/";
    public const string SubjectClaim = "voice_agent_sub";
    private const string AuthKindClaim = "auth_kind";
    private const string AuthKind = "voice-agent-sa";

    /// <summary>
    /// A JwtBearer scheme for the cluster's service-account tokens that only the voice agent's endpoint names, so the
    /// HubOrAgent default (which sends every Bearer to AgentToken) is untouched. Always registered: unconfigured, it
    /// refuses every token rather than leaving the endpoint's scheme missing.
    /// </summary>
    public static AuthenticationBuilder AddVoiceAgentAssignAuthentication(this AuthenticationBuilder builder,
        VoiceAgentAssignOptions options, AgentAccessOptions? agentAccess)
    {
        if (agentAccess is not null)
        {
            builder.Services.AddHttpClient(HubTenantTimeZoneSource.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(10));
            builder.Services.AddSingleton(sp => new HubTenantTimeZoneSource(sp.GetRequiredService<IHttpClientFactory>(), agentAccess));
        }

        if (!options.IsConfigured)
        {
            Log.Warning(
                "{Path}* refuses every call: cluster issuer {Issuer}, {Accounts} valid VoiceAgentAssign__ServiceAccounts entries, invalid: {Invalid}",
                PathPrefix, options.ClusterIssuerNote, options.ServiceAccounts.Count, string.Join("; ", options.InvalidEntries));
        }
        else if (agentAccess is null)
        {
            Log.Warning("{Path}* refuses every call: HubUrl is not configured, so the tenant connection cannot be seeded", PathPrefix);
        }
        else
        {
            Log.Information("{Path}* accepts service-account tokens issued by {Issuer} ({Source}) for {Count} account(s)",
                PathPrefix, options.ClusterIssuer, options.ClusterIssuerNote, options.ServiceAccounts.Count);
        }

        builder.AddJwtBearer(Scheme, o =>
        {
            // Never fetched while unconfigured: OnMessageReceived refuses first.
            o.Authority = options.ClusterIssuer.Length > 0 ? options.ClusterIssuer : "https://unconfigured.invalid";
            o.MapInboundClaims = false;
            o.TokenValidationParameters.ValidateIssuer = true;
            o.TokenValidationParameters.ValidIssuer = o.Authority;
            o.TokenValidationParameters.ValidateAudience = true;
            o.TokenValidationParameters.ValidAudience = options.Audience;
            o.TokenValidationParameters.ValidateLifetime = true;
            o.TokenValidationParameters.RequireExpirationTime = true;
            o.TokenValidationParameters.ClockSkew = TimeSpan.FromSeconds(30);
            o.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    if (!options.IsConfigured || agentAccess is null) context.Fail("voice_agent_assign_not_configured");
                    return Task.CompletedTask;
                },
                OnTokenValidated = context => Validate(context, options)
            };
        });

        builder.Services.AddAuthorizationBuilder().AddPolicy(Policy, p => p
            .AddAuthenticationSchemes(Scheme)
            .RequireAuthenticatedUser()
            .RequireClaim(AuthKindClaim, AuthKind));
        return builder;
    }

    private static async Task Validate(TokenValidatedContext context, VoiceAgentAssignOptions options)
    {
        var http = context.HttpContext;
        var principal = context.Principal!;
        var subject = principal.FindFirst("sub")?.Value;
        if (subject is null || !options.ServiceAccounts.TryGetValue(subject, out var tenantId))
        {
            Log.Warning("VoiceAgentAssign refused service account {Sub}: not in VoiceAgentAssign__ServiceAccounts", subject);
            context.Fail("service_account_not_allowed");
            return;
        }

        var services = http.RequestServices;
        if (services.GetService<HubTenantConnectionSource>() is not { } source || services.GetService<IAgentTenantConnectionStore>() is not { } store)
        {
            Log.Error("VoiceAgentAssign refused {Sub}: agent access (HubUrl) is not configured, so tenant {TenantId}'s connection cannot be seeded", subject, tenantId);
            context.Fail("tenant_connection_unavailable");
            return;
        }

        if (!await store.HasAsync(tenantId, http.RequestAborted))
        {
            var connection = await source.GetAsync(tenantId, http.RequestAborted);
            if (connection is null)
            {
                Log.Error("VoiceAgentAssign refused {Sub}: Hub gave no connection for tenant {TenantId}", subject, tenantId);
                context.Fail("tenant_connection_unavailable");
                return;
            }

            await store.SetAsync(tenantId, connection, http.RequestAborted);
        }

        var timeZone = await services.GetRequiredService<HubTenantTimeZoneSource>().GetAsync(tenantId, http.RequestAborted);
        if (timeZone is null)
        {
            Log.Error("VoiceAgentAssign refused {Sub}: Hub gave no time zone for tenant {TenantId}", subject, tenantId);
            context.Fail("tenant_time_zone_unavailable");
            return;
        }

        var identity = (ClaimsIdentity)principal.Identity!;
        identity.AddClaim(new Claim("CurrentTenantID", tenantId.ToString(CultureInfo.InvariantCulture)));
        identity.AddClaim(new Claim("ClientTypeId", ((int)ClientType.Tenant).ToString(CultureInfo.InvariantCulture)));
        identity.AddClaim(new Claim("TimeZone", timeZone));
        identity.AddClaim(new Claim(SubjectClaim, subject));
        identity.AddClaim(new Claim(AuthKindClaim, AuthKind));
    }
}
