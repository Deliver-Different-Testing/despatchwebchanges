using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Hosting;

namespace DespatchWeb.Tests.Middleware;

/// <summary>
/// Tests for the security middleware added in the bug-fixes branch.
/// These test the CSRF protection and security headers middleware in isolation.
/// </summary>
public class SecurityMiddlewareTests
{
    /// <summary>
    /// Creates a test server with the security middleware configured.
    /// </summary>
    private static IHost CreateTestHost() =>
        new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.Configure(app =>
                {
                    // CSRF protection middleware (from Program.cs)
                    app.Use(async (context, next) =>
                    {
                        var method = context.Request.Method;
                        var isStateChangingRequest = method is "POST" or "PUT" or "PATCH" or "DELETE";

                        if (isStateChangingRequest && !context.Request.Path.StartsWithSegments("/healthz"))
                        {
                            var hasXhrHeader = context.Request.Headers.XRequestedWith == "XMLHttpRequest";
                            if (!hasXhrHeader)
                            {
                                context.Response.StatusCode = 400;
                                await context.Response.WriteAsync("Invalid request - missing required header");
                                return;
                            }
                        }

                        await next();
                    });

                    // Security headers middleware (from Program.cs)
                    app.Use(async (context, next) =>
                    {
                        var headers = context.Response.Headers;
                        headers.XContentTypeOptions = "nosniff";
                        headers.XFrameOptions = "DENY";
                        headers.XXSSProtection = "1; mode=block";
                        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                        headers["Permissions-Policy"] = "geolocation=(self), microphone=()";
                        headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains";
                        headers.ContentSecurityPolicy =
                            "default-src 'self'; " +
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.api.here.com; " +
                            "img-src 'self' data: blob: https:; " +
                            "frame-ancestors 'none'; " +
                            "frame-src 'none'; " +
                            "object-src 'none'; " +
                            "worker-src 'self' blob:; " +
                            "upgrade-insecure-requests;";

                        await next();
                    });

                    // Simple endpoint for testing
                    app.Map("/api/test", appBuilder =>
                    {
                        appBuilder.Run(async context =>
                        {
                            context.Response.ContentType = "application/json";
                            await context.Response.WriteAsync("{\"success\": true}");
                        });
                    });

                    app.Map("/healthz",
                        appBuilder =>
                        {
                            appBuilder.Run(async context => { await context.Response.WriteAsync("Healthy"); });
                        });
                });
            })
            .Start();

    [Fact]
    public async Task Post_WithoutXhrHeader_Returns400()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response =
            await client.PostAsync("/api/test", new StringContent(""), TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.Contains("missing required header", content);
    }

    [Fact]
    public async Task Post_WithXhrHeader_Succeeds()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/test")
        {
            Content = new StringContent(string.Empty)
        };
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");

        // Act
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Get_WithoutXhrHeader_Succeeds()
    {
        // Arrange - GET requests should not require the header
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test", TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task HealthCheck_WithoutXhrHeader_Succeeds()
    {
        // Arrange - /healthz is excluded from CSRF check
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act - POST to healthz without header
        var response = await client.PostAsync("/healthz", new StringContent(string.Empty),
            TestContext.Current.CancellationToken);

        // Assert - Should succeed because healthz is excluded
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Put_WithoutXhrHeader_Returns400()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.PutAsync("/api/test", new StringContent(string.Empty),
            TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Delete_WithoutXhrHeader_Returns400()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.DeleteAsync("/api/test", TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Patch_WithoutXhrHeader_Returns400()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();
        var request = new HttpRequestMessage(HttpMethod.Patch, "/api/test")
        {
            Content = new StringContent(string.Empty)
        };

        // Act
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Response_HasXContentTypeOptions()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test", TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains(response.Headers, h => h.Key == "X-Content-Type-Options");
        Assert.Contains("nosniff", response.Headers.GetValues("X-Content-Type-Options"));
    }

    [Fact]
    public async Task Response_HasXFrameOptions()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test", TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains(response.Headers, h => h.Key == "X-Frame-Options");
        Assert.Contains("DENY", response.Headers.GetValues("X-Frame-Options"));
    }

    [Fact]
    public async Task Response_HasXXSSProtection()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test", TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains(response.Headers, h => h.Key == "X-XSS-Protection");
        Assert.Contains("1; mode=block", response.Headers.GetValues("X-XSS-Protection"));
    }

    [Fact]
    public async Task Response_HasReferrerPolicy()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test", TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains(response.Headers, h => h.Key == "Referrer-Policy");
        Assert.Contains("strict-origin-when-cross-origin", response.Headers.GetValues("Referrer-Policy"));
    }

    [Fact]
    public async Task Response_HasStrictTransportSecurity()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test", TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains(response.Headers, h => h.Key == "Strict-Transport-Security");
        var hstsValue = response.Headers.GetValues("Strict-Transport-Security").First();
        Assert.Contains("max-age=31536000", hstsValue);
        Assert.Contains("includeSubDomains", hstsValue);
    }

    [Fact]
    public async Task Response_HasContentSecurityPolicy()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test", TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains(response.Headers, h => h.Key == "Content-Security-Policy");
        var cspValue = response.Headers.GetValues("Content-Security-Policy").First();
        Assert.Contains("default-src 'self'", cspValue);
        Assert.Contains("frame-ancestors 'none'", cspValue);
        Assert.Contains("object-src 'none'", cspValue); // Prevents Flash/plugin attacks
        Assert.Contains("frame-src 'none'", cspValue); // Prevents iframe embedding
        Assert.Contains("upgrade-insecure-requests", cspValue); // Forces HTTPS
    }

    [Fact]
    public async Task Response_CspBlocksInsecureImages()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test", TestContext.Current.CancellationToken);

        // Assert - img-src should only allow https:, not http:
        var cspValue = response.Headers.GetValues("Content-Security-Policy").First();
        Assert.Contains("img-src 'self' data: blob: https:", cspValue);
        Assert.DoesNotContain("img-src 'self' data: blob: https: http:", cspValue);
    }

    [Fact]
    public async Task Response_HasPermissionsPolicy()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test", TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains(response.Headers, h => h.Key == "Permissions-Policy");
        var permissionsValue = response.Headers.GetValues("Permissions-Policy").First();
        Assert.Contains("geolocation=(self)", permissionsValue);
        Assert.Contains("microphone=()", permissionsValue);
    }

}
