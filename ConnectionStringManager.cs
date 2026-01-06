using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace DespatchWeb;

public interface IConnectionStringManager
{
    Task SetConnectionStringAsync(string tenantAppCacheKey, string connectionString);
    Task<string> GetConnectionStringAsync(string tenantAppCacheKey);
}

public class ConnectionStringManager(
    IDistributedCache distributedCache,
    IMemoryCache memoryCache,
    ILogger<ConnectionStringManager> logger)
    : IConnectionStringManager
{
    private static readonly SemaphoreSlim Semaphore = new(1, 1);

    // Cache settings - using sliding expiration so active users stay cached
    private static readonly TimeSpan CacheSlidingExpiry = TimeSpan.FromHours(8);
    private const int MaxRetryAttempts = 3;
    private static readonly TimeSpan InitialRetryDelay = TimeSpan.FromMilliseconds(100);

    public async Task SetConnectionStringAsync(string tenantAppCacheKey, string connectionString)
    {
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new ArgumentNullException(nameof(connectionString));
        }

        // Always set in memory cache first (fast, reliable)
        SetMemoryCache(tenantAppCacheKey, connectionString);

        await Semaphore.WaitAsync();
        try
        {
            var options = new DistributedCacheEntryOptions
            {
                SlidingExpiration = CacheSlidingExpiry
            };

            await distributedCache.SetStringAsync(tenantAppCacheKey, connectionString, options);
            logger.LogDebug("Connection string set in distributed cache for {CacheKey}", tenantAppCacheKey);
        }
        catch (Exception ex)
        {
            // Log but don't throw - memory cache is our fallback
            logger.LogWarning(ex, "Failed to set connection string in distributed cache for {CacheKey}, using memory cache as fallback", tenantAppCacheKey);
        }
        finally
        {
            Semaphore.Release();
        }
    }

    public async Task<string> GetConnectionStringAsync(string tenantAppCacheKey)
    {
        // Try memory cache first (fastest)
        if (memoryCache.TryGetValue(tenantAppCacheKey, out string cachedConnectionString)
            && !string.IsNullOrEmpty(cachedConnectionString))
        {
            logger.LogDebug("Connection string retrieved from memory cache for {CacheKey}", tenantAppCacheKey);
            return cachedConnectionString;
        }

        // Try distributed cache with retry logic
        var connectionString = await GetFromDistributedCacheWithRetryAsync(tenantAppCacheKey);

        if (!string.IsNullOrEmpty(connectionString))
        {
            // Populate memory cache for future requests
            SetMemoryCache(tenantAppCacheKey, connectionString);
            return connectionString;
        }

        logger.LogWarning("Connection string not found in any cache for {CacheKey}", tenantAppCacheKey);
        return null;
    }

    private async Task<string> GetFromDistributedCacheWithRetryAsync(string tenantAppCacheKey)
    {
        var retryDelay = InitialRetryDelay;

        for (var attempt = 1; attempt <= MaxRetryAttempts; attempt++)
        {
            await Semaphore.WaitAsync();
            try
            {
                var connectionString = await distributedCache.GetStringAsync(tenantAppCacheKey);

                if (!string.IsNullOrEmpty(connectionString))
                {
                    logger.LogDebug("Connection string retrieved from distributed cache for {CacheKey} on attempt {Attempt}",
                        tenantAppCacheKey, attempt);
                    return connectionString;
                }

                // Key doesn't exist in cache - no point retrying
                if (attempt == 1)
                {
                    logger.LogDebug("Connection string not found in distributed cache for {CacheKey}", tenantAppCacheKey);
                }
                return null;
            }
            catch (Exception ex) when (attempt < MaxRetryAttempts)
            {
                logger.LogWarning(ex,
                    "Transient error accessing distributed cache for {CacheKey}, attempt {Attempt}/{MaxAttempts}. Retrying in {Delay}ms",
                    tenantAppCacheKey, attempt, MaxRetryAttempts, retryDelay.TotalMilliseconds);

                await Task.Delay(retryDelay);
                retryDelay *= 2; // Exponential backoff
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "Failed to retrieve connection string from distributed cache for {CacheKey} after {MaxAttempts} attempts",
                    tenantAppCacheKey, MaxRetryAttempts);
                return null;
            }
            finally
            {
                Semaphore.Release();
            }
        }

        return null;
    }

    private void SetMemoryCache(string tenantAppCacheKey, string connectionString)
    {
        var options = new MemoryCacheEntryOptions
        {
            SlidingExpiration = CacheSlidingExpiry,
            Priority = CacheItemPriority.High // Don't evict connection strings easily
        };

        memoryCache.Set(tenantAppCacheKey, connectionString, options);
    }
}
