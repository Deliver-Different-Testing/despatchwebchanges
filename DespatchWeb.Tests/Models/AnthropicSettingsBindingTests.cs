using DespatchWeb.Extensions;
using DespatchWeb.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Tests.Models;

/// <summary>
/// The Anthropic settings are supplied as Anthropic__* environment variables from
/// launchSettings.json, which is developer-local and not deployed. Everywhere else the
/// C# defaults are the only source, so every value has to survive an absent or partially
/// filled configuration — a half-populated profile must not zero out the prices it omits.
/// </summary>
public class AnthropicSettingsBindingTests
{
    private static AnthropicSettings Bind(Dictionary<string, string> values)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddAiServices();

        return services.BuildServiceProvider().GetRequiredService<IOptions<AnthropicSettings>>().Value;
    }

    [Fact]
    public void NoConfigurationAtAll_FallsBackToTheCodeDefaults()
    {
        var settings = Bind([]);
        var defaults = new AnthropicSettings();

        Assert.Equal(defaults.Drafting.Model, settings.Drafting.Model);
        Assert.Equal(defaults.Judgment.Model, settings.Judgment.Model);
        Assert.Equal(defaults.Judgment.Effort, settings.Judgment.Effort);
        Assert.Equal(defaults.Judgment.MaxTokens, settings.Judgment.MaxTokens);
        Assert.Equal(defaults.Judgment.OutputPricePerMillion, settings.Judgment.OutputPricePerMillion);
        Assert.Equal(defaults.ResponseCacheSeconds, settings.ResponseCacheSeconds);
    }

    [Fact]
    public void PartialProfile_KeepsTheDefaultsForEveryKeyItOmits()
    {
        // Only the model is overridden; the prices and ceiling must survive.
        var settings = Bind(new Dictionary<string, string>
        {
            ["Anthropic:Judgment:Model"] = "claude-opus-5"
        });
        var defaults = new AnthropicSettings();

        Assert.Equal("claude-opus-5", settings.Judgment.Model);
        Assert.Equal(defaults.Judgment.Effort, settings.Judgment.Effort);
        Assert.Equal(defaults.Judgment.MaxTokens, settings.Judgment.MaxTokens);
        Assert.Equal(defaults.Judgment.InputPricePerMillion, settings.Judgment.InputPricePerMillion);
        Assert.Equal(defaults.Judgment.OutputPricePerMillion, settings.Judgment.OutputPricePerMillion);
        Assert.Equal(defaults.Judgment.CacheReadPricePerMillion, settings.Judgment.CacheReadPricePerMillion);

        // An untouched profile is untouched.
        Assert.Equal(defaults.Drafting.Model, settings.Drafting.Model);
        Assert.Equal(defaults.Drafting.OutputPricePerMillion, settings.Drafting.OutputPricePerMillion);
    }

    [Fact]
    public void PopulatedConfiguration_Wins()
    {
        var settings = Bind(new Dictionary<string, string>
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
        // This is the shape launchSettings.json actually supplies.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string>())
            .AddEnvironmentVariables()
            .Build();

        Environment.SetEnvironmentVariable("Anthropic__Judgment__MaxTokens", "8192");
        try
        {
            configuration = new ConfigurationBuilder().AddEnvironmentVariables().Build();
            var settings = new AnthropicSettings();
            configuration.GetSection("Anthropic").Bind(settings);

            Assert.Equal(8192, settings.Judgment.MaxTokens);
            // Everything the env vars did not mention still holds its default.
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
            .AddInMemoryCollection(new Dictionary<string, string>
            {
                // Haiku 4.5 rejects the effort parameter outright.
                ["Anthropic:Drafting:Effort"] = "low"
            }).Build());
        services.AddAiServices();

        var options = services.BuildServiceProvider().GetRequiredService<IOptions<AnthropicSettings>>();

        Assert.Throws<OptionsValidationException>(() => options.Value);
    }

    [Fact]
    public void EnabledDefaultsToOn_SoAnAbsentSectionDoesNotSilentlyKillAutoMate()
    {
        Assert.True(Bind([]).Enabled);
    }

    [Fact]
    public void EnabledCanBeTurnedOff_WhichIsTheWholePointOfTheOpsBrake()
    {
        Assert.False(Bind(new Dictionary<string, string> { ["Anthropic:Enabled"] = "false" }).Enabled);
    }

    [Fact]
    public void AppSettingsJsonDeclaresEnabled_SoTheBrakeIsFindable()
    {
        // It binds from Anthropic__Enabled either way; declaring it in the shipped
        // config is what makes it greppable by whoever needs it during an incident.
        var appSettings = File.ReadAllText(Path.Combine(FindSolutionRoot(), "appsettings.json"));

        using var document = System.Text.Json.JsonDocument.Parse(appSettings);
        Assert.True(document.RootElement.TryGetProperty("Anthropic", out var anthropic));
        Assert.True(anthropic.TryGetProperty("Enabled", out var enabled));
        Assert.True(enabled.GetBoolean());
    }

    private static string FindSolutionRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Dockerfile")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new InvalidOperationException("Could not find solution root");
    }
}
