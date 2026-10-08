#nullable enable
namespace DespatchWeb.Models;

/// <summary>
/// A service the partner reports as available on the route, when the one we asked for is not.
/// JobTypeId is populated where a local speed maps onto it, so the operator can act on it.
/// </summary>
public sealed class PartnerServiceabilityAlternativeResponse
{
    public int? JobTypeId { get; init; }
    public string PartnerServiceCode { get; init; } = string.Empty;
    public string ServiceName { get; init; } = string.Empty;
    public decimal? TotalCharge { get; init; }
    public string? Currency { get; init; }
    public int? TransitDays { get; init; }
}
