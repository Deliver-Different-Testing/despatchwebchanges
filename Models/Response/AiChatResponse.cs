namespace DespatchWeb.Models.Response;

public class AiChatResponse
{
    public string Message { get; set; }
    public AiUsageInfo Usage { get; set; }
}

public class AiChatChunk
{
    public string Text { get; set; }
    public bool IsComplete { get; set; }
    public AiUsageInfo Usage { get; set; }
}

public class AiUsageInfo
{
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
}

public class AiSummaryResponse
{
    public string Summary { get; set; }
    public AiUsageInfo Usage { get; set; }
}
