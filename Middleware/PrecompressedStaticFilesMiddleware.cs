using Microsoft.Extensions.Primitives;
using Microsoft.Net.Http.Headers;

namespace DespatchWeb.Middleware;

/// <summary>
/// Serves the .br/.gz siblings that build.ts pre-compresses next to each bundle, when
/// the client advertises support for them.
///
/// Pre-compressing at build time rather than compressing per response is worth the extra
/// middleware here because dist filenames are content-hashed and therefore immutable:
/// the maximum-quality pass runs once per build instead of once per request, and it
/// compresses roughly 25% smaller than response-compression middleware's default level.
/// </summary>
public class PrecompressedStaticFilesMiddleware(
    RequestDelegate next,
    PrecompressedStaticFileOptions options)
{
    private static readonly (string Token, string Extension)[] EncodingsByPreference =
    [
        ("br", ".br"),
        ("gzip", ".gz"),
    ];

    private readonly string _root = Path.GetFullPath(options.PhysicalPath);

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments(options.RequestPath, out var subPath))
        {
            await next(context);
            return;
        }

        var relative = subPath.Value ?? string.Empty;

        if (!options.ServeSourceMaps && IsBuildArtefact(relative))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        if (!IsBundleAsset(relative))
        {
            await next(context);
            return;
        }

        // Set Vary even when the response ends up uncompressed: a shared cache that
        // stored the brotli body without it could hand that body to a client which
        // cannot decode it.
        context.Response.Headers.Append(HeaderNames.Vary, HeaderNames.AcceptEncoding);

        var negotiated = Negotiate(context.Request.Headers.AcceptEncoding, relative);
        if (negotiated is not null)
        {
            context.Response.Headers.ContentEncoding = negotiated.Value.Token;
            context.Request.Path += negotiated.Value.Extension;
        }

        await next(context);
    }

    /// <summary>
    /// Build introspection that ships in the dist folder but is not a runtime asset:
    /// sourcemaps, and esbuild's metafile (several MB enumerating every source path).
    /// Neither is referenced by the app, but both are guessable by name.
    /// </summary>
    private static bool IsBuildArtefact(string relative) =>
        relative.EndsWith(".map", StringComparison.OrdinalIgnoreCase)
        || relative.EndsWith("/meta.json", StringComparison.OrdinalIgnoreCase);

    private static bool IsBundleAsset(string relative) =>
        relative.EndsWith(".js", StringComparison.OrdinalIgnoreCase)
        || relative.EndsWith(".css", StringComparison.OrdinalIgnoreCase);

    private (string Token, string Extension)? Negotiate(StringValues acceptEncoding, string relative)
    {
        if (StringValues.IsNullOrEmpty(acceptEncoding)) return null;

        if (!StringWithQualityHeaderValue.TryParseList(acceptEncoding, out var accepted)) return null;

        foreach (var candidate in EncodingsByPreference)
        {
            var isAccepted = accepted.Any(value =>
                string.Equals(value.Value.Value, candidate.Token, StringComparison.OrdinalIgnoreCase)
                && value.Quality != 0);

            if (isAccepted && CompressedFileExists(relative, candidate.Extension))
            {
                return candidate;
            }
        }

        return null;
    }

    /// <summary>
    /// Probes for a compressed sibling, refusing anything that resolves outside the dist
    /// directory so the lookup can't be used to confirm files elsewhere on disk.
    /// </summary>
    private bool CompressedFileExists(string relative, string extension)
    {
        var combined = Path.Combine(_root, relative.TrimStart('/', '\\') + extension);

        string resolved;
        try
        {
            resolved = Path.GetFullPath(combined);
        }
        catch (Exception e) when (e is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return false;
        }

        return resolved.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal) && File.Exists(resolved);
    }
}
