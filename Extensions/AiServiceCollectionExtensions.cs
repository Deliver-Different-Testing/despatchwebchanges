using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;

namespace DespatchWeb.Extensions;

public static class AiServiceCollectionExtensions
{
    public static void AddAiServices(this IServiceCollection services,
        string configSectionName = "Anthropic")
    {
        services.AddOptions<AnthropicSettings>()
            .BindConfiguration(configSectionName)
            // DataAnnotations validation is shallow, so the per-profile annotations are
            // checked explicitly here rather than being silently skipped.
            .Validate(ValidateProfiles, "Anthropic model profiles are invalid.")
            .ValidateOnStart();

        services.AddSingleton<IAiResponseCache, AiResponseCache>();
        services.AddSingleton<IAiClientService, AiClientService>();
        services.AddSingleton<IAiRateLimiter, AiRateLimiter>();
        services.AddScoped<IAiSummarizationService, AiSummarizationService>();
        services.AddScoped<IAiDraftingService, AiDraftingService>();
        services.AddScoped<IAiInsightsService, AiInsightsService>();
        services.AddScoped<IAiIntakeService, AiIntakeService>();
    }

    internal static bool ValidateProfiles(AnthropicSettings settings) =>
        IsValid(settings.Drafting) && IsValid(settings.Judgment);

    private static bool IsValid(AiModelProfile profile) =>
        profile is { MaxTokens: >= 256 and <= 64000 }
        && !string.IsNullOrWhiteSpace(profile.Model)
        && profile.InputPricePerMillion >= 0
        && profile.OutputPricePerMillion >= 0
        && profile.CacheReadPricePerMillion >= 0
        && profile.CacheWritePricePerMillion >= 0
        // Claude Haiku 4.5 has no effort parameter and rejects the request if one is
        // sent, so a profile pinned to it must leave Effort unset.
        && (string.IsNullOrEmpty(profile.Effort) || !profile.Model.StartsWith("claude-haiku"));
}
