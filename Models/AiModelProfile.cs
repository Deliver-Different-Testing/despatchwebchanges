using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

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

    /// <summary>
    /// Whether structured-output calls force the tool with tool_choice. Claude Sonnet 5.5,
    /// Opus 5.5 and Fable 5.1 return a 400 for a forced tool, so a profile on one of them
    /// sets this false and the call relies on the prompt plus tool_choice auto instead.
    /// </summary>
    public bool ForcedToolChoice { get; init; } = true;

    /// <summary>
    /// Wall-clock limit for one AI call including retries. A stalled upstream otherwise holds
    /// the request and the dispatcher's spinner for the SDK's 10-minute default.
    /// </summary>
    [Range(1, 600)]
    public int TimeoutSeconds { get; init; } = 30;

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
