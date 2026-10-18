using DespatchWeb.Extensions;
using DespatchWeb.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Tests.Models;

/// <summary>
/// The Anthropic settings have no C# fallback defaults — appsettings.json's "Anthropic"
/// section is the only source, for every environment. A missing or incomplete profile
/// must fail validation at startup rather than silently run on an empty/zero value.
/// </summary>
public class AnthropicSettingsBindingTests
{
    // Mirrors the "Anthropic" section committed to appsettings.json.
    private static Dictionary<string, string?> AppSettingsShapedConfig() => new()
    {
        ["Anthropic:Drafting:Model"] = "claude-haiku-4-5",
        ["Anthropic:Drafting:MaxTokens"] = "1024",
        ["Anthropic:Drafting:InputPricePerMillion"] = "1.00",
        ["Anthropic:Drafting:OutputPricePerMillion"] = "5.00",
        ["Anthropic:Drafting:CacheReadPricePerMillion"] = "0.10",
        ["Anthropic:Drafting:CacheWritePricePerMillion"] = "1.25",
        ["Anthropic:Judgment:Model"] = "claude-sonnet-5",
        ["Anthropic:Judgment:Effort"] = "low",
        ["Anthropic:Judgment:MaxTokens"] = "4096",
        ["Anthropic:Judgment:InputPricePerMillion"] = "2.00",
        ["Anthropic:Judgment:OutputPricePerMillion"] = "10.00",
        ["Anthropic:Judgment:CacheReadPricePerMillion"] = "0.20",
        ["Anthropic:Judgment:CacheWritePricePerMillion"] = "2.50",
        ["Anthropic:RateLimitPerUserPerMinute"] = "5",
        ["Anthropic:RateLimitPerTenantPerMinute"] = "20",
        ["Anthropic:ResponseCacheSeconds"] = "90"
    };

    private static AnthropicSettings Bind(params IEnumerable<KeyValuePair<string, string?>>[] layers)
    {
        var builder = new ConfigurationBuilder();
        foreach (var layer in layers)
            builder.AddInMemoryCollection(layer);

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(builder.Build());
        services.AddAiServices();

        return services.BuildServiceProvider().GetRequiredService<IOptions<AnthropicSettings>>().Value;
    }

    [Fact]
    public void AppSettingsShapedConfiguration_BindsTheDocumentedBusinessRules()
    {
        var settings = Bind(AppSettingsShapedConfig());

        // Drafts are reviewed and edited by a dispatcher before they send, and the user
        // is waiting on the button, so the cheapest fast model is the right trade.
        Assert.Equal("claude-haiku-4-5", settings.Drafting.Model);
        // Claude Haiku 4.5 has no effort parameter and rejects the request if one is sent.
        Assert.True(string.IsNullOrEmpty(settings.Drafting.Effort));

        // Judgment drives money, safety and severity decisions, where being wrong costs
        // far more than the token difference between tiers.
        Assert.Equal("claude-sonnet-5", settings.Judgment.Model);
        Assert.Equal("low", settings.Judgment.Effort);

        // Claude Sonnet 5 thinks adaptively by default and those tokens count against
        // MaxTokens, so Judgment needs more room than Drafting for the answer plus a
        // forced tool call.
        Assert.True(settings.Judgment.MaxTokens > settings.Drafting.MaxTokens);

        // Cache reads bill at 10% of input on both tiers.
        Assert.Equal(settings.Drafting.InputPricePerMillion / 10m, settings.Drafting.CacheReadPricePerMillion);
        Assert.Equal(settings.Judgment.InputPricePerMillion / 10m, settings.Judgment.CacheReadPricePerMillion);

        Assert.Equal(settings.Drafting, settings.For(AiTaskClass.Drafting));
        Assert.Equal(settings.Judgment, settings.For(AiTaskClass.Judgment));
    }

    [Fact]
    public void NoConfigurationAtAll_FailsValidationAtStartup()
    {
        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
        services.AddAiServices();

        var options = services.BuildServiceProvider().GetRequiredService<IOptions<AnthropicSettings>>();

        Assert.Throws<OptionsValidationException>(() => options.Value);
    }

    [Fact]
    public void PartialOverride_KeepsTheBaseLayerForEveryKeyItOmits()
    {
        // Only the model is overridden by a higher-precedence layer (e.g. launchSettings);
        // the prices and ceiling from the base appsettings.json layer must survive.
        var settings = Bind(AppSettingsShapedConfig(), new Dictionary<string, string?>
        {
            ["Anthropic:Judgment:Model"] = "claude-opus-5"
        });

        Assert.Equal("claude-opus-5", settings.Judgment.Model);
        Assert.Equal("low", settings.Judgment.Effort);
        Assert.Equal(4096, settings.Judgment.MaxTokens);
        Assert.Equal(2.00m, settings.Judgment.InputPricePerMillion);
        Assert.Equal(10.00m, settings.Judgment.OutputPricePerMillion);
        Assert.Equal(0.20m, settings.Judgment.CacheReadPricePerMillion);

        // An untouched profile is untouched.
        Assert.Equal("claude-haiku-4-5", settings.Drafting.Model);
        Assert.Equal(5.00m, settings.Drafting.OutputPricePerMillion);
    }

    [Fact]
    public void PopulatedConfiguration_Wins()
    {
        var settings = Bind(new Dictionary<string, string?>
        {
            ["Anthropic:Drafting:Model"] = "claude-haiku-4-5",
            ["Anthropic:Drafting:MaxTokens"] = "2048",
            ["Anthropic:Judgment:Model"] = "claude-sonnet-5",
            ["Anthropic:Judgment:Effort"] = "medium",
            ["Anthropic:ResponseCacheSeconds"] = "30"
        });

        Assert.Equal(2048, settings.Drafting.MaxTokens);
        Assert.Equal("medium", settings.Judgment.Effort);
        Assert.Equal(30, settings.ResponseCacheSeconds);
    }

    [Fact]
    public void EnvironmentVariableDoubleUnderscore_ReachesTheNestedProfile()
    {
        // This is the shape launchSettings.json actually supplies, layered on top of the
        // appsettings.json base.
        Environment.SetEnvironmentVariable("Anthropic__Judgment__MaxTokens", "8192");
        try
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(AppSettingsShapedConfig())
                .AddEnvironmentVariables()
                .Build();

            var settings = new AnthropicSettings();
            configuration.GetSection("Anthropic").Bind(settings);

            Assert.Equal(8192, settings.Judgment.MaxTokens);
            // Everything the env var did not mention still holds the base layer's value.
            Assert.Equal("claude-sonnet-5", settings.Judgment.Model);
        }
        finally
        {
            Environment.SetEnvironmentVariable("Anthropic__Judgment__MaxTokens", null);
        }
    }

    [Fact]
    public void AnInvalidProfile_FailsAtStartupRatherThanAtTheFirstApiCall()
    {
        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder()
            .AddInMemoryCollection(AppSettingsShapedConfig())
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                // Haiku 4.5 rejects the effort parameter outright.
                ["Anthropic:Drafting:Effort"] = "low"
            }).Build());
        services.AddAiServices();

        var options = services.BuildServiceProvider().GetRequiredService<IOptions<AnthropicSettings>>();

        Assert.Throws<OptionsValidationException>(() => options.Value);
    }

    [Fact]
    public void CommittedAppSettings_PassStartupValidation_OnTheCurrentSonnetWithoutForcedToolChoice()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "appsettings.json")))
        {
            dir = dir.Parent;
        }

        Assert.NotNull(dir);
        var config = new ConfigurationBuilder()
            .AddJsonFile(Path.Combine(dir.FullName, "appsettings.json"))
            .Build();
        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(config);
        services.AddAiServices();

        var settings = services.BuildServiceProvider().GetRequiredService<IOptions<AnthropicSettings>>().Value;

        Assert.Equal("claude-sonnet-5-5", settings.Judgment.Model);
        Assert.False(settings.Judgment.ForcedToolChoice);
        Assert.True(settings.Drafting.ForcedToolChoice);
        Assert.True(AiServiceCollectionExtensions.ValidateProfiles(settings));

        // Opening one job auto-fires the briefing and blockers cards (2 calls) and a dispatcher
        // works through several jobs a minute; a response-cache hit still counts against the limit.
        Assert.True(settings.RateLimitPerUserPerMinute >= 20);
        Assert.True(settings.RateLimitPerTenantPerMinute >= 120);
    }
}
