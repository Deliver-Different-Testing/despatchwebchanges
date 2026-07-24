#nullable enable
using DeliverDifferentReporting.Models;
using DeliverDifferentReporting.Services;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Reporting;
using Serilog;

namespace DespatchWeb.Services;

// Fetches the filtered job set + pricing data, assembles the audit model, computes findings and
// invariant annotations, and renders the .xlsx. Mirrors PodReportService's DI shape
// (httpContext + branding + tenant info) - no ITenantClock, filename timestamp comes from
// DateTime.UtcNow to match how PodReportService derives $"POD-{...}.pdf" from job data.
public sealed class PriceReportService(
    IHttpContextAccessor httpContextAccessor,
    ITenantBrandingService tenantBrandingService,
    ITenantInfoService infoService,
    IJobQueryRepository jobRepository
) : IPriceReportService
{
    public async Task<(byte[] FileBytes, string FileName)> GeneratePriceDetailReportAsync(
        PriceDetailReportRequest request, CancellationToken ct = default)
    {
        var raw = await jobRepository.GetPriceDetailReportAsync(request, ct);

        var data = PriceDetailReportData.From(raw, infoService);
        data.Findings = PriceDetailFindings.Detect(data);
        PriceDetailFindings.AssertInvariants(data);

        var branding = await GetBrandingOrDefaultAsync(GetTenantId(), ct);
        using var stream = new MemoryStream();
        new PriceDetailSpreadsheet(data, branding).Generate(stream);

        var stamp = infoService.ConvertUtcToTenantTimeZone(DateTime.UtcNow).DateTime;
        return (stream.ToArray(), $"PriceDetail {stamp:yyyyMMddHHmmssfff}.xlsx");
    }

    private int GetTenantId()
    {
        var user = httpContextAccessor.HttpContext?.User;
        var tenantClaim = user?.Claims.FirstOrDefault(c => c.Type == "CurrentTenantID")?.Value;

        if (string.IsNullOrEmpty(tenantClaim) || !int.TryParse(tenantClaim, out var tenantId))
        {
            throw new InvalidOperationException("Unable to determine tenant ID from user claims");
        }

        return tenantId;
    }

    // Branding is cosmetic - a 404 / connectivity failure must not block the export. Fall back to
    // a default-populated ReportBranding, exactly like PodReportService.GetBrandingOrDefaultAsync.
    private async Task<ReportBranding> GetBrandingOrDefaultAsync(int tenantId, CancellationToken ct)
    {
        try
        {
            return await tenantBrandingService.GetBrandingAsync(tenantId, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException)
        {
            Log.Warning(ex,
                "No tenant branding available for tenant {TenantId}; falling back to default Price Detail branding",
                tenantId);
            return new ReportBranding { TenantId = tenantId };
        }
    }
}
