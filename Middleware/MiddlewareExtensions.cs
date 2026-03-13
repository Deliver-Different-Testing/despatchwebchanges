using Microsoft.AspNetCore.Builder;

namespace DespatchWeb.Middleware;

public static class MiddlewareExtensions
{
    public static IApplicationBuilder UseCsrfProtection(this IApplicationBuilder app)
        => app.UseMiddleware<CsrfProtectionMiddleware>();

    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
        => app.UseMiddleware<SecurityHeadersMiddleware>();
}
