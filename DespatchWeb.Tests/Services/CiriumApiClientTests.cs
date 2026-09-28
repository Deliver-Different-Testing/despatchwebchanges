using System.Net;
using System.Security.Claims;
using System.Text;
using DespatchWeb.Models.Dto;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class CiriumApiClientTests
{
    private readonly FakeHttpMessageHandler _handler = new();
    private readonly IHttpContextAccessor _httpContextAccessor = Substitute.For<IHttpContextAccessor>();
    private readonly IWebHostEnvironment _environment = Substitute.For<IWebHostEnvironment>();

    public CiriumApiClientTests()
    {
        Environment.SetEnvironmentVariable("IntegrationManagerUrl", "https://im.example");
        Environment.SetEnvironmentVariable("JWTSecretKey", "0123456789abcdef0123456789abcdef");
        Environment.SetEnvironmentVariable("ClaimsKey", Convert.ToBase64String(new byte[32]));
        Environment.SetEnvironmentVariable("Issuer", "test-issuer");
        Environment.SetEnvironmentVariable("Audience", "test-audience");

        _environment.EnvironmentName.Returns("Development");

        var principal = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim("Connection", "conn-str"),
            new Claim("CurrentTenantID", "42"),
            new Claim("TimeZone", "New Zealand Standard Time"),
            new Claim(ClaimTypes.Name, "tester")
        ]));
        _httpContextAccessor.HttpContext.Returns(new DefaultHttpContext {User = principal});
    }

    private CiriumApiClient CreateClient() =>
        new(new HttpClient(_handler), _httpContextAccessor, _environment);

    [Fact]
    public async Task SearchFlightsAsync_PostsToGateway_WithBearerToken()
    {
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"flights":[],"message":"No flights found."}""", Encoding.UTF8, "application/json")
        });

        var result = await CreateClient().SearchFlightsAsync(new CiriumFlightSearchRequestDto {JobId = 1}, TestContext.Current.CancellationToken);

        Assert.Equal("No flights found.", result.Message);
        var request = Assert.Single(_handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Contains("/api/v1/admin/cirium/flight-search", request.RequestUri!.ToString());
        Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
        Assert.False(string.IsNullOrEmpty(request.Headers.Authorization?.Parameter));
    }

    [Fact]
    public async Task SearchFlightsAsync_ThrowsArgumentException_OnValidationError()
    {
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = new StringContent("""{"flights":[],"message":"Departure airport not found"}""", Encoding.UTF8, "application/json")
        });

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            CreateClient().SearchFlightsAsync(new CiriumFlightSearchRequestDto {JobId = 1}, TestContext.Current.CancellationToken));

        Assert.Contains("Departure airport not found", ex.Message);
    }

    [Fact]
    public async Task CreateAlertAsync_ReturnsRuleId_FromGateway()
    {
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"ruleId":"RULE-7"}""", Encoding.UTF8, "application/json")
        });

        var ruleId = await CreateClient().CreateAlertAsync(new CiriumCreateAlertRequestDto
        {
            CompleteFlightNumber = "NZ123",
            DepartureAirportCode = "AKL"
        }, TestContext.Current.CancellationToken);

        Assert.Equal("RULE-7", ruleId);
        Assert.Contains("/api/v1/admin/cirium/alerts", _handler.Requests[0].RequestUri!.ToString());
    }
}
