using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using DeliverDifferent.AgentAccess;
using DespatchWeb.Controllers;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Middleware;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using NSubstitute;

namespace DespatchWeb.Tests.Security;

public class AgentAccessTests : IAsyncDisposable
{
    private const string Hub = "https://hub.test.example";

    private readonly RsaSecurityKey _hubKey = new(RSA.Create(2048)) { KeyId = "k" };
    private readonly IConnectionStringManager _connections = Substitute.For<IConnectionStringManager>();
    private WebApplication? _app;

    private static IConfiguration Config(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.ToDictionary(v => v.Key, v => v.Value)).Build();

    [Fact]
    public void AgentAccess_IsOff_WithoutAHubUrl() =>
        Assert.Null(AuthServiceCollectionExtensions.AgentAccessOptionsFrom(Config(("HubUrl", null))));

    [Fact]
    public void AgentAccess_UsesThisTenantsHub_AndTheAppsOwnCredentials()
    {
        var options = AuthServiceCollectionExtensions.AgentAccessOptionsFrom(Config(
            ("HubUrl", "https://hub.urgent.example/"), ("PartnerDirectoryApiKey", "key"), ("SQLCredentials", "User ID=dw;")))!;

        Assert.Equal("DespatchWeb", options.AppName);
        Assert.Equal("https://hub.urgent.example/", options.HubAuthority);
        Assert.Equal("key", options.HubApiKey);
        Assert.Equal("User ID=dw;", options.SqlCredentials);
    }

    [Fact]
    public async Task WithoutAgentAccess_TheDefaultSchemeIsStillTheCookie()
    {
        var services = new ServiceCollection().AddLogging();
        services.AddAppAuthentication("localhost");
        var schemes = services.BuildServiceProvider().GetRequiredService<IAuthenticationSchemeProvider>();

        Assert.Equal("Identity.Application", (await schemes.GetDefaultAuthenticateSchemeAsync())!.Name);
        Assert.Null(await schemes.GetSchemeAsync(AgentTokenAuthentication.Scheme));
    }

    [Fact]
    public async Task TheConnectionStore_UsesThisAppsOwnCacheKey()
    {
        var store = new AgentTenantConnectionStore(_connections);
        _connections.GetConnectionStringAsync(TenantConnectionCache.Key("7")).Returns("Server=db;");

        Assert.True(await store.HasAsync(7));
        Assert.False(await store.HasAsync(8));
        await store.SetAsync(9, "Server=db9;");
        await _connections.Received(1).SetConnectionStringAsync(TenantConnectionCache.Key("9"), "Server=db9;");
    }

    [Fact]
    public async Task Context_ForAnAgent_ReturnsTheContextWithoutReseedingTheConnection()
    {
        var sessions = Substitute.For<ISessionContextService>();
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("auth_kind", "agent"), new Claim("CurrentTenantID", "7"), new Claim("ContactID", "1")], "AgentToken"));
        var dto = new SessionContextDto(1, 2, "A", "A B", "a@b.c", null, "Pacific/Auckland", "NZ", false, "NZD", false, false, null, null, null);
        sessions.BuildAsync(user).Returns(dto);
        var controller = new ContextController(sessions, _connections)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } }
        };

        var result = await controller.Get();

        Assert.Equal(dto, Assert.IsType<OkObjectResult>(result).Value);
        await _connections.DidNotReceiveWithAnyArgs().SetConnectionStringAsync(default!, default!);
    }

    private async Task<HttpClient> Server(IDistributedCache cache)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton(Options.Create(new AppSettings { PublicPath = "https://hub.test/" }));
        builder.Services.AddSingleton(cache);
        builder.Services.AddSingleton(_connections);
        builder.Services.AddAppAuthentication("localhost", new AgentAccessOptions
        {
            AppName = "DespatchWeb", HubAuthority = Hub, HubApiKey = "key", SqlCredentials = "User ID=dw;"
        });
        builder.Services.PostConfigure<JwtBearerOptions>(AgentTokenAuthentication.Scheme, o =>
        {
            var config = new OpenIdConnectConfiguration { Issuer = Hub + "/" };
            config.SigningKeys.Add(_hubKey);
            o.Configuration = config;
            o.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(config);
        });
        builder.Services.AddAuthorization();
        _app = builder.Build();
        _app.UseMiddleware<CsrfProtectionMiddleware>();
        _app.UseAuthentication();
        _app.UseAuthorization();
        _app.Map("/{**rest}", (HttpContext c) => Results.Text(c.User.FindFirst("StaffID")?.Value ?? "none")).RequireAuthorization();
        await _app.StartAsync();
        return _app.GetTestClient();
    }

    private string Token() => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Issuer = Hub + "/",
        Audience = "dfrnt-apps",
        Expires = DateTime.UtcNow.AddMinutes(15),
        Subject = new ClaimsIdentity([
            new Claim("sub", "u1"), new Claim("CurrentTenantID", "7"), new Claim("StaffID", "42"), new Claim("ClientTypeId", "4"),
            new Claim("grant_id", "g1"), new Claim("scope", "read"), new Claim("auth_kind", "agent")
        ]),
        SigningCredentials = new SigningCredentials(_hubKey, SecurityAlgorithms.RsaSha256)
    });

    private static IDistributedCache Cache(bool grantLive)
    {
        var cache = new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));
        if (grantLive) cache.Set("agent-grant:g1", [1]);
        return cache;
    }

    private async Task<HttpResponseMessage> Send(HttpClient client, string method, string path, string? bearer)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), path);
        if (bearer is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return await client.SendAsync(request);
    }

    [Fact]
    public async Task AnAgentRead_RunsAsTheUser()
    {
        _connections.GetConnectionStringAsync(TenantConnectionCache.Key("7")).Returns("Server=db;");
        var response = await Send(await Server(Cache(grantLive: true)), "GET", "/Job/Index", Token());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("42", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task AnAgentRead_OfJobDetail_IsForbidden_BecauseItMarksTheJobRead()
    {
        _connections.GetConnectionStringAsync(TenantConnectionCache.Key("7")).Returns("Server=db;");
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(await Server(Cache(grantLive: true)), "GET", "/job/Detail/5", Token())).StatusCode);
    }

    [Fact]
    public async Task ARevokedGrant_IsUnauthorized() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(await Server(Cache(grantLive: false)), "GET", "/Job/Index", Token())).StatusCode);

    [Fact]
    public async Task ACookieStyleRequest_WithABogusBearer_StillHitsCsrf()
    {
        var response = await Send(await Server(Cache(grantLive: true)), "POST", "/Job/Save", "not-a-jwt");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task WithoutABearer_TheCookieChallengeIsUnchanged()
    {
        var response = await Send(await Server(Cache(grantLive: true)), "GET", "/Job/Index", null);
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("https://hub.test/", response.Headers.Location!.ToString());
    }

    public async ValueTask DisposeAsync()
    {
        if (_app is not null) await _app.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}
