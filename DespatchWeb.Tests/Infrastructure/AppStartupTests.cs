using System.Net;
using Amazon.S3;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Infrastructure;

/// <summary>
/// Integration test that boots the real middleware pipeline via WebApplicationFactory.
/// Validates the app starts without errors and the liveness probe responds.
/// </summary>
[Trait("Category", "Integration")]
public class AppStartupTests(AppStartupTests.TestApp factory) : IClassFixture<AppStartupTests.TestApp>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task HealthLive_Returns200()
    {
        var response = await _client.GetAsync("/health/live", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task EfModelWarmup_RunsAtStartup_AndGatesReadiness()
    {
        var state = factory.Services.GetRequiredService<EfModelWarmupState>();
        await state.Completion.WaitAsync(TimeSpan.FromSeconds(60), TestContext.Current.CancellationToken);

        var healthChecks = factory.Services.GetRequiredService<IOptions<HealthCheckServiceOptions>>().Value;

        Assert.True(state.IsReady);
        Assert.Contains(healthChecks.Registrations, r => r.Name == "ef_model_warmup");
    }

    [Fact]
    public async Task GenericStaticFiles_AreNotCachedWithoutRevalidation()
    {
        // favicon.ico sits directly in wwwroot (outside /dist) and is served by the
        // catch-all UseStaticFiles branch in Program.cs, which historically set no
        // Cache-Control at all — leaving it to browser heuristic freshness, which can
        // keep a stale copy around well past a deploy.
        var response = await _client.GetAsync("/favicon.ico", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoCache);
    }

    public class TestApp : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.UseSetting("Domain", "localhost");
            builder.UseSetting("RedisConfig", "localhost:6379");
            builder.UseSetting("PublicPath", "/login");
            builder.UseSetting("HubUrl", "https://localhost");
            builder.UseSetting("S3BucketMars", "test-bucket");

            builder.ConfigureServices(services =>
            {
                // Remove external infrastructure registrations that fail without real services
                RemoveService<IDistributedCache>(services);

                // Replace Redis distributed cache with in-memory
                services.AddDistributedMemoryCache();

                // Stub AWS S3
                RemoveService<IAmazonS3>(services);
                services.AddSingleton(Substitute.For<IAmazonS3>());

                // Stub connection string manager
                RemoveService<IConnectionStringManager>(services);
                services.AddSingleton(Substitute.For<IConnectionStringManager>());

                // Use ephemeral data protection (no file system or AWS dependency)
                services.AddDataProtection().UseEphemeralDataProtectionProvider();
            });
        }

        private static void RemoveService<T>(IServiceCollection services)
        {
            var descriptor = services.FirstOrDefault(d => d.ServiceType == typeof(T));
            if (descriptor is not null)
            {
                services.Remove(descriptor);
            }
        }
    }
}
