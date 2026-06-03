#nullable enable
using System.Globalization;
using System.Text.Json;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

public sealed class JobChangeRequestService(
    IDbContextFactory<DespatchContext> contextFactory,
    IJobChangePolicyService policyService,
    IJobChangeRequestPartnerClient partnerClient,
    ISendToPartnerService sendToPartner,
    ITenantInfoService tenantInfo,
    IJobCommandRepository jobCommandRepository) : IJobChangeRequestService
{
    private const int ListForJobMaxRows = 100;
    private static readonly JsonSerializerOptions CompoundPayloadJsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<JobChangeRequestResult> CreateLocalAsync(CreateJobChangeRequestRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.FieldName))
        {
            return new JobChangeRequestResult { Success = false, Message = "FieldName is required" };
        }

        if (!Enum.TryParse<JobChangeField>(request.FieldName, ignoreCase: true, out var field))
        {
            return new JobChangeRequestResult { Success = false, Message = $"Unknown field '{request.FieldName}'" };
        }

        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var job = await ctx.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == request.JobId)
            .FirstOrDefaultAsync(ct);

        if (job is null)
        {
            return new JobChangeRequestResult { Success = false, Message = $"Job {request.JobId} not found" };
        }

        if (!job.PartnerJobGuid.HasValue)
        {
            return new JobChangeRequestResult { Success = false, Message = "Job is not an inter-tenant partner job" };
        }

        // Resolve the pairing this job belongs to. Prefer the explicit request.PairingId
        // (frontend sends it when known); otherwise fall back to TucJob.PartnerPairingId
        // (column set at SendToPartner-time for outbound, IM ingest for inbound).
        // ResolveActivePairingAsync validates the candidate and only falls back to
        // "single active pairing on this tenant" when both are null — bailing out
        // loudly when ambiguous.
        var pairingIdHint = request.PairingId ?? job.PartnerPairingId;

        var (pairing, pairingError) =
            await ResolveActivePairingAsync(ctx, pairingIdHint, partnerTenantId: null, ct);
        if (pairing is null)
        {
            return new JobChangeRequestResult { Success = false, Message = pairingError };
        }

        if (await ctx.TucJobChangeRequests
                .AnyAsync(r => r.UjcrJobId == request.JobId
                               && r.UjcrFieldName == field.ToString()
                               && (r.UjcrStatus == JobChangeRequestStatus.Pending
                                   || r.UjcrStatus == JobChangeRequestStatus.Approved), ct))
        {
            return new JobChangeRequestResult
            {
                Success = false,
                Message = $"A pending request for '{field}' already exists on this job"
            };
        }

        var stage = MapLifecycleStage(job.UcjbStatus);

        var localTenantId = tenantInfo.GetCurrentTenantId();
        var isLocalOwner = string.IsNullOrEmpty(localTenantId)
                           || string.Equals(localTenantId, pairing.OwnerTenantId, StringComparison.Ordinal);
        var requestingPartyType = isLocalOwner ? "OwnerTenant" : "PartnerTenant";
        var decision = policyService.Evaluate(field, requestingPartyType, stage);
        if (!decision.Allowed)
        {
            return new JobChangeRequestResult
            {
                Success = false,
                Message = $"Change to '{field}' is prohibited at stage '{stage}' (rule {decision.RuleCode})"
            };
        }

        var currentValue = request.CurrentValue ?? SnapshotCurrentValue(field, job);

        var sourceUuid = Guid.NewGuid();
        var staffId = CurrentStaffIdOrNull();

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

        var strategy = ctx.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await ctx.Database.BeginTransactionAsync(ct);
            await ctx.TucJobChangeRequests.AddAsync(row, ct);

            if (decision.Mode == JobChangeApprovalMode.Auto)
            {
                await ApplyFieldChangeAsync(ctx, request.JobId, field, request.RequestedValue, ct);
            }

            await ctx.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });

        // Forward to peer via IM. Best-effort: local row is already saved; a transient peer
        // failure surfaces in the response but doesn't roll back the local state.
        var forward = await partnerClient.ForwardCreateAsync(pairing.Id, job.PartnerJobGuid.Value, sourceUuid,
            field.ToString(), currentValue, request.RequestedValue, request.Reason,
            decision.Mode.ToString(), decision.RequiresCommercialRefresh, ct);

        if (forward.Success)
        {
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
        }

        Log.Error(
            "Peer forward for change request {SourceUuid} (PartnerJobGuid={PartnerJobGuid}) failed: {Message}",
            sourceUuid, job.PartnerJobGuid, forward.Message);
        return new JobChangeRequestResult
        {
            Success = true,
            Request = ToDto(row),
            PeerForwardWarning = forward.Message ?? "Partner notification failed"
        };
    }

    public async Task<JobChangeRequestResult> ApproveAsync(int id, ApproveJobChangeRequestRequest request,
        CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var row = await ctx.TucJobChangeRequests.FirstOrDefaultAsync(r => r.UjcrId == id, ct);
        if (row is null)
        {
            return new JobChangeRequestResult { Success = false, Message = "Change request not found" };
        }

        if (row.UjcrStatus != JobChangeRequestStatus.Pending)
        {
            return new JobChangeRequestResult
                { Success = false, Message = $"Request is in status '{row.UjcrStatus}', cannot approve" };
        }

        // Reject rows whose field name doesn't map to any v1 enum value rather than
        // silently flipping to Applied without mutating the job. Peer-create writes the
        // payload's FieldName verbatim, so a peer running ahead of us on the field-set
        // can land an unknown name here — explicit refusal beats silent no-op.
        if (!Enum.TryParse<JobChangeField>(row.UjcrFieldName, out var field))
        {
            return new JobChangeRequestResult
            {
                Success = false,
                Message = $"Field '{row.UjcrFieldName}' is not supported in this version"
            };
        }

        if (request.RowVersion is not null)
        {
            ctx.Entry(row).OriginalValues[nameof(TucJobChangeRequest.UjcrRowVersion)] = request.RowVersion;
        }

        decimal? refreshedAmount = null;
        decimal? oldAmountForRefresh = null;
        var needsRefresh = row.UjcrRequiresCommercialRefresh
                           && field != JobChangeField.PartnerAgreedRate
                           && row.UjcrPairingId is not null;
        if (needsRefresh)
        {
            var refreshPairing = row.UjcrPairingId!.Value;
            var refreshed = await sendToPartner.GetRateForJobAsync(refreshPairing, row.UjcrJobId);
            if (refreshed.RateCardRate is null)
            {
                Log.Warning(
                    "Commercial refresh for change request {SourceUuid} produced no rate (source={Source}); leaving row Pending",
                    row.UjcrSourceRequestUuid, refreshed.Source);
                return new JobChangeRequestResult
                {
                    Success = false,
                    Message =
                        "Could not re-rate the job against the current rate card. Approval rolled back; please retry."
                };
            }

            refreshedAmount = refreshed.RateCardRate;
            oldAmountForRefresh = await ctx.TucJobs
                .Where(j => j.UcjbId == row.UjcrJobId)
                .Select(j => j.PartnerAgreedRate)
                .FirstOrDefaultAsync(ct);
        }

        var staffId = CurrentStaffIdOrNull();
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

        var concurrencyConflict = false;
        var strategy = ctx.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await ctx.Database.BeginTransactionAsync(ct);

            await ApplyFieldChangeAsync(ctx, row.UjcrJobId, field, row.UjcrRequestedValue, ct);

            if (needsRefresh)
            {
                row.UjcrOldCommercialAmount = oldAmountForRefresh;
                row.UjcrNewCommercialAmount = refreshedAmount;
                await ctx.TucJobs.Where(j => j.UcjbId == row.UjcrJobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.PartnerAgreedRate, refreshedAmount), ct);
            }

            try
            {
                await ctx.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                concurrencyConflict = true;
                return;
            }

            await tx.CommitAsync(ct);
        });

        if (concurrencyConflict)
        {
            return new JobChangeRequestResult
                { Success = false, Message = "Request has been modified by someone else; refresh and retry" };
        }

        if (row.UjcrPairingId is not { } pairingId)
        {
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
        }

        var forward = await partnerClient.ForwardDecisionAsync(pairingId, row.UjcrSourceRequestUuid,
            "Approved", request.Reason, ct);
        if (!forward.Success)
        {
            Log.Error("Peer decision forward (Approved) for {SourceUuid} failed: {Message}",
                row.UjcrSourceRequestUuid, forward.Message);
        }

        var applied = await partnerClient.ForwardAppliedAsync(pairingId, row.UjcrSourceRequestUuid,
            row.UjcrNewCommercialAmount, ct);
        if (!applied.Success)
        {
            Log.Error("Peer applied forward for {SourceUuid} failed: {Message}", row.UjcrSourceRequestUuid,
                applied.Message);
        }

        var warning = !forward.Success
            ? forward.Message ?? "Partner notification failed"
            : !applied.Success
                ? applied.Message ?? "Partner apply notification failed"
                : null;
        return new JobChangeRequestResult { Success = true, Request = ToDto(row), PeerForwardWarning = warning };
    }

    public async Task<JobChangeRequestResult> RejectAsync(int id, RejectJobChangeRequestRequest request,
        CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var row = await ctx.TucJobChangeRequests.FirstOrDefaultAsync(r => r.UjcrId == id, ct);
        if (row is null)
        {
            return new JobChangeRequestResult { Success = false, Message = "Change request not found" };
        }

        if (row.UjcrStatus != JobChangeRequestStatus.Pending)
        {
            return new JobChangeRequestResult
                { Success = false, Message = $"Request is in status '{row.UjcrStatus}', cannot reject" };
        }

        if (request.RowVersion is not null)
        {
            ctx.Entry(row).OriginalValues[nameof(TucJobChangeRequest.UjcrRowVersion)] = request.RowVersion;
        }

        row.UjcrStatus = JobChangeRequestStatus.Rejected;
        row.UjcrRejectedByStaffId = CurrentStaffIdOrNull();
        row.UjcrRespondedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Reason))
        {
            row.UjcrReason = string.IsNullOrEmpty(row.UjcrReason)
                ? request.Reason
                : $"{row.UjcrReason}\n--\n{request.Reason}";
        }

        var concurrencyConflict = false;
        var strategy = ctx.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await ctx.Database.BeginTransactionAsync(ct);

            try
            {
                await ctx.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                concurrencyConflict = true;
                return;
            }

            await tx.CommitAsync(ct);
        });

        if (concurrencyConflict)
        {
            return new JobChangeRequestResult
                { Success = false, Message = "Request has been modified by someone else; refresh and retry" };
        }

        if (row.UjcrPairingId is not { } pairingId)
        {
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
        }

        var forward = await partnerClient.ForwardDecisionAsync(pairingId, row.UjcrSourceRequestUuid,
            "Rejected", request.Reason, ct);
        if (!forward.Success)
        {
            Log.Error("Peer decision forward (Rejected) for {SourceUuid} failed: {Message}",
                row.UjcrSourceRequestUuid, forward.Message);
        }

        return new JobChangeRequestResult
        {
            Success = true,
            Request = ToDto(row),
            PeerForwardWarning = forward.Success ? null : forward.Message ?? "Partner notification failed"
        };
    }

    public async Task<JobChangeRequestResult> CancelAsync(int id, CancelJobChangeRequestRequest request,
        CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var row = await ctx.TucJobChangeRequests.FirstOrDefaultAsync(r => r.UjcrId == id, ct);
        if (row is null)
        {
            return new JobChangeRequestResult { Success = false, Message = "Change request not found" };
        }

        if (row.UjcrStatus != JobChangeRequestStatus.Pending)
        {
            return new JobChangeRequestResult
                { Success = false, Message = $"Request is in status '{row.UjcrStatus}', cannot cancel" };
        }

        // Only the originator can retract — peer-side rows are rejected via RejectAsync.
        // This keeps the semantic clean: Cancelled = "the requester took it back".
        if (!string.Equals(row.UjcrOrigin, "Local", StringComparison.Ordinal))
        {
            return new JobChangeRequestResult
                { Success = false, Message = "Only the originator can cancel a change request" };
        }

        if (request.RowVersion is not null)
        {
            ctx.Entry(row).OriginalValues[nameof(TucJobChangeRequest.UjcrRowVersion)] = request.RowVersion;
        }

        row.UjcrStatus = JobChangeRequestStatus.Cancelled;
        row.UjcrRespondedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Reason))
        {
            row.UjcrReason = string.IsNullOrEmpty(row.UjcrReason)
                ? request.Reason
                : $"{row.UjcrReason}\n--\n{request.Reason}";
        }

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
        {
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
        }

        var forward = await partnerClient.ForwardDecisionAsync(pairingId, row.UjcrSourceRequestUuid,
            "Cancelled", request.Reason, ct);
        if (!forward.Success)
        {
            Log.Error("Peer cancellation forward for {SourceUuid} failed: {Message}",
                row.UjcrSourceRequestUuid, forward.Message);
        }

        return new JobChangeRequestResult
        {
            Success = true,
            Request = ToDto(row),
            PeerForwardWarning = forward.Success ? null : forward.Message ?? "Partner notification failed"
        };
    }

    public async Task<JobChangeRequestResult> RecordPeerCreateAsync(PeerInboundChangeRequestPayload payload,
        CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        var existing = await ctx.TucJobChangeRequests
            .FirstOrDefaultAsync(r => r.UjcrSourceRequestUuid == payload.SourceRequestUuid, ct);
        if (existing is not null)
        {
            return new JobChangeRequestResult { Success = true, Request = ToDto(existing) };
        }

        var mirror = await ctx.TucJobs
            .Where(j => j.PartnerJobGuid == payload.PartnerJobGuid)
            .Select(j => new { j.UcjbId, j.UcjbStatus })
            .FirstOrDefaultAsync(ct);
        if (mirror is null)
        {
            // Without DB access in production, the next failure must produce its own evidence
            // for whether the local tenant has zero partner jobs (config/dispatch broken) or
            // many but not this specific one (data loss specific to this job). Pull a small
            // sample of recent partner GUIDs so the CloudWatch log line is self-diagnosing.
            var recent = await ctx.TucJobs
                .AsNoTracking()
                .Where(j => j.PartnerJobGuid.HasValue)
                .OrderByDescending(j => j.UcjbId)
                .Take(10)
                .Select(j => new { j.UcjbId, j.PartnerJobGuid })
                .ToListAsync(ct);
            var recentGuids = string.Join(",", recent.Select(r => $"{r.UcjbId}={r.PartnerJobGuid}"));

            Log.Error(
                "PeerInbound mirror lookup failed: PartnerJobGuid={PartnerJobGuid}, " +
                "SourceRequestUuid={SourceRequestUuid}, FieldName={FieldName}, " +
                "PartnerTenantId={PartnerTenantId}. Local partner-job count: {PartnerJobCount}, " +
                "recent partner GUIDs: {RecentGuids}",
                payload.PartnerJobGuid, payload.SourceRequestUuid, payload.FieldName,
                payload.PartnerTenantId, recent.Count, recentGuids);

            return new JobChangeRequestResult
                { Success = false, Message = $"No mirror job for PartnerJobGuid {payload.PartnerJobGuid}" };
        }

        var (pairing, pairingError) = await ResolveActivePairingAsync(ctx, payload.PairingId,
            payload.PartnerTenantId, ct);
        if (pairing is null)
        {
            return new JobChangeRequestResult { Success = false, Message = pairingError };
        }

        // Re-evaluate the policy against OUR local mirror's lifecycle stage. The originator
        // already checked their side, but our stage may have advanced (e.g., we've moved to
        // Delivered while the peer is still pre-pickup). If the field isn't allowed at our
        // stage, reject the inbound rather than silently queueing a request the approver
        // can never act on.
        if (Enum.TryParse<JobChangeField>(payload.FieldName, ignoreCase: true, out var peerField))
        {
            var localStage = MapLifecycleStage(mirror.UcjbStatus);
            var localDecision = policyService.Evaluate(peerField, "PartnerTenant", localStage);
            if (!localDecision.Allowed)
            {
                return new JobChangeRequestResult
                {
                    Success = false,
                    Message =
                        $"Change to '{payload.FieldName}' is prohibited on our side at stage '{localStage}' (rule {localDecision.RuleCode})"
                };
            }
        }

        // Mirror the local CreateLocalAsync duplicate guard: refuse a second Pending/Approved
        // row for the same field on the same job. Without this, a peer that races our own
        // Pending request lands a competing row; whoever's approve fires first wins
        // arbitrarily. SourceRequestUuid dedup above only catches replays of the SAME request.
        if (await ctx.TucJobChangeRequests
                .AnyAsync(r => r.UjcrJobId == mirror.UcjbId
                               && r.UjcrFieldName == payload.FieldName
                               && (r.UjcrStatus == JobChangeRequestStatus.Pending
                                   || r.UjcrStatus == JobChangeRequestStatus.Approved), ct))
        {
            return new JobChangeRequestResult
            {
                Success = false,
                Message = $"A pending request for '{payload.FieldName}' already exists on this job"
            };
        }

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

        await ctx.TucJobChangeRequests.AddAsync(row, ct);
        await ctx.SaveChangesAsync(ct);

        return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
    }

    public async Task<JobChangeRequestResult> RecordPeerDecisionAsync(Guid sourceUuid,
        PeerInboundChangeDecisionPayload payload, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var row = await ctx.TucJobChangeRequests
            .FirstOrDefaultAsync(r => r.UjcrSourceRequestUuid == sourceUuid, ct);
        if (row is null)
        {
            return new JobChangeRequestResult { Success = false, Message = $"No request for SourceUuid {sourceUuid}" };
        }

        // Terminal statuses short-circuit so a replayed inbound is idempotent. Approved
        // is non-terminal — the originator may still be waiting on the Applied event to
        // finalize the mutation, but we don't accept a fresh Approved overwrite.
        if (row.UjcrStatus is JobChangeRequestStatus.Applied
            or JobChangeRequestStatus.Rejected
            or JobChangeRequestStatus.Cancelled)
        {
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
        }

        row.UjcrStatus = ResolvePeerDecisionStatus(payload.Outcome);
        row.UjcrRespondedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(payload.Reason))
        {
            row.UjcrReason = string.IsNullOrEmpty(row.UjcrReason)
                ? payload.Reason
                : $"{row.UjcrReason}\n--\n{payload.Reason}";
        }

        await ctx.SaveChangesAsync(ct);
        return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
    }

    public async Task<JobChangeRequestResult> RecordPeerAppliedAsync(Guid sourceUuid,
        PeerInboundChangeAppliedPayload payload, CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);
        var row = await ctx.TucJobChangeRequests
            .FirstOrDefaultAsync(r => r.UjcrSourceRequestUuid == sourceUuid, ct);
        if (row is null)
        {
            return new JobChangeRequestResult { Success = false, Message = $"No request for SourceUuid {sourceUuid}" };
        }

        // Terminal short-circuit. Crucially includes Cancelled — if the originator
        // canceled after the peer applied, the late Applied event must not silently
        // re-mutate the originator's tucJob.
        if (row.UjcrStatus is JobChangeRequestStatus.Applied
            or JobChangeRequestStatus.Cancelled
            or JobChangeRequestStatus.Rejected)
        {
            return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
        }

        row.UjcrStatus = JobChangeRequestStatus.Applied;
        row.UjcrAppliedAtUtc = DateTime.UtcNow;

        var strategy = ctx.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await ctx.Database.BeginTransactionAsync(ct);

            if (payload.NewCommercialAmount.HasValue)
            {
                // Capture the current rate before ExecuteUpdateAsync overwrites it —
                // reading after would silently produce identical old/new amounts.
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
            {
                await ApplyFieldChangeAsync(ctx, row.UjcrJobId, field, row.UjcrRequestedValue, ct);
            }

            await ctx.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });

        return new JobChangeRequestResult { Success = true, Request = ToDto(row) };
    }

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

    public async Task<IReadOnlyList<JobChangeRequestInboxItem>> ListPendingForApprovalAsync(int limit,
        CancellationToken ct)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(ct);

        // Pending + Origin=Peer is the canonical "this tenant must approve" filter:
        // peer-originated rows always have ApprovalPartyType set to the local role,
        // and local-originated rows are awaiting the *other* side's approval.
        // Join through TucJobs → TucClients in a single round-trip so the inbox page
        // doesn't N+1-fetch job details for every row.
        var query =
            from r in ctx.TucJobChangeRequests.AsNoTracking()
            where r.UjcrStatus == JobChangeRequestStatus.Pending && r.UjcrOrigin == "Peer"
            join j in ctx.TucJobs.AsNoTracking() on r.UjcrJobId equals j.UcjbId
            join c in ctx.TucClients.AsNoTracking() on j.UcjbClientId equals c.UcclId into clients
            from c in clients.DefaultIfEmpty()
            orderby r.UjcrId descending
            select new { Row = r, JobNo = j.UcjbNumber, ClientName = c != null ? c.UcclName : null };

        var rows = await query.Take(limit).ToListAsync(ct);
        return rows
            .Select(x => new JobChangeRequestInboxItem
            {
                Request = ToDto(x.Row),
                JobNo = x.JobNo ?? string.Empty,
                ClientName = x.ClientName
            })
            .ToList();
    }

    private static string ResolvePeerDecisionStatus(string outcome)
    {
        if (outcome.Equals(JobChangeRequestStatus.Approved, StringComparison.OrdinalIgnoreCase))
        {
            return JobChangeRequestStatus.Approved;
        }

        return outcome.Equals(JobChangeRequestStatus.Cancelled, StringComparison.OrdinalIgnoreCase)
            ? JobChangeRequestStatus.Cancelled
            : JobChangeRequestStatus.Rejected;
    }

    private async Task ApplyFieldChangeAsync(DespatchContext ctx, int jobId, JobChangeField field,
        string? requestedValue, CancellationToken ct)
    {
        var q = ctx.TucJobs.Where(j => j.UcjbId == jobId);
        switch (field)
        {
            case JobChangeField.Notes:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbNotes, requestedValue), ct);
                break;
            case JobChangeField.ProgressNote:
                await AppendNoteAsync(ctx, jobId, "Progress", requestedValue, ct);
                break;
            case JobChangeField.PodNote:
                await AppendNoteAsync(ctx, jobId, "POD", requestedValue, ct);
                break;
            case JobChangeField.Quantity:
                if (short.TryParse(requestedValue, out var qty))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbQty, qty), ct);
                }

                break;
            case JobChangeField.Speed:
                if (int.TryParse(requestedValue, out var speedId))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbSpeed, speedId), ct);
                }

                break;
            case JobChangeField.PartnerAgreedRate:
                if (decimal.TryParse(requestedValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var rate))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.PartnerAgreedRate, rate), ct);
                }

                break;

            // Auto — customer-visible non-rated. Mirror the truncation / parsing rules used by
            // JobRepository.TryExecuteDirectUpdateAsync so a request applied here matches what
            // a direct UpdateJob save would have stored.
            case JobChangeField.ConNote:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.Connote, requestedValue), ct);
                break;
            case JobChangeField.RefA:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbClientRefa, Truncate(requestedValue, 20)), ct);
                break;
            case JobChangeField.RefB:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbClientRefb, Truncate(requestedValue, 15)), ct);
                break;
            case JobChangeField.OurRef:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbOurRef, Truncate(requestedValue, 20)), ct);
                break;
            case JobChangeField.Attention:
                if (bool.TryParse(requestedValue, out var attention))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbAttention, attention), ct);
                }

                break;
            case JobChangeField.FromContactName:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromContact, Truncate(requestedValue, 100)),
                    ct);
                break;
            case JobChangeField.ToContactName:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToContact, Truncate(requestedValue, 100)),
                    ct);
                break;
            case JobChangeField.FromContactPhone:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromPhone, Truncate(requestedValue, 100)),
                    ct);
                break;
            case JobChangeField.ToContactPhone:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToPhone, Truncate(requestedValue, 100)),
                    ct);
                break;
            case JobChangeField.TrackingMobile:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMobile, Truncate(requestedValue, 100)),
                    ct);
                break;
            case JobChangeField.TrackingEmail:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingEmail, Truncate(requestedValue, 100)), ct);
                break;
            case JobChangeField.TrackingMethod:
                if (int.TryParse(requestedValue, out var trackingMethod))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMethod, trackingMethod), ct);
                }

                break;
            case JobChangeField.Barcode:
                await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.Barcode, Truncate(requestedValue, 20)), ct);
                break;
            case JobChangeField.DeliverToLeaveID:
                if (int.TryParse(requestedValue, out var leaveId))
                {
                    var privateBusiness = leaveId == 1 ? (int?)null : 1;
                    await q.ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.DeliverToLeaveId, leaveId)
                        .SetProperty(j => j.DeliverToPrivateBusiness, privateBusiness), ct);
                }

                break;

            // Manual — dates / times / DG / flags. The approver path runs the commercial
            // refresh separately when RequiresCommercialRefresh is set.
            case JobChangeField.Date:
                if (DateTimeOffset.TryParse(requestedValue, CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeLocal, out var date))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbDate, date.DateTime), ct);
                }

                break;
            case JobChangeField.Time:
                if (DateTimeOffset.TryParse(requestedValue, CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeLocal, out var time))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbTime, time.DateTime), ct);
                }

                break;
            case JobChangeField.PuTime:
                if (DateTimeOffset.TryParse(requestedValue, CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeLocal, out var puTime))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.PickUpTime, puTime.DateTime), ct);
                }

                break;
            case JobChangeField.DeliverBy:
                if (DateTimeOffset.TryParse(requestedValue, CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeLocal, out var deliverBy))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverByTime, deliverBy.DateTime), ct);
                }

                break;
            case JobChangeField.BookedTime:
                if (DateTimeOffset.TryParse(requestedValue, CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeLocal, out var booked))
                {
                    await q.ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.UcjbDate, booked.DateTime)
                        .SetProperty(j => j.UcjbTime, booked.DateTime), ct);
                }

                break;
            case JobChangeField.AcceptedJobTypeID:
                if (short.TryParse(requestedValue, out var acceptedJobType))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.AcceptedJobTypeId, acceptedJobType), ct);
                }

                break;
            case JobChangeField.Direct:
                if (bool.TryParse(requestedValue, out var direct))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.Direct, direct), ct);
                }

                break;
            case JobChangeField.DGClass:
                if (int.TryParse(requestedValue, out var dgClass))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.Dgclass, dgClass), ct);
                }

                break;
            case JobChangeField.DGDocumentation:
                if (bool.TryParse(requestedValue, out var dgDoc))
                {
                    await q.ExecuteUpdateAsync(s => s.SetProperty(j => j.Dgdocument, dgDoc), ct);
                }

                break;

            // Compound fields: RequestedValue is a JSON-encoded payload. We deserialise
            // and delegate to the same IJobCommandRepository methods the standard edit
            // endpoints use. The repo opens its own DbContext, so the column write is in
            // a separate transaction from the change-request row update — acceptable for
            // these apply-side mutations since the row commit happens after this returns
            // and the audit trail records both halves regardless.
            case JobChangeField.Packages:
                await ApplyPackagesAsync(jobId, requestedValue);
                break;
            case JobChangeField.PickupAddress:
                await ApplyAddressAsync(jobId, requestedValue, isDelivery: false);
                break;
            case JobChangeField.DeliveryAddress:
                await ApplyAddressAsync(jobId, requestedValue, isDelivery: true);
                break;

            default:
                throw new ArgumentOutOfRangeException(nameof(field), field, null);
        }
    }

    private async Task ApplyPackagesAsync(int jobId, string? requestedValue)
    {
        if (string.IsNullOrWhiteSpace(requestedValue))
        {
            return;
        }

        var payload = JsonSerializer.Deserialize<UpdateJobPackagesPayload>(requestedValue, CompoundPayloadJsonOptions);
        if (payload?.Parcels is null)
        {
            return;
        }

        await jobCommandRepository.UpdatePackagesForJobAsync(jobId, payload.Parcels);
        if (payload.Weight is > 0)
        {
            await jobCommandRepository.UpdateJobWeightAsync(jobId, payload.Weight.Value);
        }
    }

    private async Task ApplyAddressAsync(int jobId, string? requestedValue, bool isDelivery)
    {
        if (string.IsNullOrWhiteSpace(requestedValue))
        {
            return;
        }

        var address = JsonSerializer.Deserialize<AddressViewModel>(requestedValue, CompoundPayloadJsonOptions);
        if (address is null)
        {
            return;
        }

        var request = new UpdateAddressRequest { JobId = jobId, Address = address };
        if (isDelivery)
        {
            await jobCommandRepository.UpdateDeliveryAddressAsync(request);
        }
        else
        {
            await jobCommandRepository.UpdatePickupAddressAsync(request);
        }
    }

    private static string? Truncate(string? value, int max) =>
        value?[..Math.Min(value.Length, max)];

    // ProgressNote / PodNote append to UcjbNotes with a labelled prefix rather than
    // replace it, so the existing dispatcher notes survive an auto-applied partner update.
    // Read-then-write — acceptable because Auto fields don't carry the same concurrency
    // load as Quantity/Speed and the worst case is one auto-applied note overwriting
    // another in the same millisecond.
    private static async Task AppendNoteAsync(DespatchContext ctx, int jobId, string label,
        string? requestedValue, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(requestedValue))
        {
            return;
        }

        var existing = await ctx.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.UcjbNotes)
            .FirstOrDefaultAsync(ct);

        var entry = $"[{label}] {requestedValue}";
        var combined = string.IsNullOrWhiteSpace(existing) ? entry : $"{existing}\n{entry}";

        await ctx.TucJobs.Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbNotes, combined), ct);
    }

    // Returns the current staff ID for audit columns, or null when no real staff
    // context is available (background jobs, peer-inbound paths, or transient claims
    // failures). Writing null is more honest than writing 0 — the audit clearly says
    // "we don't know who did this" rather than masquerading as staff #0.
    private int? CurrentStaffIdOrNull()
    {
        try
        {
            var id = tenantInfo.GetStaffId();
            return id > 0 ? id : null;
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Could not resolve current staff ID for change-request audit; attributing to system");
            return null;
        }
    }

    // PartnerTenantId is signature-authoritative when the peer IM sets it. Tenants
    // with multiple active pairings and no disambiguator error loudly rather than
    // silently routing to whichever Active row comes back first.
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
            {
                return (null, $"Partner pairing {pairingId} not found");
            }

            if (explicitMatch.Status != "Active")
            {
                return (null, $"Partner pairing {pairingId} is not active");
            }

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

    private static string? SnapshotCurrentValue(JobChangeField field, TucJob job) =>
        field switch
        {
            JobChangeField.Quantity => job.UcjbQty?.ToString(CultureInfo.InvariantCulture),
            JobChangeField.Speed => job.UcjbSpeed?.ToString(CultureInfo.InvariantCulture),
            JobChangeField.Notes => job.UcjbNotes,
            JobChangeField.PartnerAgreedRate => job.PartnerAgreedRate?.ToString(CultureInfo.InvariantCulture),

            JobChangeField.ConNote => job.Connote,
            JobChangeField.RefA => job.UcjbClientRefa,
            JobChangeField.RefB => job.UcjbClientRefb,
            JobChangeField.OurRef => job.UcjbOurRef,
            JobChangeField.Attention => job.UcjbAttention.ToString(),
            JobChangeField.FromContactName => job.PickupFromContact,
            JobChangeField.ToContactName => job.DeliverToContact,
            JobChangeField.FromContactPhone => job.PickupFromPhone,
            JobChangeField.ToContactPhone => job.DeliverToPhone,
            JobChangeField.TrackingMobile => job.TrackingMobile,
            JobChangeField.TrackingEmail => job.TrackingEmail,
            JobChangeField.TrackingMethod => job.TrackingMethod?.ToString(CultureInfo.InvariantCulture),
            JobChangeField.Barcode => job.Barcode,
            JobChangeField.DeliverToLeaveID => job.DeliverToLeaveId?.ToString(CultureInfo.InvariantCulture),

            JobChangeField.Date => job.UcjbDate.ToString("o", CultureInfo.InvariantCulture),
            JobChangeField.Time => job.UcjbTime?.ToString("o", CultureInfo.InvariantCulture),
            JobChangeField.PuTime => job.PickUpTime?.ToString("o", CultureInfo.InvariantCulture),
            JobChangeField.DeliverBy => job.DeliverByTime?.ToString("o", CultureInfo.InvariantCulture),
            JobChangeField.BookedTime => job.UcjbTime?.ToString("o", CultureInfo.InvariantCulture),
            JobChangeField.AcceptedJobTypeID => job.AcceptedJobTypeId?.ToString(CultureInfo.InvariantCulture),
            JobChangeField.Direct => job.Direct.ToString(),
            JobChangeField.DGClass => job.Dgclass?.ToString(CultureInfo.InvariantCulture),
            JobChangeField.DGDocumentation => job.Dgdocument?.ToString(),

            JobChangeField.PickupAddress => SnapshotAddress(
                job.PickupAddressLine1, job.PickupAddressLine2, job.PickupAddressLine3, job.PickupAddressLine4,
                job.PickupAddressLine5, job.PickupAddressLine6, job.PickupAddressLine7, job.PickupAddressLine8),
            JobChangeField.DeliveryAddress => SnapshotAddress(
                job.DeliveryAddressLine1, job.DeliveryAddressLine2, job.DeliveryAddressLine3, job.DeliveryAddressLine4,
                job.DeliveryAddressLine5, job.DeliveryAddressLine6, job.DeliveryAddressLine7, job.DeliveryAddressLine8),

            _ => null
        };

    // Serialise the address columns into the same camelCase JSON shape the
    // dialog sends as RequestedValue, so the per-job history panel can run
    // its addressLine1..8 parser over the snapshot and render lines instead
    // of "—". Returns null when every line is empty rather than emitting an
    // empty-shaped JSON blob.
    private static string? SnapshotAddress(string? l1, string? l2, string? l3, string? l4,
        string? l5, string? l6, string? l7, string? l8)
    {
        if (string.IsNullOrWhiteSpace(l1) && string.IsNullOrWhiteSpace(l2)
                                          && string.IsNullOrWhiteSpace(l3) && string.IsNullOrWhiteSpace(l4)
                                          && string.IsNullOrWhiteSpace(l5) && string.IsNullOrWhiteSpace(l6)
                                          && string.IsNullOrWhiteSpace(l7) && string.IsNullOrWhiteSpace(l8))
        {
            return null;
        }

        var address = new AddressViewModel(l1 ?? string.Empty, l2 ?? string.Empty, l3 ?? string.Empty,
            l4 ?? string.Empty, l5 ?? string.Empty, l6 ?? string.Empty, l7 ?? string.Empty, l8 ?? string.Empty);
        return JsonSerializer.Serialize(address, CompoundPayloadJsonOptions);
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

    // Wire payload for JobChangeField.Packages. Mirrors UpdateJobPackagesRequest minus
    // the JobId (carried in the change-request row) so the change-request body stays
    // self-describing without coupling to the controller's DTO shape.
    private sealed record UpdateJobPackagesPayload(List<ParcelDimensions> Parcels, decimal? Weight);
}