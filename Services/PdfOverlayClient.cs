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
    private static readonly JsonSerializerOptions WebJsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<byte[]?> RenderJobAsync(int jobId, string documentType, CancellationToken ct = default)
    {
        var baseUrl = configuration["PdfOverlayBaseUrl"];
        var apiKey = configuration["PdfOverlayRenderApiKey"];

        // Feature not configured for this deployment — nothing to render.
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

        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Content = new StringContent(payload, Encoding.UTF8, "application/json");
        req.Headers.Add("X-Api-Key", apiKey);

        using var res = await httpClient.SendAsync(req, ct);

        // 404 = no active template for this client + documentType — the defined "no template" signal.
        if (res.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }

        if (res.IsSuccessStatusCode)
        {
            return await res.Content.ReadAsByteArrayAsync(ct);
        }

        // A real render-side failure (e.g. an undecodable delivery photo → 400/500). Surface it — the
        // caller must not report this as "no template available".
        var body = await res.Content.ReadAsStringAsync(ct);
        Log.Warning("PDF Overlay render-job for job {JobId} ({DocType}) returned {Status}: {Body}",
            jobId, documentType, (int)res.StatusCode, body);
        throw new PdfOverlayRenderException(
            (int)res.StatusCode,
            string.IsNullOrWhiteSpace(body) ? $"PDF overlay render failed ({(int)res.StatusCode})." : body);
    }

    public async Task<byte[]?> TryRenderJobAsync(int jobId, string documentType, CancellationToken ct = default)
    {
        try
        {
            return await RenderJobAsync(jobId, documentType, ct);
        }
        catch (Exception ex)
        {
            // Safe-by-design fallback path (e.g. the POD button): never let the overlay break the
            // caller — log and fall back to the built-in report.
            Log.Warning(ex, "PDF Overlay render-job call failed for job {JobId} — falling back", jobId);
            return null;
        }
    }

    public async Task<IReadOnlyList<OverlayDocument>?> ListJobDocumentsAsync(
        int jobId, CancellationToken ct = default)
    {
        var baseUrl = configuration["PdfOverlayBaseUrl"];
        var apiKey = configuration["PdfOverlayRenderApiKey"];

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

        var url = $"{baseUrl.TrimEnd('/')}/api/pdf-overlay/list-job";
        var payload = JsonSerializer.Serialize(new { tenantId, jobId });

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Content = new StringContent(payload, Encoding.UTF8, "application/json");
            req.Headers.Add("X-Api-Key", apiKey);

            using var res = await httpClient.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                Log.Warning("PDF Overlay list-job for job {JobId} returned {Status}",
                    jobId, (int)res.StatusCode);
                return null;
            }

            var json = await res.Content.ReadAsStringAsync(ct);
            var docs = JsonSerializer.Deserialize<List<OverlayDocument>>(json, WebJsonOptions);
            return docs ?? [];
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "PDF Overlay list-job call failed for job {JobId}", jobId);
            return null;
        }
    }
}