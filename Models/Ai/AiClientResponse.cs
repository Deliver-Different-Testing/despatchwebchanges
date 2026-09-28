namespace DespatchWeb.Models.Ai;

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

    /// <summary>
    /// Raw API stop reason ("end_turn", "tool_use", "max_tokens", "refusal", ...).
    /// Null on a response-cache hit, where no request was made.
    /// </summary>
    public string StopReason { get; init; }

    /// <summary>
    /// The model hit <c>MaxTokens</c> mid-answer. A forced tool call truncated this way
    /// yields malformed arguments JSON, so callers must not report it as a parse failure.
    /// </summary>
    public bool WasTruncated => StopReason == "max_tokens";

    /// <summary>A safety classifier declined the request; there is no content to read.</summary>
    public bool WasRefused => StopReason == "refusal";

    /// <summary>Refusal category from the API, when <see cref="WasRefused"/>.</summary>
    public string RefusalCategory { get; init; }
}