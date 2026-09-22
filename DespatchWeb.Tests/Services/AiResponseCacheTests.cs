using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Ai;
using DespatchWeb.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class AiResponseCacheTests
{
    private static readonly List<AiMessage> Messages =
        [new() { Role = "user", Content = "summarize job 42" }];

    private readonly IDistributedCache _cache = Substitute.For<IDistributedCache>();

    private AiResponseCache CreateCache(int seconds = 90) =>
        new(_cache, Options.Create(new AnthropicSettings { ResponseCacheSeconds = seconds }));

    [Fact]
    public void Enabled_ReflectsSettings()
    {
        Assert.True(CreateCache().Enabled);
        Assert.False(CreateCache(0).Enabled);
    }

    [Fact]
    public void BuildKey_IsDeterministic_ForIdenticalInputs()
    {
        var cache = CreateCache();

        var a = cache.BuildKey("m", "sys", Messages, 1024, null, null);
        var b = cache.BuildKey("m", "sys", Messages, 1024, null, null);

        Assert.Equal(a, b);
        Assert.StartsWith("ai_resp:", a);
    }

    [Theory]
    [InlineData("m2", "sys", 1024)] // model differs
    [InlineData("m", "sys2", 1024)] // system prompt differs
    [InlineData("m", "sys", 512)] // max tokens differ
    public void BuildKey_Differs_WhenAnyInputChanges(string model, string system, int maxTokens)
    {
        var cache = CreateCache();

        var baseline = cache.BuildKey("m", "sys", Messages, 1024, null, null);
        var other = cache.BuildKey(model, system, Messages, maxTokens, null, null);

        Assert.NotEqual(baseline, other);
    }

    [Fact]
    public void BuildKey_Differs_WhenMessageContentChanges()
    {
        var cache = CreateCache();

        var a = cache.BuildKey("m", "sys", Messages, 1024, null, null);
        var b = cache.BuildKey("m", "sys",
            [new AiMessage { Role = "user", Content = "summarize job 43" }], 1024, null, null);

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void BuildKey_AvoidsFieldBoundaryCollisions()
    {
        // Length-prefixed framing must keep "ab"+"c" distinct from "a"+"bc".
        var cache = CreateCache();

        var a = cache.BuildKey("ab", "c", Messages, 1024, null, null);
        var b = cache.BuildKey("a", "bc", Messages, 1024, null, null);

        Assert.NotEqual(a, b);
    }

    [Fact]
    public async Task GetAsync_ReturnsNull_WhenAbsent()
    {
        _cache.GetAsync("k", Arg.Any<CancellationToken>()).Returns((byte[]?)null);

        var result = await CreateCache().GetAsync("k", TestContext.Current.CancellationToken);

        Assert.Null(result);
    }

    [Fact]
    public async Task SetThenGet_RoundTripsResponse()
    {
        byte[]? stored = null;
        _cache.When(c => c.SetAsync(Arg.Any<string>(), Arg.Any<byte[]>(),
                Arg.Any<DistributedCacheEntryOptions>(), Arg.Any<CancellationToken>()))
            .Do(call => stored = call.ArgAt<byte[]>(1));
        _cache.GetAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(_ => stored);

        var cache = CreateCache();
        var response = new AiClientResponse { TextContent = "hi", InputTokens = 10, OutputTokens = 5 };
        response.ToolCalls.Add(new AiToolCall { ToolUseId = "t1", ToolName = "emit", ArgumentsJson = "{}" });

        await cache.SetAsync("k", response, TestContext.Current.CancellationToken);
        var roundTripped = await cache.GetAsync("k", TestContext.Current.CancellationToken);

        Assert.NotNull(roundTripped);
        Assert.Equal("hi", roundTripped.TextContent);
        Assert.Equal(10, roundTripped.InputTokens);
        Assert.Single(roundTripped.ToolCalls);
        Assert.Equal("emit", roundTripped.ToolCalls[0].ToolName);
    }
}