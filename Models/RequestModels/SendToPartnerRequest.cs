namespace DespatchWeb.Models.RequestModels;

public sealed class SendToPartnerRequest
{
    public int JobId { get; init; }
    public int PartnerId { get; init; }
}
