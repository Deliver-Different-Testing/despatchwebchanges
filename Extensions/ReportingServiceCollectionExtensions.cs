using DeliverDifferent.AlertLabel.Data.Extensions;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using QuestPDF.Infrastructure;

namespace DespatchWeb.Extensions;

public static class ReportingServiceCollectionExtensions
{
    public static IServiceCollection AddReportingServices(this IServiceCollection services)
    {
        // The label renderer (and every other QuestPDF document) throws until a license is chosen.
        QuestPDF.Settings.License = LicenseType.Community;

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
