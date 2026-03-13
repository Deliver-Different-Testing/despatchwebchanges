using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.Extensions.DependencyInjection;

namespace DespatchWeb.Extensions;

public static class AiServiceCollectionExtensions
{
    public static IServiceCollection AddAiServices(
        this IServiceCollection services,
        string configSectionName = "Anthropic")
    {
        services.AddOptions<AnthropicSettings>()
            .BindConfiguration(configSectionName)
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton<IAiClientService, AiClientService>();
        services.AddSingleton<IAiRateLimiter, AiRateLimiter>();
        services.AddScoped<IAiAssistantService, AiAssistantService>();
        services.AddScoped<IAiSummarizationService, AiSummarizationService>();

        return services;
    }
}
