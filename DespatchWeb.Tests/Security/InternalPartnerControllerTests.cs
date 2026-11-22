using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DeliverDifferent.AgentAccess;
using DespatchWeb.Controllers;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Middleware;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using NSubstitute;

namespace DespatchWeb.Tests.Security;

/// <summary>
/// The internal/partner/* routes Integration Manager calls with its Kubernetes service-account token: partner change
/// requests relayed from the peer, and ending a hand-off (unlink, release on revoke).
/// </summary>
public class InternalPartnerControllerTests : IAsyncDisposable
{
    private const string Hub = "https://hub.test.example";
    private const string Cluster = "https://oidc.eks.test.example/id/ABC";
    private const string Sub = "system:serviceaccount:integration-manager-788-urgent-staging:integrationmanager";

    private readonly RsaSecurityKey _clusterKey = new(RSA.Create(2048)) { KeyId = "c" };
    private readonly IConnectionStringManager _connections = Substitute.For<IConnectionStringManager>();
    private readonly IJobChangeRequestService _changeRequests = Substitute.For<IJobChangeRequestService>();
    private readonly IPartnerJobLinkService _links = Substitute.For<IPartnerJobLinkService>();
    private WebApplication? _app;

    public InternalPartnerControllerTests() =>
        _connections.GetConnectionStringAsync(TenantConnectionCache.Key("1")).Returns("Server=db;");

    private async Task<HttpClient> Server()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton(Microsoft.Extensions.Options.Options.Create(new AppSettings { PublicPath = "https://hub.test/" }));
        builder.Services.AddSingleton<IDistributedCache>(
            new MemoryDistributedCache(Microsoft.Extensions.Options.Options.Create(new MemoryDistributedCacheOptions())));
        builder.Services.AddSingleton(_connections);
        builder.Services.AddSingleton(_changeRequests);
        builder.Services.AddSingleton(_links);
        builder.Services.AddSingleton(Substitute.For<IDispatchJobService>());
        builder.Services.AddSingleton(Substitute.For<IAgentClaimsEnricher>());
        builder.Services.AddSingleton(Substitute.For<IAgentCapabilitySource>());
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddAppAuthentication("localhost",
            new AgentAccessOptions { AppName = "DespatchWeb", HubAuthority = Hub, HubApiKey = "key", SqlCredentials = "User ID=dw;" },
            new VoiceAgentAssignOptions([Sub], Cluster));
        builder.Services.AddHttpClient(HubTenantTimeZoneSource.HttpClientName)
            .ConfigurePrimaryHttpMessageHandler(() => new VoiceAgentAssignTests.StubHandler());
        builder.Services.AddHttpClient(HubTenantConnectionSource.HttpClientName)
            .ConfigurePrimaryHttpMessageHandler(() => new VoiceAgentAssignTests.CountingHandler { Fail = true });
        builder.Services.PostConfigure<JwtBearerOptions>(VoiceAgentAssignAuthentication.Scheme, o =>
        {
            var config = new OpenIdConnectConfiguration { Issuer = Cluster };
            config.SigningKeys.Add(_clusterKey);
            o.Configuration = config;
            o.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(config);
        });
        builder.Services.PostConfigure<CookieAuthenticationOptions>("Identity.Application",
            o => o.TicketDataFormat = new VoiceAgentAssignTests.StubTicketFormat());
        builder.Services.AddControllers()
            .AddApplicationPart(typeof(InternalPartnerController).Assembly)
            .AddNewtonsoftJson(o => NewtonsoftSettings.Apply(o.SerializerSettings));
        _app = builder.Build();
        _app.UseMiddleware<CsrfProtectionMiddleware>();
        _app.UseRouting();
        _app.UseAuthentication();
        _app.UseAgentRouteAllowList();
        _app.UseConnectedTenantRejection();
        _app.UseAuthorization();
        _app.MapControllers();
        await _app.StartAsync();
        return _app.GetTestClient();
    }

    private string ClusterToken() =>
        new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = Cluster,
            Audience = "despatchweb",
            Expires = DateTime.UtcNow.AddMinutes(10),
            Subject = new ClaimsIdentity([new Claim("sub", Sub)]),
            SigningCredentials = new SigningCredentials(_clusterKey, SecurityAlgorithms.RsaSha256)
        });

    private async Task<HttpResponseMessage> Post(string path, string body, bool token = true, string? cookie = null, bool csrfHeader = false,
        string? pairingHeader = null)
    {
        var client = await Server();
        var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        if (token) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ClusterToken());
        request.Headers.Add("X-Tenant-Id", "1");
        if (cookie is not null) request.Headers.Add("Cookie", cookie);
        if (csrfHeader) request.Headers.Add("X-Requested-With", "XMLHttpRequest");
        if (pairingHeader is not null) request.Headers.Add("X-Partner-Pairing-Id", pairingHeader);
        return await client.SendAsync(request);
    }

    private static readonly Guid PartnerJobGuid = Guid.Parse("6457fbd8-8c8c-4dca-ab18-b2415d32a784");
    private static readonly Guid SourceUuid = Guid.Parse("87afd7b9-7bf3-44d8-9d85-f818c64dda74");

    private static readonly string PeerCreateBody =
        $$"""{"partnerJobGuid":"{{PartnerJobGuid}}","sourceRequestUuid":"{{SourceUuid}}","fieldName":"Quantity","requestedValue":"2","approvalMode":"Manual","partnerTenantId":"8"}""";

    [Fact]
    public async Task APeerChangeRequest_WithTheServiceAccount_IsRecorded_WithoutTheCsrfHeader()
    {
        _changeRequests.RecordPeerCreateAsync(default!, default).ReturnsForAnyArgs(new JobChangeRequestResult { Success = true });

        var response = await Post("/internal/partner/job-change-requests", PeerCreateBody);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _changeRequests.Received(1).RecordPeerCreateAsync(
            Arg.Is<PeerInboundChangeRequestPayload>(p => p.PartnerJobGuid == PartnerJobGuid && p.SourceRequestUuid == SourceUuid
                                                         && p.FieldName == "Quantity" && p.RequestedValue == "2"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ThePairingIMAuthenticated_OverridesWhateverTheBodyClaims()
    {
        _changeRequests.RecordPeerCreateAsync(default!, default).ReturnsForAnyArgs(new JobChangeRequestResult { Success = true });
        _changeRequests.RecordPeerAppliedAsync(default, default!, default, default).ReturnsForAnyArgs(new JobChangeRequestResult { Success = true });
        var bodyClaimingPairing9 = PeerCreateBody.Replace("}", ",\"pairingId\":9}");

        await Post("/internal/partner/job-change-requests", bodyClaimingPairing9, pairingHeader: "6");
        await Post($"/internal/partner/job-change-requests/{SourceUuid}/applied", "{}", pairingHeader: "6");

        await _changeRequests.Received(1).RecordPeerCreateAsync(Arg.Is<PeerInboundChangeRequestPayload>(p => p.PairingId == 6),
            Arg.Any<CancellationToken>());
        await _changeRequests.Received(1).RecordPeerAppliedAsync(SourceUuid, Arg.Any<PeerInboundChangeAppliedPayload>(), 6,
            Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(true, HttpStatusCode.NotFound)]
    [InlineData(false, HttpStatusCode.UnprocessableEntity)]
    public async Task ARefusedPeerChangeRequest_SaysWhetherItWasMissingOrRejected(bool notFound, HttpStatusCode expected)
    {
        _changeRequests.RecordPeerCreateAsync(default!, default)
            .ReturnsForAnyArgs(new JobChangeRequestResult { Success = false, NotFound = notFound, Message = "why" });

        var response = await Post("/internal/partner/job-change-requests", PeerCreateBody);

        Assert.Equal(expected, response.StatusCode);
        Assert.Contains("why", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task APeerDecision_IsRecordedAgainstItsSourceRequest()
    {
        _changeRequests.RecordPeerDecisionAsync(default, default!, default, default).ReturnsForAnyArgs(new JobChangeRequestResult { Success = true });

        var response = await Post($"/internal/partner/job-change-requests/{SourceUuid}/decision", """{"outcome":"Cancelled"}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _changeRequests.Received(1).RecordPeerDecisionAsync(SourceUuid,
            Arg.Is<PeerInboundChangeDecisionPayload>(p => p.Outcome == "Cancelled"), null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task APeerApplied_IsRecordedAgainstItsSourceRequest()
    {
        _changeRequests.RecordPeerAppliedAsync(default, default!, default, default).ReturnsForAnyArgs(new JobChangeRequestResult { Success = true });

        var response = await Post($"/internal/partner/job-change-requests/{SourceUuid}/applied", "{}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _changeRequests.Received(1).RecordPeerAppliedAsync(SourceUuid, Arg.Any<PeerInboundChangeAppliedPayload>(), null,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ARefusedAgentChangeRequest_IsUnprocessable()
    {
        _changeRequests.RecordAgentCreateAsync(default!, default)
            .ReturnsForAnyArgs(new AgentInboundChangeRequestResult { Success = false, Message = "no such job" });

        var response = await Post("/internal/partner/job-change-requests/agent-inbound",
            """{"jobId":10,"callId":"CA1","reason":"later","changes":[]}""");

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Theory]
    [InlineData(PartnerUnlinkOutcome.Unlinked, "unlinked")]
    [InlineData(PartnerUnlinkOutcome.NotFound, "not_found")]
    public async Task Unlink_ReturnsItsOutcomeByName(PartnerUnlinkOutcome outcome, string name)
    {
        _links.UnlinkAsync(PartnerJobGuid, PartnerUnlinkReason.PartnerVoided, null, null, Arg.Any<CancellationToken>()).Returns(outcome);

        var response = await Post("/internal/partner/jobs/unlink", $$"""{"partnerJobGuid":"{{PartnerJobGuid}}","reason":"PartnerVoided"}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(name, (await response.Content.ReadFromJsonAsync<Dictionary<string, string>>())!["outcome"]);
    }

    [Theory]
    [InlineData("""{"reason":"PartnerVoided"}""")]
    [InlineData($$"""{"partnerJobGuid":"6457fbd8-8c8c-4dca-ab18-b2415d32a784","reason":"Nope"}""")]
    public async Task Unlink_WithAMissingGuidOrUnknownReason_IsABadRequest(string body)
    {
        var response = await Post("/internal/partner/jobs/unlink", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await _links.DidNotReceiveWithAnyArgs().UnlinkAsync(default, default, default, default, default);
    }

    [Fact]
    public async Task Release_ReturnsWhatWasReleased()
    {
        _links.ReleaseAsync(6, PartnerReleaseScope.Inbound, "OTG Cargo", Arg.Any<CancellationToken>())
            .Returns(new PartnerReleaseResult(Unlinked: 0, Voided: 2, VoidedAfterPickup: 1, SkippedCompleted: 3));

        var response = await Post("/internal/partner/pairings/6/release", """{"scope":"inbound","partnerName":"OTG Cargo"}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, int>>();
        Assert.Equal(2, body!["voided"]);
        Assert.Equal(1, body["voidedAfterPickup"]);
        Assert.Equal(3, body["skippedCompleted"]);
    }

    [Fact]
    public async Task AReleaseForAnotherPairingThanTheAuthenticatedOne_IsNotFound()
    {
        var response = await Post("/internal/partner/pairings/6/release", """{"scope":"inbound"}""", pairingHeader: "7");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await _links.DidNotReceiveWithAnyArgs().ReleaseAsync(default, default, default, default);
    }

    [Fact]
    public async Task Unlink_PassesTheAuthenticatedPairingOn()
    {
        _links.UnlinkAsync(default, default, default, default, default).ReturnsForAnyArgs(PartnerUnlinkOutcome.NotFound);

        await Post("/internal/partner/jobs/unlink", $$"""{"partnerJobGuid":"{{PartnerJobGuid}}","reason":"PartnerVoided"}""", pairingHeader: "6");

        await _links.Received(1).UnlinkAsync(PartnerJobGuid, PartnerUnlinkReason.PartnerVoided, null, 6, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WithoutAToken_IsUnauthorized()
    {
        var response = await Post("/internal/partner/jobs/unlink", $$"""{"partnerJobGuid":"{{PartnerJobGuid}}","reason":"PartnerVoided"}""",
            token: false, csrfHeader: true);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await _links.DidNotReceiveWithAnyArgs().UnlinkAsync(default, default, default, default, default);
    }

    [Fact]
    public async Task ACookieUser_IsRefused_EvenWithTheCsrfHeader()
    {
        var response = await Post("/internal/partner/job-change-requests", PeerCreateBody, token: false,
            cookie: ".AspNet.SharedCookie=anything", csrfHeader: true);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await _changeRequests.DidNotReceiveWithAnyArgs().RecordPeerCreateAsync(default!, default);
    }

    [Fact]
    public async Task ACookieRequest_WithoutTheCsrfHeader_StillHitsCsrf() =>
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Post("/internal/partner/job-change-requests", PeerCreateBody, token: false, cookie: ".AspNet.SharedCookie=anything")).StatusCode);

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        if (_app is not null) await _app.DisposeAsync();
    }
}
