using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Services;

/// <summary>
/// Short-lived dedup cache for identical read-only AI requests. The cache key is
/// a hash of everything that determines the model output (model, system prompt,
/// messages, tools), so any change to the underlying data produces a fresh call
/// automatically — no manual invalidation. Collapses repeat briefings (a job
/// re-opened, a tenant dashboard opened by many dispatchers) into one API call.
/// </summary>
public sealed class AiResponseCache(IDistributedCache cache, IOptions<AnthropicSettings> settings)
    : IAiResponseCache
{
    private readonly AnthropicSettings _settings = settings.Value;

    public bool Enabled => _settings.ResponseCacheSeconds > 0;

    public string BuildKey(
        string model,
        string systemPrompt,
        IReadOnlyList<AiMessage> messages,
        int maxTokens,
        string forceToolName,
        IReadOnlyList<AiToolDefinition> tools)
    {
        // Length-prefix every field so distinct inputs can never frame to the
        // same string, regardless of what the field contents are.
        var sb = new StringBuilder();
        AppendField(sb, model);
        AppendField(sb, maxTokens.ToString());
        AppendField(sb, forceToolName);
        AppendField(sb, systemPrompt);

        foreach (var m in messages)
        {
            AppendField(sb, m.Role);
            AppendField(sb, m.Content);
        }

        if (tools is { Count: > 0 })
        {
            foreach (var t in tools)
            {
                AppendField(sb, t.Name);
                AppendField(sb, t.InputSchemaJson);
            }
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString()));
        return "ai_resp:" + Convert.ToHexString(hash);
    }

    public async Task<AiClientResponse> GetAsync(string key, CancellationToken ct = default)
    {
        var cached = await cache.GetStringAsync(key, ct);
        return cached is null ? null : JsonSerializer.Deserialize<AiClientResponse>(cached);
    }

    public async Task SetAsync(string key, AiClientResponse response, CancellationToken ct = default)
    {
        var payload = JsonSerializer.Serialize(response);
        await cache.SetStringAsync(key, payload, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_settings.ResponseCacheSeconds)
        }, ct);
    }

    private static void AppendField(StringBuilder sb, string value)
    {
        value ??= string.Empty;
        sb.Append(value.Length).Append(':').Append(value);
    }
}
