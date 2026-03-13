using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using Microsoft.Extensions.DependencyInjection;

namespace DespatchWeb.Extensions;

public static class JobServiceCollectionExtensions
{
    public static IServiceCollection AddJobServices(this IServiceCollection services)
    {
        services.AddScoped<IFlightStatsService, FlightStatsService>();
        services.AddScoped<IClientAccessValidatorService, ClientAccessValidatorService>();
        services.AddScoped<IRateJobService, RateJobService>();
        services.AddScoped<IFlightRateService, FlightRateService>();
        services.AddScoped<IAddStopJobService, AddStopJobService>();
        services.AddScoped<IMessageHelperService, MessageHelperService>();
        services.AddScoped<IAddAgentRecoveryJobService, AddAgentRecoveryJobService>();
        services.AddScoped<IAddressLookupService, AddressLookupService>();
        services.AddScoped<IJobReportService, JobReportService>();
        services.AddScoped<ICourierReportService, CourierReportService>();
        services.AddScoped<IJobPhotoService, JobPhotoService>();
        services.AddScoped<IClearListEnvelopeService, ClearListEnvelopeService>();
        services.AddScoped<IDispatchJobService, DispatchJobService>();
        services.AddScoped<IDeliveryJourneyService, DeliveryJourneyService>();
        services.AddScoped<IPricingPermissionService, PricingPermissionService>();
        services.AddScoped<ISplitJobService, SplitJobService>();
        services.AddScoped<ICreateJobService, CreateJobService>();
        services.AddScoped<IPodReportService, PodReportService>();
        services.AddScoped<IAccessorialChargeService, AccessorialChargeService>();
        services.AddSingleton<BackgroundTaskTracker>();

        return services;
    }
}
