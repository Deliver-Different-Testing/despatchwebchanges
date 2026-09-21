using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace DespatchWeb.Tests.Controllers;

[TestSubject(typeof(TenantSettingsController))]
public class TenantSettingsControllerTests
{
    private readonly ITenantSettingsService _tenantSettingsServiceMock = Substitute.For<ITenantSettingsService>();

    private TenantSettingsController CreateController() => new(_tenantSettingsServiceMock);

    [Fact]
    public async Task GetDispatchAddressFormatDefault_ReturnsTheStoredJson()
    {
        _tenantSettingsServiceMock.GetDispatchAddressFormatDefaultAsync()
            .Returns("{\"fields\":[\"streetNumber\"]}");
        var controller = CreateController();

        var result = await controller.GetDispatchAddressFormatDefault();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equal("{\"fields\":[\"streetNumber\"]}", json.Value);
    }

    [Fact]
    public async Task GetDispatchAddressFormatDefault_WhenNotConfigured_ReturnsNull()
    {
        _tenantSettingsServiceMock.GetDispatchAddressFormatDefaultAsync().Returns((string)null!);
        var controller = CreateController();

        var result = await controller.GetDispatchAddressFormatDefault();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Null(json.Value);
    }
}
