using DespatchWeb.Interfaces;
using DespatchWeb.Services;

namespace DespatchWeb.Extensions;

public static class TenantServiceCollectionExtensions
{
    public static IServiceCollection AddTenantServices(this IServiceCollection services)
    {
        services.AddScoped<ITenantInfoService, TenantInfoService>();
        services.AddScoped<ITenantClock, TenantClock>();
        services.AddScoped<IScopeProvider, ScopeProvider>();
        services.AddScoped<IFeatureVisibilityService, FeatureVisibilityService>();
        services.AddScoped<INetworkPartnerContextService, NetworkPartnerContextService>();

        return services;
    }
}
