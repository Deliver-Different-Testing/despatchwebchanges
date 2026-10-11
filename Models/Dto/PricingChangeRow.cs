#nullable enable
namespace DespatchWeb.Models.Dto;

// A JobDeliveryJourney row that touches pricing. Two FieldName shapes matter:
//   FieldName == "PricingBreakdown"       - structural line insert / rename / delete
//   FieldName StartsWith "Pricing: "      - per-line value change (Old/New are decimals)
// Plus JobCreated rows (FieldName == "CreatedBySp", NewValue = inserting SP name) and header
// fields (ucjbAmount / FuelSurchargeAmount / ucjbVoid - lowercase 'u' confirmed against DFRNT).
public sealed class PricingChangeRow
{
    public int JobId { get; init; }
    public string ChangeType { get; init; } = string.Empty;
    public string FieldName { get; init; } = string.Empty;
    public string? OldValue { get; init; }
    public string? NewValue { get; init; }
    public DateTime AtUtc { get; init; }
    public string UpdatedByType { get; init; } = string.Empty;
    public string? StaffFirstName { get; init; }
    public string? StaffLastName { get; init; }

    public string ActorName =>
        UpdatedByType == "Staff" && (StaffFirstName is not null || StaffLastName is not null)
            ? $"{StaffFirstName} {StaffLastName}".Trim()
            : "SYSTEM";
}
