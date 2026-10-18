using System.Net;
using DespatchWeb.Extensions;
using DespatchWeb.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace DespatchWeb.Tests.Middleware;

public class SpaFallbackTests : IDisposable
{
    private const string IndexHtml = "<div id=\"root\"></div>";

    private readonly string _webRoot = Path.Combine(Path.GetTempPath(), $"spa-test-{Guid.NewGuid():N}");
    private readonly string _distDir;

    public SpaFallbackTests()
    {
        _distDir = Path.Combine(_webRoot, "dist");
        Directory.CreateDirectory(Path.Combine(_distDir, "assets"));
        File.WriteAllText(Path.Combine(_distDir, "index.html"), IndexHtml);
        File.WriteAllText(Path.Combine(_distDir, "assets", "index-ABC123.js"), "raw");
        File.WriteAllText(Path.Combine(_distDir, "assets", "logo-XYZ789.svg"), "<svg/>");
        File.WriteAllText(Path.Combine(_distDir, "sw.js"), "self.skipWaiting();");
        File.WriteAllText(Path.Combine(_distDir, "registerSW.js"), "navigator.serviceWorker.register('/dist/sw.js');");
        File.WriteAllText(Path.Combine(_distDir, "workbox-1a2b3c4d.js"), "define([]);");
    }

    public void Dispose()
    {
        Directory.Delete(_webRoot, recursive: true);
        GC.SuppressFinalize(this);
    }

    private IHost CreateHost(string? distDir = null, bool immutableAssets = true) =>
        new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.ConfigureServices(s => s.AddRouting());
                webBuilder.Configure(app =>
                {
                    app.UseSpaAssetHeaders(immutableAssets);
                    app.UseStaticFiles(new StaticFileOptions
                    {
                        FileProvider = new PhysicalFileProvider(_distDir),
                        RequestPath = "/dist"
                    });
                    app.UseRouting();
                    app.UseEndpoints(endpoints =>
                    {
                        endpoints.MapGet("/api/context", () => "context");
                        endpoints.MapSpaFallback(distDir ?? _distDir);
                    });
                });
            })
            .Start();

    [Theory]
    [InlineData("/")]
    [InlineData("/dispatch")]
    [InlineData("/jobs/search/123")]
    public async Task DeepLink_ServesIndexHtmlWithNoStore(string path)
    {
        using var host = CreateHost();
        var response = await host.GetTestClient().GetAsync(path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(IndexHtml, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.True(response.Headers.CacheControl?.NoStore);
    }

    [Theory]
    [InlineData("/api/unknown")]
    [InlineData("/api")]
    [InlineData("/dist/nope")]
    [InlineData("/dist/assets/missing-ABC.js")]
    [InlineData("/healthz")]
    public async Task ReservedOrFileLikePaths_AreNotSwallowed(string path)
    {
        using var host = CreateHost();
        var response = await host.GetTestClient().GetAsync(path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MappedApiEndpoint_WinsOverFallback()
    {
        using var host = CreateHost();
        var body = await host.GetTestClient().GetStringAsync("/api/context", TestContext.Current.CancellationToken);

        Assert.Equal("context", body);
    }

    [Fact]
    public async Task NonGetRequest_IsNotAnsweredWithIndexHtml()
    {
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .PostAsync("/dispatch", new StringContent(""), TestContext.Current.CancellationToken);

        Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task MissingIndexHtml_Returns404()
    {
        var emptyDir = Path.Combine(_webRoot, "empty");
        Directory.CreateDirectory(emptyDir);
        using var host = CreateHost(emptyDir);
        var response = await host.GetTestClient().GetAsync("/dispatch", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("/dist/assets/index-ABC123.js")]
    [InlineData("/dist/assets/logo-XYZ789.svg")]
    public async Task HashedAssets_AreCachedImmutably(string path)
    {
        using var host = CreateHost();
        var response = await host.GetTestClient().GetAsync(path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("immutable", response.Headers.CacheControl?.ToString());
        Assert.Equal(TimeSpan.FromDays(365), response.Headers.CacheControl?.MaxAge);
    }

    [Fact]
    public async Task HashedAssets_AreNotImmutableOutsideProduction()
    {
        using var host = CreateHost(immutableAssets: false);
        var response = await host.GetTestClient()
            .GetAsync("/dist/assets/index-ABC123.js", TestContext.Current.CancellationToken);

        Assert.DoesNotContain("immutable", response.Headers.CacheControl?.ToString() ?? string.Empty);
    }

    [Fact]
    public async Task HashedWorkboxRuntime_IsCachedImmutably()
    {
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .GetAsync("/dist/workbox-1a2b3c4d.js", TestContext.Current.CancellationToken);

        Assert.Contains("immutable", response.Headers.CacheControl?.ToString());
    }

    [Theory]
    [InlineData("/dist/sw.js")]
    [InlineData("/dist/registerSW.js")]
    public async Task ServiceWorkerEntryPoints_AreNeverCached(string path)
    {
        // The browser's update check only finds a new build if it can re-fetch sw.js; the file keeps
        // a constant name, so any caching pins clients to the first worker they installed.
        using var host = CreateHost();
        var response = await host.GetTestClient().GetAsync(path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.DoesNotContain("immutable", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task ServiceWorker_MayControlTheWholeOrigin()
    {
        // sw.js lives under /dist, so without this header its scope is capped at /dist/.
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .GetAsync("/dist/sw.js", TestContext.Current.CancellationToken);

        Assert.Equal("/", Assert.Single(response.Headers.GetValues("Service-Worker-Allowed")));
    }

    [Fact]
    public async Task NonDistResponses_AreLeftAlone()
    {
        using var host = CreateHost();
        var response = await host.GetTestClient()
            .GetAsync("/api/context", TestContext.Current.CancellationToken);

        Assert.False(response.Headers.Contains("Service-Worker-Allowed"));
        Assert.DoesNotContain("immutable", response.Headers.CacheControl?.ToString() ?? string.Empty);
    }
}
