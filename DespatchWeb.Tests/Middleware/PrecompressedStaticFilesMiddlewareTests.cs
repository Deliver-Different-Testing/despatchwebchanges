using System.Net;
using DespatchWeb.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace DespatchWeb.Tests.Middleware;

/// <summary>
/// Tests <see cref="PrecompressedStaticFilesMiddleware"/>, which serves the .br/.gz
/// siblings that build.ts emits next to each bundle. The contract that matters is the
/// whole pipeline — negotiation plus the static-file handler behind it — so these tests
/// drive a real TestServer rather than the middleware in isolation.
/// </summary>
public class PrecompressedStaticFilesMiddlewareTests : IDisposable
{
    // Mirrors the real layout: dist is a subfolder of the web root, which is why a
    // catch-all static-file handler over the web root can also serve /dist.
    private readonly string _webRoot =
        Path.Combine(Path.GetTempPath(), $"webroot-test-{Guid.NewGuid():N}");

    private readonly string _distDir;

    private readonly byte[] _jsRaw = [.. "console.error('raw js');"u8];
    private readonly byte[] _jsBrotli = [.. "pretend-brotli-js"u8];
    private readonly byte[] _jsGzip = [.. "pretend-gzip-js"u8];

    public PrecompressedStaticFilesMiddlewareTests()
    {
        _distDir = Path.Combine(_webRoot, "dist");
        Directory.CreateDirectory(_distDir);

        File.WriteAllBytes(Path.Combine(_distDir, "app.ABC123.js"), _jsRaw);
        File.WriteAllBytes(Path.Combine(_distDir, "app.ABC123.js.br"), _jsBrotli);
        File.WriteAllBytes(Path.Combine(_distDir, "app.ABC123.js.gz"), _jsGzip);

        File.WriteAllText(Path.Combine(_distDir, "app.DEF456.css"), ".a{color:red}");
        File.WriteAllText(Path.Combine(_distDir, "app.DEF456.css.br"), "pretend-brotli-css");

        // Deliberately has no compressed sibling.
        File.WriteAllText(Path.Combine(_distDir, "tiny.GHI789.js"), "0");

        File.WriteAllText(Path.Combine(_distDir, "app.ABC123.js.map"), "{\"version\":3}");
        File.WriteAllText(Path.Combine(_distDir, "meta.json"), "{\"inputs\":{}}");
        File.WriteAllText(Path.Combine(_distDir, "manifest.json"), "{}");
    }

    public void Dispose()
    {
        Directory.Delete(_webRoot, recursive: true);
        GC.SuppressFinalize(this);
    }

    private IHost CreateHost(bool serveSourceMaps = false, bool immutableCaching = false) =>
        new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.Configure(app =>
                {
                    var options = new PrecompressedStaticFileOptions
                    {
                        RequestPath = "/dist",
                        PhysicalPath = _distDir,
                        ServeSourceMaps = serveSourceMaps,
                        ImmutableCaching = immutableCaching,
                    };

                    app.UsePrecompressedStaticFiles(options);
                    app.UseStaticFiles(options.CreateStaticFileOptions());

                    app.Run(async ctx =>
                    {
                        ctx.Response.StatusCode = 404;
                        await ctx.Response.WriteAsync("fell through");
                    });
                });
            })
            .Start();

    private static HttpRequestMessage Get(string path, string? acceptEncoding)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (acceptEncoding is not null)
        {
            request.Headers.TryAddWithoutValidation("Accept-Encoding", acceptEncoding);
        }
        return request;
    }

    [Theory]
    [InlineData("br", "br")]
    [InlineData("gzip", "gzip")]
    [InlineData("gzip, deflate, br", "br")]
    [InlineData("br;q=0, gzip", "gzip")]
    public async Task ServesBestAvailableEncoding(string acceptEncoding, string expectedEncoding)
    {
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .SendAsync(Get("/dist/app.ABC123.js", acceptEncoding), TestContext.Current.CancellationToken);

        var body = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expectedEncoding, Assert.Single(response.Content.Headers.ContentEncoding));
        Assert.Equal(expectedEncoding == "br" ? _jsBrotli : _jsGzip, body);
        // The Content-Type must describe the *decoded* payload, not the .br/.gz wrapper.
        Assert.Equal("text/javascript", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("Accept-Encoding", response.Headers.Vary);
    }

    [Fact]
    public async Task ServesUncompressedWhenClientDoesNotAskForIt()
    {
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .SendAsync(Get("/dist/app.ABC123.js", acceptEncoding: null), TestContext.Current.CancellationToken);

        var body = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(response.Content.Headers.ContentEncoding);
        Assert.Equal(_jsRaw, body);
    }

    [Fact]
    public async Task ServesUncompressedWhenNoCompressedSiblingExists()
    {
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .SendAsync(Get("/dist/tiny.GHI789.js", "br, gzip"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(response.Content.Headers.ContentEncoding);
        Assert.Equal("0", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task FallsBackToGzipWhenOnlyGzipSiblingIsMissing()
    {
        // app.DEF456.css has a .br but no .gz — a gzip-only client gets the original.
        using var host = CreateHost();
        var client = host.GetTestClient();

        var gzipOnly = await client.SendAsync(
            Get("/dist/app.DEF456.css", "gzip"), TestContext.Current.CancellationToken);
        Assert.Empty(gzipOnly.Content.Headers.ContentEncoding);

        var brotli = await client.SendAsync(
            Get("/dist/app.DEF456.css", "br"), TestContext.Current.CancellationToken);
        Assert.Equal("br", Assert.Single(brotli.Content.Headers.ContentEncoding));
        Assert.Equal("text/css", brotli.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task SetsVaryEvenWhenServingUncompressed()
    {
        // Without Vary, a shared cache could hand a brotli body to a client that can't
        // decode it (or vice versa).
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .SendAsync(Get("/dist/app.ABC123.js", acceptEncoding: null), TestContext.Current.CancellationToken);

        Assert.Contains("Accept-Encoding", response.Headers.Vary);
    }

    [Fact]
    public async Task SourceMapsAreNotPubliclyServedByDefault()
    {
        using var host = CreateHost(serveSourceMaps: false);
        var response = await host.GetTestClient()
            .SendAsync(Get("/dist/app.ABC123.js.map", "br"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task BuildMetafileIsNotPubliclyServedByDefault()
    {
        // meta.json is esbuild's metafile — several MB enumerating every source file in
        // the app. It is build introspection, not a runtime asset.
        using var host = CreateHost(serveSourceMaps: false);
        var response = await host.GetTestClient()
            .SendAsync(Get("/dist/meta.json", "br"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SourceMapsAreServedWhenExplicitlyEnabled()
    {
        using var host = CreateHost(serveSourceMaps: true);
        var response = await host.GetTestClient()
            .SendAsync(Get("/dist/app.ABC123.js.map", "br"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task LeavesNonDistRequestsAlone()
    {
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .SendAsync(Get("/Home/Index", "br"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("fell through", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task DoesNotNegotiateForNonBundleExtensions()
    {
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .SendAsync(Get("/dist/manifest.json", "br"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(response.Content.Headers.ContentEncoding);
    }

    [Fact]
    public async Task NegotiationWinsOverAGeneralWebRootHandler()
    {
        // wwwroot/dist lives inside the web root, so Program.cs's catch-all
        // UseStaticFiles can serve /dist itself. If it is registered first it answers
        // with the uncompressed bundle and negotiation never runs — which is exactly
        // what happened the first time this was wired up.
        using var host = new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.Configure(app =>
                {
                    var options = new PrecompressedStaticFileOptions
                    {
                        RequestPath = "/dist",
                        PhysicalPath = _distDir,
                        ImmutableCaching = true,
                    };

                    app.UsePrecompressedStaticFiles(options);
                    app.UseStaticFiles(options.CreateStaticFileOptions());

                    // The catch-all, serving the whole web root — including dist.
                    app.UseStaticFiles(new StaticFileOptions
                    {
                        FileProvider = new PhysicalFileProvider(_webRoot),
                        RequestPath = "",
                    });
                });
            })
            .Start();

        var response = await host.GetTestClient().SendAsync(
            Get("/dist/app.ABC123.js", "br"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("br", Assert.Single(response.Content.Headers.ContentEncoding));
        Assert.Equal(_jsBrotli, await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData("/dist/app.ABC123.js", null)]
    [InlineData("/dist/app.ABC123.js", "br")]
    [InlineData("/dist/app.DEF456.css", "br")]
    public async Task HashedBundlesAreCachedImmutably(string path, string? acceptEncoding)
    {
        using var host = CreateHost(immutableCaching: true);
        var response = await host.GetTestClient()
            .SendAsync(Get(path, acceptEncoding), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.Public);
        Assert.Equal(TimeSpan.FromDays(365), response.Headers.CacheControl?.MaxAge);
        Assert.Contains("immutable", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task ManifestIsNeverCachedImmutably()
    {
        // manifest.json is fetched at runtime under a constant name and is what maps an
        // island to its hashed bundle. Caching it for a year would pin every client to
        // the pre-deploy bundle set permanently.
        using var host = CreateHost(immutableCaching: true);
        var response = await host.GetTestClient()
            .SendAsync(Get("/dist/manifest.json", "br"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("immutable", response.Headers.CacheControl?.ToString() ?? string.Empty);
        Assert.True(response.Headers.CacheControl?.NoCache);
    }

    [Fact]
    public async Task DevelopmentBundlesAreNotCachedImmutably()
    {
        // Dev builds use entryNames "[name]" — app.js keeps its name across rebuilds, so
        // an immutable header would freeze the browser on the first build of the session.
        using var host = CreateHost(immutableCaching: false);
        var response = await host.GetTestClient()
            .SendAsync(Get("/dist/app.ABC123.js", "br"), TestContext.Current.CancellationToken);

        Assert.DoesNotContain("immutable", response.Headers.CacheControl?.ToString() ?? string.Empty);
    }

    [Theory]
    [InlineData("/dist/../appsettings.json")]
    [InlineData("/dist/..%2fappsettings.json")]
    public async Task DoesNotEscapeTheDistDirectory(string path)
    {
        // Guard the File.Exists probe: the encoding lookup must not be usable to
        // confirm or serve files outside wwwroot/dist.
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .SendAsync(Get(path, "br"), TestContext.Current.CancellationToken);

        Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(response.Content.Headers.ContentEncoding);
    }
}
