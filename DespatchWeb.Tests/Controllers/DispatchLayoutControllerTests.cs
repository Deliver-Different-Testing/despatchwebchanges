using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace DespatchWeb.Tests.Controllers;

/// <summary>
/// The Default layout is read-only and regenerated on the client from code, so a
/// row named "Default" must never reach the database — it could only ever be a
/// stale copy waiting to overwrite the shipped arrangement.
/// </summary>
[TestSubject(typeof(DispatchLayoutController))]
public class DispatchLayoutControllerTests
{
    private readonly IDispatchLayoutRepository _repositoryMock = Substitute.For<IDispatchLayoutRepository>();

    private DispatchLayoutController CreateController() => new(_repositoryMock);

    private static DispatchLayoutDto Layout(string name) =>
        new() { Name = name, LayoutJson = "{}" };

    private static SaveDispatchLayoutsRequest Request(params DispatchLayoutDto[] layouts) =>
        new() { Page = "JobSearch", Layouts = layouts };

    [Fact]
    public async Task SaveLayouts_StripsTheDefaultLayoutBeforePersisting()
    {
        var controller = CreateController();

        var result = await controller.SaveLayouts(Request(Layout("Default"), Layout("Wide")));

        Assert.IsType<OkResult>(result);
        await _repositoryMock.Received(1).ReplaceLayoutsAsync(
            "JobSearch",
            Arg.Is<IReadOnlyList<DispatchLayoutDto>>(l => l.Count == 1 && l[0].Name == "Wide"));
    }

    [Fact]
    public async Task SaveLayouts_WhenOnlyTheDefaultIsSent_StillReplacesSoStaleRowsAreCleared()
    {
        var controller = CreateController();

        var result = await controller.SaveLayouts(Request(Layout("Default")));

        // The replace is delete-missing-by-name, so an empty list is what removes a
        // Default row an earlier build wrote.
        Assert.IsType<OkResult>(result);
        await _repositoryMock.Received(1).ReplaceLayoutsAsync(
            "JobSearch",
            Arg.Is<IReadOnlyList<DispatchLayoutDto>>(l => l.Count == 0));
    }

    [Fact]
    public async Task SaveLayouts_PassesUserLayoutsThroughUnchanged()
    {
        var controller = CreateController();

        var result = await controller.SaveLayouts(Request(Layout("Wide"), Layout("Narrow")));

        Assert.IsType<OkResult>(result);
        await _repositoryMock.Received(1).ReplaceLayoutsAsync(
            "JobSearch",
            Arg.Is<IReadOnlyList<DispatchLayoutDto>>(l => l.Count == 2));
    }

    [Fact]
    public async Task SaveLayouts_RejectsAnUnknownPage()
    {
        var controller = CreateController();

        var result = await controller.SaveLayouts(
            new SaveDispatchLayoutsRequest { Page = "Nope", Layouts = [Layout("Wide")] });

        Assert.IsType<BadRequestObjectResult>(result);
        await _repositoryMock.DidNotReceiveWithAnyArgs().ReplaceLayoutsAsync(null!, null!);
    }

    [Fact]
    public async Task SaveLayouts_RejectsALayoutMissingItsNameOrJson()
    {
        var controller = CreateController();

        var result = await controller.SaveLayouts(
            Request(new DispatchLayoutDto { Name = "Wide", LayoutJson = "" }));

        Assert.IsType<BadRequestObjectResult>(result);
        await _repositoryMock.DidNotReceiveWithAnyArgs().ReplaceLayoutsAsync(null!, null!);
    }

    [Fact]
    public async Task GetLayouts_AllowsTheNationwidePage()
    {
        _repositoryMock.GetLayoutsAsync("Nationwide").Returns([Layout("Wide")]);
        var controller = CreateController();

        var result = await controller.GetLayouts("Nationwide");

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SaveLayouts_AllowsTheNationwidePage()
    {
        var controller = CreateController();

        var result = await controller.SaveLayouts(
            new SaveDispatchLayoutsRequest { Page = "Nationwide", Layouts = [Layout("Wide")] });

        Assert.IsType<OkResult>(result);
        await _repositoryMock.Received(1).ReplaceLayoutsAsync(
            "Nationwide",
            Arg.Is<IReadOnlyList<DispatchLayoutDto>>(l => l.Count == 1 && l[0].Name == "Wide"));
    }
}
