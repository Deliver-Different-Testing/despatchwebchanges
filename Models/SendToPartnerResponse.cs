namespace DespatchWeb.Models;

public sealed class SendToPartnerResponse
{
    public bool Success { get; init; }
    public string TrackingNumber { get; init; }
    public string Message { get; init; }
}

public sealed class PartnerRateForJobResponse
{
    public decimal? RateCardRate { get; init; }
    public List<PartnerRateQuoteResponse> LiveQuotes { get; init; } = [];
    public string Source { get; init; } = "none";
}

public sealed class PartnerRateQuoteResponse
{
    public string ServiceCode { get; init; } = string.Empty;
    public string ServiceName { get; init; } = string.Empty;
    public decimal TotalCharge { get; init; }
    public string Currency { get; init; } = "NZD";
    public int? TransitDays { get; init; }
}
