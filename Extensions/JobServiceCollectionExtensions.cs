using DespatchWeb.Interfaces;
using DespatchWeb.Services;

namespace DespatchWeb.Extensions;

public static class JobServiceCollectionExtensions
{
    public static IServiceCollection AddJobServices(this IServiceCollection services)
    {
        services.AddScoped<ICreateJobService, CreateJobService>();
        services.AddScoped<ISplitJobService, SplitJobService>();
        services.AddScoped<IAddStopJobService, AddStopJobService>();
        services.AddScoped<IDispatchJobService, DispatchJobService>();
        services.AddScoped<IDeliveryJourneyService, DeliveryJourneyService>();
        services.AddScoped<IAddAgentRecoveryJobService, AddAgentRecoveryJobService>();
        services.AddScoped<IClearListEnvelopeService, ClearListEnvelopeService>();
        services.AddScoped<IClientAccessValidatorService, ClientAccessValidatorService>();
        services.AddScoped<ISendToPartnerService, SendToPartnerService>();

        return services;
    }
}
