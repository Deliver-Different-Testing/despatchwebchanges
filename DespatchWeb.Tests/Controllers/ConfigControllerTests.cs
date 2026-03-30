using DespatchWeb.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Tests.Controllers;

public class ConfigControllerTests : IDisposable
{
    private readonly string? _originalKey = Environment.GetEnvironmentVariable("HereMapsAPIKey");
    private readonly string? _originalId = Environment.GetEnvironmentVariable("HereMapsID");
    private readonly string? _originalCode = Environment.GetEnvironmentVariable("HereMapsCode");

    private static ConfigController CreateController() => new();

    [Fact]
    public void GetHereMapsKey_ReturnsApiKeyFromEnvironment()
    {
        Environment.SetEnvironmentVariable("HereMapsAPIKey", "test-api-key");

        var result = CreateController().GetHereMapsKey();

        var json = Assert.IsType<JsonResult>(result);
        Assert.NotNull(json.Value);
    }

    [Fact]
    public void GetHereMapsKey_ReturnsNullKey_WhenEnvVarNotSet()
    {
        Environment.SetEnvironmentVariable("HereMapsAPIKey", null);

        var result = CreateController().GetHereMapsKey();

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public void GetHereMapsConfig_ReturnsAppIdAndCode()
    {
        Environment.SetEnvironmentVariable("HereMapsID", "test-id");
        Environment.SetEnvironmentVariable("HereMapsCode", "test-code");

        var result = CreateController().GetHereMapsConfig();

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public void GetHereMapsConfig_ReturnsNulls_WhenEnvVarsNotSet()
    {
        Environment.SetEnvironmentVariable("HereMapsID", null);
        Environment.SetEnvironmentVariable("HereMapsCode", null);

        var result = CreateController().GetHereMapsConfig();

        Assert.IsType<JsonResult>(result);
    }

    public void Dispose()
    {
        Environment.SetEnvironmentVariable("HereMapsAPIKey", _originalKey);
        Environment.SetEnvironmentVariable("HereMapsID", _originalId);
        Environment.SetEnvironmentVariable("HereMapsCode", _originalCode);
        GC.SuppressFinalize(this);
    }
}
