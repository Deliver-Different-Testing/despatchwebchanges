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
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton<IAiClientService, AiClientService>();
        services.AddSingleton<IAiRateLimiter, AiRateLimiter>();
        services.AddScoped<IAiSummarizationService, AiSummarizationService>();
    }
}