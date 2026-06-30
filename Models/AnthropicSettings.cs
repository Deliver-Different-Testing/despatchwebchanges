namespace DespatchWeb.Models;

public sealed class AnthropicSettings
{
    public string Model { get; init; } = "claude-haiku-4-5";
    public int MaxTokensPerRequest { get; init; } = 4096;
    public int MaxTokensPerSummary { get; init; } = 1024;
    public int MaxTokensPerDraft { get; init; } = 512;
    public int RateLimitPerUserPerMinute { get; init; } = 5;
    public int RateLimitPerTenantPerMinute { get; init; } = 20;
}
