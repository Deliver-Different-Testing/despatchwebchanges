using System.Net;
using System.Security.Claims;
using System.Text;
using DespatchWeb.Services;
using DespatchWeb.Tests.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class PdfOverlayClientTests
{
    private readonly FakeHttpMessageHandler _handler = new();
    private readonly IHttpContextAccessor _httpContextAccessor = Substitute.For<IHttpContextAccessor>();

    private void SetTenant(string? tenantId)
    {
        var claims = tenantId is null ? [] : new[] { new Claim("CurrentTenantID", tenantId) };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims));
        _httpContextAccessor.HttpContext.Returns(new DefaultHttpContext { User = principal });
    }

    private static IConfiguration Config(string? baseUrl = "https://cfg.example", string? apiKey = "secret") =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["PdfOverlayBaseUrl"] = baseUrl,
            ["PdfOverlayRenderApiKey"] = apiKey,
        }).Build();

    private PdfOverlayClient CreateClient(IConfiguration config) =>
        new(new HttpClient(_handler), _httpContextAccessor, config);

    [Fact]
    public async Task ListJobDocumentsAsync_ReturnsParsedDocuments_OnSuccess()
    {
        SetTenant("42");
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                """[{"documentType":"Invoice","displayName":"Customer Invoice","available":true},{"documentType":"Manifest","displayName":"Delivery Manifest","available":false}]""",
                Encoding.UTF8, "application/json"),
        });

        var result = await CreateClient(Config()).ListJobDocumentsAsync(42, TestContext.Current.CancellationToken);

        Assert.NotNull(result);
        Assert.Equal(2, result!.Count);
        Assert.Equal("Invoice", result[0].DocumentType);
        Assert.Equal("Customer Invoice", result[0].DisplayName);
        Assert.True(result[0].Available);
        Assert.False(result[1].Available);
    }

    [Fact]
    public async Task ListJobDocumentsAsync_PostsToListJobEndpoint_WithApiKeyAndTenant()
    {
        SetTenant("42");
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("[]", Encoding.UTF8, "application/json"),
        });

        await CreateClient(Config()).ListJobDocumentsAsync(7, TestContext.Current.CancellationToken);

        var request = Assert.Single(_handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Contains("/api/pdf-overlay/list-job", request.RequestUri!.ToString());
        Assert.Equal("secret", request.Headers.GetValues("X-Api-Key").Single());
        var body = Assert.Single(_handler.RequestBodies);
        Assert.Contains("\"tenantId\":\"42\"", body);
        Assert.Contains("\"jobId\":7", body);
    }

    [Fact]
    public async Task ListJobDocumentsAsync_NotConfigured_ReturnsNullWithoutCalling()
    {
        SetTenant("42");

        var result = await CreateClient(Config(baseUrl: null))
            .ListJobDocumentsAsync(42, TestContext.Current.CancellationToken);

        Assert.Null(result);
        Assert.Empty(_handler.Requests);
    }

    [Fact]
    public async Task ListJobDocumentsAsync_NoTenant_ReturnsNullWithoutCalling()
    {
        SetTenant(null);

        var result = await CreateClient(Config()).ListJobDocumentsAsync(42, TestContext.Current.CancellationToken);

        Assert.Null(result);
        Assert.Empty(_handler.Requests);
    }

    [Fact]
    public async Task ListJobDocumentsAsync_NonSuccessStatus_ReturnsNull()
    {
        SetTenant("42");
        _handler.SetResponse(new HttpResponseMessage(HttpStatusCode.InternalServerError));

        var result = await CreateClient(Config()).ListJobDocumentsAsync(42, TestContext.Current.CancellationToken);

        Assert.Null(result);
    }
}
