using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

namespace DespatchWeb.Middleware;

public sealed class PrecompressedStaticFileOptions
{
    /// <summary>Request prefix the bundles are served under (e.g. "/dist").</summary>
    public required string RequestPath { get; init; }

    /// <summary>Directory on disk holding the bundles and their .br/.gz siblings.</summary>
    public required string PhysicalPath { get; init; }

    /// <summary>
    /// Whether build introspection — .map files and esbuild's meta.json — may be fetched
    /// over HTTP. Only dev builds emit sourcemaps, and meta.json is stripped from the
    /// published output, so outside Development this is a guard rather than a switch.
    /// </summary>
    public bool ServeSourceMaps { get; init; }

    /// <summary>
    /// Whether bundle filenames are content-hashed and can therefore be cached forever.
    /// True for production builds (entryNames "[name].[hash]"), false for dev builds,
    /// where "app.js" keeps its name across rebuilds.
    /// </summary>
    public bool ImmutableCaching { get; init; }

    /// <summary>
    /// Static-file options matching this middleware: the encoding-aware content types,
    /// plus caching headers. Only hashed bundles get the immutable header — manifest.json
    /// is fetched at runtime under a constant name and is what points an island at its
    /// hashed bundle, so caching it would strand clients on the pre-deploy bundle set.
    /// </summary>
    public StaticFileOptions CreateStaticFileOptions() => new()
    {
        FileProvider = new PhysicalFileProvider(Path.GetFullPath(PhysicalPath)),
        RequestPath = RequestPath,
        ContentTypeProvider = CreateContentTypeProvider(),
        OnPrepareResponse = ctx =>
        {
            ctx.Context.Response.Headers.CacheControl =
                ImmutableCaching && IsHashedBundle(ctx.File.Name)
                    ? "public, max-age=31536000, immutable"
                    : "no-cache";
        }
    };

    private static bool IsHashedBundle(string fileName)
    {
        // Strip the encoding suffix so "app.HASH.js.br" is judged on ".js".
        if (fileName.EndsWith(".br", StringComparison.OrdinalIgnoreCase)
            || fileName.EndsWith(".gz", StringComparison.OrdinalIgnoreCase))
        {
            fileName = fileName[..^3];
        }

        return fileName.EndsWith(".js", StringComparison.OrdinalIgnoreCase)
               || fileName.EndsWith(".css", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Content types for the dist folder. A precompressed file must be described by the
    /// type of its *decoded* payload — a browser asked to render "app.js.br" as
    /// application/brotli would download it instead of executing it — so the trailing
    /// .br/.gz is stripped before the lookup.
    /// </summary>
    public static IContentTypeProvider CreateContentTypeProvider()
    {
        var inner = new FileExtensionContentTypeProvider
        {
            Mappings =
            {
                [".map"] = "application/json"
            }
        };
        return new EncodingAwareContentTypeProvider(inner);
    }

    private sealed class EncodingAwareContentTypeProvider(IContentTypeProvider inner) : IContentTypeProvider
    {
        public bool TryGetContentType(string subpath, out string contentType)
        {
            if (subpath.EndsWith(".br", StringComparison.OrdinalIgnoreCase)
                || subpath.EndsWith(".gz", StringComparison.OrdinalIgnoreCase))
            {
                subpath = subpath[..^3];
            }

            return inner.TryGetContentType(subpath, out contentType!);
        }
    }
}