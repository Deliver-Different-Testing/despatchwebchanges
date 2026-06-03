using DespatchWeb.Enums;
using Serilog;

namespace DespatchWeb.Middleware;

/// <summary>
/// Rejects requests carrying a <c>ClientTypeId == 6</c> (ConnectedTenant) claim
/// with 403 Forbidden. ConnectedTenants operate as their own tenant DB; data
/// transfer back to the originating tenant happens via webhook + API contract,
/// never via shared queries. Enforced at the auth boundary so a ConnectedTenant
/// user can never reach the query layer of this app. See
/// docs/CLIENT-TYPE-FILTERING-CURRENT-STATE-2026-06-02.md §2 / §3.
/// </summary>
public class ConnectedTenantRejectionMiddleware(RequestDelegate next)
{
    private static readonly string ConnectedTenantValue =
        ((int)ClientType.ConnectedTenant).ToString();

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var claim = context.User.FindFirst("ClientTypeId")?.Value;
            if (claim == ConnectedTenantValue)
            {
                Log.Warning(
                    "ConnectedTenant request rejected. Path: {Path}, User: {User}",
                    context.Request.Path,
                    context.User.Identity?.Name ?? "unknown");
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsync("ConnectedTenant access not permitted on this tenant.");
                return;
            }
        }

        await next(context);
    }
}
