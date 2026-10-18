using DespatchWeb.Extensions;
using DespatchWeb.Models;

namespace DespatchWeb.Tests.Models;

/// <summary>
/// AnthropicSettings carries no default model/pricing values of its own — those live in
/// appsettings.json's "Anthropic" section. These tests cover the shape and validation
/// rules of the settings themselves (task-class routing, profile validation), using
/// explicit profiles rather than relying on any built-in default.
/// </summary>
public class AnthropicSettingsTests
{
    [Fact]
    public void For_RoutesToTheProfileMatchingTheTaskClass()
    {
        var drafting = new AiModelProfile { Model = "claude-haiku-4-5", MaxTokens = 1024 };
        var judgment = new AiModelProfile { Model = "claude-sonnet-5", Effort = "low", MaxTokens = 4096 };
        var settings = new AnthropicSettings { Drafting = drafting, Judgment = judgment };

        Assert.Same(drafting, settings.For(AiTaskClass.Drafting));
        Assert.Same(judgment, settings.For(AiTaskClass.Judgment));
    }

    [Fact]
    public void ValidateProfiles_RejectsEffortOnAHaikuProfile()
    {
        var valid = new AnthropicSettings
        {
            Drafting = new AiModelProfile { Model = "claude-haiku-4-5", MaxTokens = 1024 },
            Judgment = new AiModelProfile { Model = "claude-sonnet-5", Effort = "low", MaxTokens = 4096 }
        };
        Assert.True(AiServiceCollectionExtensions.ValidateProfiles(valid));

        // Claude Haiku 4.5 has no effort parameter and rejects the request if one is sent.
        var haikuWithEffort = new AnthropicSettings
        {
            Drafting = new AiModelProfile
            {
                Model = "claude-haiku-4-5",
                Effort = "low",
                MaxTokens = 1024
            },
            Judgment = valid.Judgment
        };

        Assert.False(AiServiceCollectionExtensions.ValidateProfiles(haikuWithEffort));
    }

    [Fact]
    public void ValidateProfiles_RejectsAnUnusableTokenCeiling()
    {
        var settings = new AnthropicSettings
        {
            Drafting = new AiModelProfile { Model = "claude-haiku-4-5", MaxTokens = 1024 },
            Judgment = new AiModelProfile { Model = "claude-sonnet-5", MaxTokens = 0 }
        };

        Assert.False(AiServiceCollectionExtensions.ValidateProfiles(settings));
    }

    [Fact]
    public void ValidateProfiles_RejectsAMissingModel()
    {
        var settings = new AnthropicSettings
        {
            Drafting = new AiModelProfile { Model = "", MaxTokens = 1024 },
            Judgment = new AiModelProfile { Model = "claude-sonnet-5", MaxTokens = 4096 }
        };

        Assert.False(AiServiceCollectionExtensions.ValidateProfiles(settings));
    }

    [Theory]
    [InlineData("claude-sonnet-5-5", true, false)]
    [InlineData("claude-sonnet-5-5", false, true)]
    [InlineData("claude-opus-5-5", true, false)]
    [InlineData("claude-fable-5-1", true, false)]
    [InlineData("claude-sonnet-5", true, true)]
    [InlineData("claude-haiku-4-5", true, true)]
    public void ValidateProfiles_RejectsForcedToolChoiceOnModelsThatReturn400ForIt(
        string model, bool forced, bool expectedValid)
    {
        var settings = new AnthropicSettings
        {
            Drafting = new AiModelProfile { Model = "claude-haiku-4-5", MaxTokens = 1024 },
            Judgment = new AiModelProfile { Model = model, MaxTokens = 4096, ForcedToolChoice = forced }
        };

        Assert.Equal(expectedValid, AiServiceCollectionExtensions.ValidateProfiles(settings));
    }
}
