using DespatchWeb.Interfaces;
using DespatchWeb.Models.Ai;

namespace DespatchWeb.Models.Response;

public readonly record struct AiUsageInfo
{
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
    public int CacheReadInputTokens { get; init; }
    public int CacheCreationInputTokens { get; init; }

    public static AiUsageInfo From(AiClientResponse response) => new()
    {
        InputTokens = response.InputTokens,
        OutputTokens = response.OutputTokens,
        CacheReadInputTokens = response.CacheReadInputTokens,
        CacheCreationInputTokens = response.CacheCreationInputTokens
    };
}

public sealed record AiSummaryResponse
{
    public string Summary { get; init; }
    public AiUsageInfo Usage { get; init; }
}
