using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.FileProviders;

namespace DespatchWeb.Extensions;

public static class SpaExtensions
{
    private static readonly string[] ReservedPrefixes = ["/api", "/dist", "/health", "/healthz"];

    /// <summary>
    /// Serves the Vite SPA's index.html for extensionless GET paths no endpoint claimed, so
    /// client-side routes survive a reload. Never cached: it names the hashed bundles to load.
    /// </summary>
    public static IEndpointConventionBuilder MapSpaFallback(this IEndpointRouteBuilder endpoints, string distPath)
    {
        var pipeline = endpoints.CreateApplicationBuilder();
        pipeline.Use(next => context =>
        {
            if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method)
                || IsReserved(context.Request.Path))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return Task.CompletedTask;
            }

            // StaticFileMiddleware stands down while an endpoint is selected.
            context.SetEndpoint(null);
            context.Request.Path = "/index.html";
            return next(context);
        });
        pipeline.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(Path.GetFullPath(distPath)),
            OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-store"
        });

        return endpoints.MapFallback("{*path:nonfile}", pipeline.Build());
    }

    private static bool IsReserved(PathString path) =>
        ReservedPrefixes.Any(prefix => path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase));
}
