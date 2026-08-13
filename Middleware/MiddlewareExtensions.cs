namespace DespatchWeb.Middleware;

public static class MiddlewareExtensions
{
    extension(IApplicationBuilder app)
    {
        public void UseCsrfProtection() => app.UseMiddleware<CsrfProtectionMiddleware>();

        public void UseSecurityHeaders() => app.UseMiddleware<SecurityHeadersMiddleware>();

        public void UseConnectedTenantRejection() => app.UseMiddleware<ConnectedTenantRejectionMiddleware>();

        public void UsePrecompressedStaticFiles(PrecompressedStaticFileOptions options) =>
            app.UseMiddleware<PrecompressedStaticFilesMiddleware>(options);
    }
}