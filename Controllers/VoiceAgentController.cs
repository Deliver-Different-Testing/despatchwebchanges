#nullable enable
using System.Security.Claims;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

public sealed record CourierAssignRequest(int JobId, int CourierId, int StaffId, string? CallId);

/// <summary>
/// Called only by Integration Manager's voice agent, with a Kubernetes service-account token. The tenant comes from the
/// token's subject, never from the body. Cookie users and Hub agent tokens are not accepted here.
/// </summary>
[Authorize(AuthenticationSchemes = VoiceAgentAssignAuthentication.Scheme, Policy = VoiceAgentAssignAuthentication.Policy)]
public sealed class VoiceAgentController(IDispatchJobService dispatchJobService) : ControllerBase
{
    [HttpPost("internal/voice-agent/courier-assign")]
    public async Task<IActionResult> CourierAssign([FromBody] CourierAssignRequest? request, CancellationToken cancellationToken)
    {
        var sub = User.FindFirst(VoiceAgentAssignAuthentication.SubjectClaim)?.Value;
        var tenant = User.FindFirst("CurrentTenantID")?.Value;

        if (request is null || !ModelState.IsValid || request.JobId <= 0 || request.CourierId <= 0 || request.StaffId <= 0
            || string.IsNullOrWhiteSpace(request.CallId))
        {
            Log.Information("VoiceAgent courier-assign refused sub={Sub} tenant={Tenant} jobId={JobId} courierId={CourierId} staffId={StaffId} callId={CallId} outcome=invalid_request",
                sub, tenant, request?.JobId, request?.CourierId, request?.StaffId, request?.CallId);
            return Error("invalid_request");
        }

        // The journey triggers read the acting staff from the StaffID claim, so the voice agent's staff is the one recorded.
        ((ClaimsIdentity)User.Identity!).AddClaim(new Claim("StaffID", request.StaffId.ToString()));

        CourierClaimOutcome outcome;
        try
        {
            outcome = await dispatchJobService.ClaimJobForCourierAsync(request.JobId, request.CourierId, request.StaffId, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            Log.Error(ex, "VoiceAgent courier-assign failed sub={Sub} tenant={Tenant} jobId={JobId} courierId={CourierId} staffId={StaffId} callId={CallId}",
                sub, tenant, request.JobId, request.CourierId, request.StaffId, request.CallId);
            return StatusCode(StatusCodes.Status500InternalServerError, new Dictionary<string, string> { ["error"] = "assign_failed" });
        }

        var name = Name(outcome);
        Log.Information("VoiceAgent courier-assign sub={Sub} tenant={Tenant} jobId={JobId} courierId={CourierId} staffId={StaffId} callId={CallId} outcome={Outcome}",
            sub, tenant, request.JobId, request.CourierId, request.StaffId, request.CallId, name);

        return outcome is CourierClaimOutcome.InvalidStaff or CourierClaimOutcome.InvalidCourier
            ? Error(name)
            : Content($"{{\"outcome\":\"{name}\"}}", "application/json");
    }

    private BadRequestObjectResult Error(string code) => BadRequest(new Dictionary<string, string> { ["error"] = code });

    private static string Name(CourierClaimOutcome outcome) => outcome switch
    {
        CourierClaimOutcome.Assigned => "assigned",
        CourierClaimOutcome.AlreadyYours => "already_yours",
        CourierClaimOutcome.Unavailable => "unavailable",
        CourierClaimOutcome.NotFound => "not_found",
        CourierClaimOutcome.InvalidStaff => "invalid_staff",
        _ => "invalid_courier"
    };
}
