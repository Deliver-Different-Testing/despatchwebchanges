namespace DespatchWeb.Models;

public sealed class AnthropicSettings
{
    public string Model { get; init; } = "claude-haiku-4-5";
    public int MaxTokensPerRequest { get; init; } = 4096;
    public int MaxTokensPerSummary { get; init; } = 1024;
    public int MaxTokensPerDraft { get; init; } = 512;
    public int RateLimitPerUserPerMinute { get; init; } = 5;
    public int RateLimitPerTenantPerMinute { get; init; } = 20;

    // Deduplicate identical read-only AI requests (job/ops/compliance briefings,
    // insights) via a short-lived response cache. 0 disables it.
    public int ResponseCacheSeconds { get; init; } = 90;

    // USD per million tokens. Defaults track claude-haiku-4-5 list pricing;
    // override in configuration if the model or pricing changes.
    public decimal InputPricePerMillion { get; init; } = 1.00m;
    public decimal OutputPricePerMillion { get; init; } = 5.00m;
    public decimal CacheReadPricePerMillion { get; init; } = 0.10m;
    public decimal CacheWritePricePerMillion { get; init; } = 1.25m;
}
