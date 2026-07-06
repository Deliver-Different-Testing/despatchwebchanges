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

    /// <summary>Uncached input tokens billed at full price.</summary>
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }

    /// <summary>Input tokens served from the prompt cache (~0.1x price).</summary>
    public int CacheReadInputTokens { get; init; }

    /// <summary>Input tokens written to the prompt cache (~1.25x price).</summary>
    public int CacheCreationInputTokens { get; init; }

    /// <summary>True when this response was served from the dedup response cache (zero API cost).</summary>
    public bool ServedFromCache { get; init; }
}

public interface IAiResponseCache
{
    /// <summary>False when response caching is disabled (ResponseCacheSeconds &lt;= 0).</summary>
    bool Enabled { get; }

    string BuildKey(
        string model,
        string systemPrompt,
        IReadOnlyList<AiMessage> messages,
        int maxTokens,
        string forceToolName,
        IReadOnlyList<AiToolDefinition> tools);

    Task<AiClientResponse> GetAsync(string key, CancellationToken ct = default);

    Task SetAsync(string key, AiClientResponse response, CancellationToken ct = default);
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
        bool cacheResponse = false,
        CancellationToken ct = default);

    IAsyncEnumerable<string> StreamMessageAsync(
        string systemPrompt,
        List<AiMessage> messages,
        CancellationToken ct = default);
}
