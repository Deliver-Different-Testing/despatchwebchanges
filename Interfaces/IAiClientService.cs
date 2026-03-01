using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public class AiMessage
{
    public string Role { get; set; } // "user" or "assistant"
    public string Content { get; set; }
}

public class AiToolDefinition
{
    public string Name { get; set; }
    public string Description { get; set; }
    public string InputSchemaJson { get; set; }
}

public class AiToolCall
{
    public string ToolUseId { get; set; }
    public string ToolName { get; set; }
    public string ArgumentsJson { get; set; }
}

public class AiClientResponse
{
    public string TextContent { get; set; }
    public List<AiToolCall> ToolCalls { get; set; } = new();
    public bool HasToolUse => ToolCalls.Count > 0;
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
}

public interface IAiClientService
{
    Task<AiClientResponse> SendMessageAsync(
        string systemPrompt,
        List<AiMessage> messages,
        int maxTokens,
        List<AiToolDefinition> tools = null,
        CancellationToken ct = default);

    IAsyncEnumerable<string> StreamMessageAsync(
        string systemPrompt,
        List<AiMessage> messages,
        int maxTokens,
        [EnumeratorCancellation] CancellationToken ct = default);
}
