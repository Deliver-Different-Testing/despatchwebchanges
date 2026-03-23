using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;
using Moq;

namespace DespatchWeb.Tests.Services;

public class AiRateLimiterTests
{
    private readonly Mock<IDistributedCache> _cacheMock = new();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        RateLimitPerUserPerMinute = 20,
        RateLimitPerTenantPerMinute = 100
    });

    private AiRateLimiter CreateService() => new(_cacheMock.Object, _settings);

    [Fact]
    public async Task TryAcquireAsync_FirstRequest_ReturnsTrue()
    {
        // Arrange - cache returns null (no existing counter)
        _cacheMock.Setup(x => x.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[]?)null);

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
        _cacheMock.Setup(x => x.GetAsync(It.Is<string>(k => k.Contains("user:")), It.IsAny<CancellationToken>()))
            .ReturnsAsync("20"u8.ToArray());
        _cacheMock.Setup(x => x.GetAsync(It.Is<string>(k => k.Contains("tenant:")), It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[]?)null);

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
        _cacheMock.Setup(x => x.GetAsync(It.Is<string>(k => k.Contains("user:")), It.IsAny<CancellationToken>()))
            .ReturnsAsync("1"u8.ToArray());
        _cacheMock.Setup(x => x.GetAsync(It.Is<string>(k => k.Contains("tenant:")), It.IsAny<CancellationToken>()))
            .ReturnsAsync("100"u8.ToArray());

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
        _cacheMock.Setup(x => x.GetAsync(It.Is<string>(k => k.Contains("user:")), It.IsAny<CancellationToken>()))
            .ReturnsAsync("5"u8.ToArray());
        _cacheMock.Setup(x => x.GetAsync(It.Is<string>(k => k.Contains("tenant:")), It.IsAny<CancellationToken>()))
            .ReturnsAsync("50"u8.ToArray());

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
