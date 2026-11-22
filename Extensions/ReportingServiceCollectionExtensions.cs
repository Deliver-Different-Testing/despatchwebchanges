using DeliverDifferent.AlertLabel.Data.Extensions;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;

namespace DespatchWeb.Extensions;

public static class ReportingServiceCollectionExtensions
{
    public static IServiceCollection AddReportingServices(this IServiceCollection services)
    {
        services.AddScoped<IJobReportService, JobReportService>();
        services.AddScoped<ICourierReportService, CourierReportService>();
        services.AddScoped<IComplianceReminderService, ComplianceReminderService>();
        services.AddScoped<IPodReportService, PodReportService>();
        services.AddScoped<IPriceReportService, PriceReportService>();
        services.AddScoped<IJobLabelService, JobLabelService>();
        services.AddSingleton<ILabelTemplateResolver, LabelTemplateResolver>();
        services.AddAlertLabelService();
        
        services.AddHttpClient<IPdfOverlayClient, PdfOverlayClient>();

        return services;
    }
}
