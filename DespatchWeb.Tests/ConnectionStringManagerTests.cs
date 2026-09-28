using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests;

public class ConnectionStringManagerTests
{
    private readonly IDistributedCache _distributedCacheMock = Substitute.For<IDistributedCache>();
    private readonly MemoryCache _memoryCache = new(new MemoryCacheOptions());

    private ConnectionStringManager CreateManager() => new(_distributedCacheMock, _memoryCache);

    [Fact]
    public async Task SetConnectionStringAsync_StoresInMemoryAndDistributedCache()
    {
        var manager = CreateManager();

        await manager.SetConnectionStringAsync("tenant-1", "Server=test;");

        // Verify memory cache was set
        var memoryCached = manager.GetConnectionStringFromMemoryCache("tenant-1");
        Assert.Equal("Server=test;", memoryCached);

        // Verify distributed cache was called
        await _distributedCacheMock
            .Received()
            .SetAsync("tenant-1", Arg.Any<byte[]>(), Arg.Any<DistributedCacheEntryOptions>(),
                Arg.Any<CancellationToken>());
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
            .SetAsync(Arg.Any<string>(), Arg.Any<byte[]>(), Arg.Any<DistributedCacheEntryOptions>(), Arg.Any<CancellationToken>())
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
        await _distributedCacheMock
            .DidNotReceive()
            .GetAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetConnectionStringAsync_FallsBackToDistributedCache_WhenMemoryCacheEmpty()
    {
        var connectionBytes = "Server=distributed;"u8.ToArray();
        _distributedCacheMock.GetAsync("tenant-1", Arg.Any<CancellationToken>())
            .Returns(connectionBytes);

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
        _distributedCacheMock.GetAsync("tenant-1", Arg.Any<CancellationToken>())
            .Returns((byte[])null!);

        var manager = CreateManager();

        var result = await manager.GetConnectionStringAsync("tenant-1");

        Assert.Null(result);
    }

    [Fact]
    public async Task GetConnectionStringAsync_ReturnsNull_WhenDistributedCacheThrows()
    {
        _distributedCacheMock.GetAsync("tenant-1", Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("Redis down"));

        var manager = CreateManager();

        var result = await manager.GetConnectionStringAsync("tenant-1");

        Assert.Null(result);
    }
}
