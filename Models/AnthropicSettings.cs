namespace DespatchWeb.Models;

public sealed class AnthropicSettings
{
    public string Model { get; init; } = "claude-sonnet-4-20250514";
    public int MaxTokensPerRequest { get; init; } = 4096;
    public int MaxTokensPerSummary { get; init; } = 1024;
    public int RateLimitPerUserPerMinute { get; init; } = 20;
    public int RateLimitPerTenantPerMinute { get; init; } = 100;
}
