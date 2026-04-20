namespace DespatchWeb.Models.RequestModels;

public sealed class SendToPartnerRequest
{
    public int JobId { get; init; }
    public int PartnerId { get; init; }
    public decimal AgreedRate { get; init; }
}

public sealed class PartnerRateForJobRequest
{
    public int PairingId { get; init; }
    public int JobId { get; init; }
}
