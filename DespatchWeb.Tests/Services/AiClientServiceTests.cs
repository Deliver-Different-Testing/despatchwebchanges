using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Ai;
using DespatchWeb.Services;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for AiClientService: tool-schema parsing and response-cache behavior.
/// </summary>
public class AiClientServiceTests
{
    private readonly IAiResponseCache _responseCache = Substitute.For<IAiResponseCache>();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings());

    public AiClientServiceTests()
    {
        // AnthropicClient's default constructor reads the API key from the env.
        Environment.SetEnvironmentVariable("ANTHROPIC_API_KEY", "test-key");
    }

    [Fact]
    public async Task SendMessageAsync_ServesFromCache_WithoutApiCall_AndZeroesUsage()
    {
        var cached = new AiClientResponse
        {
            TextContent = "cached summary",
            InputTokens = 100,
            OutputTokens = 50
        };
        _responseCache.Enabled.Returns(true);
        _responseCache.BuildKey(
                Arg.Any<string>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<AiMessage>>(),
                Arg.Any<int>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<AiToolDefinition>>())
            .Returns("cache-key");
        _responseCache.GetAsync("cache-key", Arg.Any<CancellationToken>()).Returns(cached);

        var service = new AiClientService(_settings, _responseCache);

        var result = await service.SendMessageAsync(
            AiTaskClass.Drafting,
            "system",
            [new AiMessage { Role = "user", Content = "hi" }],
            1024,
            cacheResponse: true,
            ct: TestContext.Current.CancellationToken);

        Assert.True(result.ServedFromCache);
        Assert.Equal("cached summary", result.TextContent);
        // A cache hit costs nothing, so usage is reported as zero.
        Assert.Equal(0, result.InputTokens);
        Assert.Equal(0, result.OutputTokens);
        // On a hit we neither overwrite nor re-store the cache entry.
        await _responseCache.DidNotReceive()
            .SetAsync(Arg.Any<string>(), Arg.Any<AiClientResponse>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void ParseToolProperties_ValidJson_ReturnsDictionaryWithCorrectKeys()
    {
        const string json =
            """{"properties": {"name": {"type": "string"}, "age": {"type": "integer"}}, "required": ["name"]}""";

        var result = AiClientService.ParseToolProperties(json);

        Assert.Equal(2, result.Count);
        Assert.True(result.ContainsKey("name"));
        Assert.True(result.ContainsKey("age"));
    }

    [Fact]
    public void ParseToolProperties_NoPropertiesKey_ReturnsEmptyDictionary()
    {
        const string json = """{"required": ["name"]}""";

        var result = AiClientService.ParseToolProperties(json);

        Assert.Empty(result);
    }

    [Fact]
    public void ParseToolProperties_NestedProperties_ValuesArePreserved()
    {
        const string json =
            """{"properties": {"address": {"type": "object", "properties": {"street": {"type": "string"}}}}}""";

        var result = AiClientService.ParseToolProperties(json);

        Assert.Single(result);
        Assert.True(result.ContainsKey("address"));

        var addressElement = result["address"];
        Assert.True(addressElement.TryGetProperty("properties", out var nested));
        Assert.True(nested.TryGetProperty("street", out _));
    }

    [Fact]
    public void ParseToolRequired_WithRequiredArray_ReturnsStringArray()
    {
        const string json = """{"properties": {"name": {"type": "string"}}, "required": ["name"]}""";

        var result = AiClientService.ParseToolRequired(json);

        Assert.Single(result);
        Assert.Equal("name", result[0]);
    }

    [Fact]
    public void ParseToolRequired_NoRequiredKey_ReturnsEmptyArray()
    {
        const string json = """{"properties": {"name": {"type": "string"}}}""";

        var result = AiClientService.ParseToolRequired(json);

        Assert.Empty(result);
    }

    [Fact]
    public void ParseToolRequired_EmptyRequiredArray_ReturnsEmptyArray()
    {
        const string json = """{"properties": {"name": {"type": "string"}}, "required": []}""";

        var result = AiClientService.ParseToolRequired(json);

        Assert.Empty(result);
    }

    [Fact]
    public void ParseToolRequired_MultipleRequired_ReturnsAll()
    {
        const string json = """{"required": ["name", "age", "email"]}""";

        var result = AiClientService.ParseToolRequired(json);

        Assert.Equal(3, result.Length);
        Assert.Equal("name", result[0]);
        Assert.Equal("age", result[1]);
        Assert.Equal("email", result[2]);
    }
}