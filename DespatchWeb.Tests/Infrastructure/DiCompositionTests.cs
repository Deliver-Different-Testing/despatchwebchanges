using Amazon.S3;
using Anthropic;
using DeliverDifferentReporting.Services;
using DespatchWeb.EntityClasses;
using DespatchWeb.Extensions;
using DespatchWeb.Interfaces;
using DespatchWeb.Services.AutoMate;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
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
                // AnthropicSettings has no C# defaults; resolving AiResponseCache/AiClientService
                // reads IOptions<AnthropicSettings>.Value, which validates the profiles.
                ["Anthropic:Drafting:Model"] = "claude-haiku-4-5",
                ["Anthropic:Judgment:Model"] = "claude-sonnet-5",
                ["Anthropic:Judgment:Effort"] = "low",
                ["Anthropic:Chat:Model"] = "claude-sonnet-5-5",
                ["Anthropic:Chat:Effort"] = "low",
                ["Anthropic:Chat:ForcedToolChoice"] = "false"
            })
            .Build();
        services.AddSingleton<IConfiguration>(config);

        services.AddSingleton(Substitute.For<IDbContextFactory<DespatchContext>>());
        services.AddSingleton(Substitute.For<IHttpContextAccessor>());
        services.AddSingleton(Substitute.For<IAmazonS3>());
        services.AddSingleton(Substitute.For<IConnectionStringManager>());
        services.AddSingleton(Substitute.For<IDistributedCache>());
        services.AddSingleton(Substitute.For<IWebHostEnvironment>());
        services.AddSingleton(Substitute.For<IHostEnvironment>());
        services.AddScoped(_ => Substitute.For<IScopeProvider>());
        services.AddSingleton(Substitute.For<ITenantBrandingService>());
        services.AddMemoryCache();
        services.AddHttpClient();
        services.AddScoped(_ => new HttpClient());
        services.AddLogging();

        // Register the extension method groups under test
        services.AddRepositories();
        services.AddJobServices(config);
        services.AddAgentReadServices();
        services.AddPricingServices();
        services.AddReportingServices();
        services.AddSupportServices();
        services.AddTenantServices();
        services.AddAiServices();
        services.AddAutoMateChat();

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
        Assert.NotNull(sp.GetRequiredService<IAiSummarizationService>());
        Assert.NotNull(sp.GetRequiredService<IAutoMateChatService>());
        Assert.NotNull(sp.GetRequiredService<IServiceTokenProvider>());
        Assert.NotNull(sp.GetRequiredService<ICspKnowledgeClient>());

        // One client, so one set of workload-identity credentials: each identity token can be exchanged only once.
        Assert.Single(services, d => d.ServiceType == typeof(AnthropicClient));

        var toolNames = sp.GetServices<IAutoMateTool>().Select(t => t.Definition.Name).Order().ToList();
        Assert.Equal(
            ["find_client", "find_drivers", "get_article", "get_job", "get_job_activity", "search_jobs", "search_knowledge_base"],
            toolNames);
    }
}
