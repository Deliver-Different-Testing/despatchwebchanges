using DespatchWeb.Models;
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
        _cacheMock.GetAsync(Arg.Is<string>(k => k.Contains("user:")), Arg.Any<CancellationToken>())
            .Returns("20"u8.ToArray());
        _cacheMock.GetAsync(Arg.Is<string>(k => k.Contains("tenant:")), Arg.Any<CancellationToken>())
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
        _cacheMock.GetAsync(Arg.Is<string>(k => k.Contains("user:")), Arg.Any<CancellationToken>())
            .Returns("1"u8.ToArray());
        _cacheMock.GetAsync(Arg.Is<string>(k => k.Contains("tenant:")), Arg.Any<CancellationToken>())
            .Returns("100"u8.ToArray());

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
        _cacheMock.GetAsync(Arg.Is<string>(k => k.Contains("user:")), Arg.Any<CancellationToken>())
            .Returns("5"u8.ToArray());
        _cacheMock.GetAsync(Arg.Is<string>(k => k.Contains("tenant:")), Arg.Any<CancellationToken>())
            .Returns("50"u8.ToArray());

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
        await service.RecordTokenUsageAsync(1, "nz", 100, 50);
    }
}