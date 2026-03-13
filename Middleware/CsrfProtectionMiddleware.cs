using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace DespatchWeb.Middleware;

/// <summary>
/// Verifies X-Requested-With header on state-changing requests (POST, PUT, PATCH, DELETE).
/// Combined with SameSite cookies, this prevents CSRF attacks.
/// </summary>
public class CsrfProtectionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;
        var isStateChangingRequest = method is "POST" or "PUT" or "PATCH" or "DELETE";

        if (isStateChangingRequest && !context.Request.Path.StartsWithSegments("/healthz"))
        {
            var hasXhrHeader = context.Request.Headers.XRequestedWith == "XMLHttpRequest";
            if (!hasXhrHeader)
            {
                context.Response.StatusCode = 400;
                await context.Response.WriteAsync("Invalid request - missing required header");
                return;
            }
        }

        await next(context);
    }
}
