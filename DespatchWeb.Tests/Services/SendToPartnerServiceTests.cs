using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for SendToPartnerService - verifies HTTP error handling so failures surface
/// a specific reason instead of bubbling exceptions to the controller's generic catch-all.
/// </summary>
public class SendToPartnerServiceTests : IDisposable
{
    private readonly FakeHttpMessageHandler _httpHandler = new();
    private readonly IHttpContextAccessor _httpContextAccessor = Substitute.For<IHttpContextAccessor>();
    private readonly IWebHostEnvironment _environment = Substitute.For<IWebHostEnvironment>();

    private readonly string? _originalJwtSecretKey;
    private readonly string? _originalClaimsKey;
    private readonly string? _originalIssuer;
    private readonly string? _originalAudience;
    private readonly string? _originalIntegrationManagerUrl;

    public SendToPartnerServiceTests()
    {
        _originalJwtSecretKey = Environment.GetEnvironmentVariable("JWTSecretKey");
        _originalClaimsKey = Environment.GetEnvironmentVariable("ClaimsKey");
        _originalIssuer = Environment.GetEnvironmentVariable("Issuer");
        _originalAudience = Environment.GetEnvironmentVariable("Audience");
        _originalIntegrationManagerUrl = Environment.GetEnvironmentVariable("IntegrationManagerUrl");

        Environment.SetEnvironmentVariable("JWTSecretKey", new string('k', 32));
        Environment.SetEnvironmentVariable("ClaimsKey", Convert.ToBase64String(new byte[32]));
        Environment.SetEnvironmentVariable("Issuer", "TestIssuer");
        Environment.SetEnvironmentVariable("Audience", "TestAudience");
        Environment.SetEnvironmentVariable("IntegrationManagerUrl", "https://integrationmanager.test");

        _environment.EnvironmentName.Returns(Environments.Development);

        var user = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.Name, "testuser"),
            new Claim("Connection", "TestConnection"),
            new Claim("CurrentTenantID", "1"),
            new Claim("TimeZone", "Pacific/Auckland")
        ]));
        var httpContext = new DefaultHttpContext { User = user };
        _httpContextAccessor.HttpContext.Returns(httpContext);
    }

    public void Dispose()
    {
        Environment.SetEnvironmentVariable("JWTSecretKey", _originalJwtSecretKey);
        Environment.SetEnvironmentVariable("ClaimsKey", _originalClaimsKey);
        Environment.SetEnvironmentVariable("Issuer", _originalIssuer);
        Environment.SetEnvironmentVariable("Audience", _originalAudience);
        Environment.SetEnvironmentVariable("IntegrationManagerUrl", _originalIntegrationManagerUrl);
        GC.SuppressFinalize(this);
    }

    private SendToPartnerService CreateService()
    {
        var httpClient = new HttpClient(_httpHandler);
        return new SendToPartnerService(httpClient, _httpContextAccessor, _environment);
    }

    private static SendToPartnerRequest SampleRequest() =>
        new() { JobId = 42, PartnerId = 7, AgreedRate = 25.50m };

    private static StringContent JsonContent(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    [Fact]
    public async Task SendAsync_OkWithSuccessTrue_ReturnsSuccessAndTrackingNumber()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent(new { success = true, trackingNumber = "TRK-123" })
        });

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.True(result.Success);
        Assert.Equal("TRK-123", result.TrackingNumber);
    }

    [Fact]
    public async Task SendAsync_OkWithSuccessFalse_PropagatesPartnerMessage()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent(new { success = false, message = "Partner declined" })
        });

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Equal("Partner declined", result.Message);
    }

    [Fact]
    public async Task SendAsync_ErrorStatusWithJsonBody_PropagatesPartnerMessage()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = JsonContent(new { success = false, message = "Invalid pairing" })
        });

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Equal("Invalid pairing", result.Message);
    }

    [Fact]
    public async Task SendAsync_ErrorStatusWithHtmlBody_ReturnsStatusCodeMessage()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.BadGateway)
        {
            Content = new StringContent("<html><body>502 Bad Gateway</body></html>", Encoding.UTF8, "text/html")
        });

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Contains("502", result.Message);
    }

    [Fact]
    public async Task SendAsync_OkWithEmptyBody_ReturnsInvalidResponseMessage()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(string.Empty, Encoding.UTF8, "application/json")
        });

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Equal("Invalid response from Integration Manager", result.Message);
    }

    [Fact]
    public async Task SendAsync_HttpRequestException_ReturnsReachabilityMessage()
    {
        var throwingHandler = new ThrowingHandler(new HttpRequestException("connection refused"));
        var service = new SendToPartnerService(new HttpClient(throwingHandler), _httpContextAccessor, _environment);

        var result = await service.SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Equal("Could not reach Integration Manager", result.Message);
    }

    [Fact]
    public async Task SendAsync_TaskCanceledException_ReturnsTimeoutMessage()
    {
        var throwingHandler = new ThrowingHandler(new TaskCanceledException("timed out"));
        var service = new SendToPartnerService(new HttpClient(throwingHandler), _httpContextAccessor, _environment);

        var result = await service.SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Equal("Integration Manager request timed out", result.Message);
    }

    [Fact]
    public async Task SendAsync_NoIntegrationManagerUrl_ReturnsNotConfiguredMessage()
    {
        Environment.SetEnvironmentVariable("IntegrationManagerUrl", null);

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Equal("Integration Manager is not configured", result.Message);
    }

    private sealed class ThrowingHandler(Exception exception) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromException<HttpResponseMessage>(exception);
    }
}
