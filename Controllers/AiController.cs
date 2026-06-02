using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class AiController(
    IAiSummarizationService summarizationService,
    IAiRateLimiter rateLimiter,
    ITenantInfoService tenantInfo) : Controller
{
    [HttpPost]
    public async Task<IActionResult> SummarizeJobNotes(int jobId, CancellationToken ct)
    {
        try
        {
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
