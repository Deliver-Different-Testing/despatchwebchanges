#nullable enable
using System.Globalization;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

public sealed class JobChangeRequestService(
    IDbContextFactory<DespatchContext> contextFactory,
    IJobChangePolicyService policyService,
    IJobChangeRequestPartnerClient partnerClient,
    ISendToPartnerService sendToPartner,
    ITenantInfoService tenantInfo) : IJobChangeRequestService
{
    public async Task<JobChangeRequestResult> CreateLocalAsync(CreateJobChangeRequestRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.FieldName))
            return new JobChangeRequestResult { Success = false, Message = "FieldName is required" };
        if (!Enum.TryParse<JobChangeField>(request.FieldName, ignoreCase: true, out var field))
            return new JobChangeRequestResult { Success = false, Message = $"Unknown field '{request.FieldName}'" };

        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var job = await ctx.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == request.JobId)
            .Select(j => new
            {
                j.UcjbId,
                j.UcjbStatus,
                j.PartnerJobGuid,
                j.PartnerAgreedRate,
                j.UcjbQty,
                j.UcjbSpeed,
                j.UcjbNotes
            })
            .FirstOrDefaultAsync(ct);

        if (job is null)
            return new JobChangeRequestResult { Success = false, Message = $"Job {request.JobId} not found" };
        if (!job.PartnerJobGuid.HasValue)
            return new JobChangeRequestResult { Success = false, Message = "Job is not an inter-tenant partner job" };

        var (pairing, pairingError) = await ResolveActivePairingAsync(ctx, request.PairingId, partnerTenantId: null, ct);
        if (pairing is null)
            return new JobChangeRequestResult { Success = false, Message = pairingError };

        if (await ctx.TucJobChangeRequests
                .AnyAsync(r => r.UjcrJobId == request.JobId
                               && r.UjcrFieldName == field.ToString()
                               && (r.UjcrStatus == JobChangeRequestStatus.Pending
                                   || r.UjcrStatus == JobChangeRequestStatus.Approved), ct))
            return new JobChangeRequestResult
            {
                Success = false,
                Message = $"A pending request for '{field}' already exists on this job"
            };

        var stage = MapLifecycleStage(job.UcjbStatus);
        const string requestingPartyType = "OwnerTenant";
        var decision = policyService.Evaluate(field, requestingPartyType, stage);
        if (!decision.Allowed)
            return new JobChangeRequestResult
            {
                Success = false,
                Message = $"Change to '{field}' is prohibited at stage '{stage}' (rule {decision.RuleCode})"
            };

        var currentValue = request.CurrentValue ?? SnapshotCurrentValue(field, job.UcjbQty, job.UcjbSpeed,
            job.UcjbNotes,
            job.PartnerAgreedRate);

        var sourceUuid = Guid.NewGuid();
        var staffId = SafeGetStaffId();

        var row = new TucJobChangeRequest
        {
            UjcrJobId = request.JobId,
            UjcrPairingId = pairing.Id,
            UjcrSourceRequestUuid = sourceUuid,
            UjcrOrigin = "Local",
            UjcrRequestingPartyType = requestingPartyType,
            UjcrApprovalPartyType = decision.ApprovalPartyType,
            UjcrFieldName = field.ToString(),
            UjcrCurrentValue = currentValue,
            UjcrRequestedValue = request.RequestedValue,
            UjcrReason = request.Reason,
            UjcrStatus = decision.Mode == JobChangeApprovalMode.Auto
                ? JobChangeRequestStatus.Applied
                : JobChangeRequestStatus.Pending,
            UjcrApprovalMode = decision.Mode.ToString(),
            UjcrRuleCode = decision.RuleCode,
            UjcrRequiresCommercialRefresh = decision.RequiresCommercialRefresh,
            UjcrRequestedByStaffId = staffId,
            UjcrRequestedAtUtc = DateTime.UtcNow,
            UjcrAppliedAtUtc = decision.Mode == JobChangeApprovalMode.Auto ? DateTime.UtcNow : null,
            UjcrAppliedByStaffId = decision.Mode == JobChangeApprovalMode.Auto ? staffId : null
        };

        var eventTypeId = await ResolveEventTypeIdAsync(ctx,
            decision.Mode == JobChangeApprovalMode.Auto ? "Partner Change Applied" : "Partner Change Request", ct);
        var tucEvent = new TucEvent
        {
            UcevJobId = request.JobId,
            UcevType = eventTypeId,
            UcevDate = DateTime.UtcNow,
            UcevNotes = BuildEventNotes(field.ToString(), currentValue, request.RequestedValue, request.Reason),
            UcevClosed = decision.Mode == JobChangeApprovalMode.Auto,
            UcevDueTime = DateTime.UtcNow.AddHours(24),
            UcevDescription = $"Partner change: {field}"
        };

        await using var tx = await ctx.Database.BeginTransactionAsync(ct);
        ctx.TucEvents.Add(tucEvent);
        await ctx.SaveChangesAsync(ct);
        row.UjcrTucEventId = tucEvent.UcevId;
        ctx.TucJobChangeRequests.Add(row);

        if (decision.Mode == JobChangeApprovalMode.Auto)
            await ApplyFieldChangeAsync(ctx, request.JobId, field, request.RequestedValue, ct);

        await ctx.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        // Forward to peer via IM. Best-effort: local row is already saved; a transient peer
        // failure surfaces in the response but doesn't roll back the local state.
        var forward = await partnerClient.ForwardCreateAsync(pairing.Id, job.PartnerJobGuid.Value, sourceUuid,
            field.ToString(), currentValue, request.RequestedValue, request.Reason,
            decision.Mode.ToString(), decision.RequiresCommercialRefresh, ct);
        if (!forward.Success)
            Log.Warning("Peer forward for change request {SourceUuid} failed: {Message}", sourceUuid, forward.Message);

        return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
    }

    public async Task<JobChangeRequestResult> ApproveAsync(int id, ApproveJobChangeRequestRequest request,
        CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var row = await ctx.TucJobChangeRequests.FirstOrDefaultAsync(r => r.UjcrId == id, ct);
        if (row is null)
            return new JobChangeRequestResult { Success = false, Message = "Change request not found" };
        if (row.UjcrStatus != JobChangeRequestStatus.Pending)
            return new JobChangeRequestResult
                { Success = false, Message = $"Request is in status '{row.UjcrStatus}', cannot approve" };

        // Reject rows whose field name doesn't map to any v1 enum value rather than
        // silently flipping to Applied without mutating the job. Peer-create writes the
        // payload's FieldName verbatim, so a peer running ahead of us on the field-set
        // can land an unknown name here — explicit refusal beats silent no-op.
        if (!Enum.TryParse<JobChangeField>(row.UjcrFieldName, out var field))
            return new JobChangeRequestResult
            {
                Success = false,
                Message = $"Field '{row.UjcrFieldName}' is not supported in this version"
            };

        // Stamp the client's rowversion onto EF's original-values so SaveChangesAsync below
        // performs the concurrency check at the DB level (UPDATE … WHERE rowversion = @orig)
        // and throws DbUpdateConcurrencyException if another writer beat us to it.
        if (request.RowVersion is not null)
            ctx.Entry(row).OriginalValues[nameof(TucJobChangeRequest.UjcrRowVersion)] = request.RowVersion;

        var staffId = SafeGetStaffId();
        row.UjcrStatus = JobChangeRequestStatus.Applied;
        row.UjcrApprovedByStaffId = staffId;
        row.UjcrAppliedByStaffId = staffId;
        row.UjcrRespondedAtUtc = DateTime.UtcNow;
        row.UjcrAppliedAtUtc = DateTime.UtcNow;

        // For rate changes, capture the *current* PartnerAgreedRate before applying the
        // update — ApplyFieldChangeAsync overwrites the column, so reading after would
        // return the new value and silently produce identical old/new amounts.
        if (field == JobChangeField.PartnerAgreedRate
            && decimal.TryParse(row.UjcrRequestedValue, NumberStyles.Any, CultureInfo.InvariantCulture,
                out var newRate))
        {
            row.UjcrOldCommercialAmount = await ctx.TucJobs
                .Where(j => j.UcjbId == row.UjcrJobId)
                .Select(j => j.PartnerAgreedRate)
                .FirstOrDefaultAsync(ct);
            row.UjcrNewCommercialAmount = newRate;
        }

        await ApplyFieldChangeAsync(ctx, row.UjcrJobId, field, row.UjcrRequestedValue, ct);

        // Commercial refresh for non-rate fields flagged by the policy (Quantity, Speed):
        // re-rate the job against our own rate card via the IM rate-for-job endpoint, then
        // push the new amount to both the local tucJob and the peer's mirror via
        // ForwardAppliedAsync below. Skipped when the field IS PartnerAgreedRate (the user
        // is supplying the amount directly), or when we have no pairing to ask through.
        if (row.UjcrRequiresCommercialRefresh
            && field != JobChangeField.PartnerAgreedRate
            && row.UjcrPairingId is { } refreshPairing)
        {
            var oldAmount = await ctx.TucJobs
                .Where(j => j.UcjbId == row.UjcrJobId)
                .Select(j => j.PartnerAgreedRate)
                .FirstOrDefaultAsync(ct);

            var refreshed = await sendToPartner.GetRateForJobAsync(refreshPairing, row.UjcrJobId);
            if (refreshed.RateCardRate is { } refreshedAmount)
            {
                row.UjcrOldCommercialAmount = oldAmount;
                row.UjcrNewCommercialAmount = refreshedAmount;
                await ctx.TucJobs.Where(j => j.UcjbId == row.UjcrJobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.PartnerAgreedRate, refreshedAmount), ct);
            }
            else
            {
                Log.Warning("Commercial refresh for change request {SourceUuid} produced no rate (source={Source})",
                    row.UjcrSourceRequestUuid, refreshed.Source);
            }
        }

        if (row.UjcrTucEventId is { } eventId)
            await CloseEventAsync(ctx, eventId, "Partner Change Approved", ct);

        try
        {
            await ctx.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return new JobChangeRequestResult
                { Success = false, Message = "Request has been modified by someone else; refresh and retry" };
        }

        if (row.UjcrPairingId is not { } pairingId)
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
        var forward = await partnerClient.ForwardDecisionAsync(pairingId, row.UjcrSourceRequestUuid,
            "Approved", request.Reason, ct);
        if (!forward.Success)
            Log.Warning("Peer decision forward for {SourceUuid} failed: {Message}", row.UjcrSourceRequestUuid,
                forward.Message);

        var applied = await partnerClient.ForwardAppliedAsync(pairingId, row.UjcrSourceRequestUuid,
            row.UjcrNewCommercialAmount, ct);
        if (!applied.Success)
            Log.Warning("Peer applied forward for {SourceUuid} failed: {Message}", row.UjcrSourceRequestUuid,
                applied.Message);

        return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
    }

    public async Task<JobChangeRequestResult> RejectAsync(int id, RejectJobChangeRequestRequest request,
        CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var row = await ctx.TucJobChangeRequests.FirstOrDefaultAsync(r => r.UjcrId == id, ct);
        if (row is null)
            return new JobChangeRequestResult { Success = false, Message = "Change request not found" };
        if (row.UjcrStatus != JobChangeRequestStatus.Pending)
            return new JobChangeRequestResult
                { Success = false, Message = $"Request is in status '{row.UjcrStatus}', cannot reject" };

        if (request.RowVersion is not null)
            ctx.Entry(row).OriginalValues[nameof(TucJobChangeRequest.UjcrRowVersion)] = request.RowVersion;

        row.UjcrStatus = JobChangeRequestStatus.Rejected;
        row.UjcrRejectedByStaffId = SafeGetStaffId();
        row.UjcrRespondedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Reason))
            row.UjcrReason = string.IsNullOrEmpty(row.UjcrReason)
                ? request.Reason
                : $"{row.UjcrReason}\n--\n{request.Reason}";

        if (row.UjcrTucEventId is { } eventId)
            await CloseEventAsync(ctx, eventId, "Partner Change Rejected", ct);

        try
        {
            await ctx.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return new JobChangeRequestResult
                { Success = false, Message = "Request has been modified by someone else; refresh and retry" };
        }

        if (row.UjcrPairingId is not { } pairingId)
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
        var forward = await partnerClient.ForwardDecisionAsync(pairingId, row.UjcrSourceRequestUuid,
            "Rejected", request.Reason, ct);
        if (!forward.Success)
            Log.Warning("Peer decision forward for {SourceUuid} failed: {Message}", row.UjcrSourceRequestUuid,
                forward.Message);

        return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
    }

    public async Task<JobChangeRequestResult> CancelAsync(int id, CancelJobChangeRequestRequest request,
        CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var row = await ctx.TucJobChangeRequests.FirstOrDefaultAsync(r => r.UjcrId == id, ct);
        if (row is null)
            return new JobChangeRequestResult { Success = false, Message = "Change request not found" };
        if (row.UjcrStatus != JobChangeRequestStatus.Pending)
            return new JobChangeRequestResult
                { Success = false, Message = $"Request is in status '{row.UjcrStatus}', cannot cancel" };

        // Only the originator can retract — peer-side rows are rejected via RejectAsync.
        // This keeps the semantic clean: Cancelled = "the requester took it back".
        if (!string.Equals(row.UjcrOrigin, "Local", StringComparison.Ordinal))
            return new JobChangeRequestResult
                { Success = false, Message = "Only the originator can cancel a change request" };

        if (request.RowVersion is not null)
            ctx.Entry(row).OriginalValues[nameof(TucJobChangeRequest.UjcrRowVersion)] = request.RowVersion;

        row.UjcrStatus = JobChangeRequestStatus.Cancelled;
        row.UjcrRespondedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Reason))
            row.UjcrReason = string.IsNullOrEmpty(row.UjcrReason)
                ? request.Reason
                : $"{row.UjcrReason}\n--\n{request.Reason}";

        if (row.UjcrTucEventId is { } eventId)
            await CloseEventAsync(ctx, eventId, "Partner Change Rejected", ct);

        try
        {
            await ctx.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return new JobChangeRequestResult
                { Success = false, Message = "Request has been modified by someone else; refresh and retry" };
        }

        if (row.UjcrPairingId is not { } pairingId)
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
        var forward = await partnerClient.ForwardDecisionAsync(pairingId, row.UjcrSourceRequestUuid,
            "Cancelled", request.Reason, ct);
        if (!forward.Success)
            Log.Warning("Peer cancellation forward for {SourceUuid} failed: {Message}", row.UjcrSourceRequestUuid,
                forward.Message);

        return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
    }

    public async Task<JobChangeRequestResult> RecordPeerCreateAsync(PeerInboundChangeRequestPayload payload,
        CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var existing = await ctx.TucJobChangeRequests
            .FirstOrDefaultAsync(r => r.UjcrSourceRequestUuid == payload.SourceRequestUuid, ct);
        if (existing is not null)
            return new JobChangeRequestResult { Success = true, Request = ToDto(existing) };

        var mirror = await ctx.TucJobs
            .Where(j => j.PartnerJobGuid == payload.PartnerJobGuid)
            .Select(j => new { j.UcjbId, j.UcjbStatus })
            .FirstOrDefaultAsync(ct);
        if (mirror is null)
            return new JobChangeRequestResult
                { Success = false, Message = $"No mirror job for PartnerJobGuid {payload.PartnerJobGuid}" };

        // Pairing resolution order on the peer-inbound path:
        //   1) explicit PairingId in the payload (rarely useful — the peer IM's pairing.Id
        //      and our local pairing.Id are independent values, but we honor it if set);
        //   2) lookup by PartnerTenantId, which the peer IM stamps from its signature
        //      filter — this is the common path and is signature-authoritative;
        //   3) single-active-pairing fallback for legacy or self-contained tenants.
        // Multiple active pairings with no disambiguator → fail loudly.
        var (pairing, pairingError) = await ResolveActivePairingAsync(ctx, payload.PairingId,
            payload.PartnerTenantId, ct);
        if (pairing is null)
            return new JobChangeRequestResult { Success = false, Message = pairingError };

        var row = new TucJobChangeRequest
        {
            UjcrJobId = mirror.UcjbId,
            UjcrPairingId = pairing.Id,
            UjcrSourceRequestUuid = payload.SourceRequestUuid,
            UjcrOrigin = "Peer",
            UjcrRequestingPartyType = "PartnerTenant",
            UjcrApprovalPartyType = "OwnerTenant",
            UjcrFieldName = payload.FieldName,
            UjcrCurrentValue = payload.CurrentValue,
            UjcrRequestedValue = payload.RequestedValue,
            UjcrReason = payload.Reason,
            UjcrStatus = JobChangeRequestStatus.Pending,
            UjcrApprovalMode = payload.ApprovalMode,
            UjcrRequiresCommercialRefresh = payload.RequiresCommercialRefresh,
            UjcrRequestedAtUtc = DateTime.UtcNow
        };

        var eventTypeId = await ResolveEventTypeIdAsync(ctx, "Partner Change Request", ct);
        var tucEvent = new TucEvent
        {
            UcevJobId = mirror.UcjbId,
            UcevType = eventTypeId,
            UcevDate = DateTime.UtcNow,
            UcevNotes =
                BuildEventNotes(payload.FieldName, payload.CurrentValue, payload.RequestedValue, payload.Reason),
            UcevClosed = false,
            UcevDueTime = DateTime.UtcNow.AddHours(24),
            UcevDescription = $"Partner change: {payload.FieldName}"
        };

        await using var tx = await ctx.Database.BeginTransactionAsync(ct);
        ctx.TucEvents.Add(tucEvent);
        await ctx.SaveChangesAsync(ct);
        row.UjcrTucEventId = tucEvent.UcevId;
        ctx.TucJobChangeRequests.Add(row);
        await ctx.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
    }

    public async Task<JobChangeRequestResult> RecordPeerDecisionAsync(Guid sourceUuid,
        PeerInboundChangeDecisionPayload payload, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var row = await ctx.TucJobChangeRequests
            .FirstOrDefaultAsync(r => r.UjcrSourceRequestUuid == sourceUuid, ct);
        if (row is null)
            return new JobChangeRequestResult { Success = false, Message = $"No request for SourceUuid {sourceUuid}" };

        // Terminal statuses short-circuit so a replayed inbound is idempotent. Approved
        // is non-terminal — the originator may still be waiting on the Applied event to
        // finalise the mutation, but we don't accept a fresh Approved overwrite.
        if (row.UjcrStatus is JobChangeRequestStatus.Applied
            or JobChangeRequestStatus.Rejected
            or JobChangeRequestStatus.Cancelled)
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };

        var (newStatus, eventTypeName) = ResolvePeerDecisionTransition(payload.Outcome);
        row.UjcrStatus = newStatus;
        row.UjcrRespondedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(payload.Reason))
            row.UjcrReason = string.IsNullOrEmpty(row.UjcrReason)
                ? payload.Reason
                : $"{row.UjcrReason}\n--\n{payload.Reason}";

        if (row.UjcrTucEventId is { } eventId)
            await CloseEventAsync(ctx, eventId, eventTypeName, ct);

        await ctx.SaveChangesAsync(ct);
        return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
    }

    private static (string Status, string EventTypeName) ResolvePeerDecisionTransition(string outcome)
    {
        if (outcome.Equals(JobChangeRequestStatus.Approved, StringComparison.OrdinalIgnoreCase))
            return (JobChangeRequestStatus.Approved, "Partner Change Approved");
        if (outcome.Equals(JobChangeRequestStatus.Cancelled, StringComparison.OrdinalIgnoreCase))
            return (JobChangeRequestStatus.Cancelled, "Partner Change Rejected");
        return (JobChangeRequestStatus.Rejected, "Partner Change Rejected");
    }

    public async Task<JobChangeRequestResult> RecordPeerAppliedAsync(Guid sourceUuid,
        PeerInboundChangeAppliedPayload payload, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var row = await ctx.TucJobChangeRequests
            .FirstOrDefaultAsync(r => r.UjcrSourceRequestUuid == sourceUuid, ct);
        if (row is null)
            return new JobChangeRequestResult { Success = false, Message = $"No request for SourceUuid {sourceUuid}" };

        // Terminal short-circuit. Crucially includes Cancelled — if the originator
        // cancelled after the peer applied, the late Applied event must not silently
        // re-mutate the originator's tucJob.
        if (row.UjcrStatus is JobChangeRequestStatus.Applied
            or JobChangeRequestStatus.Cancelled
            or JobChangeRequestStatus.Rejected)
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };

        row.UjcrStatus = JobChangeRequestStatus.Applied;
        row.UjcrAppliedAtUtc = DateTime.UtcNow;
        if (payload.NewCommercialAmount.HasValue)
        {
            // Capture the current rate before ExecuteUpdateAsync overwrites it. One scoped
            // query + one update — the prior version did the read after the write, so old
            // and new always ended up identical on rate changes.
            row.UjcrOldCommercialAmount = await ctx.TucJobs
                .Where(j => j.UcjbId == row.UjcrJobId)
                .Select(j => j.PartnerAgreedRate)
                .FirstOrDefaultAsync(ct);
            row.UjcrNewCommercialAmount = payload.NewCommercialAmount;

            await ctx.TucJobs
                .Where(j => j.UcjbId == row.UjcrJobId)
                .ExecuteUpdateAsync(s => s.SetProperty(j => j.PartnerAgreedRate, payload.NewCommercialAmount), ct);
        }

        if (Enum.TryParse<JobChangeField>(row.UjcrFieldName, out var field)
            && field != JobChangeField.PartnerAgreedRate)
            await ApplyFieldChangeAsync(ctx, row.UjcrJobId, field, row.UjcrRequestedValue, ct);

        if (row.UjcrTucEventId is { } eventId)
            await CloseEventAsync(ctx, eventId, "Partner Change Applied", ct);

        await ctx.SaveChangesAsync(ct);
        return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
    }

    // Hard cap on the per-job request history we hand back. The list is for a UI panel,
    // so 100 most-recent is plenty; pathological jobs with thousands of edits won't blow
    // up the response or drag down the page render.
    private const int ListForJobMaxRows = 100;

    public async Task<IReadOnlyList<JobChangeRequestDto>> ListForJobAsync(int jobId, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var rows = await ctx.TucJobChangeRequests
            .AsNoTracking()
            .Where(r => r.UjcrJobId == jobId)
            .OrderByDescending(r => r.UjcrId)
            .Take(ListForJobMaxRows)
            .ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    private static async Task ApplyFieldChangeAsync(DespatchContext ctx, int jobId, JobChangeField field,
        string? requestedValue, CancellationToken ct)
    {
        switch (field)
        {
            case JobChangeField.Notes:
                await ctx.TucJobs.Where(j => j.UcjbId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbNotes, requestedValue), ct);
                break;
            case JobChangeField.ProgressNote:
                await AppendNoteAsync(ctx, jobId, "Progress", requestedValue, ct);
                break;
            case JobChangeField.PodNote:
                await AppendNoteAsync(ctx, jobId, "POD", requestedValue, ct);
                break;
            case JobChangeField.Quantity:
                if (short.TryParse(requestedValue, out var qty))
                    await ctx.TucJobs.Where(j => j.UcjbId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbQty, qty), ct);
                break;
            case JobChangeField.Speed:
                if (int.TryParse(requestedValue, out var speedId))
                    await ctx.TucJobs.Where(j => j.UcjbId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbSpeed, speedId), ct);
                break;
            case JobChangeField.PartnerAgreedRate:
                if (decimal.TryParse(requestedValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var rate))
                    await ctx.TucJobs.Where(j => j.UcjbId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.PartnerAgreedRate, rate), ct);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(field), field, null);
        }
    }

    // ProgressNote / PodNote append to UcjbNotes with a labelled prefix rather than
    // replace it, so the existing dispatcher notes survive an auto-applied partner update.
    // Read-then-write — acceptable because Auto fields don't carry the same concurrency
    // load as Quantity/Speed and the worst case is one auto-applied note overwriting
    // another in the same millisecond.
    private static async Task AppendNoteAsync(DespatchContext ctx, int jobId, string label,
        string? requestedValue, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(requestedValue)) return;

        var existing = await ctx.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.UcjbNotes)
            .FirstOrDefaultAsync(ct);

        var entry = $"[{label}] {requestedValue}";
        var combined = string.IsNullOrWhiteSpace(existing) ? entry : $"{existing}\n{entry}";

        await ctx.TucJobs.Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbNotes, combined), ct);
    }

    private static async Task<int?> ResolveEventTypeIdAsync(DespatchContext ctx, string name, CancellationToken ct) =>
        await ctx.TucEventTypes
            .AsNoTracking()
            .Where(t => t.UcetName == name)
            .Select(t => (int?)t.UcetId)
            .FirstOrDefaultAsync(ct);

    private static async Task CloseEventAsync(DespatchContext ctx, int eventId, string newTypeName,
        CancellationToken ct)
    {
        var newTypeId = await ResolveEventTypeIdAsync(ctx, newTypeName, ct);
        await ctx.TucEvents.Where(e => e.UcevId == eventId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(e => e.UcevClosed, true)
                .SetProperty(e => e.UcevType, newTypeId), ct);
    }

    private int SafeGetStaffId()
    {
        try
        {
            return tenantInfo.GetStaffId();
        }
        catch
        {
            return 0;
        }
    }

    // Resolve the pairing to record on a change-request row. Order:
    //   1) explicit pairingId (verified Active)
    //   2) PartnerTenantId match (signature-authoritative when set by the peer IM)
    //   3) single-active fallback
    // The previous implementation silently picked the first Active pairing — for tenants
    // with >1 partner this routed messages to the wrong peer non-deterministically. Now
    // multi-active without a disambiguator errors loudly.
    private static async Task<(IntMgrPartnerPairing? Pairing, string? Error)> ResolveActivePairingAsync(
        DespatchContext ctx, int? requestedPairingId, string? partnerTenantId, CancellationToken ct)
    {
        if (requestedPairingId is { } pairingId)
        {
            var explicitMatch = await ctx.IntMgrPartnerPairings
                .AsNoTracking()
                .Where(p => p.Id == pairingId)
                .FirstOrDefaultAsync(ct);
            if (explicitMatch is null)
                return (null, $"Partner pairing {pairingId} not found");
            if (explicitMatch.Status != "Active")
                return (null, $"Partner pairing {pairingId} is not active");
            return (explicitMatch, null);
        }

        if (!string.IsNullOrWhiteSpace(partnerTenantId))
        {
            var byTenant = await ctx.IntMgrPartnerPairings
                .AsNoTracking()
                .Where(p => p.PartnerTenantId == partnerTenantId && p.Status == "Active")
                .Take(2)
                .ToListAsync(ct);
            switch (byTenant.Count)
            {
                case 1:
                    return (byTenant[0], null);
                case > 1:
                    return (null,
                        $"Multiple active pairings for partner tenant {partnerTenantId}; specify pairingId");
                // case 0: fall through to the single-active fallback
            }
        }

        var actives = await ctx.IntMgrPartnerPairings
            .AsNoTracking()
            .Where(p => p.Status == "Active")
            .Take(2)
            .ToListAsync(ct);

        return actives.Count switch
        {
            0 => (null, "No active partner pairing for this job"),
            1 => (actives[0], null),
            _ => (null, "Multiple active partner pairings exist; specify pairingId on the request")
        };
    }

    // Coarse mapping of tucJob.UcjbStatus → workflow lifecycle stages. Status-id ranges
    // were chosen against the JobStatus enum (New/Dispatched/Accepted are pre-pickup,
    // PickedUp/InTransit/OutForDelivery are en route, Completed/AssumingCompleted are
    // delivered). The remaining values (Void, agent-assigned variants) fall through to
    // Allocated as a safe default — the policy service still enforces field-level rules.
    private static JobLifecycleStage MapLifecycleStage(int? ucjbStatus) => ucjbStatus switch
    {
        null => JobLifecycleStage.PreAllocation,
        (int)JobStatus.New => JobLifecycleStage.PreAllocation,
        (int)JobStatus.Dispatched or (int)JobStatus.Accepted or (int)JobStatus.Preassigned
            or (int)JobStatus.ReadyForPacking or (int)JobStatus.ReadyToPickup
            or (int)JobStatus.AwaitingProcessing => JobLifecycleStage.Allocated,
        (int)JobStatus.PickedUp or (int)JobStatus.InTransit or (int)JobStatus.OutForDelivery
            or (int)JobStatus.LateDelivery or (int)JobStatus.AwaitingPod => JobLifecycleStage.InTransit,
        (int)JobStatus.Completed or (int)JobStatus.AssumingCompleted => JobLifecycleStage.Delivered,
        _ => JobLifecycleStage.Allocated
    };

    private static string? SnapshotCurrentValue(JobChangeField field, short? qty, int? speedId, string? notes,
        decimal? partnerAgreedRate) =>
        field switch
        {
            JobChangeField.Quantity => qty?.ToString(CultureInfo.InvariantCulture),
            JobChangeField.Speed => speedId?.ToString(CultureInfo.InvariantCulture),
            JobChangeField.Notes => notes,
            JobChangeField.PartnerAgreedRate => partnerAgreedRate?.ToString(CultureInfo.InvariantCulture),
            _ => null
        };

    private static string BuildEventNotes(string fieldName, string? currentValue, string? requestedValue,
        string? reason)
    {
        var notes = $"{fieldName}: '{currentValue ?? "(empty)"}' → '{requestedValue ?? "(empty)"}'";
        if (!string.IsNullOrWhiteSpace(reason)) notes += $". {reason}";
        return notes.Length > 1000 ? notes[..1000] : notes;
    }

    private static JobChangeRequestDto ToDto(TucJobChangeRequest r) => new()
    {
        Id = r.UjcrId,
        JobId = r.UjcrJobId,
        PairingId = r.UjcrPairingId,
        SourceRequestUuid = r.UjcrSourceRequestUuid,
        TucEventId = r.UjcrTucEventId,
        Origin = r.UjcrOrigin,
        RequestingPartyType = r.UjcrRequestingPartyType,
        ApprovalPartyType = r.UjcrApprovalPartyType,
        FieldName = r.UjcrFieldName,
        CurrentValue = r.UjcrCurrentValue,
        RequestedValue = r.UjcrRequestedValue,
        Reason = r.UjcrReason,
        Status = r.UjcrStatus,
        ApprovalMode = r.UjcrApprovalMode,
        RuleCode = r.UjcrRuleCode,
        RequiresCommercialRefresh = r.UjcrRequiresCommercialRefresh,
        OldCommercialAmount = r.UjcrOldCommercialAmount,
        NewCommercialAmount = r.UjcrNewCommercialAmount,
        RequestedAt = r.UjcrRequestedAtUtc,
        RespondedAt = r.UjcrRespondedAtUtc,
        AppliedAt = r.UjcrAppliedAtUtc,
        RowVersion = r.UjcrRowVersion
    };
}