using System.Security.Claims;
using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using NSubstitute;

namespace DespatchWeb.Tests.Controllers;

[TestSubject(typeof(HomeController))]
public class HomeControllerTests
{
    private readonly IClientRepository _clientRepoMock = Substitute.For<IClientRepository>();
    private readonly IDfrntViewsRepository _viewsRepoMock = Substitute.For<IDfrntViewsRepository>();
    private readonly ITenantInfoService _infoServiceMock = Substitute.For<ITenantInfoService>();

    private HomeController CreateController(ClaimsPrincipal? user = null)
    {
        var controller = new HomeController(
            _clientRepoMock,
            _viewsRepoMock,
            _infoServiceMock);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = user ?? new ClaimsPrincipal(new ClaimsIdentity())
            }
        };
        controller.TempData = new TempDataDictionary(controller.HttpContext, Substitute.For<ITempDataProvider>());

        return controller;
    }

    [Fact]
    public async Task GetPageViews_ReturnsJson()
    {
        var expected = new List<DfrntPageViewModel> { new() };
        _infoServiceMock.GetStaffId().Returns(5);
        _viewsRepoMock.GetViewsByUserAndPageAsync(5, AppPage.Dispatch)
            .Returns(expected);

        var controller = CreateController();

        var result = await controller.GetPageViews((int)AppPage.Dispatch);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task ActiveClients_ReturnsJson()
    {
        var expected = new List<Suggestion> { new() { Id = 1, Text = "Client A" } };
        _clientRepoMock.ActiveClientsAsync("Client")
            .Returns(expected);

        var controller = CreateController();

        var result = await controller.ActiveClients("Client");

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public void Error_ReturnsViewWithRequestId()
    {
        var controller = CreateController();

        var result = controller.Error();

        Assert.IsType<ViewResult>(result);
    }
}
