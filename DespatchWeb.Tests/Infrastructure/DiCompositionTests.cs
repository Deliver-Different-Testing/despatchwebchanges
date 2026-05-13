using Amazon.S3;
using DeliverDifferentReporting.Services;
using DespatchWeb.EntityClasses;
using DespatchWeb.Extensions;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace DespatchWeb.Tests.Infrastructure;

/// <summary>
/// Smoke test that validates the DI composition root.
/// Catches missing registrations, circular dependencies, and lifetime mismatches
/// at test time rather than at runtime.
/// </summary>
public class DiCompositionTests
{
    [Fact]
    public void AllServices_CanBeResolved_WithValidateOnBuild()
    {
        var services = new ServiceCollection();

        // Infrastructure stubs — these are registered outside the Add* extensions
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Anthropic:ApiKey"] = "test-key"
            })
            .Build();
        services.AddSingleton<IConfiguration>(config);

        services.AddSingleton(Substitute.For<IDbContextFactory<DespatchContext>>());
        services.AddSingleton(Substitute.For<IHttpContextAccessor>());
        services.AddSingleton(Substitute.For<IAmazonS3>());
        services.AddSingleton(Substitute.For<IConnectionStringManager>());
        services.AddSingleton(Substitute.For<IDistributedCache>());
        services.AddSingleton(Substitute.For<IWebHostEnvironment>());
        services.AddSingleton(Substitute.For<ITenantBrandingService>());
        services.AddMemoryCache();
        services.AddHttpClient();
        services.AddScoped(_ => new HttpClient());
        services.AddLogging();

        // Register the extension method groups under test
        services.AddRepositories();
        services.AddJobServices();
        services.AddPricingServices();
        services.AddReportingServices();
        services.AddSupportServices();
        services.AddTenantServices();
        services.AddAiServices();

        var provider = services.BuildServiceProvider(new ServiceProviderOptions
        {
            ValidateOnBuild = true,
            ValidateScopes = true
        });

        // Resolve key services from a scope to verify wiring
        using var scope = provider.CreateScope();
        var sp = scope.ServiceProvider;

        Assert.NotNull(sp.GetRequiredService<IJobQueryRepository>());
        Assert.NotNull(sp.GetRequiredService<ICourierRepository>());
        Assert.NotNull(sp.GetRequiredService<INoteRepository>());
        Assert.NotNull(sp.GetRequiredService<ITenantInfoService>());
        Assert.NotNull(sp.GetRequiredService<ITenantClock>());
        Assert.NotNull(sp.GetRequiredService<IDeliveryJourneyService>());
        Assert.NotNull(sp.GetRequiredService<IAiAssistantService>());
        Assert.NotNull(sp.GetRequiredService<IAiSummarizationService>());
    }
}
