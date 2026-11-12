#nullable enable
using System.Text.Json.Nodes;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Services.AgentRead;

public sealed record PartnerInboxRequest(
    int? JobId = null,
    int? Limit = null,
    string Detail = "inbox",
    string Only = "all",
    int StaleHours = 24,
    int MaxJobs = 25,
    bool IncludeHistory = true,
    string? AsOf = null);

public interface IAgentPartnerInboxService
{
    Task<JsonObject> GetAsync(PartnerInboxRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// The partner-approvals queue read end to end through the list and gate-read services only; never Create, Approve,
/// Reject or Cancel.
/// </summary>
public sealed class AgentPartnerInboxService(
    IJobChangeRequestService requests,
    ISendToPartnerService partner,
    IJobQueryRepository jobs,
    ITenantClock clock) : IAgentPartnerInboxService
{
    private const int ShowRows = 25;
    public const int MaxJobsCap = 50;

    public async Task<JsonObject> GetAsync(PartnerInboxRequest request, CancellationToken ct = default)
    {
        var asOf = request.AsOf ?? clock.TenantNow.ToString("yyyy-MM-dd'T'HH:mm", System.Globalization.CultureInfo.InvariantCulture);
        if (!PartnerInboxComposer.TryParseAsOf(asOf, out _)) throw new AgentReadException("as_of must be yyyy-mm-dd or yyyy-mm-ddThh:mm.");
        if (request.Detail is not ("inbox" or "all" or "counts")) throw new AgentReadException("detail must be inbox, all or counts.");
        if (request.Only is not ("all" or "blocked" or "commercial" or "anomalies" or "stale")) throw new AgentReadException("only must be all, blocked, commercial, anomalies or stale.");

        List<string> warnings = [];
        return request.JobId is { } jobId
            ? await OneJobAsync(jobId, asOf, warnings, ct)
            : await QueueAsync(request, asOf, warnings, ct);
    }

    private async Task<Acceptance> GateAsync(int jobId, CancellationToken ct) =>
        PartnerInboxComposer.ReadAcceptance(await partner.GetInboundJobAcceptanceStateAsync(jobId, ct));

    // Loaded through the caller-scoped context, so a job outside the caller's tenant or partner scope reads as not found.
    private async Task<bool> IsVisibleAsync(int jobId)
    {
        try
        {
            return await jobs.GetJobWithoutMarkingReadAsync(jobId) is not null;
        }
        catch (KeyNotFoundException)
        {
            return false;
        }
    }

    private async Task<JsonObject> OneJobAsync(int jobId, string asOf, List<string> warnings, CancellationToken ct)
    {
        if (!await IsVisibleAsync(jobId))
        {
            return new JsonObject
            {
                ["ok"] = true,
                ["mode"] = "job",
                ["asOf"] = asOf,
                ["jobId"] = jobId,
                ["found"] = false,
                ["requestCount"] = 0,
                ["pendingCount"] = 0,
                ["requests"] = new JsonArray(),
                ["acceptance"] = null,
                ["message"] = "No job with that id is visible to this login (it may not exist, or it may belong to another tenant or partner). No history or acceptance gate was read.",
                ["flags"] = new JsonArray(),
                ["failures"] = new JsonArray(),
                ["warnings"] = new JsonArray()
            };
        }

        var history = await requests.ListForJobAsync(jobId, ct);
        var acceptance = await GateAsync(jobId, ct);
        warnings.Add("The acceptance lookup cannot tell a failed read from 'nothing recorded' (both come back as Allowed, known:false) — do not read Allowed as accepted.");

        List<string> flags = [];
        var stranded = history.Where(h => h.Status == "Approved" && h.AppliedAt is null).ToList();
        if (acceptance.BlocksAllocation) flags.Add($"Acceptance gate {acceptance.Status} — this job cannot be allocated (see acceptance.rejectionReason)");
        if (stranded.Count > 0) flags.Add($"{stranded.Count} request(s) Approved but never Applied — agreed with the partner and never written to the job");

        return new JsonObject
        {
            ["ok"] = true,
            ["mode"] = "job",
            ["asOf"] = asOf,
            ["jobId"] = jobId,
            ["found"] = history.Count > 0,
            ["requestCount"] = history.Count,
            ["pendingCount"] = history.Count(h => h.Status == "Pending"),
            ["requests"] = new JsonArray([.. history.Select(h => (JsonNode)HistoryDetail(h, asOf))]),
            ["acceptance"] = PartnerInboxComposer.Acceptance(acceptance),
            ["message"] = history.Count == 0
                ? "No change request has ever been raised on this job, in either direction. That is not the same as 'this job has no partner' — read the acceptance state above."
                : "This history runs both directions: origin 'Peer' came from the partner, 'Local' is ours waiting on them. Only Pending rows raised by the partner (or the voice agent) appear in the queue.",
            ["flags"] = AgentJobSearchService.Strings(flags),
            ["failures"] = new JsonArray(),
            ["warnings"] = AgentJobSearchService.Strings(warnings)
        };
    }

    private static JsonObject HistoryDetail(JobChangeRequestDto h, string asOf)
    {
        var o = PartnerInboxComposer.HistoryRow(h);
        o["approvalMode"] = h.ApprovalMode;
        PartnerInboxComposer.AddValues(o, h.FieldName, h.CurrentValue, h.RequestedValue);
        o["reason"] = h.Reason;
        o["requiresCommercialRefresh"] = h.RequiresCommercialRefresh;
        o["oldCommercialAmount"] = h.OldCommercialAmount;
        o["newCommercialAmount"] = h.NewCommercialAmount;
        o["requestingParty"] = h.RequestingPartyType;
        o["approvalParty"] = h.ApprovalPartyType;
        o["waitingHours"] = PartnerInboxComposer.HoursSince(h.RequestedAt, asOf);
        return o;
    }

    private async Task<JsonObject> QueueAsync(PartnerInboxRequest request, string asOf, List<string> warnings, CancellationToken ct)
    {
        var hasActivePartners = await requests.HasActivePartnersAsync(ct);
        var (limit, limitWarning) = PartnerInboxComposer.ClampLimit(request.Limit);
        if (limitWarning is not null) warnings.Add(limitWarning);

        var items = await requests.ListPendingForApprovalAsync(limit, ct);
        if (items.Count == limit) warnings.Add($"Received exactly the {limit} rows asked for — there may be more; raise limit (max 500) and read again.");
        if (!hasActivePartners && items.Count > 0)
        {
            warnings.Add($"hasActivePartners is false (no pairing with Status='Active') yet {items.Count} request(s) are pending. The app-bar badge is hidden while these wait — rows survive a pairing being deactivated.");
        }

        var jobIds = items.Select(i => i.Request.JobId).Distinct().ToList();
        var maxJobs = Math.Clamp(request.MaxJobs, 1, MaxJobsCap);
        if (maxJobs != request.MaxJobs) warnings.Add($"max_jobs={request.MaxJobs} is outside 1..{MaxJobsCap}; used {maxJobs}.");
        var readIds = jobIds.Take(maxJobs).ToList();
        if (jobIds.Count > readIds.Count)
        {
            warnings.Add($"max_jobs={maxJobs}: read the history and acceptance gate for {readIds.Count} of {jobIds.Count} jobs. Rows for the rest carry acceptance:null — \"not checked\", not \"Allowed\".");
        }

        Dictionary<int, (IReadOnlyList<JobChangeRequestDto>? History, Acceptance Gate)> reads = [];
        foreach (var id in readIds)
        {
            ct.ThrowIfCancellationRequested();
            var history = request.IncludeHistory ? await requests.ListForJobAsync(id, ct) : null;
            reads[id] = (history, await GateAsync(id, ct));
        }

        if (readIds.Count > 0)
        {
            warnings.Add("The acceptance lookup cannot tell a failed read from 'nothing recorded' (both come back as Allowed, known:false) — do not read Allowed as accepted.");
        }

        var rows = items.Select(item => reads.TryGetValue(item.Request.JobId, out var read)
            ? PartnerInboxComposer.ComposeRow(item, read.History, read.Gate, asOf, request.StaleHours)
            : PartnerInboxComposer.ComposeRow(item, null, null, asOf, request.StaleHours)).ToList();

        var byField = new JsonObject();
        foreach (var g in rows.GroupBy(r => string.IsNullOrEmpty(r.Item.Request.FieldName) ? "unknown" : r.Item.Request.FieldName))
        {
            byField[g.Key] = g.Count();
        }

        var filtered = rows.Where(r => request.Only switch
        {
            "blocked" => r.Classification == "rate_gate_blocked",
            "commercial" => r.Classification == "commercial",
            "anomalies" => r.Classification == "auto_mode_pending" || r.Flags.Any(f => f.Contains("never Applied") || f.Contains("not \"Peer\"")),
            "stale" => r.Flags.Any(f => f.StartsWith("Waiting ", StringComparison.Ordinal)),
            _ => true
        }).ToList();

        var body = new JsonObject
        {
            ["ok"] = true,
            ["mode"] = "queue",
            ["asOf"] = asOf,
            ["hasActivePartners"] = hasActivePartners,
            ["limitAsked"] = limit,
            ["jobsRead"] = readIds.Count,
            ["historyRead"] = request.IncludeHistory,
            ["counts"] = PartnerInboxComposer.Summarise(rows),
            ["byField"] = byField,
            ["matched"] = filtered.Count
        };

        if (request.Detail == "all")
        {
            body["shown"] = filtered.Count;
            body["requests"] = new JsonArray([.. filtered.Select(r => (JsonNode)PartnerInboxComposer.Full(r))]);
        }
        else if (request.Detail == "inbox")
        {
            var shown = filtered.Take(ShowRows).ToList();
            if (filtered.Count > ShowRows) warnings.Add($"Showing {ShowRows} of {filtered.Count} matching rows — the counts cover all of them; ask for detail=all or narrow with only=.");
            body["shown"] = shown.Count;
            body["requests"] = new JsonArray([.. shown.Select(r => (JsonNode)PartnerInboxComposer.Compact(r))]);
        }

        body["failures"] = new JsonArray();
        body["warnings"] = AgentJobSearchService.Strings(warnings);
        return body;
    }
}





