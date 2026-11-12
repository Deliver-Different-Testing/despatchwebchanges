using DespatchWeb.Services.AgentRead;

namespace DespatchWeb.Extensions;

public static class AgentReadServiceCollectionExtensions
{
    public static IServiceCollection AddAgentReadServices(this IServiceCollection services)
    {
        services.AddScoped<IAgentJobSearchService, AgentJobSearchService>();
        services.AddScoped<IAgentJobStoryService, AgentJobStoryService>();
        services.AddScoped<IAgentPartnerInboxService, AgentPartnerInboxService>();
        services.AddScoped<IAgentRecurringCheckService, AgentRecurringCheckService>();
        services.AddScoped<IAgentDispatchBoardService, AgentDispatchBoardService>();
        services.AddScoped<IAgentDriverDayService, AgentDriverDayService>();
        services.AddScoped<IAgentJobEvidenceService, AgentJobEvidenceService>();
        return services;
    }
}
