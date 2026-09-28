using DespatchWeb.Models;
using DespatchWeb.Models.Ai;

namespace DespatchWeb.Interfaces;

public interface IAiClientService
{
    Task<AiClientResponse> SendMessageAsync(
        AiTaskClass taskClass,
        string systemPrompt,
        List<AiMessage> messages,
        int maxTokens,
        List<AiToolDefinition> tools = null,
        string forceToolName = null,
        bool enableCaching = false,
        bool cacheResponse = false,
        CancellationToken ct = default);
}
