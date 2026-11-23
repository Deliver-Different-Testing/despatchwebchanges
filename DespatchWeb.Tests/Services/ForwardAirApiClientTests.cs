using System.Net;
using System.Security.Claims;
using System.Text;
using DespatchWeb.Services;
using DespatchWeb.Tests.Helpers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class ForwardAirApiClientTests
{
    private readonly FakeHttpMessageHandler _handler = new();
    private readonly IHttpContextAccessor _httpContextAccessor = Substitute.For<IHttpContextAccessor>();
    private readonly IWebHostEnvironment _environment = Substitute.For<IWebHostEnvironment>();

    public ForwardAirApiClientTests()
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

    private ForwardAirApiClient CreateClient() =>
        new(new HttpClient(_handler), _httpContextAccessor, _environment);

    private static HttpResponseMessage Json(HttpStatusCode status, string body) =>
        new(status) {Content = new StringContent(body, Encoding.UTF8, "application/json")};

    [Fact]
    public async Task GetLegQuoteAsync_PostsToLegEndpoint_WithBearerToken_AndMapsServices()
    {
        _handler.SetResponse(Json(HttpStatusCode.OK, """
            {"success":true,"error":null,"services":[{"serviceCode":"T2T","serviceName":"Terminal to Terminal",
            "guaranteed":false,"originAirport":"BNA","destinationAirport":"EWR","shipDate":"2026-12-01T10:00:00",
            "originTimeZone":"America/Chicago","estimatedArrival":"2026-12-02T09:00:00",
            "destinationTimeZone":"America/New_York","quotedTotal":123.45,"quoteId":"Q1"}]}
            """));

        var result = await CreateClient().GetLegQuoteAsync(77, TestContext.Current.CancellationToken);

        var request = Assert.Single(_handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("https://im.example/api/v1/forwardair/quotes/leg/77", request.RequestUri!.ToString());
        Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
        Assert.False(string.IsNullOrEmpty(request.Headers.Authorization?.Parameter));
        Assert.True(result.Success);
        var service = Assert.Single(result.Services);
        Assert.Equal("T2T", service.ServiceCode);
        Assert.Equal("America/Chicago", service.OriginTimeZone);
        Assert.Equal(new DateTime(2026, 12, 1, 10, 0, 0), service.ShipDate);
        Assert.Equal(123.45m, service.QuotedTotal);
    }

    [Fact]
    public async Task GetLegQuoteAsync_NotConnected_ReturnsFailureWithError()
    {
        _handler.SetResponse(Json(HttpStatusCode.OK,
            """{"success":false,"error":"Forward Air is not connected","services":[]}"""));

        var result = await CreateClient().GetLegQuoteAsync(77, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Equal("Forward Air is not connected", result.Error);
    }

    [Fact]
    public async Task GetLegQuoteAsync_ServerError_ReturnsFailure_DoesNotThrow()
    {
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.BadGateway));

        var result = await CreateClient().GetLegQuoteAsync(77, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.False(string.IsNullOrEmpty(result.Error));
    }

    [Fact]
    public async Task GetLegQuoteAsync_DoesNotRetry_OnFailure()
    {
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));

        await CreateClient().GetLegQuoteAsync(77, TestContext.Current.CancellationToken);

        Assert.Single(_handler.Requests);
    }

    [Fact]
    public async Task GetLegQuoteAsync_CapsWholeCall_AndReturnsTimeoutFailure()
    {
        var client = new ForwardAirApiClient(new HttpClient(new HangingHandler()), _httpContextAccessor, _environment,
            TimeSpan.FromMilliseconds(50));

        var result = await client.GetLegQuoteAsync(77, TestContext.Current.CancellationToken);

        Assert.False(result.Success);
        Assert.Contains("did not respond", result.Error);
    }

    [Fact]
    public async Task GetLegQuoteAsync_CallerCancellation_Propagates()
    {
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new ForwardAirApiClient(new HttpClient(new HangingHandler()), _httpContextAccessor, _environment)
                .GetLegQuoteAsync(77, cts.Token));
    }

    [Fact]
    public async Task GetJobAsync_GetsJobView()
    {
        _handler.SetResponse(Json(HttpStatusCode.OK,
            """{"jobId":77,"status":"Booked","serviceLevel":"T2T","airbillNumber":"123456","lastStatusDescription":"Picked up"}"""));

        var result = await CreateClient().GetJobAsync(77, TestContext.Current.CancellationToken);

        Assert.Equal("https://im.example/api/v1/forwardair/jobs/77", _handler.Requests[0].RequestUri!.ToString());
        Assert.Equal("123456", result!.AirbillNumber);
        Assert.Equal("Booked", result.Status);
    }

    [Fact]
    public async Task GetJobAsync_NotFound_ReturnsNull()
    {
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.NotFound));

        Assert.Null(await CreateClient().GetJobAsync(77, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task GetJobAsync_ServerError_Throws()
    {
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.InternalServerError));

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            CreateClient().GetJobAsync(77, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task GetDocumentAsync_ReturnsStreamAndContentType()
    {
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new ByteArrayContent([1, 2, 3]) {Headers = {ContentType = new("application/pdf")}}
        });

        var doc = await CreateClient().GetDocumentAsync(77, "BOL", TestContext.Current.CancellationToken);

        Assert.Equal("https://im.example/api/v1/forwardair/jobs/77/documents/BOL",
            _handler.Requests[0].RequestUri!.ToString());
        Assert.Equal("application/pdf", doc!.ContentType);
        using var ms = new MemoryStream();
        await doc.Content.CopyToAsync(ms, TestContext.Current.CancellationToken);
        Assert.Equal([1, 2, 3], ms.ToArray());
    }

    [Fact]
    public async Task GetDocumentAsync_NotFound_ReturnsNull()
    {
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.NotFound));

        Assert.Null(await CreateClient().GetDocumentAsync(77, "BOL", TestContext.Current.CancellationToken));
    }

    private sealed class HangingHandler : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            await Task.Delay(Timeout.Infinite, ct);
            return new HttpResponseMessage();
        }
    }
}
