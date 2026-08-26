using DespatchWeb.Interfaces;
using DespatchWeb.Services;

namespace DespatchWeb.Extensions;

public static class SupportServiceCollectionExtensions
{
    public static IServiceCollection AddSupportServices(this IServiceCollection services)
    {
        services.AddScoped<IAddressLookupService, AddressLookupService>();
        services.AddScoped<IMessageHelperService, MessageHelperService>();
        services.AddScoped<IJobPhotoService, JobPhotoService>();
        services.AddScoped<IPodMediaService, PodMediaService>();
        services.AddScoped<IAccessorialChargeService, AccessorialChargeService>();

        return services;
    }
}
