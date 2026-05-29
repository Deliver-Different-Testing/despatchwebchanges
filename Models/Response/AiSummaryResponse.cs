namespace DespatchWeb.Models.Response;

public readonly record struct AiUsageInfo
{
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
}

public sealed record AiSummaryResponse
{
    public string Summary { get; init; }
    public AiUsageInfo Usage { get; init; }
}
