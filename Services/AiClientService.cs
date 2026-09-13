using System.Text.Json;
using Anthropic;
using Anthropic.Core;
using Anthropic.Models.Messages;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Services;

public sealed class AiClientService(IOptions<AnthropicSettings> settings, IAiResponseCache responseCache)
    : IAiClientService
{
    private readonly AnthropicClient _client = new();
    private readonly AnthropicSettings _settings = settings.Value;

    public async Task<AiClientResponse> SendMessageAsync(
        AiTaskClass taskClass,
        string systemPrompt,
        List<AiMessage> messages,
        int maxTokens,
        List<AiToolDefinition> tools = null,
        string forceToolName = null,
        bool enableCaching = false,
        bool cacheResponse = false,
        CancellationToken ct = default)
    {
        var profile = _settings.For(taskClass);

        string cacheKey = null;
        if (cacheResponse && responseCache.Enabled)
        {
            cacheKey = responseCache.BuildKey(profile.Model, systemPrompt, messages, maxTokens, forceToolName, tools);
            var cached = await responseCache.GetAsync(cacheKey, ct);
            if (cached != null)
            {
                // Served from cache — zero API spend, so report zero usage.
                return new AiClientResponse
                {
                    TextContent = cached.TextContent,
                    ToolCalls = cached.ToolCalls,
                    ServedFromCache = true
                };
            }
        }

        var messageParams = BuildMessageParameters(
            profile, systemPrompt, messages, maxTokens, tools, forceToolName, enableCaching);

        var response = await _client.Messages.Create(messageParams, ct);

        var stopReason = ToWireValue(response.StopReason);

        var result = new AiClientResponse
        {
            InputTokens = (int)response.Usage.InputTokens,
            OutputTokens = (int)response.Usage.OutputTokens,
            CacheReadInputTokens = (int)(response.Usage.CacheReadInputTokens ?? 0),
            CacheCreationInputTokens = (int)(response.Usage.CacheCreationInputTokens ?? 0),
            StopReason = stopReason,
            RefusalCategory = stopReason == "refusal" ? Unquote(response.StopDetails?.Category?.ToString()) : null
        };

        foreach (var block in response.Content)
        {
            if (block.TryPickText(out var textBlock))
            {
                result.TextContent = (result.TextContent ?? string.Empty) + textBlock.Text;
            }
            else if (block.TryPickToolUse(out var toolUse))
            {
                result.ToolCalls.Add(new AiToolCall
                {
                    ToolUseId = toolUse.ID,
                    ToolName = toolUse.Name,
                    ArgumentsJson = JsonSerializer.Serialize(toolUse.Input)
                });
            }
        }

        // A truncated or refused answer is not a result worth replaying to the next
        // caller for the life of the cache window.
        if (cacheKey != null && !result.WasTruncated && !result.WasRefused)
        {
            await responseCache.SetAsync(cacheKey, result, ct);
        }

        return result;
    }

    private static MessageCreateParams BuildMessageParameters(
        AiModelProfile profile,
        string systemPrompt,
        List<AiMessage> messages,
        int maxTokens,
        List<AiToolDefinition> tools = null,
        string forceToolName = null,
        bool enableCaching = false)
    {
        var anthropicMessages = messages.Select(msg => new MessageParam
        {
            Role = msg.Role == "user" ? Role.User : Role.Assistant,
            Content = msg.Content
        }).ToList();

        // Put the cache breakpoint on the system prompt. Rendering order is
        // tools -> system -> messages, so a breakpoint on the system block
        // caches the whole stable prefix (tool schemas + system prompt) for
        // reuse across calls, rather than the volatile trailing user message.
        // Below the ~1024-token minimum cacheable prefix this is a silent no-op,
        // so callers only set enableCaching where the prefix is large enough to pay.
        MessageCreateParamsSystem system = systemPrompt;
        if (enableCaching)
        {
            system = new List<TextBlockParam>
            {
                new() { Text = systemPrompt, CacheControl = new CacheControlEphemeral() }
            };
        }

        return new MessageCreateParams
        {
            Model = profile.Model,
            MaxTokens = maxTokens,
            System = system,
            Messages = anthropicMessages,
            OutputConfig = string.IsNullOrEmpty(profile.Effort)
                ? null
                : new OutputConfig { Effort = profile.Effort },
            Tools = tools is { Count: > 0 }
                ? tools.Select(t => (ToolUnion)new Tool
                {
                    Name = t.Name,
                    Description = t.Description,
                    InputSchema = new InputSchema
                    {
                        Properties = ParseToolProperties(t.InputSchemaJson),
                        Required = ParseToolRequired(t.InputSchemaJson)
                    }
                }).ToList()
                : null,
            ToolChoice = string.IsNullOrEmpty(forceToolName)
                ? null
                : new ToolChoiceTool { Name = forceToolName }
        };
    }

    /// <summary>
    /// ApiEnum.ToString() JSON-serialises, so it renders the wire value already wrapped
    /// in quotes ("\"max_tokens\"") whichever way the value was constructed. Comparing
    /// it to a bare wire string silently never matches, so strip the quotes here.
    /// </summary>
    internal static string ToWireValue(ApiEnum<string, StopReason>? stopReason) =>
        Unquote(stopReason?.ToString());

    private static string Unquote(string value) => value?.Trim('"');

    internal static Dictionary<string, JsonElement> ParseToolProperties(string inputSchemaJson)
    {
        using var doc = JsonDocument.Parse(inputSchemaJson);
        var result = new Dictionary<string, JsonElement>();

        if (!doc.RootElement.TryGetProperty("properties", out var props))
        {
            return result;
        }

        foreach (var prop in props.EnumerateObject())
        {
            result[prop.Name] = prop.Value.Clone();
        }

        return result;
    }

    internal static string[] ParseToolRequired(string inputSchemaJson)
    {
        using var doc = JsonDocument.Parse(inputSchemaJson);
        if (doc.RootElement.TryGetProperty("required", out var req) &&
            req.ValueKind == JsonValueKind.Array)
        {
            return req.EnumerateArray().Select(e => e.GetString()).ToArray();
        }

        return [];
    }
}
