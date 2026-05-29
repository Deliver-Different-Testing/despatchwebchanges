using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class AiController(
    IAiSummarizationService summarizationService,
    IAiRateLimiter rateLimiter,
    ITenantInfoService tenantInfo,
    IOptions<AnthropicSettings> settings) : Controller
{
    [HttpGet]
    public IActionResult IsEnabled() => Json(new { enabled = settings.Value.EnableAiFeatures });

    [HttpPost]
    public async Task<IActionResult> SummarizeJobNotes(int jobId, CancellationToken ct)
    {
        try
        {
            if (!settings.Value.EnableAiFeatures)
            {
                return StatusCode(503, "AI features are not enabled");
            }

            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await summarizationService.SummarizeJobNotesAsync(jobId, ct);

            await rateLimiter.RecordTokenUsageAsync(
                staffId, tenantId, response.Usage.InputTokens, response.Usage.OutputTokens);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error summarizing job notes for job {JobId}: {Error}", jobId, e.Message);
            return StatusCode(500, "An error occurred generating the summary");
        }
    }

    [HttpPost]
    public async Task<IActionResult> SummarizeJobEvents(int jobId, CancellationToken ct)
    {
        try
        {
            if (!settings.Value.EnableAiFeatures)
            {
                return StatusCode(503, "AI features are not enabled");
            }

            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await summarizationService.SummarizeJobEventsAsync(jobId, ct);

            await rateLimiter.RecordTokenUsageAsync(
                staffId, tenantId, response.Usage.InputTokens, response.Usage.OutputTokens);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error summarizing job events for job {JobId}: {Error}", jobId, e.Message);
            return StatusCode(500, "An error occurred generating the summary");
        }
    }

    [HttpPost]
    public async Task<IActionResult> SummarizeTaskDashboard(CancellationToken ct)
    {
        try
        {
            if (!settings.Value.EnableAiFeatures)
            {
                return StatusCode(503, "AI features are not enabled");
            }

            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await summarizationService.SummarizeTaskDashboardAsync(ct);

            await rateLimiter.RecordTokenUsageAsync(
                staffId, tenantId, response.Usage.InputTokens, response.Usage.OutputTokens);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error summarizing task dashboard: {Error}", e.Message);
            return StatusCode(500, "An error occurred generating the summary");
        }
    }

    [HttpPost]
    public async Task<IActionResult> SummarizeJob(int jobId, CancellationToken ct)
    {
        try
        {
            if (!settings.Value.EnableAiFeatures)
            {
                return StatusCode(503, "AI features are not enabled");
            }

            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await summarizationService.SummarizeJobAsync(jobId, ct);

            await rateLimiter.RecordTokenUsageAsync(
                staffId, tenantId, response.Usage.InputTokens, response.Usage.OutputTokens);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error summarizing job {JobId}: {Error}", jobId, e.Message);
            return StatusCode(500, "An error occurred generating the summary");
        }
    }

    [HttpPost]
    public async Task<IActionResult> SummarizeOperations(CancellationToken ct)
    {
        try
        {
            if (!settings.Value.EnableAiFeatures)
            {
                return StatusCode(503, "AI features are not enabled");
            }

            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await summarizationService.SummarizeOperationsAsync(ct);

            await rateLimiter.RecordTokenUsageAsync(
                staffId, tenantId, response.Usage.InputTokens, response.Usage.OutputTokens);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error summarizing operations: {Error}", e.Message);
            return StatusCode(500, "An error occurred generating the summary");
        }
    }

    [HttpPost]
    public async Task<IActionResult> SummarizeCompliance(CancellationToken ct)
    {
        try
        {
            if (!settings.Value.EnableAiFeatures)
            {
                return StatusCode(503, "AI features are not enabled");
            }

            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await summarizationService.SummarizeComplianceAsync(ct);

            await rateLimiter.RecordTokenUsageAsync(
                staffId, tenantId, response.Usage.InputTokens, response.Usage.OutputTokens);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error summarizing compliance: {Error}", e.Message);
            return StatusCode(500, "An error occurred generating the summary");
        }
    }
}
