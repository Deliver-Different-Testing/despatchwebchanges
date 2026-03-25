namespace DespatchWeb.Middleware;

/// <summary>
/// Adds security headers (X-Content-Type-Options, X-Frame-Options, CSP, HSTS, etc.)
/// to all responses.
/// </summary>
public class SecurityHeadersMiddleware(RequestDelegate next, IHostEnvironment environment)
{
    private const string ContentSecurityPolicy =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.api.here.com https://ajax.googleapis.com https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://ajax.googleapis.com https://js.api.here.com https://api.fontshare.com; " +
        "img-src 'self' data: blob: https:; " +
        "font-src 'self' https://fonts.gstatic.com https://api.fontshare.com data:; " +
        "connect-src 'self' blob: https://*.here.com https://*.hereapi.com https://*.googleapis.com; " +
        "worker-src 'self' blob:; " +
        "frame-ancestors 'none'; " +
        "frame-src 'none'; " +
        "object-src 'none'; " +
        "manifest-src 'self'; " +
        "base-uri 'self'; " +
        "form-action 'self';";

    private const string ContentSecurityPolicyProduction =
        ContentSecurityPolicy + " upgrade-insecure-requests;";

    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        headers.XContentTypeOptions = "nosniff";
        headers.XFrameOptions = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "geolocation=(), microphone=()";

        if (!environment.IsDevelopment())
            headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains";

        headers.ContentSecurityPolicy = environment.IsDevelopment()
            ? ContentSecurityPolicy
            : ContentSecurityPolicyProduction;

        await next(context);
    }
}