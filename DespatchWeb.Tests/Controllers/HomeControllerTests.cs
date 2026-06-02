using System.Security.Claims;
using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using NSubstitute;

namespace DespatchWeb.Tests.Controllers;

public class HomeControllerTests : IDisposable
{
    private readonly IClientRepository _clientRepoMock = Substitute.For<IClientRepository>();
    private readonly IDfrntViewsRepository _viewsRepoMock = Substitute.For<IDfrntViewsRepository>();
    private readonly ITenantInfoService _infoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IConnectionStringManager _connectionStringManagerMock = Substitute.For<IConnectionStringManager>();

    private readonly string? _originalSqlCredentials = Environment.GetEnvironmentVariable("SQLCredentials");
    private readonly string? _originalHubUrl = Environment.GetEnvironmentVariable("HubUrl");
    private readonly string? _originalPublicPath = Environment.GetEnvironmentVariable("PublicPath");

    private HomeController CreateController(ClaimsPrincipal? user = null)
    {
        var controller = new HomeController(
            _clientRepoMock,
            _viewsRepoMock,
            _infoServiceMock,
            _connectionStringManagerMock);

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

    private static ClaimsPrincipal CreateAuthenticatedUser(
        string staffId = "1",
        string contactId = "100",
        string connection = "Server=test;",
        string tenantId = "42",
        string countryCode = "NZ",
        string timeZone = "Pacific/Auckland")
    {
        var claims = new List<Claim>
        {
            new("StaffID", staffId),
            new("ContactID", contactId),
            new("Connection", connection),
            new("CurrentTenantID", tenantId),
            new("CountryCode", countryCode),
            new("TimeZone", timeZone)
        };
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }

    [Fact]
    public async Task Index_ValidUser_SetsViewBagAndReturnsView()
    {
        Environment.SetEnvironmentVariable("SQLCredentials", ";Password=test;");
        var user = CreateAuthenticatedUser();
        var clientDetail = new ClientViewModel
        {
            FirstName = "Jane",
            FullName = "Jane Doe",
            Email = "jane@test.com",
            Internal = true,
            IsNetworkPartner = true,
            StaffID = 5
        };
        _clientRepoMock.ValidateClientAsync(100).Returns(clientDetail);
        _connectionStringManagerMock.SetConnectionStringAsync(Arg.Any<string>(), Arg.Any<string>())
            .Returns(Task.CompletedTask);

        var controller = CreateController(user);

        var result = await controller.Index();

        var view = Assert.IsType<ViewResult>(result);
        Assert.Equal(true, view.ViewData["ClientInternal"]);
        Assert.Equal(true, view.ViewData["IsNetworkPartner"]);
    }

    [Fact]
    public async Task Index_NonNetworkPartner_SetsIsNetworkPartnerFalse()
    {
        Environment.SetEnvironmentVariable("SQLCredentials", ";Password=test;");
        var user = CreateAuthenticatedUser();
        var clientDetail = new ClientViewModel
        {
            FirstName = "Jane",
            FullName = "Jane Doe",
            Email = "jane@test.com",
            Internal = false,
            IsNetworkPartner = false,
            StaffID = 5
        };
        _clientRepoMock.ValidateClientAsync(100).Returns(clientDetail);
        _connectionStringManagerMock.SetConnectionStringAsync(Arg.Any<string>(), Arg.Any<string>())
            .Returns(Task.CompletedTask);

        var controller = CreateController(user);

        var result = await controller.Index();

        var view = Assert.IsType<ViewResult>(result);
        Assert.Equal(false, view.ViewData["IsNetworkPartner"]);
    }

    [Fact]
    public async Task Index_MissingConnectionString_Redirects()
    {
        Environment.SetEnvironmentVariable("HubUrl", "https://hub.test.com");
        var claims = new List<Claim>
        {
            new("StaffID", "1"),
            new("ContactID", "100"),
            new("CurrentTenantID", "42")
        };
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        var controller = CreateController(user);

        var result = await controller.Index();

        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Equal("https://hub.test.com", redirect.Url);
    }

    [Fact]
    public async Task Index_MissingTenantId_Redirects()
    {
        var claims = new List<Claim>
        {
            new("StaffID", "1"),
            new("ContactID", "100"),
            new("Connection", "Server=test;")
        };
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        var controller = CreateController(user);

        var result = await controller.Index();

        Assert.IsType<RedirectResult>(result);
    }

    [Fact]
    public async Task Index_MissingSqlCredentials_RedirectsOnError()
    {
        Environment.SetEnvironmentVariable("SQLCredentials", null);
        Environment.SetEnvironmentVariable("PublicPath", "https://public.test.com");
        var user = CreateAuthenticatedUser();
        var controller = CreateController(user);

        var result = await controller.Index();

        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Equal("https://public.test.com", redirect.Url);
    }

    [Fact]
    public async Task Index_InvalidContactId_RedirectsOnError()
    {
        Environment.SetEnvironmentVariable("SQLCredentials", ";Password=test;");
        var claims = new List<Claim>
        {
            new("StaffID", "1"),
            new("ContactID", "not-a-number"),
            new("Connection", "Server=test;"),
            new("CurrentTenantID", "42"),
            new("CountryCode", "NZ"),
            new("TimeZone", "Pacific/Auckland")
        };
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        var controller = CreateController(user);

        var result = await controller.Index();

        Assert.IsType<RedirectResult>(result);
    }

    [Fact]
    public async Task Index_UsCountryCode_SetsIsUsTenantTrue()
    {
        Environment.SetEnvironmentVariable("SQLCredentials", ";Password=test;");
        var user = CreateAuthenticatedUser(countryCode: "US");
        var clientDetail = new ClientViewModel
        {
            FirstName = "John",
            FullName = "John Doe",
            Email = "john@test.com",
            Internal = false,
            StaffID = null
        };
        _clientRepoMock.ValidateClientAsync(100).Returns(clientDetail);
        _connectionStringManagerMock.SetConnectionStringAsync(Arg.Any<string>(), Arg.Any<string>())
            .Returns(Task.CompletedTask);

        var controller = CreateController(user);

        var result = await controller.Index();

        Assert.IsType<ViewResult>(result);
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

    public void Dispose()
    {
        Environment.SetEnvironmentVariable("SQLCredentials", _originalSqlCredentials);
        Environment.SetEnvironmentVariable("HubUrl", _originalHubUrl);
        Environment.SetEnvironmentVariable("PublicPath", _originalPublicPath);
        GC.SuppressFinalize(this);
    }
}
