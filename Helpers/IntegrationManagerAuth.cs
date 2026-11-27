#nullable enable
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Serilog;

namespace DespatchWeb.Helpers;

/// <summary>
/// Resolves the Integration Manager base URL for this host and mints a bearer token from the signed-in user's claims,
/// for the services that call IM gateways on the user's behalf.
/// </summary>
internal static class IntegrationManagerAuth
{
    internal static (string? BaseUrl, string? BearerToken) ResolveUrlAndToken(
        IHttpContextAccessor contextAccessor, IWebHostEnvironment environment, string caller)
    {
        var baseUrl = ResolveBaseUrl(contextAccessor, environment);
        if (string.IsNullOrEmpty(baseUrl))
        {
            Log.Error("Unable to determine Integration Manager URL for {Caller}", caller);
            return (null, null);
        }

        var user = contextAccessor.HttpContext?.User;
        var connectionString = user?.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
        var tenantId = user?.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var clientId = user?.Claims.FirstOrDefault(x => x.Type == "ClientID")?.Value;
        var timeZone = user?.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var userName = user?.FindFirst(ClaimTypes.Name)?.Value;

        if (string.IsNullOrEmpty(connectionString) || string.IsNullOrEmpty(tenantId) ||
            string.IsNullOrEmpty(timeZone) || string.IsNullOrEmpty(userName))
        {
            Log.Error("Missing required user claims for Integration Manager JWT token ({Caller})", caller);
            return (baseUrl.TrimEnd('/'), null);
        }

        var token = AuthenticationExtensions.CreateApiToken(userName,
            int.Parse(tenantId),
            connectionString,
            timeZone,
            string.IsNullOrEmpty(clientId) ? null : int.Parse(clientId));
        var bearerToken = new JwtSecurityTokenHandler().WriteToken(token);

        return (baseUrl.TrimEnd('/'), bearerToken);
    }

    private static string? ResolveBaseUrl(IHttpContextAccessor contextAccessor, IWebHostEnvironment environment)
    {
        if (environment.IsDevelopment())
        {
            return Environment.GetEnvironmentVariable("IntegrationManagerUrl");
        }

        var httpContext = contextAccessor.HttpContext;
        if (httpContext is null)
        {
            return null;
        }

        var req = httpContext.Request;
        var host = req.Host.Value?.Replace("despatch", "integrationmanager", StringComparison.OrdinalIgnoreCase);
        return $"{req.Scheme}://{host}";
    }
}
