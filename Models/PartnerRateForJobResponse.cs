#nullable enable
namespace DespatchWeb.Models;

public sealed class PartnerRateForJobResponse
{
    public decimal? RateCardRate { get; init; }
    public List<PartnerRateQuoteResponse> LiveQuotes { get; init; } = [];
    /// <summary>
    /// "none" | "live_quote" | "rate_card" (legacy) | "percentage" (Mode 2) | "cost_plus" (Mode 3).
    /// </summary>
    public string Source { get; init; } = "none";

    /// <summary>Mode 2: percentage of A's UcjbAmount the partner is paid.</summary>
    public decimal? PercentageOfClientCharge { get; init; }

    /// <summary>Mode 3: margin applied on top of the partner's quoted cost.</summary>
    public decimal? MarginPercent { get; init; }

    /// <summary>Mode 2: the rate IM will substitute at dispatch (UcjbAmount × pct / 100).</summary>
    public decimal? DerivedRate { get; init; }

    /// <summary>Mode 3: the UcjbAmount IM will stamp on A's local job (cost × (1 + margin/100)).</summary>
    public decimal? DerivedRevenue { get; init; }

    /// <summary>Optional hint or error explanation from IM.</summary>
    public string? Message { get; init; }

    /// <summary>
    /// Whether the partner can actually carry this route under the mapped service code.
    /// Null means IM couldn't find out (partner unreachable) — the dialog must not warn on null,
    /// only on an explicit false.
    /// </summary>
    public bool? ServiceAvailable { get; init; }

    /// <summary>Why <see cref="ServiceAvailable"/> is false.</summary>
    public string? ServiceabilityMessage { get; init; }

    /// <summary>Services the partner CAN carry on this route.</summary>
    public List<PartnerServiceabilityAlternativeResponse> Alternatives { get; init; } = [];
}
