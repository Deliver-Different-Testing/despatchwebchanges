using DespatchWeb.Models.Ai;

namespace DespatchWeb.Interfaces;

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