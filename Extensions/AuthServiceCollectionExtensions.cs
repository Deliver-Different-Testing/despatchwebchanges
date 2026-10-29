using DeliverDifferent.AgentAccess;
using DespatchWeb.Helpers;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Extensions;

public static class AuthServiceCollectionExtensions
{
    public const string AuthRedirectHeader = "x-auth-redirect";
    private const string ContextPath = "/api/context";
    private const string CookieScheme = "Identity.Application";

    /// <summary>
    /// Agent access (Hub-issued app pass from the MCP server) is on wherever HubUrl is set. Hub keeps it closed per
    /// tenant until its gate opens, so no tenant gets agent traffic before that.
    /// </summary>
    public static AgentAccessOptions? AgentAccessOptionsFrom(IConfiguration configuration)
    {
        var hubUrl = configuration["HubUrl"];
        if (!Uri.TryCreate(hubUrl, UriKind.Absolute, out var hub) || hub.Scheme is not ("http" or "https")) return null;

        return new AgentAccessOptions
        {
            AppName = "DespatchWeb",
            HubAuthority = hubUrl!,
            HubApiKey = configuration["PartnerDirectoryApiKey"] ?? string.Empty,
            SqlCredentials = configuration["SQLCredentials"] ?? string.Empty
        };
    }

    public static void AddAppAuthentication(this IServiceCollection services, string domain, AgentAccessOptions? agentAccess = null)
    {
        var authentication = services.AddAuthentication(agentAccess is null ? CookieScheme : AgentTokenAuthentication.HubOrAgentScheme)
            .AddCookie(CookieScheme, options =>
            {
                options.Cookie.Name = ".AspNet.SharedCookie";
                options.ExpireTimeSpan = TimeSpan.FromMinutes(20);
                options.SlidingExpiration = true;
                options.AccessDeniedPath = "/Forbidden/";
                options.Events = new CookieAuthenticationEvents
                {
                    OnRedirectToLogin = context =>
                    {
                        var appSettings = context.HttpContext.RequestServices.GetRequiredService<IOptions<AppSettings>>().Value;
                        if (context.Request.Path.StartsWithSegments(ContextPath, StringComparison.OrdinalIgnoreCase))
                        {
                            // XHR: a redirect would be followed by the browser and hide the 401 from the client.
                            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                            context.Response.Headers[AuthRedirectHeader] = appSettings.PublicPath;
                            return Task.CompletedTask;
                        }

                        context.HttpContext.Response.Redirect(appSettings.PublicPath);
                        return Task.CompletedTask;
                    }
                };
                options.Cookie.HttpOnly = true;
                options.Cookie.Domain = domain;
            });

        if (agentAccess is not null)
        {
            authentication.AddHubOrAgentPolicyScheme(CookieScheme).AddAgentTokenAuthentication(agentAccess);
            services.AddAgentTenantConnectionStore<AgentTenantConnectionStore>();
        }

        services.AddSession(options =>
        {
            options.Cookie.Name = "hub_session";
            options.IdleTimeout = TimeSpan.FromMinutes(60 * 24);
        });
    }
}
