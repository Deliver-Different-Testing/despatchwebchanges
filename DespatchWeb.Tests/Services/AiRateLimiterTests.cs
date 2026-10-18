using System.Diagnostics.Metrics;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using DespatchWeb.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class AiRateLimiterTests
{
    private readonly IDistributedCache _cacheMock = Substitute.For<IDistributedCache>();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        RateLimitPerUserPerMinute = 20,
        RateLimitPerTenantPerMinute = 100
    });

    private AiRateLimiter CreateService() => new(_cacheMock, _settings);

    [Fact]
    public async Task TryAcquireAsync_FirstRequest_ReturnsTrue()
    {
        // Arrange - cache returns null (no existing counter)
        _cacheMock.GetAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((byte[]?)null);

        var service = CreateService();

        // Act
        var result = await service.TryAcquireAsync(1, "nz");

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task TryAcquireAsync_UserLimitExceeded_ReturnsFalse()
    {
        // Arrange - user has already made 20 requests this minute
        _cacheMock.GetAsync(Arg.Is<string>(k => k!.Contains("user:")), Arg.Any<CancellationToken>())
            .Returns([.. "20"u8]);
        _cacheMock.GetAsync(Arg.Is<string>(k => k!.Contains("tenant:")), Arg.Any<CancellationToken>())
            .Returns((byte[]?)null);

        var service = CreateService();

        // Act
        var result = await service.TryAcquireAsync(1, "nz");

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task TryAcquireAsync_TenantLimitExceeded_ReturnsFalse()
    {
        // Arrange - user is under limit, but tenant is at 100
        _cacheMock.GetAsync(Arg.Is<string>(k => k!.Contains("user:")), Arg.Any<CancellationToken>())
            .Returns([.. "1"u8]);
        _cacheMock.GetAsync(Arg.Is<string>(k => k!.Contains("tenant:")), Arg.Any<CancellationToken>())
            .Returns([.. "100"u8]);

        var service = CreateService();

        // Act
        var result = await service.TryAcquireAsync(1, "nz");

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task TryAcquireAsync_BothUnderLimit_ReturnsTrue()
    {
        // Arrange
        _cacheMock.GetAsync(Arg.Is<string>(k => k!.Contains("user:")), Arg.Any<CancellationToken>())
            .Returns([.. "5"u8]);
        _cacheMock.GetAsync(Arg.Is<string>(k => k!.Contains("tenant:")), Arg.Any<CancellationToken>())
            .Returns([.. "50"u8]);

        var service = CreateService();

        // Act
        var result = await service.TryAcquireAsync(1, "nz");

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task RecordTokenUsageAsync_Completes()
    {
        // Arrange
        var service = CreateService();

        // Act & Assert - should complete without error (logging only)
        await service.RecordTokenUsageAsync(1, "nz", "SummarizeJob", AiTaskClass.Judgment,
            new AiUsageInfo { InputTokens = 100, OutputTokens = 50 });
    }

    [Fact]
    public async Task RecordTokenUsageAsync_EmitsTokenAndCostMetricsTaggedByFeatureAndModel()
    {
        var tokens = new List<(long Value, string Feature, string Model, string Kind)>();
        double cost = 0;
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, l) =>
        {
            if (instrument.Meter.Name == AiRateLimiter.MeterName)
            {
                l.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<long>((_, value, tags, _) =>
        {
            var tagMap = new Dictionary<string, string>();
            foreach (var tag in tags)
            {
                tagMap[tag.Key] = tag.Value?.ToString() ?? "";
            }

            tokens.Add((value, tagMap["feature"], tagMap["model"], tagMap["kind"]));
        });
        listener.SetMeasurementEventCallback<double>((_, value, _, _) => cost += value);
        listener.Start();

        var settings = Options.Create(new AnthropicSettings
        {
            Drafting = new AiModelProfile { Model = "claude-haiku-4-5", InputPricePerMillion = 1m, OutputPricePerMillion = 5m }
        });
        await new AiRateLimiter(_cacheMock, settings).RecordTokenUsageAsync(
            1, "nz", "DraftNote", AiTaskClass.Drafting,
            new AiUsageInfo { InputTokens = 1_000_000, OutputTokens = 200_000, CacheReadInputTokens = 5 });

        Assert.Contains((1_000_000L, "DraftNote", "claude-haiku-4-5", "input"), tokens);
        Assert.Contains((200_000L, "DraftNote", "claude-haiku-4-5", "output"), tokens);
        Assert.Contains((5L, "DraftNote", "claude-haiku-4-5", "cache_read"), tokens);
        Assert.Equal(2.0, cost, 6);
    }
}
