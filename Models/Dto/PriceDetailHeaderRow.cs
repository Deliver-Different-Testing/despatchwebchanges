#nullable enable
namespace DespatchWeb.Models.Dto;

// One row per job from TucJob / TucJobArchive. Property types match the EF entities (double? for
// weight/cubic, short? for qty) so the repository projection stays free of casts.
public sealed class PriceDetailHeaderRow
{
    public int JobId { get; init; }
    public string JobNo { get; init; } = string.Empty;
    public int? ClientId { get; init; }
    public string ClientName { get; init; } = string.Empty;
    public string Reference { get; init; } = string.Empty;
    public string Service { get; init; } = string.Empty;

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
    public string Dims { get; set; } = string.Empty;

    public DateTime? BookedAt { get; init; }
    public DateTime? PickedUpAt { get; init; }
    public DateTime? DeliveredAt { get; init; }
    public DateTime? PickupArrivalUtc { get; init; }
    public DateTime? DeliveryArrivalUtc { get; init; }
    public DateTime? PickupTimeUtc { get; init; }
    public DateTime? CompletionUtc { get; init; }

    public string PickupAddress { get; init; } = string.Empty;
    public string DeliveryAddress { get; init; } = string.Empty;
}
