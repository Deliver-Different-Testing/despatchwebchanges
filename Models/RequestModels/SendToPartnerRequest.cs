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

public sealed class AcceptPartnerRateRequest
{
    public int JobId { get; init; }
}

public sealed class RejectPartnerRateRequest
{
    public int JobId { get; init; }
    public string Reason { get; init; } = string.Empty;
}
