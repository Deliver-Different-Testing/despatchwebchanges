using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

/// <summary>
/// Which class of work an AI request belongs to. Drafting output is always read and
/// edited by a human before it leaves the system, so it runs on the cheapest fast
/// model. Judgment output drives money (accessorial charges, change-request approval),
/// safety (dangerous goods, access hazards) and severity ranking, where a wrong answer
/// costs far more than the token difference between tiers.
/// </summary>
public enum AiTaskClass
{
    Drafting,
    Judgment
}

/// <summary>
/// The model to run one task class on, plus the list prices used to cost its usage.
/// Prices live beside the model id so they cannot drift apart when the model changes.
/// </summary>
public sealed class AiModelProfile
{
    [Required]
    [MinLength(3)]
    public string Model { get; init; } = string.Empty;

    /// <summary>
    /// Effort level ("low"/"medium"/"high"/"xhigh"/"max"), or null on models that do
    /// not accept the parameter. Claude Haiku 4.5 rejects it.
    /// </summary>
    public string Effort { get; init; }

    /// <summary>Ceiling for a single response, including any thinking tokens.</summary>
    [Range(256, 64000)]
    public int MaxTokens { get; init; } = 1024;

    // USD per million tokens. Cache reads bill at 10% of input; 5-minute cache
    // writes at 125%.
    [Range(0, 1000)] public decimal InputPricePerMillion { get; init; }
    [Range(0, 1000)] public decimal OutputPricePerMillion { get; init; }
    [Range(0, 1000)] public decimal CacheReadPricePerMillion { get; init; }
    [Range(0, 1000)] public decimal CacheWritePricePerMillion { get; init; }
}

public sealed class AnthropicSettings
{
    /// <summary>
    /// Message, note and email drafts. A dispatcher reviews every one before sending,
    /// and is waiting on the button while it generates, so latency is the quality bar.
    /// </summary>
    public AiModelProfile Drafting { get; init; } = new()
    {
        Model = "claude-haiku-4-5",
        Effort = null,
        MaxTokens = 1024,
        InputPricePerMillion = 1.00m,
        OutputPricePerMillion = 5.00m,
        CacheReadPricePerMillion = 0.10m,
        CacheWritePricePerMillion = 1.25m
    };

    /// <summary>
    /// Structured briefings and insights. Low effort keeps the cost close to the
    /// drafting tier while retaining the stronger model's judgment.
    /// </summary>
    public AiModelProfile Judgment { get; init; } = new()
    {
        Model = "claude-sonnet-5",
        Effort = "low",
        MaxTokens = 4096,
        InputPricePerMillion = 2.00m,
        OutputPricePerMillion = 10.00m,
        CacheReadPricePerMillion = 0.20m,
        CacheWritePricePerMillion = 2.50m
    };

    public int RateLimitPerUserPerMinute { get; init; } = 5;
    public int RateLimitPerTenantPerMinute { get; init; } = 20;

    // Deduplicate identical read-only AI requests (job/ops/compliance briefings,
    // insights) via a short-lived response cache. 0 disables it.
    public int ResponseCacheSeconds { get; init; } = 90;

    public AiModelProfile For(AiTaskClass taskClass) =>
        taskClass == AiTaskClass.Judgment ? Judgment : Drafting;
}
