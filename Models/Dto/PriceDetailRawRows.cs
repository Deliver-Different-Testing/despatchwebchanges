#nullable enable
namespace DespatchWeb.Models.Dto;

// Flat rows returned by JobRepository.GetPriceDetailReportAsync. The mapper turns them into the
// workbook. Deliberately dumb - no logic - so the repository stays a pure projection and all
// reconstruction lives in PriceDetailReportData.
public sealed class PriceDetailReportRaw
{
    public required IReadOnlyList<PriceDetailHeaderRow> Headers { get; init; }
    public required IReadOnlyList<PriceDetailLineRow> CurrentLines { get; init; }
    public required IReadOnlyList<PricingChangeRow> History { get; init; }
}

// One row per job from TucJob / TucJobArchive. Property types match the EF entities (double? for
// weight/cubic, short? for qty) so the repository projection stays free of casts.
public sealed class PriceDetailHeaderRow
{
    public int JobId { get; init; }
    public string JobNo { get; init; } = "";
    public int? ClientId { get; init; }
    public string ClientName { get; init; } = "";
    public string Reference { get; init; } = "";
    public string Service { get; init; } = "";

    public decimal? HeaderAmount { get; init; }
    public decimal HeaderFuel { get; init; }

    public bool Void { get; init; }
    public bool RatedManually { get; init; }
    public int? BookingParentId { get; init; }
    public bool JobNoIsPPrefix => JobNo.StartsWith("P", StringComparison.OrdinalIgnoreCase);

    public double? Weight { get; init; }
    public double? Cubic { get; init; }
    public short? Qty { get; init; }
    public decimal? TotalDistance { get; init; }
    // Set after header projection from a separate items-table lookup (see JobRepository.PriceDetail).
    public string Dims { get; set; } = "";

    public DateTime? BookedAt { get; init; }
    public DateTime? PickedUpAt { get; init; }
    public DateTime? DeliveredAt { get; init; }
    public DateTime? PickupArrivalUtc { get; init; }
    public DateTime? DeliveryArrivalUtc { get; init; }
    public DateTime? PickupTimeUtc { get; init; }
    public DateTime? CompletionUtc { get; init; }

    public string PickupAddress { get; init; } = "";
    public string DeliveryAddress { get; init; } = "";
}

// One row per current PricingBreakdown line (live or archive).
public sealed class PriceDetailLineRow
{
    public int JobId { get; init; }
    public string ChargeName { get; init; } = "";
    public decimal ChargeAmount { get; init; }
    public decimal? CourierPay { get; init; }  // CostAmount = driver pay, not cost
}

// A JobDeliveryJourney row that touches pricing. Two FieldName shapes matter:
//   FieldName == "PricingBreakdown"       - structural line insert / rename / delete
//   FieldName StartsWith "Pricing: "      - per-line value change (Old/New are decimals)
// Plus JobCreated rows (FieldName == "CreatedBySp", NewValue = inserting SP name) and header
// fields (ucjbAmount / FuelSurchargeAmount / ucjbVoid - lowercase 'u' confirmed against DFRNT).
public sealed class PricingChangeRow
{
    public int JobId { get; init; }
    public string ChangeType { get; init; } = "";
    public string FieldName { get; init; } = "";
    public string? OldValue { get; init; }
    public string? NewValue { get; init; }
    public DateTime AtUtc { get; init; }
    public string UpdatedByType { get; init; } = "";
    public string? StaffFirstName { get; init; }
    public string? StaffLastName { get; init; }

    public string ActorName =>
        UpdatedByType == "Staff" && (StaffFirstName is not null || StaffLastName is not null)
            ? $"{StaffFirstName} {StaffLastName}".Trim()
            : "SYSTEM";
}
