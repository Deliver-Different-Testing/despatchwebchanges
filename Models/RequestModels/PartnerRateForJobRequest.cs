namespace DespatchWeb.Models.RequestModels;

public sealed class PartnerRateForJobRequest
{
    public int PairingId { get; init; }
    public int JobId { get; init; }
}
