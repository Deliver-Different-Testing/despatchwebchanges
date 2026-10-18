using Microsoft.AspNetCore.Builder;
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

    /// <summary>
    /// Cache and scope headers for the Vite output. Static asset endpoints can't tell a content-hashed
    /// bundle from a constant-named file, so Vite's hashed output is marked immutable here and the
    /// service worker entry points are kept out of every cache.
    /// </summary>
    public static IApplicationBuilder UseSpaAssetHeaders(this IApplicationBuilder app, bool immutableAssets) =>
        app.Use(async (context, next) =>
        {
            var path = context.Request.Path;
            if (path.StartsWithSegments("/dist", StringComparison.OrdinalIgnoreCase))
            {
                var file = path.Value![(path.Value.LastIndexOf('/') + 1)..];
                if (IsServiceWorkerEntryPoint(file))
                {
                    context.Response.OnStarting(() =>
                    {
                        context.Response.Headers.CacheControl = "no-cache, no-store";
                        context.Response.Headers.Pragma = "no-cache";
                        context.Response.Headers["Service-Worker-Allowed"] = "/";
                        return Task.CompletedTask;
                    });
                }
                else if (immutableAssets && IsContentHashed(path, file))
                {
                    context.Response.OnStarting(() =>
                    {
                        if (context.Response.StatusCode == StatusCodes.Status200OK)
                        {
                            context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
                        }

                        return Task.CompletedTask;
                    });
                }
            }

            await next();
        });

    private static bool IsServiceWorkerEntryPoint(string file) =>
        file.Equals("sw.js", StringComparison.OrdinalIgnoreCase)
        || file.Equals("registerSW.js", StringComparison.OrdinalIgnoreCase);

    // Vite hashes everything it emits under assets/; workbox's runtime chunk is hashed too.
    private static bool IsContentHashed(PathString path, string file) =>
        path.StartsWithSegments("/dist/assets", StringComparison.OrdinalIgnoreCase)
        || file.StartsWith("workbox-", StringComparison.OrdinalIgnoreCase);

    private static bool IsReserved(PathString path) =>
        ReservedPrefixes.Any(prefix => path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase));
}
