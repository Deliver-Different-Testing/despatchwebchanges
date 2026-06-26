#nullable enable
namespace DespatchWeb.Models.RequestModels;

/// <summary>Payload from the React UI to <c>POST /JobChangeRequest/Create</c>.</summary>
public sealed class CreateJobChangeRequestRequest
{
    public int JobId { get; init; }
    public string FieldName { get; init; } = string.Empty;
    public string? CurrentValue { get; init; }
    public string? RequestedValue { get; init; }
    public string? Reason { get; init; }

    /// <summary>
    /// Pairing the job was dispatched on. Optional for back-compat — when omitted, the
    /// service requires the tenant to have exactly one active pairing and errors otherwise.
    /// </summary>
    public int? PairingId { get; init; }
}

public sealed class ApproveJobChangeRequestRequest
{
    public int RequestId { get; init; }
    public byte[]? RowVersion { get; init; }
    public string? Reason { get; init; }
}

public sealed class RejectJobChangeRequestRequest
{
    public int RequestId { get; init; }
    public byte[]? RowVersion { get; init; }
    public string? Reason { get; init; }
}

public sealed class CancelJobChangeRequestRequest
{
    public int RequestId { get; init; }
    public byte[]? RowVersion { get; init; }
    public string? Reason { get; init; }
}

/// <summary>Body posted by Integration Manager when a peer's signed change-request arrives.</summary>
public sealed class PeerInboundChangeRequestPayload
{
    public Guid PartnerJobGuid { get; init; }
    public Guid SourceRequestUuid { get; init; }
    public string FieldName { get; init; } = string.Empty;
    public string? CurrentValue { get; init; }
    public string? RequestedValue { get; init; }
    public string? Reason { get; init; }
    public string ApprovalMode { get; init; } = "Manual";
    public bool RequiresCommercialRefresh { get; init; }

    /// <summary>
    /// Pairing the originating change request was forwarded on. Optional for back-compat —
    /// when omitted, the service falls back to <see cref="PartnerTenantId"/> lookup, then
    /// finally to selecting the tenant's sole active pairing.
    /// </summary>
    public int? PairingId { get; init; }

    /// <summary>
    /// Originator's tenant id, stamped by the peer IM's signature filter. Lets the local
    /// service resolve its pairing record without trusting a self-asserted PairingId from
    /// the wire (the local pairing.Id and the peer's pairing.Id are independent values).
    /// </summary>
    public string? PartnerTenantId { get; init; }
}

public sealed class PeerInboundChangeDecisionPayload
{
    /// <summary>"Approved" or "Rejected".</summary>
    public string Outcome { get; init; } = string.Empty;
    public string? Reason { get; init; }
}

public sealed class PeerInboundChangeAppliedPayload
{
    public decimal? NewCommercialAmount { get; init; }
}

/// <summary>Returned to the React UI and to IM relay endpoints.</summary>
public sealed class JobChangeRequestDto
{
    public int Id { get; init; }
    public int JobId { get; init; }
    public Guid? PartnerJobGuid { get; init; }
    public int? PairingId { get; init; }
    public Guid SourceRequestUuid { get; init; }
    public int? TucEventId { get; init; }
    public string Origin { get; init; } = string.Empty;
    public string RequestingPartyType { get; init; } = string.Empty;
    public string ApprovalPartyType { get; init; } = string.Empty;
    public string FieldName { get; init; } = string.Empty;
    public string? CurrentValue { get; init; }
    public string? RequestedValue { get; init; }
    public string? Reason { get; init; }
    public string Status { get; init; } = string.Empty;
    public string ApprovalMode { get; init; } = string.Empty;
    public string? RuleCode { get; init; }
    public bool RequiresCommercialRefresh { get; init; }
    public decimal? OldCommercialAmount { get; init; }
    public decimal? NewCommercialAmount { get; init; }
    public DateTime RequestedAt { get; init; }
    public DateTime? RespondedAt { get; init; }
    public DateTime? AppliedAt { get; init; }
    public byte[]? RowVersion { get; init; }
}

public sealed class JobChangeRequestResult
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public JobChangeRequestDto? Request { get; init; }

    /// <summary>
    /// Populated when the local row was saved but the IM enqueue/forward step
    /// failed. The local state is consistent; the cross-tenant relay needs a
    /// retry. UI surfaces this as a non-blocking warning so the user knows
    /// the partner side did not see the change.
    /// </summary>
    public string? PeerForwardWarning { get; init; }
}

/// <summary>
/// Approver inbox row — a Pending change request the local tenant must
/// review, enriched with enough job context that the inbox page can list it
/// without an N+1 round-trip back to /job/Detail for each row.
/// </summary>
public sealed class JobChangeRequestInboxItem
{
    public JobChangeRequestDto Request { get; init; } = null!;
    public string JobNo { get; init; } = string.Empty;
    public string? ClientName { get; init; }
}
