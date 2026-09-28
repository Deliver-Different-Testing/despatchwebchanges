using Anthropic.Core;
using Anthropic.Models.Messages;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Ai;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Pins the SDK behaviour the truncation/refusal handling depends on. ApiEnum.ToString()
/// JSON-serialises, so it yields a quoted wire value; comparing it raw to "max_tokens"
/// silently never matches and every truncated answer is misreported as a parse failure.
/// </summary>
public class AiStopReasonTests
{
    [Theory]
    [InlineData("max_tokens")]
    [InlineData("refusal")]
    [InlineData("tool_use")]
    [InlineData("end_turn")]
    public void ToWireValue_StripsTheQuotesApiEnumAdds(string wire)
    {
        ApiEnum<string, StopReason> stopReason = wire;

        Assert.Contains('"', stopReason.ToString());
        Assert.Equal(wire, AiClientService.ToWireValue(stopReason));
    }

    [Fact]
    public void ToWireValue_IsTheSameWhicheverWayTheValueWasBuilt()
    {
        Assert.Equal("max_tokens", AiClientService.ToWireValue(StopReason.MaxTokens));
        Assert.Equal("refusal", AiClientService.ToWireValue(StopReason.Refusal));
    }

    [Fact]
    public void ToWireValue_Null_ReturnsNull() => Assert.Null(AiClientService.ToWireValue(null));

    [Theory]
    [InlineData("max_tokens", true, false)]
    [InlineData("refusal", false, true)]
    [InlineData("tool_use", false, false)]
    [InlineData(null, false, false)]
    public void Response_ClassifiesTruncationAndRefusalFromTheWireValue(
        string? stopReason, bool truncated, bool refused)
    {
        var response = new AiClientResponse { StopReason = stopReason };

        Assert.Equal(truncated, response.WasTruncated);
        Assert.Equal(refused, response.WasRefused);
    }
}
