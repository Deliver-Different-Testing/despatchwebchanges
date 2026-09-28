using DespatchWeb.Models;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Extensions;

public static class AuthServiceCollectionExtensions
{
    public static void AddAppAuthentication(this IServiceCollection services, string domain)
    {
        services.AddAuthentication("Identity.Application")
            .AddCookie("Identity.Application", options =>
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
                        context.HttpContext.Response.Redirect(appSettings.PublicPath);
                        return Task.CompletedTask;
                    }
                };
                options.Cookie.HttpOnly = true;
                options.Cookie.Domain = domain;
            });

        services.AddSession(options =>
        {
            options.Cookie.Name = "hub_session";
            options.IdleTimeout = TimeSpan.FromMinutes(60 * 24);
        });
    }
}
