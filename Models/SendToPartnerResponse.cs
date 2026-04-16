namespace DespatchWeb.Models;

public sealed class SendToPartnerResponse
{
    public bool Success { get; init; }
    public string TrackingNumber { get; init; }
    public string Message { get; init; }
}
