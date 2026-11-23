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
/// Who may call the one endpoint Integration Manager's voice agent uses. Nothing is configurable: the allowed subject
/// is derived from this pod's namespace and the issuer from its own projected token (as DfrntMcp does). Anything that
/// cannot be worked out leaves the endpoint closed, with the reason for the startup log.
/// </summary>
public sealed class VoiceAgentAssignOptions
{
    public const string Audience = "despatchweb";
    public const string DefaultServiceAccountTokenPath = "/var/run/secrets/kubernetes.io/serviceaccount/token";
    public const string DefaultNamespacePath = "/var/run/secrets/kubernetes.io/serviceaccount/namespace";
    private const string SubjectPrefix = "system:serviceaccount:";
    private const string DeploymentNamespacePrefix = "despatchweb-594-";
    private const string ImNamespacePrefix = "integration-manager-788-";

    private readonly string _serviceAccountTokenPath = DefaultServiceAccountTokenPath;
    private readonly string _namespacePath = DefaultNamespacePath;

    public VoiceAgentAssignOptions()
    {
    }

    /// <summary>For tests: fixed subjects and issuer, no files read.</summary>
    public VoiceAgentAssignOptions(IEnumerable<string> allowedSubjects, string clusterIssuer)
    {
        AllowedSubjects = new HashSet<string>(allowedSubjects, StringComparer.Ordinal);
        ClusterIssuer = clusterIssuer;
    }

    private VoiceAgentAssignOptions(string namespacePath, string serviceAccountTokenPath)
    {
        _namespacePath = namespacePath;
        _serviceAccountTokenPath = serviceAccountTokenPath;
    }

    public string ClusterIssuer { get; private set; } = string.Empty;
    public string ClusterIssuerNote { get; private set; } = string.Empty;

    /// <summary>Exact service-account subjects that may call.</summary>
    public IReadOnlySet<string> AllowedSubjects { get; private set; } = new HashSet<string>();

    public string AllowedSubjectsNote { get; private set; } = string.Empty;

    public bool IsConfigured => ClusterIssuer.Length > 0 && AllowedSubjects.Count > 0;

    /// <summary>
    /// IM pods run as the default service account in integration-manager-788-{env}, the namespace paired with
    /// despatchweb-594-{env}. Null for any other namespace.
    /// </summary>
    public static string? DeriveSubject(string? deploymentNamespace)
    {
        var ns = deploymentNamespace?.Trim();
        if (ns is null || !ns.StartsWith(DeploymentNamespacePrefix, StringComparison.Ordinal)) return null;

        var rest = ns[DeploymentNamespacePrefix.Length..];
        return rest.Length == 0 || rest.Contains(':') || rest.Contains('*')
            ? null
            : $"{SubjectPrefix}{ImNamespacePrefix}{rest}:default";
    }

    public static VoiceAgentAssignOptions Resolve(string namespacePath = DefaultNamespacePath, string serviceAccountTokenPath = DefaultServiceAccountTokenPath)
    {
        var options = new VoiceAgentAssignOptions(namespacePath, serviceAccountTokenPath);
        options.ResolveSubjects();
        options.ResolveClusterIssuer();
        return options;
    }

    private void ResolveSubjects()
    {
        try
        {
            if (!File.Exists(_namespacePath))
            {
                AllowedSubjectsNote = $"no namespace file at {_namespacePath}";
                return;
            }

            var ns = File.ReadAllText(_namespacePath).Trim();
            var derived = DeriveSubject(ns);
            if (derived is null)
            {
                AllowedSubjectsNote = $"namespace '{ns}' is not {DeploymentNamespacePrefix}*";
                return;
            }

            AllowedSubjects = new HashSet<string>(StringComparer.Ordinal) { derived };
            AllowedSubjectsNote = $"derived from namespace {ns} in {_namespacePath}";
        }
        catch (Exception ex)
        {
            AllowedSubjectsNote = $"{_namespacePath} could not be read ({ex.GetType().Name})";
        }
    }

    private void ResolveClusterIssuer()
    {
        try
        {
            if (!File.Exists(_serviceAccountTokenPath))
            {
                ClusterIssuerNote = "no service-account token is mounted";
                return;
            }

            var issuer = new JsonWebToken(File.ReadAllText(_serviceAccountTokenPath).Trim()).Issuer;
            if (IsHttpsUrl(issuer))
            {
                ClusterIssuer = issuer;
                ClusterIssuerNote = $"from {_serviceAccountTokenPath}";
            }
            else
            {
                ClusterIssuerNote = $"{_serviceAccountTokenPath} has issuer '{issuer}', not an https URL";
            }
        }
        catch (Exception ex)
        {
            ClusterIssuerNote = $"{_serviceAccountTokenPath} could not be read ({ex.GetType().Name})";
        }
    }

    private static bool IsHttpsUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
}

/// <summary>
/// The tenant's wall-clock zone from Hub, which a service-account call has no claim for. Dispatch times are written in
/// it, so an unknown zone refuses the call instead of stamping UTC.
/// </summary>
public sealed class HubTenantTimeZoneSource(IHttpClientFactory httpClientFactory, AgentAccessOptions options, TimeProvider? timeProvider = null)
{
    public const string HttpClientName = "DespatchWeb.HubTimeZone";
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromHours(1);
    private static readonly TimeSpan RetryAfterFailure = TimeSpan.FromMinutes(1);
    private readonly TimeProvider _time = timeProvider ?? TimeProvider.System;
    private readonly ConcurrentDictionary<int, (string TimeZone, DateTimeOffset FetchedAt)> _cache = new();

    public async Task<string?> GetAsync(int tenantId, CancellationToken cancellationToken)
    {
        var hasCached = _cache.TryGetValue(tenantId, out var cached);
        if (hasCached && _time.GetUtcNow() - cached.FetchedAt < CacheLifetime)
            return cached.TimeZone;

        var fresh = await FetchAsync(tenantId, cancellationToken);
        if (fresh is not null)
        {
            _cache[tenantId] = (fresh, _time.GetUtcNow());
            return fresh;
        }

        if (!hasCached) return null;

        // Serve the last good zone and try Hub again in a minute, rather than waiting out its timeout on every call.
        _cache[tenantId] = (cached.TimeZone, _time.GetUtcNow() - CacheLifetime + RetryAfterFailure);
        return cached.TimeZone;
    }

    private async Task<string?> FetchAsync(int tenantId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(options.HubApiKey)) return null;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{options.HubAuthority.TrimEnd('/')}/api/tenants/{tenantId}/time-zone");
            request.Headers.Add("X-Api-Key", options.HubApiKey);
            using var response = await httpClientFactory.CreateClient(HttpClientName).SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            var body = await response.Content.ReadFromJsonAsync<TimeZoneResponse>(cancellationToken);
            if (string.IsNullOrWhiteSpace(body?.TimeZone)) return null;
            if (IsResolvable(body.TimeZone)) return body.TimeZone;

            Log.Warning("VoiceAgentAssign: Hub gave tenant {TenantId} the unknown time zone {TimeZone}", tenantId, body.TimeZone);
            return null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            Log.Warning(ex, "VoiceAgentAssign: Hub could not give tenant {TenantId}'s time zone", tenantId);
            return null;
        }
    }

    // TenantInfoService silently falls back to UTC for an id it cannot resolve, which would stamp UTC dispatch times.
    private static bool IsResolvable(string timeZone) =>
        TimeZoneInfo.TryFindSystemTimeZoneById(timeZone, out _)
        || (TimeZoneInfo.TryConvertIanaIdToWindowsId(timeZone, out var windowsId)
            && TimeZoneInfo.TryFindSystemTimeZoneById(windowsId, out _));

    private sealed record TimeZoneResponse(string? TimeZone);
}

public static class VoiceAgentAssignAuthentication
{
    public const string Scheme = "ImServiceAccount";
    public const string Policy = "VoiceAgentAssign";
    public const string PathPrefix = "/internal/voice-agent/";

    public const string PartnerPathPrefix = "/internal/partner/";

    /// <summary>The route groups Integration Manager calls with this scheme.</summary>
    public static readonly string[] ImServicePathPrefixes = [PathPrefix, PartnerPathPrefix];
    public const string TenantHeader = "X-Tenant-Id";
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
                "{Path}* refuses every call: cluster issuer ({IssuerNote}); allowed service accounts ({AccountsNote})",
                PathPrefix, options.ClusterIssuerNote, options.AllowedSubjectsNote);
        }
        else if (agentAccess is null)
        {
            Log.Warning("{Path}* refuses every call: HubUrl is not configured, so the tenant connection cannot be seeded", PathPrefix);
        }
        else
        {
            Log.Information("{Path}* accepts service-account tokens issued by {Issuer} ({IssuerSource}) from {Subjects} ({SubjectSource})",
                PathPrefix, options.ClusterIssuer, options.ClusterIssuerNote, string.Join(", ", options.AllowedSubjects), options.AllowedSubjectsNote);
        }

        builder.AddJwtBearer(Scheme, o =>
        {
            // Never fetched while unconfigured: OnMessageReceived refuses first.
            o.Authority = options.ClusterIssuer.Length > 0 ? options.ClusterIssuer : "https://unconfigured.invalid";
            o.MapInboundClaims = false;
            o.TokenValidationParameters.ValidateIssuer = true;
            o.TokenValidationParameters.ValidIssuer = o.Authority;
            o.TokenValidationParameters.ValidateAudience = true;
            o.TokenValidationParameters.ValidAudience = VoiceAgentAssignOptions.Audience;
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
        if (subject is null || !options.AllowedSubjects.Contains(subject))
        {
            Log.Warning("VoiceAgentAssign refused service account {Sub}: not an allowed subject", subject);
            context.Fail("service_account_not_allowed");
            return;
        }

        if (!int.TryParse(http.Request.Headers[TenantHeader].ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out var tenantId) || tenantId <= 0)
        {
            Log.Warning("VoiceAgentAssign refused {Sub}: {Header} header is missing or not a positive integer", subject, TenantHeader);
            context.Fail("tenant_header_invalid");
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
