using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace DespatchWeb.Tests.Controllers;

/// <summary>
/// PreferenceKey is restricted to a known allow-list — the table is a generic
/// key/value store, but the app should not silently accumulate arbitrary keys
/// from a compromised or buggy client.
/// </summary>
[TestSubject(typeof(StaffPreferenceController))]
public class StaffPreferenceControllerTests
{
    private readonly IStaffPreferenceRepository _repositoryMock = Substitute.For<IStaffPreferenceRepository>();

    private StaffPreferenceController CreateController() => new(_repositoryMock);

    [Fact]
    public async Task GetPreference_ReturnsTheStoredJson()
    {
        _repositoryMock.GetPreferenceAsync("AutoMate").Returns("{\"aiEnabled\":true}");
        var controller = CreateController();

        var result = await controller.GetPreference("AutoMate");

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equal("{\"aiEnabled\":true}", json.Value);
    }

    [Fact]
    public async Task GetPreference_WhenNothingSaved_ReturnsNull()
    {
        _repositoryMock.GetPreferenceAsync("AutoMate").Returns((string)null);
        var controller = CreateController();

        var result = await controller.GetPreference("AutoMate");

        var json = Assert.IsType<JsonResult>(result);
        Assert.Null(json.Value);
    }

    [Fact]
    public async Task GetPreference_RejectsAnUnknownKey()
    {
        var controller = CreateController();

        var result = await controller.GetPreference("Nope");

        Assert.IsType<BadRequestObjectResult>(result);
        await _repositoryMock.DidNotReceiveWithAnyArgs().GetPreferenceAsync(null!);
    }

    [Fact]
    public async Task SavePreference_PersistsTheJson()
    {
        var controller = CreateController();

        var result = await controller.SavePreference(
            new SavePreferenceRequest { PreferenceKey = "AutoMate", PreferenceJson = "{\"aiEnabled\":true}" });

        Assert.IsType<OkResult>(result);
        await _repositoryMock.Received(1).SetPreferenceAsync("AutoMate", "{\"aiEnabled\":true}");
    }

    [Fact]
    public async Task SavePreference_RejectsAnUnknownKey()
    {
        var controller = CreateController();

        var result = await controller.SavePreference(
            new SavePreferenceRequest { PreferenceKey = "Nope", PreferenceJson = "{}" });

        Assert.IsType<BadRequestObjectResult>(result);
        await _repositoryMock.DidNotReceiveWithAnyArgs().SetPreferenceAsync(null!, null!);
    }

    [Fact]
    public async Task SavePreference_RejectsEmptyJson()
    {
        var controller = CreateController();

        var result = await controller.SavePreference(
            new SavePreferenceRequest { PreferenceKey = "AutoMate", PreferenceJson = "" });

        Assert.IsType<BadRequestObjectResult>(result);
        await _repositoryMock.DidNotReceiveWithAnyArgs().SetPreferenceAsync(null!, null!);
    }

    [Fact]
    public async Task SavePreference_AcceptsAJobListColumnsKey()
    {
        var controller = CreateController();

        var result = await controller.SavePreference(new SavePreferenceRequest
        {
            PreferenceKey = "JobListColumnsDispatchJobList",
            PreferenceJson = "{\"columnOrder\":[]}",
        });

        Assert.IsType<OkResult>(result);
        await _repositoryMock.Received(1).SetPreferenceAsync(
            "JobListColumnsDispatchJobList", "{\"columnOrder\":[]}");
    }

    [Fact]
    public async Task DeletePreference_RemovesTheStoredJson()
    {
        var controller = CreateController();

        var result = await controller.DeletePreference("AutoMate");

        Assert.IsType<OkResult>(result);
        await _repositoryMock.Received(1).DeletePreferenceAsync("AutoMate");
    }

    [Fact]
    public async Task DeletePreference_RejectsAnUnknownKey()
    {
        var controller = CreateController();

        var result = await controller.DeletePreference("Nope");

        Assert.IsType<BadRequestObjectResult>(result);
        await _repositoryMock.DidNotReceiveWithAnyArgs().DeletePreferenceAsync(null!);
    }

    [Fact]
    public async Task GetPreference_RejectsTheEnumsUnderlyingNumericValue()
    {
        // Enum.TryParse also accepts "0" as AutoMate's numeric value — that's
        // not a real key name and must not slip through the allow-list.
        var controller = CreateController();

        var result = await controller.GetPreference("0");

        Assert.IsType<BadRequestObjectResult>(result);
        await _repositoryMock.DidNotReceiveWithAnyArgs().GetPreferenceAsync(null!);
    }
}
