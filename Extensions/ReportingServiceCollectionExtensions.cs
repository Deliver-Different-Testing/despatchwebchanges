using DespatchWeb.Interfaces;
using DespatchWeb.Services;

namespace DespatchWeb.Extensions;

public static class ReportingServiceCollectionExtensions
{
    public static IServiceCollection AddReportingServices(this IServiceCollection services)
    {
        services.AddScoped<IJobReportService, JobReportService>();
        services.AddScoped<ICourierReportService, CourierReportService>();
        services.AddScoped<IPodReportService, PodReportService>();
        services.AddScoped<IPriceReportService, PriceReportService>();
        
        services.AddHttpClient<IPdfOverlayClient, PdfOverlayClient>();

        return services;
    }
}
