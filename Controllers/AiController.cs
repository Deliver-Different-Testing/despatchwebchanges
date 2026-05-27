using System.Text;
using System.Text.Json;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class AiController(
    IAiAssistantService assistantService,
    IAiSummarizationService summarizationService,
    IAiRateLimiter rateLimiter,
    ITenantInfoService tenantInfo,
    IOptions<AnthropicSettings> settings) : Controller
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    [HttpGet]
    public IActionResult IsEnabled() => Json(new { enabled = settings.Value.EnableAiFeatures });

    [HttpPost]
    public async Task<IActionResult> Chat([FromBody] AiChatRequest request, CancellationToken ct)
    {
        try
        {
            if (!settings.Value.EnableAiFeatures)
            {
                return StatusCode(503, "AI features are not enabled");
            }

            var validationError = AiInputGuard.Validate(request);
            if (validationError != null)
            {
                return BadRequest(validationError);
            }

            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone(); // using timezone as tenant identifier

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                return StatusCode(429, "Rate limit exceeded. Please try again in a moment.");
            }

            var messages = request.Messages
                .Select(m => new AiMessage { Role = m.Role, Content = m.Content })
                .ToList();

            var response = await assistantService.ChatAsync(messages, ct);

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
            Log.Error(e, "Error in AI chat: {Error}", e.Message);
            return StatusCode(500, "An error occurred processing your request");
        }
    }

    [HttpPost]
    public async Task StreamChat([FromBody] AiChatRequest request, CancellationToken ct)
    {
        try
        {
            if (!settings.Value.EnableAiFeatures)
            {
                Response.StatusCode = 503;
                await Response.WriteAsync("AI features are not enabled", ct);
                return;
            }

            var validationError = AiInputGuard.Validate(request);
            if (validationError != null)
            {
                Response.StatusCode = 400;
                await Response.WriteAsync(validationError, ct);
                return;
            }

            var staffId = tenantInfo.GetStaffId();
            var tenantId = tenantInfo.GetTenantTimeZone();

            if (!await rateLimiter.TryAcquireAsync(staffId, tenantId))
            {
                Response.StatusCode = 429;
                await Response.WriteAsync("Rate limit exceeded", ct);
                return;
            }

            Response.ContentType = "application/x-ndjson";
            Response.Headers.CacheControl = "no-cache";

            var messages = request.Messages
                .Select(m => new AiMessage { Role = m.Role, Content = m.Content })
                .ToList();

            await foreach (var chunk in assistantService.StreamChatAsync(messages, ct))
            {
                var chunkResponse = new AiChatChunk
                {
                    Text = chunk,
                    IsComplete = false
                };

                var json = JsonSerializer.Serialize(chunkResponse, JsonOptions);
                await Response.WriteAsync(json + "\n", Encoding.UTF8, ct);
                await Response.Body.FlushAsync(ct);
            }

            // Send completion marker
            var completeChunk = new AiChatChunk { Text = "", IsComplete = true };
            var completeJson = JsonSerializer.Serialize(completeChunk, JsonOptions);
            await Response.WriteAsync(completeJson + "\n", Encoding.UTF8, ct);
            await Response.Body.FlushAsync(ct);
        }
        catch (OperationCanceledException)
        {
            // Client disconnected, nothing to do
        }
        catch (Exception e)
        {
            Log.Error(e, "Error in AI stream chat: {Error}", e.Message);

            if (!Response.HasStarted)
            {
                Response.StatusCode = 500;
                await Response.WriteAsync("An error occurred processing your request", ct);
            }
        }
    }

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

    [HttpPost]
    public async Task<IActionResult> AnalyzeLateAlert(int jobId, CancellationToken ct)
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

            var response = await summarizationService.AnalyzeLateAlertAsync(jobId, ct);

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
            Log.Error(e, "Error analyzing late alert for job {JobId}: {Error}", jobId, e.Message);
            return StatusCode(500, "An error occurred analyzing the late alert");
        }
    }

    [HttpPost]
    public async Task<IActionResult> SuggestCouriers(int jobId, CancellationToken ct)
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

            var response = await summarizationService.SuggestCouriersAsync(jobId, ct);

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
            Log.Error(e, "Error suggesting couriers for job {JobId}: {Error}", jobId, e.Message);
            return StatusCode(500, "An error occurred generating courier suggestions");
        }
    }
}