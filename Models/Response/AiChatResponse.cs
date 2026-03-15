namespace DespatchWeb.Models.Response;

public class AiChatResponse
{
    public string Message { get; init; }
    public AiUsageInfo Usage { get; init; }
}

public class AiChatChunk
{
    public string Text { get; init; }
    public bool IsComplete { get; init; }
    public AiUsageInfo Usage { get; init; }
}

public class AiUsageInfo
{
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
}

public class AiSummaryResponse
{
    public string Summary { get; init; }
    public AiUsageInfo Usage { get; init; }
}

public class AiCourierSuggestionResponse
{
    public string Summary { get; init; }
    public AiUsageInfo Usage { get; init; }
    public List<SuggestedCourier> Couriers { get; init; } = [];
}

public class SuggestedCourier
{
    public int CourierId { get; init; }
    public string Code { get; init; }
    public string FirstName { get; init; }
}
