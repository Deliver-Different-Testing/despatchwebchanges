using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
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
        if (tenantCount <= _settings.RateLimitPerTenantPerMinute)
        {
            return true;
        }

        Log.Warning("AI rate limit exceeded for tenant {TenantId}: {Count}/{Limit}",
            tenantId, tenantCount, _settings.RateLimitPerTenantPerMinute);
        return false;
    }

    public Task RecordTokenUsageAsync(
        int staffId, string tenantId, string feature, AiTaskClass taskClass, AiUsageInfo usage)
    {
        var profile = _settings.For(taskClass);

        var costUsd = CostUsd(profile, usage);

        // Feature and model are separate properties, not interpolated into the message,
        // so cost and cache effectiveness stay groupable per feature and per model in
        // the log sink. CacheReadInputTokens sitting at zero across repeated briefings
        // means the prompt-cache breakpoint is below the minimum cacheable prefix and
        // is doing nothing.
        Log.Information(
            "AI token usage - Feature: {Feature}, TaskClass: {TaskClass}, Model: {Model}, " +
            "Staff: {StaffId}, Tenant: {TenantId}, " +
            "Input: {InputTokens}, Output: {OutputTokens}, CacheRead: {CacheReadTokens}, " +
            "CacheWrite: {CacheCreationTokens}, CostUsd: {CostUsd:F6}",
            feature, taskClass.ToString(), profile.Model,
            staffId, tenantId,
            usage.InputTokens, usage.OutputTokens,
            usage.CacheReadInputTokens, usage.CacheCreationInputTokens, costUsd);
        return Task.CompletedTask;
    }

    internal static decimal CostUsd(AiModelProfile profile, AiUsageInfo usage) =>
        usage.InputTokens / 1_000_000m * profile.InputPricePerMillion +
        usage.OutputTokens / 1_000_000m * profile.OutputPricePerMillion +
        usage.CacheReadInputTokens / 1_000_000m * profile.CacheReadPricePerMillion +
        usage.CacheCreationInputTokens / 1_000_000m * profile.CacheWritePricePerMillion;

    private async Task<int> IncrementCounterAsync(string key)
    {
        var existing = await cache.GetStringAsync(key);
        var count = 1;
        if (existing != null && int.TryParse(existing, out var parsed))
        {
            count = parsed + 1;
        }

        await cache.SetStringAsync(key, count.ToString(), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2)
        });

        return count;
    }
}
