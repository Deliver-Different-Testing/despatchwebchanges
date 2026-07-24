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
        // POD emails are sent synchronously (with the PDF attached) via SMTP rather than queued.
        services.AddScoped<IEmailSender, SmtpEmailSender>();
        // Calls the Configurator's PDF Overlay render endpoint to produce a job's document from a
        // customer template (falls back to the built-in report when no template applies).
        services.AddHttpClient<IPdfOverlayClient, PdfOverlayClient>();

        return services;
    }
}
