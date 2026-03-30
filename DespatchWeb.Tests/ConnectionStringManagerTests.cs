using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Moq;

namespace DespatchWeb.Tests;

public class ConnectionStringManagerTests
{
    private readonly Mock<IDistributedCache> _distributedCacheMock = new();
    private readonly MemoryCache _memoryCache = new(new MemoryCacheOptions());

    private ConnectionStringManager CreateManager() => new(_distributedCacheMock.Object, _memoryCache);

    [Fact]
    public async Task SetConnectionStringAsync_StoresInMemoryAndDistributedCache()
    {
        var manager = CreateManager();

        await manager.SetConnectionStringAsync("tenant-1", "Server=test;");

        // Verify memory cache was set
        var memoryCached = manager.GetConnectionStringFromMemoryCache("tenant-1");
        Assert.Equal("Server=test;", memoryCached);

        // Verify distributed cache was called
        _distributedCacheMock.Verify(
            x => x.SetAsync("tenant-1", It.IsAny<byte[]>(), It.IsAny<DistributedCacheEntryOptions>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task SetConnectionStringAsync_NullConnectionString_ThrowsArgumentNullException()
    {
        var manager = CreateManager();

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => manager.SetConnectionStringAsync("tenant-1", null!));
    }

    [Fact]
    public async Task SetConnectionStringAsync_EmptyConnectionString_ThrowsArgumentNullException()
    {
        var manager = CreateManager();

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => manager.SetConnectionStringAsync("tenant-1", ""));
    }

    [Fact]
    public async Task SetConnectionStringAsync_DistributedCacheFails_StillSetsMemoryCache()
    {
        _distributedCacheMock
            .Setup(x => x.SetAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<DistributedCacheEntryOptions>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Redis down"));

        var manager = CreateManager();

        // Should not throw - memory cache is fallback
        await manager.SetConnectionStringAsync("tenant-1", "Server=test;");

        var memoryCached = manager.GetConnectionStringFromMemoryCache("tenant-1");
        Assert.Equal("Server=test;", memoryCached);
    }

    [Fact]
    public void GetConnectionStringFromMemoryCache_ReturnsNull_WhenNotCached()
    {
        var manager = CreateManager();

        var result = manager.GetConnectionStringFromMemoryCache("nonexistent");

        Assert.Null(result);
    }

    [Fact]
    public void GetConnectionStringFromMemoryCache_ReturnsValue_WhenCached()
    {
        _memoryCache.Set("tenant-1", "Server=test;");
        var manager = CreateManager();

        var result = manager.GetConnectionStringFromMemoryCache("tenant-1");

        Assert.Equal("Server=test;", result);
    }

    [Fact]
    public void GetConnectionStringFromMemoryCache_ReturnsNull_WhenCachedValueIsEmpty()
    {
        _memoryCache.Set("tenant-1", "");
        var manager = CreateManager();

        var result = manager.GetConnectionStringFromMemoryCache("tenant-1");

        Assert.Null(result);
    }

    [Fact]
    public async Task GetConnectionStringAsync_ReturnsFromMemoryCache_WhenAvailable()
    {
        _memoryCache.Set("tenant-1", "Server=memory;");
        var manager = CreateManager();

        var result = await manager.GetConnectionStringAsync("tenant-1");

        Assert.Equal("Server=memory;", result);
        // Should not hit distributed cache
        _distributedCacheMock.Verify(
            x => x.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetConnectionStringAsync_FallsBackToDistributedCache_WhenMemoryCacheEmpty()
    {
        var connectionBytes = System.Text.Encoding.UTF8.GetBytes("Server=distributed;");
        _distributedCacheMock
            .Setup(x => x.GetAsync("tenant-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(connectionBytes);

        var manager = CreateManager();

        var result = await manager.GetConnectionStringAsync("tenant-1");

        Assert.Equal("Server=distributed;", result);
        // Should also populate memory cache
        var memoryCached = manager.GetConnectionStringFromMemoryCache("tenant-1");
        Assert.Equal("Server=distributed;", memoryCached);
    }

    [Fact]
    public async Task GetConnectionStringAsync_ReturnsNull_WhenNotInAnyCache()
    {
        _distributedCacheMock
            .Setup(x => x.GetAsync("tenant-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[])null!);

        var manager = CreateManager();

        var result = await manager.GetConnectionStringAsync("tenant-1");

        Assert.Null(result);
    }

    [Fact]
    public async Task GetConnectionStringAsync_ReturnsNull_WhenDistributedCacheThrows()
    {
        _distributedCacheMock
            .Setup(x => x.GetAsync("tenant-1", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Redis down"));

        var manager = CreateManager();

        var result = await manager.GetConnectionStringAsync("tenant-1");

        Assert.Null(result);
    }
}
