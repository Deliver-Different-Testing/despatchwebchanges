using DespatchWeb.Interfaces;
using DespatchWeb.Services;

namespace DespatchWeb.Extensions;

public static class JobServiceCollectionExtensions
{
    public static IServiceCollection AddJobServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ICreateJobService, CreateJobService>();
        services.AddScoped<ISplitJobService, SplitJobService>();
        services.AddScoped<ISplitPricingPreviewService, SplitPricingPreviewService>();
        services.AddScoped<IAddStopJobService, AddStopJobService>();
        services.AddScoped<IDispatchJobService, DispatchJobService>();
        services.AddScoped<IDeliveryJourneyService, DeliveryJourneyService>();
        services.AddScoped<IAddAgentRecoveryJobService, AddAgentRecoveryJobService>();
        services.AddScoped<IClearListEnvelopeService, ClearListEnvelopeService>();
        services.AddScoped<IClientAccessValidatorService, ClientAccessValidatorService>();
        services.AddScoped<ISendToPartnerService, SendToPartnerService>();
        services.AddScoped<IJobChangePolicyService, JobChangePolicyService>();
        services.AddScoped<IJobChangeRequestService, JobChangeRequestService>();
        services.AddScoped<IJobChangeRequestPartnerClient, JobChangeRequestPartnerClient>();
        services.AddScoped<IPartnerJobGate, PartnerJobGate>();
        services.AddScoped<IArrivalWaitRerateService, ArrivalWaitRerateService>();

        return services;
    }
}
