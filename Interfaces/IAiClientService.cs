namespace DespatchWeb.Interfaces;

public class AiMessage
{
    public string Role { get; init; } // "user" or "assistant"
    public string Content { get; init; }
}

public class AiToolDefinition
{
    public string Name { get; init; }
    public string Description { get; init; }
    public string InputSchemaJson { get; init; }
}

public class AiToolCall
{
    public string ToolUseId { get; set; }
    public string ToolName { get; init; }
    public string ArgumentsJson { get; init; }
}

public class AiClientResponse
{
    public string TextContent { get; set; }
    public List<AiToolCall> ToolCalls { get; init; } = [];
    public bool HasToolUse => ToolCalls.Count > 0;
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
}

public interface IAiClientService
{
    Task<AiClientResponse> SendMessageAsync(
        string systemPrompt,
        List<AiMessage> messages,
        int maxTokens,
        List<AiToolDefinition> tools = null,
        string forceToolName = null,
        bool enableCaching = false,
        CancellationToken ct = default);

    IAsyncEnumerable<string> StreamMessageAsync(
        string systemPrompt,
        List<AiMessage> messages,
        int maxTokens,
        CancellationToken ct = default);
}
