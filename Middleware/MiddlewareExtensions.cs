namespace DespatchWeb.Middleware;

public static class MiddlewareExtensions
{
    extension(IApplicationBuilder app)
    {
        public void UseCsrfProtection() => app.UseMiddleware<CsrfProtectionMiddleware>();

        public void UseSecurityHeaders() => app.UseMiddleware<SecurityHeadersMiddleware>();
    }
}