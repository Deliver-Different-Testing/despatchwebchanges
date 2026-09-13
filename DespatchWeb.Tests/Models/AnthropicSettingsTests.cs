using DespatchWeb.Extensions;
using DespatchWeb.Models;

namespace DespatchWeb.Tests.Models;

public class AnthropicSettingsTests
{
    [Fact]
    public void Defaults_SplitModelByTaskClass()
    {
        var settings = new AnthropicSettings();

        // Drafts are reviewed and edited by a dispatcher before they send, and the user
        // is waiting on the button, so the cheapest fast model is the right trade.
        Assert.Equal("claude-haiku-4-5", settings.Drafting.Model);
        // Judgment drives money, safety and severity decisions, where being wrong costs
        // far more than the token difference between tiers.
        Assert.Equal("claude-sonnet-5", settings.Judgment.Model);

        Assert.Equal(settings.Drafting, settings.For(AiTaskClass.Drafting));
        Assert.Equal(settings.Judgment, settings.For(AiTaskClass.Judgment));
    }

    [Fact]
    public void Defaults_OnlySetEffortOnAModelThatAcceptsIt()
    {
        var settings = new AnthropicSettings();

        // Claude Haiku 4.5 has no effort parameter and rejects the request if one is sent.
        Assert.True(string.IsNullOrEmpty(settings.Drafting.Effort));
        Assert.Equal("low", settings.Judgment.Effort);
    }

    [Fact]
    public void Defaults_PriceEachProfileAtItsOwnModelsRates()
    {
        var settings = new AnthropicSettings();

        Assert.Equal(1.00m, settings.Drafting.InputPricePerMillion);
        Assert.Equal(5.00m, settings.Drafting.OutputPricePerMillion);
        Assert.Equal(2.00m, settings.Judgment.InputPricePerMillion);
        Assert.Equal(10.00m, settings.Judgment.OutputPricePerMillion);

        // Cache reads bill at 10% of input on both tiers.
        Assert.Equal(settings.Drafting.InputPricePerMillion / 10m, settings.Drafting.CacheReadPricePerMillion);
        Assert.Equal(settings.Judgment.InputPricePerMillion / 10m, settings.Judgment.CacheReadPricePerMillion);
    }

    [Fact]
    public void Defaults_GiveJudgmentRoomForThinkingPlusAForcedToolCall()
    {
        var settings = new AnthropicSettings();

        // Claude Sonnet 5 thinks adaptively by default and those tokens count against
        // MaxTokens, so a ceiling sized for the answer alone truncates the tool call.
        Assert.True(settings.Judgment.MaxTokens > settings.Drafting.MaxTokens);
    }

    [Fact]
    public void ValidateProfiles_RejectsEffortOnAHaikuProfile()
    {
        var valid = new AnthropicSettings();
        Assert.True(AiServiceCollectionExtensions.ValidateProfiles(valid));

        var haikuWithEffort = new AnthropicSettings
        {
            Drafting = new AiModelProfile
            {
                Model = "claude-haiku-4-5",
                Effort = "low",
                MaxTokens = 1024
            }
        };

        Assert.False(AiServiceCollectionExtensions.ValidateProfiles(haikuWithEffort));
    }

    [Fact]
    public void ValidateProfiles_RejectsAnUnusableTokenCeiling()
    {
        var settings = new AnthropicSettings
        {
            Judgment = new AiModelProfile { Model = "claude-sonnet-5", MaxTokens = 0 }
        };

        Assert.False(AiServiceCollectionExtensions.ValidateProfiles(settings));
    }
}
