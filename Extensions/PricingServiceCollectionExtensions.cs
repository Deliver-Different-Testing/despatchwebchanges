using DespatchWeb.Interfaces;
using DespatchWeb.Services;

namespace DespatchWeb.Extensions;

public static class PricingServiceCollectionExtensions
{
    public static IServiceCollection AddPricingServices(this IServiceCollection services)
    {
        services.AddScoped<IRateJobService, RateJobService>();
        services.AddScoped<IFlightRateService, FlightRateService>();
        services.AddScoped<IFlightStatsService, FlightStatsService>();
        services.AddScoped<IPricingPermissionService, PricingPermissionService>();

        return services;
    }
}
