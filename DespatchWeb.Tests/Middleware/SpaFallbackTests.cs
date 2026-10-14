using System.Net;
using DespatchWeb.Extensions;
using DespatchWeb.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
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
        File.WriteAllText(Path.Combine(_distDir, "assets", "index-ABC123.js.br"), "br");
        File.WriteAllText(Path.Combine(_distDir, "assets", "logo-XYZ789.svg"), "<svg/>");
    }

    public void Dispose()
    {
        Directory.Delete(_webRoot, recursive: true);
        GC.SuppressFinalize(this);
    }

    private IHost CreateHost(string? distDir = null) =>
        new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.ConfigureServices(s => s.AddRouting());
                webBuilder.Configure(app =>
                {
                    var options = new PrecompressedStaticFileOptions
                    {
                        RequestPath = "/dist",
                        PhysicalPath = _distDir,
                        ImmutableCaching = true
                    };
                    app.UsePrecompressedStaticFiles(options);
                    app.UseStaticFiles(options.CreateStaticFileOptions());
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
    public async Task PrecompressedAsset_IsStillNegotiated()
    {
        using var host = CreateHost();
        var request = new HttpRequestMessage(HttpMethod.Get, "/dist/assets/index-ABC123.js");
        request.Headers.TryAddWithoutValidation("Accept-Encoding", "br");
        var response = await host.GetTestClient().SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal("br", Assert.Single(response.Content.Headers.ContentEncoding));
        Assert.Equal("br", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }
}
