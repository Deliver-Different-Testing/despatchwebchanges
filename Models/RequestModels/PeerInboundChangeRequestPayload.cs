#nullable enable
namespace DespatchWeb.Models.RequestModels;

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
