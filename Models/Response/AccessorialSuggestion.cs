#nullable enable annotations
namespace DespatchWeb.Models.Response;

// ---- Note blocker extraction --------------------------------------------

public sealed class AccessorialSuggestion
{
    public int AccessorialChargeId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Reason { get; init; } = string.Empty;
    public decimal? SuggestedInputValue { get; init; }
}
