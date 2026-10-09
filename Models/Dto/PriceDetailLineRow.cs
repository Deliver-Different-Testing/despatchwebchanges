#nullable enable
namespace DespatchWeb.Models.Dto;

// One row per current PricingBreakdown line (live or archive).
public sealed class PriceDetailLineRow
{
    /// <summary>
    /// The split leg this line belongs to, when the line is attributed to one. Lines hang off the
    /// parent job, so this is how a leg's own share is distinguished from the parent's whole set.
    /// </summary>
    public int? ChildJobId { get; init; }

    public int JobId { get; init; }
    public string ChargeName { get; init; } = string.Empty;
    public decimal ChargeAmount { get; init; }
    public decimal? CourierPay { get; init; }  // CostAmount = driver pay, not cost
}
