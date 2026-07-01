using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using DespatchWeb.Services.JobApi;

namespace DespatchWeb.Extensions;

public static class PricingServiceCollectionExtensions
{
    public static IServiceCollection AddPricingServices(this IServiceCollection services)
    {
        services.AddScoped<IRateJobService, RateJobService>();
        services.AddScoped<IFlightRateService, FlightRateService>();
        services.AddScoped<IFlightStatsService, FlightStatsService>();
        services.AddScoped<IFlightAssignmentService, FlightAssignmentService>();
        services.AddScoped<IPricingPermissionService, PricingPermissionService>();

        // DespatchWeb -> Integration Manager Cirium gateway (used when Cirium:UseIntegrationManager is on).
        services.AddHttpClient<ICiriumApiClient, CiriumApiClient>();

        return services;
    }
}
