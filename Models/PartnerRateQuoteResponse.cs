#nullable enable
namespace DespatchWeb.Models;

public sealed class PartnerRateQuoteResponse
{
    public string ServiceCode { get; init; } = string.Empty;
    public string ServiceName { get; init; } = string.Empty;
    public decimal TotalCharge { get; init; }
    public string Currency { get; init; } = "NZD";
    public int? TransitDays { get; init; }
}
