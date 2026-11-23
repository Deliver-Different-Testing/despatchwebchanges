#nullable enable
using DespatchWeb.Extensions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public sealed record PartnerUnlinkRequest(Guid? PartnerJobGuid, string? Reason, string? PartnerName);

public sealed record PartnerReleaseRequest(string? Scope, string? PartnerName);

/// <summary>
/// Called only by Integration Manager, with its Kubernetes service-account token (the tenant comes from X-Tenant-Id).
/// Change-request routes: 404 means the job, pairing or request isn't here; 422 means a rule refused it. IM retries
/// neither, and parks both with this body as the reason. Unlink and release are idempotent and answer 200 with their
/// outcome or counts ("not_found" when the job is already unlinked).
/// </summary>
[Authorize(AuthenticationSchemes = VoiceAgentAssignAuthentication.Scheme, Policy = VoiceAgentAssignAuthentication.Policy)]
[Route("internal/partner")]
public sealed class InternalPartnerController(IJobChangeRequestService changeRequests, IPartnerJobLinkService links) : ControllerBase
{
    [HttpPost("job-change-requests")]
    public async Task<IActionResult> PeerCreate([FromBody] PeerInboundChangeRequestPayload payload, CancellationToken ct)
    {
        payload.PairingId = AuthenticatedPairingId ?? payload.PairingId;
        return ToResult(await changeRequests.RecordPeerCreateAsync(payload, ct));
    }

    [HttpPost("job-change-requests/{sourceUuid:guid}/decision")]
    public async Task<IActionResult> PeerDecision(Guid sourceUuid, [FromBody] PeerInboundChangeDecisionPayload payload, CancellationToken ct) =>
        ToResult(await changeRequests.RecordPeerDecisionAsync(sourceUuid, payload, AuthenticatedPairingId, ct));

    [HttpPost("job-change-requests/{sourceUuid:guid}/applied")]
    public async Task<IActionResult> PeerApplied(Guid sourceUuid, [FromBody] PeerInboundChangeAppliedPayload payload, CancellationToken ct) =>
        ToResult(await changeRequests.RecordPeerAppliedAsync(sourceUuid, payload, AuthenticatedPairingId, ct));

    [HttpPost("job-change-requests/agent-inbound")]
    public async Task<IActionResult> AgentInbound([FromBody] AgentInboundChangeRequestPayload payload, CancellationToken ct)
    {
        var result = await changeRequests.RecordAgentCreateAsync(payload, ct);
        return result.Success ? Ok(result) : UnprocessableEntity(result);
    }

    [HttpPost("jobs/unlink")]
    public async Task<IActionResult> Unlink([FromBody] PartnerUnlinkRequest? request, CancellationToken ct)
    {
        if (request?.PartnerJobGuid is not { } guid || guid == Guid.Empty
            || !Enum.TryParse<PartnerUnlinkReason>(request.Reason, ignoreCase: true, out var reason)
            || !Enum.IsDefined(reason))
        {
            return BadRequest(new { error = "invalid_request" });
        }

        var outcome = await links.UnlinkAsync(guid, reason, request.PartnerName, AuthenticatedPairingId, ct);
        return Ok(new { outcome = outcome == PartnerUnlinkOutcome.Unlinked ? "unlinked" : "not_found" });
    }

    [HttpPost("pairings/{pairingId:int}/release")]
    public async Task<IActionResult> Release(int pairingId, [FromBody] PartnerReleaseRequest? request, CancellationToken ct)
    {
        if (!Enum.TryParse<PartnerReleaseScope>(request?.Scope, ignoreCase: true, out var scope) || !Enum.IsDefined(scope))
        {
            return BadRequest(new { error = "invalid_request" });
        }

        if (AuthenticatedPairingId is { } authenticated && authenticated != pairingId)
        {
            return NotFound();
        }

        var result = await links.ReleaseAsync(pairingId, scope, request!.PartnerName, ct);
        return Ok(new
        {
            unlinked = result.Unlinked,
            voided = result.Voided,
            voidedAfterPickup = result.VoidedAfterPickup,
            skippedCompleted = result.SkippedCompleted
        });
    }

    // IM stamps the pairing whose signing key authenticated the peer; it outranks anything the body claims.
    private int? AuthenticatedPairingId =>
        int.TryParse(Request.Headers[PairingHeader].ToString(), System.Globalization.NumberStyles.None,
            System.Globalization.CultureInfo.InvariantCulture, out var id) && id > 0 ? id : null;

    private const string PairingHeader = "X-Partner-Pairing-Id";

    private IActionResult ToResult(JobChangeRequestResult result) => result switch
    {
        { Success: true } => Ok(result),
        { NotFound: true } => NotFound(result),
        _ => UnprocessableEntity(result)
    };
}
