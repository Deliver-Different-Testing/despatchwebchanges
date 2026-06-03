using System.Net;
using System.Security.Claims;
using DespatchWeb.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Hosting;

namespace DespatchWeb.Tests.Middleware;

/// <summary>
/// Tests <see cref="ConnectedTenantRejectionMiddleware"/>. Per spec §3,
/// ClientTypeId == 6 (ConnectedTenant) must be rejected at the auth boundary
/// with 403 Forbidden — never reaches the query layer.
/// </summary>
public class ConnectedTenantRejectionMiddlewareTests
{
    private static IHost CreateTestHost(params Claim[] claims) =>
        new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.Configure(app =>
                {
                    // Stamp claims onto the request (simulating UseAuthentication output).
                    app.Use(async (context, next) =>
                    {
                        if (claims.Length > 0)
                        {
                            var identity = new ClaimsIdentity(claims, "TestAuth");
                            context.User = new ClaimsPrincipal(identity);
                        }
                        await next();
                    });

                    app.UseMiddleware<ConnectedTenantRejectionMiddleware>();

                    app.Run(async ctx =>
                    {
                        ctx.Response.StatusCode = 200;
                        await ctx.Response.WriteAsync("ok");
                    });
                });
            })
            .Start();

    [Fact]
    public async Task ConnectedTenantClaim_Returns403()
    {
        using var host = CreateTestHost(new Claim("ClientTypeId", "6"));
        var client = host.GetTestClient();

        var response = await client.GetAsync("/anything", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("1")]
    [InlineData("2")]
    [InlineData("3")]
    [InlineData("4")]
    [InlineData("5")]
    public async Task OtherClientTypes_PassThrough(string clientTypeId)
    {
        using var host = CreateTestHost(new Claim("ClientTypeId", clientTypeId));
        var client = host.GetTestClient();

        var response = await client.GetAsync("/anything", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task NoClientTypeClaim_PassesThrough()
    {
        // Pre-2026-06-03 cookies — claim absent. Don't reject; ScopeProvider will
        // resolve via the transitional DB fallback.
        using var host = CreateTestHost(new Claim(ClaimTypes.Name, "test"));
        var client = host.GetTestClient();

        var response = await client.GetAsync("/anything", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UnauthenticatedRequest_PassesThrough()
    {
        // Anonymous endpoints (login page, healthchecks) — middleware short-circuits
        // when no identity is present.
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/anything", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
