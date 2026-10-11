namespace DespatchWeb.Models;

public sealed class AdditionalInformation
{
    public DateTime? ContactSignDate { get; init; }
    public decimal? MobileInsurence { get; init; }
    public decimal DailyProfitAdjust { get; init; }
    public string Notes { get; init; }
}
