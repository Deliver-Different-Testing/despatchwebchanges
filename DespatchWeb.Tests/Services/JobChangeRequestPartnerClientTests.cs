using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for JobChangeRequestPartnerClient — mirrors SendToPartnerServiceTests because
/// the two services share the same JWT minting and proxy-fallback header contract with the
/// Integration Manager. Drift between them is a regression risk.
/// </summary>
public class JobChangeRequestPartnerClientTests : IDisposable
{
    private readonly FakeHttpMessageHandler _httpHandler = new();
    private readonly IHttpContextAccessor _httpContextAccessor = Substitute.For<IHttpContextAccessor>();
    private readonly IWebHostEnvironment _environment = Substitute.For<IWebHostEnvironment>();

    private readonly string? _originalJwtSecretKey;
    private readonly string? _originalClaimsKey;
    private readonly string? _originalIssuer;
    private readonly string? _originalAudience;
    private readonly string? _originalIntegrationManagerUrl;

    public JobChangeRequestPartnerClientTests()
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

        SetUser([
            new Claim(ClaimTypes.Name, "testuser"),
            new Claim("Connection", "TestConnection"),
            new Claim("CurrentTenantID", "1"),
            new Claim("TimeZone", "Pacific/Auckland")
        ]);
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

    private void SetUser(Claim[] claims)
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims));
        var httpContext = new DefaultHttpContext { User = user };
        _httpContextAccessor.HttpContext.Returns(httpContext);
    }

    private JobChangeRequestPartnerClient CreateClient(HttpMessageHandler? handler = null) =>
        new(new HttpClient(handler ?? _httpHandler), _httpContextAccessor, _environment);

    private static StringContent JsonContent(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    // --- ForwardCreateAsync ---------------------------------------------------------------

    [Fact]
    public async Task ForwardCreateAsync_Success_ReturnsSuccess()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK));

        var result = await CreateClient().ForwardCreateAsync(
            pairingId: 7,
            partnerJobGuid: Guid.NewGuid(),
            sourceRequestUuid: Guid.NewGuid(),
            fieldName: "PickupAddress",
            currentValue: "old",
            requestedValue: "new",
            reason: "Customer moved",
            approvalMode: "Manual",
            requiresCommercialRefresh: false,
            CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task ForwardCreateAsync_OutgoingRequest_HitsExpectedPath_AndIncludesAllAuthHeaders()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK));

        await CreateClient().ForwardCreateAsync(
            7, Guid.NewGuid(), Guid.NewGuid(), "PickupAddress",
            null, null, null, "Manual", false, CancellationToken.None);

        var sent = Assert.Single(_httpHandler.Requests);
        Assert.Equal("https://integrationmanager.test/api/v1/admin/partner/job-change-requests",
            sent.RequestUri!.ToString());
        Assert.Equal(HttpMethod.Post, sent.Method);
        Assert.StartsWith("Bearer ", sent.Headers.GetValues("Authorization").First());
        Assert.Equal("XMLHttpRequest", sent.Headers.GetValues("X-Requested-With").First());
        // Fallback bearer header — proven necessary by AWS staging logs showing the ingress
        // strips the standard Authorization header before it reaches I AM.
        Assert.StartsWith("Bearer ", sent.Headers.GetValues("X-IM-Authorization").First());
        Assert.Equal(
            sent.Headers.GetValues("Authorization").First(),
            sent.Headers.GetValues("X-IM-Authorization").First());
    }

    [Fact]
    public async Task ForwardCreateAsync_Body_IncludesAllFieldsAndPartnerTenantIdFromClaim()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK));
        var partnerJobGuid = Guid.NewGuid();
        var sourceUuid = Guid.NewGuid();

        await CreateClient().ForwardCreateAsync(
            pairingId: 9,
            partnerJobGuid: partnerJobGuid,
            sourceRequestUuid: sourceUuid,
            fieldName: "DeliveryAddress",
            currentValue: "old addr",
            requestedValue: "new addr",
            reason: "Customer moved",
            approvalMode: "AutoApprove",
            requiresCommercialRefresh: true,
            CancellationToken.None);

        var sent = Assert.Single(_httpHandler.Requests);
        var body = await sent.Content!.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        Assert.Equal(9, root.GetProperty("pairingId").GetInt32());
        Assert.Equal(partnerJobGuid, root.GetProperty("partnerJobGuid").GetGuid());
        Assert.Equal(sourceUuid, root.GetProperty("sourceRequestUuid").GetGuid());
        Assert.Equal("DeliveryAddress", root.GetProperty("fieldName").GetString());
        Assert.Equal("old addr", root.GetProperty("currentValue").GetString());
        Assert.Equal("new addr", root.GetProperty("requestedValue").GetString());
        Assert.Equal("Customer moved", root.GetProperty("reason").GetString());
        Assert.Equal("AutoApprove", root.GetProperty("approvalMode").GetString());
        Assert.True(root.GetProperty("requiresCommercialRefresh").GetBoolean());
        // partnerTenantId is the originator's tenant id, pulled from the CurrentTenantID claim.
        Assert.Equal("1", root.GetProperty("partnerTenantId").GetString());
    }

    // --- ForwardDecisionAsync -------------------------------------------------------------

    [Fact]
    public async Task ForwardDecisionAsync_Success_PathIncludesSourceUuid_AndBodyHasOutcome()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK));
        var sourceUuid = Guid.NewGuid();

        var result = await CreateClient()
            .ForwardDecisionAsync(7, sourceUuid, "Approved", "Looks good", CancellationToken.None);

        Assert.True(result.Success);
        var sent = Assert.Single(_httpHandler.Requests);
        Assert.Equal(
            $"https://integrationmanager.test/api/v1/admin/partner/job-change-requests/{sourceUuid}/decision",
            sent.RequestUri!.ToString());
        Assert.StartsWith("Bearer ", sent.Headers.GetValues("Authorization").First());
        Assert.StartsWith("Bearer ", sent.Headers.GetValues("X-IM-Authorization").First());

        var body = await sent.Content!.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(7, doc.RootElement.GetProperty("pairingId").GetInt32());
        Assert.Equal("Approved", doc.RootElement.GetProperty("outcome").GetString());
        Assert.Equal("Looks good", doc.RootElement.GetProperty("reason").GetString());
    }

    // --- ForwardAppliedAsync --------------------------------------------------------------

    [Fact]
    public async Task ForwardAppliedAsync_Success_PathIncludesSourceUuid_AndBodyHasNewAmount()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK));
        var sourceUuid = Guid.NewGuid();

        var result = await CreateClient()
            .ForwardAppliedAsync(7, sourceUuid, 250.75m, CancellationToken.None);

        Assert.True(result.Success);
        var sent = Assert.Single(_httpHandler.Requests);
        Assert.Equal(
            $"https://integrationmanager.test/api/v1/admin/partner/job-change-requests/{sourceUuid}/applied",
            sent.RequestUri!.ToString());

        var body = await sent.Content!.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(7, doc.RootElement.GetProperty("pairingId").GetInt32());
        Assert.Equal(250.75m, doc.RootElement.GetProperty("newCommercialAmount").GetDecimal());
    }

    [Fact]
    public async Task ForwardAppliedAsync_NullCommercialAmount_StillForwards()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK));

        var result = await CreateClient()
            .ForwardAppliedAsync(7, Guid.NewGuid(), null, CancellationToken.None);

        Assert.True(result.Success);
        var sent = Assert.Single(_httpHandler.Requests);
        var body = await sent.Content!.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("newCommercialAmount").ValueKind);
    }

    // --- Error handling -------------------------------------------------------------------

    [Fact]
    public async Task ForwardCreateAsync_NonSuccessStatus_ReturnsFailureWithStatusInMessage()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = JsonContent(new { error = "Invalid pairing" })
        });

        var result = await CreateClient().ForwardCreateAsync(
            7, Guid.NewGuid(), Guid.NewGuid(), "PickupAddress",
            null, null, null, "Manual", false, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("400", result.Message);
    }

    [Fact]
    public async Task ForwardCreateAsync_HttpRequestException_ReturnsReachabilityMessage()
    {
        var throwing = new ThrowingHandler(new HttpRequestException("connection refused"));

        var result = await CreateClient(throwing).ForwardCreateAsync(
            7, Guid.NewGuid(), Guid.NewGuid(), "PickupAddress",
            null, null, null, "Manual", false, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("Could not reach Integration Manager", result.Message);
    }

    [Fact]
    public async Task ForwardCreateAsync_TaskCanceledException_ReturnsTimeoutMessage()
    {
        var throwing = new ThrowingHandler(new TaskCanceledException("timed out"));

        var result = await CreateClient(throwing).ForwardCreateAsync(
            7, Guid.NewGuid(), Guid.NewGuid(), "PickupAddress",
            null, null, null, "Manual", false, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("Integration Manager request timed out", result.Message);
    }

    [Fact]
    public async Task ForwardCreateAsync_NoIntegrationManagerUrl_ReturnsNotConfiguredMessage()
    {
        Environment.SetEnvironmentVariable("IntegrationManagerUrl", null);

        var result = await CreateClient().ForwardCreateAsync(
            7, Guid.NewGuid(), Guid.NewGuid(), "PickupAddress",
            null, null, null, "Manual", false, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("Integration Manager is not configured", result.Message);
        Assert.Empty(_httpHandler.Requests);
    }

    [Fact]
    public async Task ForwardCreateAsync_MissingRequiredClaims_ReturnsAuthFailureMessage()
    {
        // Strip Connection/CurrentTenantID/TimeZone/Name — JWT minting cannot proceed.
        SetUser([new Claim("Unrelated", "x")]);

        var result = await CreateClient().ForwardCreateAsync(
            7, Guid.NewGuid(), Guid.NewGuid(), "PickupAddress",
            null, null, null, "Manual", false, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("Unable to authenticate with Integration Manager", result.Message);
        Assert.Empty(_httpHandler.Requests);
    }

    [Fact]
    public async Task ForwardDecisionAsync_NonSuccessStatus_ReturnsFailureWithStatusInMessage()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.NotFound));

        var result = await CreateClient()
            .ForwardDecisionAsync(7, Guid.NewGuid(), "Approved", null, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("404", result.Message);
    }

    [Fact]
    public async Task ForwardAppliedAsync_NonSuccessStatus_ReturnsFailureWithStatusInMessage()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.InternalServerError));

        var result = await CreateClient()
            .ForwardAppliedAsync(7, Guid.NewGuid(), 99m, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("500", result.Message);
    }

    private sealed class ThrowingHandler(Exception exception) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromException<HttpResponseMessage>(exception);
    }
}
