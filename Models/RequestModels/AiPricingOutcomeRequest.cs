namespace DespatchWeb.Models.RequestModels;

/// <summary>Which AI-suggested accessorial charges the dispatcher actually added.</summary>
public sealed class AiPricingOutcomeRequest
{
    public int JobId { get; init; }
    public List<int> SuggestedChargeIds { get; init; } = [];
    public List<int> AcceptedChargeIds { get; init; } = [];
}
