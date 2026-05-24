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

    /// <summary>
    /// Approver inbox feed: Pending change requests this tenant must review.
    /// Driven by Status='Pending' AND Origin='Peer' on the local DB — see
    /// <see cref="IJobChangeRequestService.ListPendingForApprovalAsync"/>.
    /// </summary>
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

    /// <summary>
    /// Internal: called by Integration Manager (with SC-JWT) when a peer's change request arrives.
    /// Not user-facing; protected by the same [Authorize] gate as the rest of the controller —
    /// IM mints a per-tenant JWT that DespatchWeb's auth middleware accepts.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> PeerInbound([FromBody] PeerInboundChangeRequestPayload payload, CancellationToken ct)
    {
        try
        {
            var result = await service.RecordPeerCreateAsync(payload, ct);
            return result.Success ? Ok(result) : NotFound(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobChangeRequestController), nameof(PeerInbound)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost("JobChangeRequest/PeerDecision/{sourceUuid:guid}")]
    public async Task<IActionResult> PeerDecision(Guid sourceUuid, [FromBody] PeerInboundChangeDecisionPayload payload,
        CancellationToken ct)
    {
        try
        {
            var result = await service.RecordPeerDecisionAsync(sourceUuid, payload, ct);
            return result.Success ? Ok(result) : NotFound(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobChangeRequestController), nameof(PeerDecision)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost("JobChangeRequest/PeerApplied/{sourceUuid:guid}")]
    public async Task<IActionResult> PeerApplied(Guid sourceUuid, [FromBody] PeerInboundChangeAppliedPayload payload,
        CancellationToken ct)
    {
        try
        {
            var result = await service.RecordPeerAppliedAsync(sourceUuid, payload, ct);
            return result.Success ? Ok(result) : NotFound(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobChangeRequestController), nameof(PeerApplied)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }
}
