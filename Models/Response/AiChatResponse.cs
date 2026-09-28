namespace DespatchWeb.Models.Response;

public sealed record AiChatResponse
{
    public string Message { get; init; }
    public AiUsageInfo Usage { get; init; }
}

public sealed record AiChatChunk
{
    public string Text { get; init; }
    public bool IsComplete { get; init; }
    public AiUsageInfo Usage { get; init; }
}

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

public sealed record AiCourierSuggestionResponse
{
    public string Summary { get; init; }
    public AiUsageInfo Usage { get; init; }
    public IReadOnlyList<SuggestedCourier> Couriers { get; init; } = [];
}

public sealed record SuggestedCourier
{
    public int CourierId { get; init; }
    public string Code { get; init; }
    public string FirstName { get; init; }
}
