using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DeliverDifferent.AgentAccess;
using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Middleware;
using DespatchWeb.Models;
using DespatchWeb.Tests.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using NSubstitute;

namespace DespatchWeb.Tests.Security;

public class VoiceAgentAssignTests : IAsyncDisposable
{
    private const string Hub = "https://hub.test.example";
    private const string Cluster = "https://oidc.eks.test.example/id/ABC";
    private const string Sub = "system:serviceaccount:integration-manager-788-urgent-staging:integrationmanager";
    private const string Path = "/internal/voice-agent/courier-assign";
    private const string Body = """{"jobId":10,"courierId":7,"staffId":42,"callId":"CA1"}""";

    private readonly RsaSecurityKey _clusterKey = new(RSA.Create(2048)) { KeyId = "c" };
    private readonly RsaSecurityKey _hubKey = new(RSA.Create(2048)) { KeyId = "h" };
    private readonly IConnectionStringManager _connections = Substitute.For<IConnectionStringManager>();
    private readonly IDispatchJobService _dispatch = Substitute.For<IDispatchJobService>();
    private WebApplication? _app;
    private string? _staffClaimSeenByService;
    private string? _tenantClaimSeenByService;
    private CourierClaimOutcome _outcome = CourierClaimOutcome.Assigned;

    public VoiceAgentAssignTests() =>
        _connections.GetConnectionStringAsync(TenantConnectionCache.Key("1")).Returns("Server=db;");

    private static VoiceAgentAssignOptions Options() => new([Sub], Cluster);

    private async Task<HttpClient> Server(VoiceAgentAssignOptions? options = null, bool agentAccess = true)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton(Microsoft.Extensions.Options.Options.Create(new AppSettings { PublicPath = "https://hub.test/" }));
        builder.Services.AddSingleton<IDistributedCache>(
            new MemoryDistributedCache(Microsoft.Extensions.Options.Options.Create(new MemoryDistributedCacheOptions())));
        builder.Services.AddSingleton(_connections);
        builder.Services.AddSingleton(_dispatch);
        builder.Services.AddSingleton(Substitute.For<IAgentClaimsEnricher>());
        builder.Services.AddSingleton(Substitute.For<IAgentCapabilitySource>());
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddAppAuthentication("localhost",
            agentAccess ? new AgentAccessOptions { AppName = "DespatchWeb", HubAuthority = Hub, HubApiKey = "key", SqlCredentials = "User ID=dw;" } : null,
            options ?? Options());
        builder.Services.AddHttpClient(HubTenantTimeZoneSource.HttpClientName)
            .ConfigurePrimaryHttpMessageHandler(() => new StubHandler());
        builder.Services.AddHttpClient(HubTenantConnectionSource.HttpClientName)
            .ConfigurePrimaryHttpMessageHandler(() => new CountingHandler { Fail = true });
        builder.Services.PostConfigure<JwtBearerOptions>(VoiceAgentAssignAuthentication.Scheme, o =>
        {
            var config = new OpenIdConnectConfiguration { Issuer = Cluster };
            config.SigningKeys.Add(_clusterKey);
            o.Configuration = config;
            o.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(config);
        });
        if (agentAccess)
        {
            builder.Services.PostConfigure<JwtBearerOptions>(AgentTokenAuthentication.Scheme, o =>
            {
                var config = new OpenIdConnectConfiguration { Issuer = Hub + "/" };
                config.SigningKeys.Add(_hubKey);
                o.Configuration = config;
                o.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(config);
            });
        }

        builder.Services.PostConfigure<CookieAuthenticationOptions>("Identity.Application", o => o.TicketDataFormat = new StubTicketFormat());
        builder.Services.AddControllers()
            .AddApplicationPart(typeof(VoiceAgentController).Assembly)
            .AddNewtonsoftJson(o => NewtonsoftSettings.Apply(o.SerializerSettings));
        _app = builder.Build();
        _app.UseMiddleware<CsrfProtectionMiddleware>();
        _app.UseRouting();
        _app.UseAuthentication();
        _app.UseAgentRouteAllowList();
        _app.UseConnectedTenantRejection();
        _app.UseAuthorization();
        _app.MapControllers();
        _dispatch.ClaimJobForCourierAsync(default, default, default, default).ReturnsForAnyArgs(_ =>
        {
            var user = _app.Services.GetRequiredService<IHttpContextAccessor>().HttpContext!.User;
            _staffClaimSeenByService = user.FindFirst("StaffID")?.Value;
            _tenantClaimSeenByService = user.FindFirst("CurrentTenantID")?.Value;
            return _outcome;
        });
        await _app.StartAsync();
        return _app.GetTestClient();
    }

    private string ClusterToken(string sub = Sub, string audience = "despatchweb", string issuer = Cluster, DateTime? expires = null) =>
        new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            Expires = expires ?? DateTime.UtcNow.AddMinutes(10),
            Subject = new ClaimsIdentity([new Claim("sub", sub)]),
            SigningCredentials = new SigningCredentials(_clusterKey, SecurityAlgorithms.RsaSha256)
        });

    private string HubAgentToken() => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Issuer = Hub + "/",
        Audience = "dfrnt-apps",
        Expires = DateTime.UtcNow.AddMinutes(10),
        Subject = new ClaimsIdentity([
            new Claim("sub", "u1"), new Claim("CurrentTenantID", "1"), new Claim("StaffID", "42"), new Claim("ClientTypeId", "4"),
            new Claim("grant_id", "g1"), new Claim("scope", "read write"), new Claim("auth_kind", "agent")
        ]),
        SigningCredentials = new SigningCredentials(_hubKey, SecurityAlgorithms.RsaSha256)
    });

    private static async Task<HttpResponseMessage> Post(HttpClient client, string? bearer, string body = Body, string? cookie = null, string? tenant = "1")
    {
        var request = new HttpRequestMessage(HttpMethod.Post, Path) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        if (bearer is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        if (tenant is not null) request.Headers.Add("X-Tenant-Id", tenant);
        if (cookie is not null) request.Headers.Add("Cookie", cookie);
        return await client.SendAsync(request);
    }

    private void Returns(CourierClaimOutcome outcome) => _outcome = outcome;

    private async Task NothingWasClaimed() =>
        await _dispatch.DidNotReceiveWithAnyArgs().ClaimJobForCourierAsync(default, default, default, default);

    [Fact]
    public async Task AMappedServiceAccount_IsAssigned_WithoutTheCsrfHeader_AndTheStaffIsAttributed()
    {
        var response = await Post(await Server(), ClusterToken());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("""{"outcome":"assigned"}""", await response.Content.ReadAsStringAsync());
        await _dispatch.Received(1).ClaimJobForCourierAsync(10, 7, 42, Arg.Any<CancellationToken>());
        Assert.Equal("42", _staffClaimSeenByService);
    }

    [Theory]
    [InlineData(CourierClaimOutcome.AlreadyYours, "already_yours")]
    [InlineData(CourierClaimOutcome.Unavailable, "unavailable")]
    [InlineData(CourierClaimOutcome.NotFound, "not_found")]
    public async Task EachOutcome_IsReturnedByName(CourierClaimOutcome outcome, string name)
    {
        var client = await Server();
        Returns(outcome);

        var response = await Post(client, ClusterToken());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal($$"""{"outcome":"{{name}}"}""", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData(CourierClaimOutcome.InvalidStaff, "invalid_staff")]
    [InlineData(CourierClaimOutcome.InvalidCourier, "invalid_courier")]
    public async Task AnInvalidStaffOrCourier_IsABadRequest(CourierClaimOutcome outcome, string error)
    {
        var client = await Server();
        Returns(outcome);

        var response = await Post(client, ClusterToken());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(error, (await response.Content.ReadFromJsonAsync<Dictionary<string, string>>())!["error"]);
    }

    [Theory]
    [InlineData("""{"jobId":0,"courierId":7,"staffId":42,"callId":"CA1"}""")]
    [InlineData("""{"jobId":10,"courierId":-1,"staffId":42,"callId":"CA1"}""")]
    [InlineData("""{"jobId":10,"courierId":7,"staffId":0,"callId":"CA1"}""")]
    [InlineData("""{"jobId":10,"courierId":7,"staffId":42}""")]
    [InlineData("""{"jobId":10,"courierId":7,"staffId":42,"callId":"  "}""")]
    [InlineData("""{"jobId":"x","courierId":7,"staffId":42,"callId":"CA1"}""")]
    [InlineData("not json")]
    public async Task ABadBody_IsInvalidRequest_AndClaimsNothing(string body)
    {
        var response = await Post(await Server(), ClusterToken(), body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_request", (await response.Content.ReadFromJsonAsync<Dictionary<string, string>>())!["error"]);
        await NothingWasClaimed();
    }

    [Fact]
    public async Task WithoutAToken_IsUnauthorized()
    {
        var client = await Server();
        var request = new HttpRequestMessage(HttpMethod.Post, Path) { Content = new StringContent(Body, Encoding.UTF8, "application/json") };
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(request)).StatusCode);
        await NothingWasClaimed();
    }

    [Fact]
    public async Task ACookieUser_IsRefused_EvenWithTheCsrfHeader()
    {
        var client = await Server();
        var request = new HttpRequestMessage(HttpMethod.Post, Path) { Content = new StringContent(Body, Encoding.UTF8, "application/json") };
        request.Headers.Add("Cookie", ".AspNet.SharedCookie=anything");
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await NothingWasClaimed();
    }

    [Fact]
    public async Task ACookieRequest_WithoutTheCsrfHeader_StillHitsCsrf() =>
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(await Server(), null, cookie: ".AspNet.SharedCookie=anything")).StatusCode);

    [Fact]
    public async Task AHubAgentToken_IsRefused()
    {
        var response = await Post(await Server(), HubAgentToken());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await NothingWasClaimed();
    }

    [Fact]
    public async Task AServiceAccountNotInTheMap_IsRefused()
    {
        var response = await Post(await Server(), ClusterToken("system:serviceaccount:integration-manager-788-other:integrationmanager"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await NothingWasClaimed();
    }

    [Theory]
    [InlineData("wrong-audience", Cluster, 10)]
    [InlineData("despatchweb", "https://evil.example", 10)]
    [InlineData("despatchweb", Cluster, -10)]
    public async Task AWrongAudienceIssuerOrExpiredToken_IsRefused(string audience, string issuer, int minutes) =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await Post(await Server(), ClusterToken(audience: audience, issuer: issuer, expires: DateTime.UtcNow.AddMinutes(minutes)))).StatusCode);

    [Fact]
    public async Task ATokenSignedByAnotherKey_IsRefused()
    {
        var forged = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = Cluster,
            Audience = "despatchweb",
            Expires = DateTime.UtcNow.AddMinutes(10),
            Subject = new ClaimsIdentity([new Claim("sub", Sub)]),
            SigningCredentials = new SigningCredentials(_hubKey, SecurityAlgorithms.RsaSha256)
        });

        Assert.Equal(HttpStatusCode.Unauthorized, (await Post(await Server(), forged)).StatusCode);
    }

    [Fact]
    public async Task WithNoAllowedServiceAccount_EverythingIsRefused()
    {
        var response = await Post(await Server(new VoiceAgentAssignOptions([], Cluster)), ClusterToken());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await NothingWasClaimed();
    }

    [Fact]
    public async Task WithoutAHubUrl_EverythingIsRefused()
    {
        var response = await Post(await Server(agentAccess: false), ClusterToken());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await NothingWasClaimed();
    }

    [Fact]
    public async Task WhenHubHasNoConnectionForTheTenant_IsRefused()
    {
        _connections.GetConnectionStringAsync(TenantConnectionCache.Key("1")).Returns((string?)null);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Post(await Server(), ClusterToken())).StatusCode);
    }

    [Theory]
    [InlineData("despatchweb-594-urgent-staging", "system:serviceaccount:integration-manager-788-urgent-staging:default")]
    [InlineData("despatchweb-594-staging", "system:serviceaccount:integration-manager-788-staging:default")]
    [InlineData("despatchweb-594-production", "system:serviceaccount:integration-manager-788-production:default")]
    [InlineData("despatchweb-594-urgent-prod\n", "system:serviceaccount:integration-manager-788-urgent-prod:default")]
    [InlineData("despatchweb-594-", null)]
    [InlineData("despatchweb-594-a:b", null)]
    [InlineData("kube-system", null)]
    [InlineData("integration-manager-788-staging", null)]
    [InlineData(null, null)]
    public void TheSubject_IsDerivedFromThePodsNamespace(string? ns, string? expected) =>
        Assert.Equal(expected, VoiceAgentAssignOptions.DeriveSubject(ns));

    private static VoiceAgentAssignOptions FromFile(string? ns)
    {
        var path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        if (ns is not null) File.WriteAllText(path, ns);
        try
        {
            return VoiceAgentAssignOptions.Resolve(path, path + ".missing");
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void ThePodsNamespaceFile_GivesTheOneAllowedSubject()
    {
        var options = FromFile("despatchweb-594-urgent-staging\n");

        Assert.Equal(["system:serviceaccount:integration-manager-788-urgent-staging:default"], options.AllowedSubjects);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("some-other-namespace")]
    public void AnUnrecognisedOrMissingNamespace_IsClosed(string? ns)
    {
        var options = FromFile(ns);

        Assert.False(options.IsConfigured);
        Assert.Empty(options.AllowedSubjects);
        Assert.NotEmpty(options.AllowedSubjectsNote);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("0")]
    [InlineData("-3")]
    [InlineData("abc")]
    public async Task AMissingOrInvalidTenantHeader_IsRefused(string? tenant)
    {
        var response = await Post(await Server(), ClusterToken(), tenant: tenant);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await NothingWasClaimed();
    }

    [Fact]
    public async Task TheHeaderTenant_IsTheRequestsTenant()
    {
        _connections.GetConnectionStringAsync(TenantConnectionCache.Key("5")).Returns("Server=db5;");

        var response = await Post(await Server(), ClusterToken(), tenant: "5");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("5", _tenantClaimSeenByService);
    }

    [Fact]
    public void TheAudience_IsDespatchweb() => Assert.Equal("despatchweb", VoiceAgentAssignOptions.Audience);

    [Theory]
    [InlineData("Pacific/Auckland", "Pacific/Auckland")]
    [InlineData("Not/AZone", null)]
    public async Task OnlyAResolvableHubTimeZone_IsUsed(string fromHub, string? expected)
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient(HubTenantTimeZoneSource.HttpClientName).Returns(_ => new HttpClient(new StubHandler(fromHub)));
        var source = new HubTenantTimeZoneSource(factory, new AgentAccessOptions { AppName = "DespatchWeb", HubAuthority = Hub, HubApiKey = "key" });

        Assert.Equal(expected, await source.GetAsync(1, CancellationToken.None));
    }

    [Fact]
    public async Task WhenHubFailsAfterTheCacheExpires_TheStaleZoneIsServed_WithoutAskingHubOnEveryCall()
    {
        var handler = new CountingHandler();
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient(HubTenantTimeZoneSource.HttpClientName).Returns(_ => new HttpClient(handler, disposeHandler: false));
        var time = new ManualTimeProvider();
        var source = new HubTenantTimeZoneSource(factory, new AgentAccessOptions { AppName = "DespatchWeb", HubAuthority = Hub, HubApiKey = "key" }, time);
        var ct = TestContext.Current.CancellationToken;

        Assert.Equal("Pacific/Auckland", await source.GetAsync(1, ct));
        time.Advance(TimeSpan.FromHours(2));
        handler.Fail = true;

        Assert.Equal("Pacific/Auckland", await source.GetAsync(1, ct));
        Assert.Equal("Pacific/Auckland", await source.GetAsync(1, ct));
        Assert.Equal(2, handler.Calls);
    }

    public async ValueTask DisposeAsync()
    {
        if (_app is not null) await _app.DisposeAsync();
        GC.SuppressFinalize(this);
    }

    internal sealed class StubHandler(string timeZone = "Pacific/Auckland") : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(new { timeZone }) });
    }

    internal sealed class CountingHandler : HttpMessageHandler
    {
        public bool Fail { get; set; }
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(Fail
                ? new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
                : new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(new { timeZone = "Pacific/Auckland" }) });
        }
    }

    internal sealed class StubTicketFormat : ISecureDataFormat<AuthenticationTicket>
    {
        public string Protect(AuthenticationTicket data) => "x";
        public string Protect(AuthenticationTicket data, string? purpose) => "x";
        public AuthenticationTicket? Unprotect(string? protectedText) => Unprotect(protectedText, null);

        public AuthenticationTicket? Unprotect(string? protectedText, string? purpose) => new(
            new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim("CurrentTenantID", "1"), new Claim("StaffID", "42"), new Claim("ClientTypeId", "4")], "Identity.Application")),
            "Identity.Application");
    }
}
