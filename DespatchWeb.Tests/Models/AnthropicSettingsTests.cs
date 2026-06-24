using DespatchWeb.Models;

namespace DespatchWeb.Tests.Models;

public class AnthropicSettingsTests
{
    [Fact]
    public void Defaults_AreCheapestActiveModelAndLowRateLimits()
    {
        var settings = new AnthropicSettings();

        Assert.Equal("claude-haiku-4-5", settings.Model);
        Assert.Equal(4096, settings.MaxTokensPerRequest);
        Assert.Equal(1024, settings.MaxTokensPerSummary);
        Assert.Equal(5, settings.RateLimitPerUserPerMinute);
        Assert.Equal(20, settings.RateLimitPerTenantPerMinute);
    }
}
