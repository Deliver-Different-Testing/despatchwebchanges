#nullable enable
using System.Net;
using System.Text;
using System.Text.Json;
using DespatchWeb.Interfaces;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// DespatchWeb → Configurator PDF Overlay client. One HTTP call: pass the job + document type, get
/// back the stamped PDF. Tenant is read from the current user's <c>CurrentTenantID</c> claim (same as
/// the rest of DespatchWeb), so callers don't pass it. Designed to be safe to call unconditionally —
/// it returns <c>null</c> (rather than throwing) for every "no overlay" outcome, so the overlay path
/// can never break the caller's existing behaviour.
/// </summary>
public sealed class PdfOverlayClient(
    HttpClient httpClient,
    IHttpContextAccessor contextAccessor,
    IConfiguration configuration) : IPdfOverlayClient
{
    public async Task<byte[]?> TryRenderJobAsync(int jobId, string documentType, CancellationToken ct = default)
    {
        var baseUrl = configuration["PdfOverlayBaseUrl"];
        var apiKey = configuration["PdfOverlayRenderApiKey"];

        // Feature not configured for this deployment — caller falls back to the built-in report.
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(apiKey))
        {
            return null;
        }

        var tenantId = contextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(c => c.Type == "CurrentTenantID")?.Value;
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return null;
        }

        var url = $"{baseUrl.TrimEnd('/')}/api/pdf-overlay/render-job";
        var payload = JsonSerializer.Serialize(new { tenantId, jobId, documentType });

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Content = new StringContent(payload, Encoding.UTF8, "application/json");
            req.Headers.Add("X-Api-Key", apiKey);

            using var res = await httpClient.SendAsync(req, ct);

            // 404 = no active template for this client + documentType — the defined "fall back" signal.
            if (res.StatusCode == HttpStatusCode.NotFound)
            {
                return null;
            }

            if (res.IsSuccessStatusCode) return await res.Content.ReadAsByteArrayAsync(ct);
            Log.Warning("PDF Overlay render-job for job {JobId} ({DocType}) returned {Status} — falling back",
                jobId, documentType, (int)res.StatusCode);
            return null;
        }
        catch (Exception ex)
        {
            // Never let the overlay path break the caller — log and fall back.
            Log.Warning(ex, "PDF Overlay render-job call failed for job {JobId} — falling back", jobId);
            return null;
        }
    }
}