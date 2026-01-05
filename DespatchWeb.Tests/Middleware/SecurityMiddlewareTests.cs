using System.Net;
using FluentAssertions;
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
    private static IHost CreateTestHost()
    {
        return new HostBuilder()
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
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com; " +
                            "frame-ancestors 'none';";

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

                    app.Map("/healthz", appBuilder =>
                    {
                        appBuilder.Run(async context =>
                        {
                            await context.Response.WriteAsync("Healthy");
                        });
                    });
                });
            })
            .Start();
    }

    #region CSRF Protection Tests

    [Fact]
    public async Task Post_WithoutXhrHeader_Returns400()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.PostAsync("/api/test", new StringContent(""));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("missing required header");
    }

    [Fact]
    public async Task Post_WithXhrHeader_Succeeds()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/test")
        {
            Content = new StringContent("")
        };
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");

        // Act
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Get_WithoutXhrHeader_Succeeds()
    {
        // Arrange - GET requests should not require the header
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task HealthCheck_WithoutXhrHeader_Succeeds()
    {
        // Arrange - /healthz is excluded from CSRF check
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act - POST to healthz without header
        var response = await client.PostAsync("/healthz", new StringContent(string.Empty));

        // Assert - Should succeed because healthz is excluded
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Put_WithoutXhrHeader_Returns400()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.PutAsync("/api/test", new StringContent(string.Empty));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Delete_WithoutXhrHeader_Returns400()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.DeleteAsync("/api/test");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Patch_WithoutXhrHeader_Returns400()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();
        var request = new HttpRequestMessage(HttpMethod.Patch, "/api/test")
        {
            Content = new StringContent("")
        };

        // Act
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region Security Headers Tests

    [Fact]
    public async Task Response_HasXContentTypeOptions()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test");

        // Assert
        response.Headers.Should().ContainKey("X-Content-Type-Options");
        response.Headers.GetValues("X-Content-Type-Options").Should().Contain("nosniff");
    }

    [Fact]
    public async Task Response_HasXFrameOptions()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test");

        // Assert
        response.Headers.Should().ContainKey("X-Frame-Options");
        response.Headers.GetValues("X-Frame-Options").Should().Contain("DENY");
    }

    [Fact]
    public async Task Response_HasXXSSProtection()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test");

        // Assert
        response.Headers.Should().ContainKey("X-XSS-Protection");
        response.Headers.GetValues("X-XSS-Protection").Should().Contain("1; mode=block");
    }

    [Fact]
    public async Task Response_HasReferrerPolicy()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test");

        // Assert
        response.Headers.Should().ContainKey("Referrer-Policy");
        response.Headers.GetValues("Referrer-Policy").Should().Contain("strict-origin-when-cross-origin");
    }

    [Fact]
    public async Task Response_HasStrictTransportSecurity()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test");

        // Assert
        response.Headers.Should().ContainKey("Strict-Transport-Security");
        var hstsValue = response.Headers.GetValues("Strict-Transport-Security").First();
        hstsValue.Should().Contain("max-age=31536000");
        hstsValue.Should().Contain("includeSubDomains");
    }

    [Fact]
    public async Task Response_HasContentSecurityPolicy()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test");

        // Assert
        response.Headers.Should().ContainKey("Content-Security-Policy");
        var cspValue = response.Headers.GetValues("Content-Security-Policy").First();
        cspValue.Should().Contain("default-src 'self'");
        cspValue.Should().Contain("frame-ancestors 'none'");
    }

    [Fact]
    public async Task Response_HasPermissionsPolicy()
    {
        // Arrange
        using var host = CreateTestHost();
        var client = host.GetTestClient();

        // Act
        var response = await client.GetAsync("/api/test");

        // Assert
        response.Headers.Should().ContainKey("Permissions-Policy");
        var permissionsValue = response.Headers.GetValues("Permissions-Policy").First();
        permissionsValue.Should().Contain("geolocation=(self)");
        permissionsValue.Should().Contain("microphone=()");
    }

    #endregion
}
