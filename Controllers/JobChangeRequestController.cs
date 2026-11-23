using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class JobChangeRequestController(IJobChangeRequestService service) : Controller
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateJobChangeRequestRequest request, CancellationToken ct)
    {
        try
        {
            var result = await service.CreateLocalAsync(request, ct);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobChangeRequestController), nameof(Create)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> Approve([FromBody] ApproveJobChangeRequestRequest request, CancellationToken ct)
    {
        try
        {
            var result = await service.ApproveAsync(request.RequestId, request, ct);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobChangeRequestController), nameof(Approve)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> Reject([FromBody] RejectJobChangeRequestRequest request, CancellationToken ct)
    {
        try
        {
            var result = await service.RejectAsync(request.RequestId, request, ct);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobChangeRequestController), nameof(Reject)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> Cancel([FromBody] CancelJobChangeRequestRequest request, CancellationToken ct)
    {
        try
        {
            var result = await service.CancelAsync(request.RequestId, request, ct);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobChangeRequestController), nameof(Cancel)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpGet]
    public async Task<IActionResult> ForJob(int jobId, CancellationToken ct)
    {
        try
        {
            var rows = await service.ListForJobAsync(jobId, ct);
            return Json(rows);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobChangeRequestController), nameof(ForJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpGet]
    public async Task<IActionResult> PendingForApproval(int limit, CancellationToken ct)
    {
        try
        {
            var effective = limit is > 0 and <= 500 ? limit : 200;
            var rows = await service.ListPendingForApprovalAsync(effective, ct);
            return Json(rows);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}", ErrorMessageStringFormatter.FormatForLogging(
                ex, nameof(JobChangeRequestController), nameof(PendingForApproval)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpGet]
    public async Task<IActionResult> HasActivePartners(CancellationToken ct)
    {
        try
        {
            var hasActivePartners = await service.HasActivePartnersAsync(ct);
            return Json(new { hasActivePartners });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}", ErrorMessageStringFormatter.FormatForLogging(
                ex, nameof(JobChangeRequestController), nameof(HasActivePartners)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

}
