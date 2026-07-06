using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class AiController(
    IAiSummarizationService summarizationService,
    IAiDraftingService draftingService,
    IAiInsightsService insightsService,
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

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

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

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

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

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

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

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

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

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

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

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

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

    [HttpPost]
    public async Task<IActionResult> DraftMessage([FromBody] DraftMessageRequest request, CancellationToken ct)
    {
        try
        {
            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await draftingService.DraftCourierMessageAsync(request, ct);

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error drafting message: {Error}", e.Message);
            return StatusCode(500, "An error occurred generating the draft");
        }
    }

    [HttpPost]
    public async Task<IActionResult> DraftEmail([FromBody] DraftEmailRequest request, CancellationToken ct)
    {
        try
        {
            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await draftingService.DraftEmailAsync(request, ct);

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error drafting email: {Error}", e.Message);
            return StatusCode(500, "An error occurred generating the draft");
        }
    }

    [HttpPost]
    public async Task<IActionResult> DraftPodEmail(int jobId, CancellationToken ct)
    {
        try
        {
            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await draftingService.DraftPodEmailAsync(jobId, ct);

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error drafting POD email for job {JobId}: {Error}", jobId, e.Message);
            return StatusCode(500, "An error occurred generating the draft");
        }
    }

    [HttpPost]
    public async Task<IActionResult> DraftNote([FromBody] DraftNoteRequest request, CancellationToken ct)
    {
        try
        {
            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await draftingService.DraftNoteAsync(request, ct);

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error drafting note: {Error}", e.Message);
            return StatusCode(500, "An error occurred generating the draft");
        }
    }

    [HttpPost]
    public async Task<IActionResult> ExtractBlockers(int jobId, CancellationToken ct)
    {
        try
        {
            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await insightsService.ExtractBlockersAsync(jobId, ct);

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error extracting blockers for job {JobId}: {Error}", jobId, e.Message);
            return StatusCode(500, "An error occurred extracting blockers");
        }
    }

    [HttpPost]
    public async Task<IActionResult> AnalyzePricing(int jobId, int accessorialChargeGroupId, CancellationToken ct)
    {
        try
        {
            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await insightsService.AnalyzePricingAsync(jobId, accessorialChargeGroupId, ct);

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error analyzing pricing for job {JobId}: {Error}", jobId, e.Message);
            return StatusCode(500, "An error occurred analyzing pricing");
        }
    }

    [HttpPost]
    public async Task<IActionResult> TriageChangeRequest(int requestId, int jobId, CancellationToken ct)
    {
        try
        {
            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var response = await insightsService.TriageChangeRequestAsync(requestId, jobId, ct);

            await rateLimiter.RecordTokenUsageAsync(staffId, tenantId, response.Usage);

            return Json(response);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled");
        }
        catch (Exception e)
        {
            Log.Error(e, "Error triaging change request {RequestId}: {Error}", requestId, e.Message);
            return StatusCode(500, "An error occurred triaging the change request");
        }
    }
}
