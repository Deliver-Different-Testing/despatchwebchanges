using System.Runtime.CompilerServices;
using System.Text.Json;
using Anthropic;
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
        string systemPrompt,
        List<AiMessage> messages,
        int maxTokens,
        List<AiToolDefinition> tools = null,
        string forceToolName = null,
        bool enableCaching = false,
        bool cacheResponse = false,
        CancellationToken ct = default)
    {
        string cacheKey = null;
        if (cacheResponse && responseCache.Enabled)
        {
            cacheKey = responseCache.BuildKey(_settings.Model, systemPrompt, messages, maxTokens, forceToolName, tools);
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

        var messageParams = BuildMessageParameters(systemPrompt, messages, maxTokens, tools, forceToolName, enableCaching);

        var response = await _client.Messages.Create(messageParams, ct);

        var result = new AiClientResponse
        {
            InputTokens = (int)response.Usage.InputTokens,
            OutputTokens = (int)response.Usage.OutputTokens,
            CacheReadInputTokens = (int)(response.Usage.CacheReadInputTokens ?? 0),
            CacheCreationInputTokens = (int)(response.Usage.CacheCreationInputTokens ?? 0)
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

        if (cacheKey != null)
        {
            await responseCache.SetAsync(cacheKey, result, ct);
        }

        return result;
    }

    public async IAsyncEnumerable<string> StreamMessageAsync(
        string systemPrompt,
        List<AiMessage> messages,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var messageParams = BuildMessageParameters(systemPrompt, messages, _settings.MaxTokensPerRequest);

        await foreach (var rawEvent in _client.Messages.CreateStreaming(messageParams, ct))
        {
            if (!rawEvent.TryPickContentBlockDelta(out var delta))
            {
                continue;
            }

            if (delta.Delta.TryPickText(out var textDelta))
            {
                yield return textDelta.Text;
            }
        }
    }

    private MessageCreateParams BuildMessageParameters(
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
            Model = _settings.Model,
            MaxTokens = maxTokens,
            System = system,
            Messages = anthropicMessages,
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
