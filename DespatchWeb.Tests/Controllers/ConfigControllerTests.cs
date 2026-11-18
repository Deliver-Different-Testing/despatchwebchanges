using DespatchWeb.Controllers;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Tests.Controllers;

[TestSubject(typeof(ConfigController))]
public class ConfigControllerTests : IDisposable
{
    private readonly string? _originalKey = Environment.GetEnvironmentVariable("HereMapsAPIKey");

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

    public void Dispose()
    {
        Environment.SetEnvironmentVariable("HereMapsAPIKey", _originalKey);
        GC.SuppressFinalize(this);
    }
}
