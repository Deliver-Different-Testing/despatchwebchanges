using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using DespatchWeb.Tests.Helpers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
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
    private readonly ITenantInfoService _tenantInfoService = Substitute.For<ITenantInfoService>();
    private readonly SqliteTestDatabase _db = new();

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
        _db.DisposeAsync().AsTask().GetAwaiter().GetResult();
        GC.SuppressFinalize(this);
    }

    private SendToPartnerService CreateService()
    {
        var httpClient = new HttpClient(_httpHandler);
        return new SendToPartnerService(httpClient, _httpContextAccessor, _environment,
            _db.CreateFactoryMock(), _tenantInfoService);
    }

    private static SendToPartnerRequest SampleRequest() =>
        new() { JobId = 42, PartnerId = 7, AgreedRate = 25.50m };

    private static StringContent JsonContent(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    // Seeds the pairing referenced by SampleRequest() (PartnerId = 7) so the
    // success path can resolve the partner name and persist the JobPartnerDispatch
    // link row keyed by JobId = 42.
    private async Task SeedPairingAsync(string partnerName = "Partner Co")
    {
        await using var ctx = _db.CreateContext();
        ctx.IntMgrPartnerPairings.Add(new IntMgrPartnerPairing
        {
            Id = 7,
            PartnerTenantId = "200",
            PartnerTenantName = partnerName,
            PartnerBaseUrl = "https://peer.example.com",
            Status = "Active",
            OwnerTenantId = "100",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        });

        await ctx.SaveChangesAsync();
    }

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
    public async Task SendAsync_OutgoingRequest_IncludesAllAuthHeaders()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent(new { success = true, trackingNumber = "TRK-1" })
        });

        await CreateService().SendAsync(SampleRequest());

        var sent = Assert.Single(_httpHandler.Requests);
        Assert.StartsWith("Bearer ", sent.Headers.GetValues("Authorization").First());
        Assert.Equal("XMLHttpRequest", sent.Headers.GetValues("X-Requested-With").First());
        // Fallback bearer header — proven necessary by AWS staging logs showing the
        // ingress strips the standard Authorization header before it reaches IM.
        Assert.StartsWith("Bearer ", sent.Headers.GetValues("X-IM-Authorization").First());
        Assert.Equal(
            sent.Headers.GetValues("Authorization").First(),
            sent.Headers.GetValues("X-IM-Authorization").First());
    }

    [Fact]
    public async Task GetRateForJobAsync_OutgoingRequest_IncludesAllAuthHeaders()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent(new { source = "none", liveQuotes = Array.Empty<object>() })
        });

        await CreateService().GetRateForJobAsync(7, 42);

        var sent = Assert.Single(_httpHandler.Requests);
        Assert.StartsWith("Bearer ", sent.Headers.GetValues("Authorization").First());
        Assert.Equal("XMLHttpRequest", sent.Headers.GetValues("X-Requested-With").First());
        Assert.StartsWith("Bearer ", sent.Headers.GetValues("X-IM-Authorization").First());
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
    public async Task SendAsync_ErrorStatusWithPlainTextBody_IncludesBodySnippetInMessage()
    {
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = new StringContent("Invalid request - missing required header",
                Encoding.UTF8, "text/plain")
        });

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Contains("400", result.Message);
        Assert.Contains("Invalid request - missing required header", result.Message);
    }

    [Fact]
    public async Task SendAsync_ErrorStatusWithLongBody_TruncatesSnippet()
    {
        var longBody = new string('x', 500);
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.InternalServerError)
        {
            Content = new StringContent(longBody, Encoding.UTF8, "text/plain")
        });

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Contains("…", result.Message);
        Assert.True(result.Message.Length < longBody.Length,
            "Long bodies should be truncated to keep the error message readable.");
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
        var service = new SendToPartnerService(
            new HttpClient(throwingHandler), _httpContextAccessor, _environment,
            _db.CreateFactoryMock(), _tenantInfoService);

        var result = await service.SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Equal("Could not reach Integration Manager", result.Message);
    }

    [Fact]
    public async Task SendAsync_TaskCanceledException_ReturnsTimeoutMessage()
    {
        var throwingHandler = new ThrowingHandler(new TaskCanceledException("timed out"));
        var service = new SendToPartnerService(
            new HttpClient(throwingHandler), _httpContextAccessor, _environment,
            _db.CreateFactoryMock(), _tenantInfoService);

        var result = await service.SendAsync(SampleRequest());

        Assert.False(result.Success);
        Assert.Equal("Integration Manager request timed out", result.Message);
    }

    [Fact]
    public async Task SendAsync_Success_InsertsJobPartnerDispatchRow()
    {
        // After IM accepts the dispatch, DispatchWeb persists the job→pairing link
        // so the job list can surface the partner name in the courier column.
        await SeedPairingAsync();
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent(new { success = true, trackingNumber = "TRK-1" })
        });

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.True(result.Success);
        await using var verifyCtx = _db.CreateContext();
        var link = await verifyCtx.JobPartnerDispatches
            .FirstOrDefaultAsync(d => d.JobId == 42, TestContext.Current.CancellationToken);
        Assert.NotNull(link);
        Assert.Equal(7, link.PartnerPairingId);
    }

    [Fact]
    public async Task SendAsync_PartnerFailure_DoesNotInsertDispatchRow()
    {
        // Partner rejected the handover — no local link row should be persisted.
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent(new { success = false, message = "Partner declined" })
        });

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.False(result.Success);
        await using var verifyCtx = _db.CreateContext();
        var linkCount = await verifyCtx.JobPartnerDispatches
            .CountAsync(TestContext.Current.CancellationToken);
        Assert.Equal(0, linkCount);
    }

    [Fact]
    public async Task SendAsync_Success_WritesPartnerDispatchJourneyEntry()
    {
        // Audit trail: a successful partner handover lands a journey row on the local job
        // so the dispatcher's journey timeline shows where the job went. NewCourierId is
        // null because partner-dispatched jobs no longer carry a local courier.
        await SeedPairingAsync();
        _tenantInfoService.GetStaffId().Returns(7);
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent(new { success = true, trackingNumber = "TRK-J1" })
        });

        var result = await CreateService().SendAsync(SampleRequest());

        Assert.True(result.Success);
        await using var verifyCtx = _db.CreateContext();
        var journey = await verifyCtx.JobDeliveryJourneys
            .Where(j => j.JobId == 42)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);
        Assert.NotNull(journey);
        Assert.Equal("JobUpdate", journey.ChangeType);
        Assert.Equal("partnerJobGuid", journey.FieldName);
        Assert.Equal("TRK-J1", journey.NewValue);
        Assert.Null(journey.NewCourierId);
        Assert.Equal(7, journey.StaffId);
        Assert.Equal("Staff", journey.UpdatedByType);
        Assert.Contains("TRK-J1", journey.Comments);
    }

    [Fact]
    public async Task SendAsync_PartnerFailure_DoesNotWriteJourneyEntry()
    {
        // No journey row when the partner rejected — the local state didn't change.
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent(new { success = false, message = "Partner declined" })
        });

        await CreateService().SendAsync(SampleRequest());

        await using var verifyCtx = _db.CreateContext();
        var journeyCount = await verifyCtx.JobDeliveryJourneys
            .CountAsync(TestContext.Current.CancellationToken);
        Assert.Equal(0, journeyCount);
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
