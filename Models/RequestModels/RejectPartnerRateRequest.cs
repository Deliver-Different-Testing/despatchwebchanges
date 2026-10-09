namespace DespatchWeb.Models.RequestModels;

public sealed class RejectPartnerRateRequest
{
    public int JobId { get; init; }
    public string Reason { get; init; } = string.Empty;
}
