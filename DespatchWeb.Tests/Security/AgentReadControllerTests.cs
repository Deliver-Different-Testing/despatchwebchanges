using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using DeliverDifferent.AgentAccess;
using DespatchWeb.Controllers;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services.AgentRead;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using NSubstitute;

namespace DespatchWeb.Tests.Security;

public class AgentReadControllerTests : IAsyncDisposable
{
    private const string Hub = "https://hub.test.example";

    private readonly RsaSecurityKey _hubKey = new(RSA.Create(2048)) { KeyId = "k" };
    private readonly IAgentJobSearchService _search = Substitute.For<IAgentJobSearchService>();
    private readonly IAgentJobStoryService _story = Substitute.For<IAgentJobStoryService>();
    private WebApplication? _app;

    private sealed class GroupEnricher : IAgentClaimsEnricher
    {
        public Task EnrichAsync(ClaimsPrincipal principal, CancellationToken cancellationToken = default)
        {
            (principal.Identity as ClaimsIdentity)!.AddClaim(new Claim("UserGroupID", principal.FindFirst("TestGroup")?.Value ?? "1"));
            return Task.CompletedTask;
        }
    }

    private sealed class FixedCapabilities(IReadOnlySet<string> held) : IAgentCapabilitySource
    {
        public Task<IReadOnlySet<string>> GetAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default) => Task.FromResult(held);
    }

    private async Task<HttpClient> Server(params string[] capabilities)
    {
        var connections = Substitute.For<IConnectionStringManager>();
        connections.GetConnectionStringAsync(TenantConnectionCache.Key("7")).Returns("Server=db;");
        var cache = new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));
        cache.Set("agent-grant:g1", [1]);

        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton(Options.Create(new AppSettings { PublicPath = "https://hub.test/" }));
        builder.Services.AddSingleton<IDistributedCache>(cache);
        builder.Services.AddSingleton(connections);
        builder.Services.AddAppAuthentication("localhost", new AgentAccessOptions
        {
            AppName = "DespatchWeb", HubAuthority = Hub, HubApiKey = "key", SqlCredentials = "User ID=dw;"
        });
        builder.Services.Replace(ServiceDescriptor.Singleton<IAgentClaimsEnricher, GroupEnricher>());
        builder.Services.Replace(ServiceDescriptor.Singleton<IAgentCapabilitySource>(new FixedCapabilities(capabilities.ToHashSet())));
        builder.Services.AddSingleton(_search);
        builder.Services.AddSingleton(_story);
        builder.Services.PostConfigure<JwtBearerOptions>(AgentTokenAuthentication.Scheme, o =>
        {
            var config = new OpenIdConnectConfiguration { Issuer = Hub + "/" };
            config.SigningKeys.Add(_hubKey);
            o.Configuration = config;
            o.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(config);
        });
        builder.Services.AddControllers().AddApplicationPart(typeof(AgentReadController).Assembly);
        builder.Services.AddAuthorization();
        _app = builder.Build();
        _app.UseAuthentication();
        _app.UseAgentRouteAllowList();
        _app.UseAuthorization();
        _app.MapControllers();
        await _app.StartAsync();
        return _app.GetTestClient();
    }

    private string Token(string group = "1") => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Issuer = Hub + "/",
        Audience = "dfrnt-apps",
        Expires = DateTime.UtcNow.AddMinutes(15),
        Subject = new ClaimsIdentity([
            new Claim("sub", "u1"), new Claim("CurrentTenantID", "7"), new Claim("StaffID", "42"), new Claim("ClientTypeId", "4"),
            new Claim("grant_id", "g1"), new Claim("scope", "read"), new Claim("auth_kind", "agent"), new Claim("TestGroup", group)
        ]),
        SigningCredentials = new SigningCredentials(_hubKey, SecurityAlgorithms.RsaSha256)
    });

    private static async Task<HttpResponseMessage> Send(HttpClient client, string path, string? bearer, HttpMethod? method = null)
    {
        var request = new HttpRequestMessage(method ?? HttpMethod.Get, path);
        if (bearer is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return await client.SendAsync(request);
    }

    private void SearchReturns() =>
        _search.SearchAsync(default!, default).ReturnsForAnyArgs(Task.FromResult(JsonNode.Parse(
            """{ "jobs": [ { "jobNumber": "KT1", "amount": 12.5, "notes": "leave at gate" } ] }""")!.AsObject()));

    [Fact]
    public async Task WithoutTheToolVerb_AnAgentIsRefused()
    {
        SearchReturns();
        var response = await Send(await Server(AgentCapabilities.Connect), "/Agent/Read/jobs", Token());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Contains("agent_capability_missing", await response.Content.ReadAsStringAsync());
        await _search.DidNotReceiveWithAnyArgs().SearchAsync(default!, default);
    }

    [Fact]
    public async Task WithOnlyTheToolVerb_CostsAndNotesAreOmitted_AndNamedUnderRedacted()
    {
        SearchReturns();
        var response = await Send(await Server(AgentCapabilities.ToolJobSearch), "/Agent/Read/jobs", Token());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!.AsObject();
        var job = body["jobs"]![0]!.AsObject();
        Assert.Equal("KT1", (string?)job["jobNumber"]);
        Assert.False(job.ContainsKey("amount"));
        Assert.False(job.ContainsKey("notes"));
        Assert.Equivalent(new[] { "agent-see-costs", "agent-see-notes" },
            body["redacted"]!.AsArray().Select(r => (string)r!["class"]!).ToArray());
    }

    [Fact]
    public async Task WithTheClasses_CostsStay_AndNotesMoveUnderUntrustedText()
    {
        SearchReturns();
        var response = await Send(
            await Server(AgentCapabilities.ToolJobSearch, AgentCapabilities.SeeCosts, AgentCapabilities.SeeNotes), "/Agent/Read/jobs", Token());

        var job = JsonNode.Parse(await response.Content.ReadAsStringAsync())!["jobs"]![0]!.AsObject();
        Assert.Equal(12.5m, (decimal)job["amount"]!);
        Assert.Equal("leave at gate", (string?)job["untrusted_text"]!["notes"]);
    }

    [Fact]
    public async Task AUserInARestrictedGroup_NeverSeesCosts_EvenWithTheCapability()
    {
        SearchReturns();
        var response = await Send(await Server(AgentCapabilities.ToolJobSearch, AgentCapabilities.SeeCosts), "/Agent/Read/jobs", Token("13"));

        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync())!.AsObject();
        Assert.False(body["jobs"]![0]!.AsObject().ContainsKey("amount"));
        Assert.Contains("agent-see-costs", body["redacted"]!.AsArray().Select(r => (string)r!["class"]!));
    }

    [Theory]
    [InlineData("/Agent/Read/jobs", true)]
    [InlineData("/agent/read/driver-day", true)]
    [InlineData("/Agent/Export/jobs", true)]
    [InlineData("/Agent/Other", false)]
    [InlineData("/api/context", false)]
    public void TheUserGroupLookup_RunsForReadsAndExportsOnly(string path, bool expected) =>
        Assert.Equal(expected, AgentUserClaimsEnricher.AppliesTo(path));

    [Fact]
    public async Task ABadRequestFromTheService_Is400WithTheMessage()
    {
        _search.SearchAsync(default!, default).ReturnsForAnyArgs<JsonObject>(_ => throw new AgentReadException("window too wide"));
        var response = await Send(await Server(AgentCapabilities.ToolJobSearch), "/Agent/Read/jobs", Token());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("window too wide", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task QueryParameters_AreBoundByTheirSnakeCaseNames()
    {
        SearchReturns();
        await Send(await Server(AgentCapabilities.ToolJobSearch),
            "/Agent/Read/jobs?order_number=%231042&expected_fulfilment_orders=2&page_size=500&detail=all", Token());

        await _search.Received(1).SearchAsync(
            Arg.Is<JobSearchRequest>(r => r.OrderNumber == "#1042" && r.ExpectedFulfilmentOrders == 2 && r.PageSize == 500 && r.All),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAgent_CannotWriteToAReadRoute()
    {
        var response = await Send(await Server(AgentCapabilities.ToolJobSearch), "/Agent/Read/jobs", Token(), HttpMethod.Post);

        Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
        await _search.DidNotReceiveWithAnyArgs().SearchAsync(default!, default);
    }

    [Fact]
    public async Task ACookieStyleRequest_WithNoBearer_IsNotServed()
    {
        SearchReturns();
        var response = await Send(await Server(AgentCapabilities.ToolJobSearch), "/Agent/Read/jobs", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await _search.DidNotReceiveWithAnyArgs().SearchAsync(default!, default);
    }

    public async ValueTask DisposeAsync()
    {
        if (_app is not null) await _app.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}




