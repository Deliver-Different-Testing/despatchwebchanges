#nullable enable
namespace DespatchWeb.Models.RequestModels;

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
