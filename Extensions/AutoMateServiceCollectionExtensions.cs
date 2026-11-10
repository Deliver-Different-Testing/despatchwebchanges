using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.AutoMate;
using DespatchWeb.Services.AutoMate;
using DespatchWeb.Services.AutoMate.Tools;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Extensions;

public static class AutoMateServiceCollectionExtensions
{
    public static void AddAutoMateChat(this IServiceCollection services)
    {
        services.AddOptions<AutoMateChatOptions>().BindConfiguration(AutoMateChatOptions.SectionName);
        services.AddOptions<ServiceAuthOptions>().BindConfiguration(ServiceAuthOptions.SectionName);
        services.AddOptions<CspKnowledgeOptions>()
            .BindConfiguration(CspKnowledgeOptions.SectionName)
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<CspKnowledgeOptions>, CspKnowledgeOptionsValidator>();

        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<CspKnowledgeCircuits>();
        services.AddSingleton<CspBaseUrlResolver>();

        // No retry handler on either client: the knowledge client has its own circuit, and a retry would only
        // add latency to the wait for the chat's first token.
        services.AddSingleton<IServiceTokenProvider, CspTokenProvider>();
        services.AddHttpClient(CspTokenProvider.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(5));
        services.AddHttpClient<ICspKnowledgeClient, CspKnowledgeClient>(c => c.Timeout = TimeSpan.FromSeconds(10));

        services.AddScoped<AutoMateAudience>();
        services.AddScoped<KbTurnSources>();
        services.AddScoped<IAutoMateChatService, AutoMateChatService>();

        services.AddScoped<IAutoMateTool, GetJobTool>();
        services.AddScoped<IAutoMateTool, GetJobActivityTool>();
        services.AddScoped<IAutoMateTool, SearchJobsTool>();
        services.AddScoped<IAutoMateTool, FindDriversTool>();
        services.AddScoped<IAutoMateTool, FindClientTool>();
        services.AddScoped<IAutoMateTool, SearchKnowledgeBaseTool>();
        services.AddScoped<IAutoMateTool, GetArticleTool>();
    }
}
