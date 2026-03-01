namespace DespatchWeb.Models;

public class AnthropicSettings
{
    public string Model { get; set; } = "claude-sonnet-4-20250514";
    public int MaxTokensPerRequest { get; set; } = 4096;
    public int MaxTokensPerSummary { get; set; } = 1024;
    public int RateLimitPerUserPerMinute { get; set; } = 20;
    public int RateLimitPerTenantPerMinute { get; set; } = 100;
    public bool EnableAiFeatures { get; set; } = true;
}
