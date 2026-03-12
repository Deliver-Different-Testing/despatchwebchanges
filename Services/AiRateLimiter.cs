using System;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;
using Serilog;

namespace DespatchWeb.Services;

public sealed class AiRateLimiter(IDistributedCache cache, IOptions<AnthropicSettings> settings)
    : IAiRateLimiter
{
    private readonly AnthropicSettings _settings = settings.Value;

    public async Task<bool> TryAcquireAsync(int staffId, string tenantId)
    {
        var now = DateTimeOffset.UtcNow;
        var windowKey = now.ToString("yyyyMMddHHmm");

        // Check per-user limit
        var userKey = $"ai_rate:user:{staffId}:{windowKey}";
        var userCount = await IncrementCounterAsync(userKey);
        if (userCount > _settings.RateLimitPerUserPerMinute)
        {
            Log.Warning("AI rate limit exceeded for user {StaffId}: {Count}/{Limit}",
                staffId, userCount, _settings.RateLimitPerUserPerMinute);
            return false;
        }

        // Check per-tenant limit
        var tenantKey = $"ai_rate:tenant:{tenantId}:{windowKey}";
        var tenantCount = await IncrementCounterAsync(tenantKey);
        if (tenantCount <= _settings.RateLimitPerTenantPerMinute) return true;
       
        Log.Warning("AI rate limit exceeded for tenant {TenantId}: {Count}/{Limit}",
            tenantId, tenantCount, _settings.RateLimitPerTenantPerMinute);
        return false;
    }

    public Task RecordTokenUsageAsync(int staffId, string tenantId, int inputTokens, int outputTokens)
    {
        Log.Information(
            "AI token usage - Staff: {StaffId}, Tenant: {TenantId}, Input: {InputTokens}, Output: {OutputTokens}",
            staffId, tenantId, inputTokens, outputTokens);
        return Task.CompletedTask;
    }

    private async Task<int> IncrementCounterAsync(string key)
    {
        var existing = await cache.GetStringAsync(key);
        var count = 1;
        if (existing != null && int.TryParse(existing, out var parsed)) count = parsed + 1;

        await cache.SetStringAsync(key, count.ToString(), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2)
        });

        return count;
    }
}
