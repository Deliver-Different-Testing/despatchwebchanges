using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using DeliverDifferent.AgentAccess;
using DespatchWeb.Controllers;
using DespatchWeb.EntityClasses;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Tests.Helpers;
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

public class AgentExportTests : IAsyncDisposable
{
    private const string Hub = "https://hub.test.example";
    private const string Window = "since=2026-03-01&until=2026-03-10";

    private readonly RsaSecurityKey _hubKey = new(RSA.Create(2048)) { KeyId = "k" };
    private readonly SqliteTestDatabase _db = new();
    private WebApplication? _app;

    // Stands in for AgentUserClaimsEnricher, whose tblUser lookup is SQL Server only.
    private sealed class TestGroupEnricher : IAgentClaimsEnricher
    {
        public Task EnrichAsync(ClaimsPrincipal principal, CancellationToken cancellationToken = default)
        {
            if (principal.FindFirst("TestGroup")?.Value is { } group)
            {
                (principal.Identity as ClaimsIdentity)!.AddClaim(new Claim("UserGroupID", group));
            }

            return Task.CompletedTask;
        }
    }

    // Stands in for Hub's capabilities API (Access Control verbs AND hub tiles).
    private sealed class FixedCapabilities(IReadOnlySet<string> held) : IAgentCapabilitySource
    {
        public Task<IReadOnlySet<string>> GetAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default) =>
            Task.FromResult(held);
    }

    private async Task<HttpClient> Server(bool grantLive = true, string[]? capabilities = null)
    {
        var connections = Substitute.For<IConnectionStringManager>();
        connections.GetConnectionStringAsync(TenantConnectionCache.Key("7")).Returns("Server=db;");
        var cache = new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));
        if (grantLive) cache.Set("agent-grant:g1", [1]);

        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton(Options.Create(new AppSettings { PublicPath = "https://hub.test/" }));
        builder.Services.AddSingleton<IDistributedCache>(cache);
        builder.Services.AddSingleton(connections);
        builder.Services.AddSingleton(_db.CreateFactoryMock());
        builder.Services.AddAppAuthentication("localhost", new AgentAccessOptions
        {
            AppName = "DespatchWeb", HubAuthority = Hub, HubApiKey = "key", SqlCredentials = "User ID=dw;"
        });
        builder.Services.Replace(ServiceDescriptor.Singleton<IAgentClaimsEnricher, TestGroupEnricher>());
        builder.Services.Replace(ServiceDescriptor.Singleton<IAgentCapabilitySource>(
            new FixedCapabilities((capabilities ?? [.. AgentCapabilities.All]).ToHashSet())));
        builder.Services.PostConfigure<JwtBearerOptions>(AgentTokenAuthentication.Scheme, o =>
        {
            var config = new OpenIdConnectConfiguration { Issuer = Hub + "/" };
            config.SigningKeys.Add(_hubKey);
            o.Configuration = config;
            o.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(config);
        });
        builder.Services.AddControllers().AddApplicationPart(typeof(AgentExportController).Assembly);
        builder.Services.AddAuthorization();
        _app = builder.Build();
        _app.UseAuthentication();
        _app.UseAgentRouteAllowList();
        _app.UseAuthorization();
        _app.MapControllers();
        await _app.StartAsync();
        return _app.GetTestClient();
    }

    private string Token(string group) => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
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

    private static async Task<HttpResponseMessage> Get(HttpClient client, string path, string? bearer)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (bearer is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return await client.SendAsync(request);
    }

    private async Task<JsonElement> Page(HttpClient client, string path, string group = "1")
    {
        var response = await Get(client, path, Token(group));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
    }

    private async Task<List<JsonElement>> AllRows(HttpClient client, string entity, int pageSize)
    {
        var rows = new List<JsonElement>();
        string? cursor = null;
        do
        {
            var next = cursor is null ? "" : $"&cursor={Uri.EscapeDataString(cursor)}";
            var page = await Page(client, $"/Agent/Export/{entity}?{Window}&pageSize={pageSize}{next}");
            rows.AddRange(page.GetProperty("rows").EnumerateArray());
            cursor = page.GetProperty("nextCursor").GetString();
        } while (cursor is not null);

        return rows;
    }

    private void Seed()
    {
        using var db = _db.CreateContext();
        for (var i = 1; i <= 120; i++)
        {
            db.TucJobs.Add(new TucJob
            {
                UcjbId = i, UcjbNumber = $"J{i}", UcjbDate = new DateTime(2026, 3, 1).AddHours(i % 200), CourierPayment = 12.5m
            });
        }

        db.TucJobs.Add(new TucJob { UcjbId = 900, UcjbNumber = "OUT", UcjbDate = new DateTime(2026, 4, 1) });
        // 1000 is archive-only; 5 is also live, so the live copy must win.
        db.TucJobArchives.Add(new TucJobArchive { UcjbId = 1000, UcjbNumber = "A1000", UcjbDate = new DateTime(2026, 3, 2) });
        db.TucJobArchives.Add(new TucJobArchive { UcjbId = 5, UcjbNumber = "A5", UcjbDate = new DateTime(2026, 3, 2) });
        db.TucJobArchives.Add(new TucJobArchive { UcjbId = 1001, UcjbNumber = "ANULL", UcjbDate = null });

        db.PricingBreakdowns.Add(new PricingBreakdown { PricingBreakdownId = 1, JobId = 1, ChargeName = "Base", CostAmount = 3m });
        db.PricingBreakdowns.Add(new PricingBreakdown { PricingBreakdownId = 2, JobId = 900, ChargeName = "Out" });
        db.PricingBreakdownArchives.Add(new PricingBreakdownArchive { PricingBreakdownId = 10, JobId = 1000, ChargeName = "Arch" });
        db.PricingBreakdownArchives.Add(new PricingBreakdownArchive { PricingBreakdownId = 11, JobId = 5, ChargeName = "Dup" });
        db.TucEvents.Add(new TucEvent { UcevId = 1, UcevJobId = 1 });
        db.TucEvents.Add(new TucEvent { UcevId = 2, UcevJobId = 1000 });
        db.TucEvents.Add(new TucEvent { UcevId = 3, UcevJobId = 900 });
        db.TucEvents.Add(new TucEvent { UcevId = 4, UcevJobId = null });
        db.SaveChanges();
    }

    [Fact]
    public async Task Jobs_PageAtFifty_SumToTheTotal()
    {
        Seed();
        var client = await Server();

        var first = await Page(client, $"/Agent/Export/jobs?{Window}&pageSize=50");
        var rows = await AllRows(client, "jobs", 50);

        Assert.Equal(120, first.GetProperty("total").GetInt64());
        Assert.Equal(120, rows.Count);
        Assert.Equal(120, rows.Select(r => r.ToString()).Distinct().Count());
    }

    [Fact]
    public async Task ArchiveJobs_CountAJobInBothTablesOnce_WithLiveWinning()
    {
        Seed();
        var client = await Server();

        var archive = await Page(client, $"/Agent/Export/jobs_archive?{Window}");

        Assert.Equal(1, archive.GetProperty("total").GetInt64());
        var columns = archive.GetProperty("columns").EnumerateArray().Select(c => c.GetProperty("name").GetString()).ToList();
        Assert.Equal("A1000", archive.GetProperty("rows")[0][columns.IndexOf("UcjbNumber")].GetString());
    }

    [Fact]
    public async Task ChildEntities_FollowTheWindowsJobs()
    {
        Seed();
        var client = await Server();

        Assert.Equal(1, (await Page(client, $"/Agent/Export/pricing_breakdown?{Window}")).GetProperty("total").GetInt64());
        Assert.Equal(1, (await Page(client, $"/Agent/Export/pricing_breakdown_archive?{Window}")).GetProperty("total").GetInt64());
        Assert.Equal(2, (await Page(client, $"/Agent/Export/job_events?{Window}")).GetProperty("total").GetInt64());
    }

    [Theory]
    [InlineData("1", true)]
    [InlineData("13", false)]
    public async Task CostColumns_DependOnTheUsersGroup(string group, bool expected)
    {
        Seed();
        var page = await Page(await Server(), $"/Agent/Export/jobs?{Window}", group);

        var names = page.GetProperty("columns").EnumerateArray().Select(c => c.GetProperty("name").GetString()).ToList();
        Assert.Equal(expected, names.Contains("CourierPayment"));
        Assert.Contains("UcjbNumber", names);
    }

    [Fact]
    public async Task WithoutTheSeeCostsVerb_EvenAnAllowedGroupGetsNoCostColumns()
    {
        Seed();
        var client = await Server(capabilities: [AgentCapabilities.Connect, AgentCapabilities.ExportJobs]);

        var page = await Page(client, $"/Agent/Export/jobs?{Window}", "1");

        var names = page.GetProperty("columns").EnumerateArray().Select(c => c.GetProperty("name").GetString()).ToList();
        Assert.DoesNotContain("CourierPayment", names);
    }

    [Fact]
    public async Task WithoutTheExportJobsVerb_TheExportIsForbidden()
    {
        Seed();
        var client = await Server(capabilities: [AgentCapabilities.Connect, AgentCapabilities.ExportPricing, AgentCapabilities.SeeCosts]);

        Assert.Equal(HttpStatusCode.Forbidden, (await Get(client, $"/Agent/Export/jobs?{Window}", Token("1"))).StatusCode);
    }

    [Fact]
    public async Task ARevokedGrant_IsUnauthorized() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get(await Server(grantLive: false), $"/Agent/Export/jobs?{Window}", Token("1"))).StatusCode);

    [Fact]
    public async Task WithoutAPass_IsUnauthorized() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get(await Server(), $"/Agent/Export/jobs?{Window}", null)).StatusCode);

    [Fact]
    public async Task AnUnknownEntity_Is404_ListingTheEntities()
    {
        var response = await Get(await Server(), "/Agent/Export/nope", Token("1"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("jobs_archive", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task AMissingWindow_Is400() =>
        Assert.Equal(HttpStatusCode.BadRequest, (await Get(await Server(), "/Agent/Export/jobs", Token("1"))).StatusCode);

    public async ValueTask DisposeAsync()
    {
        if (_app is not null) await _app.DisposeAsync();
        await _db.DisposeAsync();
        GC.SuppressFinalize(this);
    }
}
