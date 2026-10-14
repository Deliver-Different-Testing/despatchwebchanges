using System.Security.Claims;
using DespatchWeb.Controllers;
using DespatchWeb.Extensions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

public class ContextControllerTests : IDisposable
{
    private readonly ISessionContextService _context = Substitute.For<ISessionContextService>();
    private readonly IConnectionStringManager _connections = Substitute.For<IConnectionStringManager>();
    private readonly string? _originalCredentials = Environment.GetEnvironmentVariable("SQLCredentials");
    private readonly string? _originalHubUrl = Environment.GetEnvironmentVariable("HubUrl");

    public ContextControllerTests() => Environment.SetEnvironmentVariable("SQLCredentials", ";Password=x;");

    public void Dispose()
    {
        Environment.SetEnvironmentVariable("SQLCredentials", _originalCredentials);
        Environment.SetEnvironmentVariable("HubUrl", _originalHubUrl);
    }

    private ContextController CreateController(ClaimsPrincipal user) => new(_context, _connections)
    {
        ControllerContext = new ControllerContext {HttpContext = new DefaultHttpContext {User = user}}
    };

    private static ClaimsPrincipal User(bool withTenant = true) =>
        new(new ClaimsIdentity(withTenant
            ?
            [
                new Claim("Connection", "Server=t;"), new Claim("CurrentTenantID", "42"), new Claim("ContactID", "1")
            ]
            : [new Claim("ContactID", "1")], "TestAuth"));

    private static SessionContextDto Dto() =>
        new(1, 2, "A", "A B", "a@b.c", null, "Pacific/Auckland", "NZ", false, "NZD", false, false, null, null, null);

    [Fact]
    public async Task Get_ReturnsContext_AndSetsTenantConnection()
    {
        var user = User();
        _context.BuildAsync(user).Returns(Dto());

        var result = await CreateController(user).Get();

        Assert.Equal(Dto(), Assert.IsType<OkObjectResult>(result).Value);
        await _connections.Received(1).SetConnectionStringAsync(Arg.Any<string>(), "Server=t;;Password=x;");
    }

    [Fact]
    public async Task Get_MissingTenantClaims_Returns401WithHubRedirectHeader()
    {
        Environment.SetEnvironmentVariable("HubUrl", "https://hub.test/");
        var controller = CreateController(User(withTenant: false));

        var result = await controller.Get();

        Assert.Equal(StatusCodes.Status401Unauthorized, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Equal("https://hub.test/", controller.Response.Headers[AuthServiceCollectionExtensions.AuthRedirectHeader]);
        await _context.DidNotReceiveWithAnyArgs().BuildAsync(default!);
    }

    [Fact]
    public async Task Get_Failure_Returns500WithoutLeakingDetail()
    {
        var originalEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production");
        _context.BuildAsync(Arg.Any<ClaimsPrincipal>()).ThrowsAsync(new InvalidOperationException("secret detail"));

        var result = await CreateController(User()).Get();
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", originalEnv);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status500InternalServerError, obj.StatusCode);
        Assert.DoesNotContain("secret detail", obj.Value!.ToString());
    }

    [Theory]
    [InlineData("/api/context", 401)]
    [InlineData("/Home/Index", 302)]
    public async Task Challenge_OnlyTheContextEndpointGets401InsteadOfARedirect(string path, int expectedStatus)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(Options.Create(new AppSettings {PublicPath = "https://hub.test/"}));
        services.AddAppAuthentication("localhost");
        var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get("Identity.Application");
        var http = new DefaultHttpContext {RequestServices = provider};
        http.Request.Path = path;

        await options.Events.OnRedirectToLogin(new RedirectContext<CookieAuthenticationOptions>(
            http, new AuthenticationScheme("Identity.Application", null, typeof(CookieAuthenticationHandler)),
            options, new AuthenticationProperties(), "/login"));

        Assert.Equal(expectedStatus, http.Response.StatusCode);
        Assert.Equal("https://hub.test/", expectedStatus == 401
            ? http.Response.Headers[AuthServiceCollectionExtensions.AuthRedirectHeader]
            : http.Response.Headers.Location);
    }
}
