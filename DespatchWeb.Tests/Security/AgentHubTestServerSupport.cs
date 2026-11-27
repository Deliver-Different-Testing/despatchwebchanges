using System.Reflection;
using System.Security.Claims;
using System.Security.Cryptography;
using DeliverDifferent.AgentAccess;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace DespatchWeb.Tests.Security;

/// <summary>
/// Stands in for Hub's capabilities API (Access Control verbs AND hub tiles).
/// </summary>
internal sealed class FixedAgentCapabilities(IReadOnlySet<string> held) : IAgentCapabilitySource
{
    public Task<IReadOnlySet<string>> GetAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default) =>
        Task.FromResult(held);
}

internal static class AgentHubTestServerSupport
{
    public static RsaSecurityKey NewHubKey() => new(RSA.Create(2048)) { KeyId = "k" };

    public static string CreateAgentToken(RsaSecurityKey hubKey, string hub, string group) =>
        new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = hub + "/",
            Audience = "dfrnt-apps",
            Expires = DateTime.UtcNow.AddMinutes(15),
            Subject = new ClaimsIdentity([
                new Claim("sub", "u1"), new Claim("CurrentTenantID", "7"), new Claim("StaffID", "42"), new Claim("ClientTypeId", "4"),
                new Claim("grant_id", "g1"), new Claim("scope", "read"), new Claim("auth_kind", "agent"), new Claim("TestGroup", group)
            ]),
            SigningCredentials = new SigningCredentials(hubKey, SecurityAlgorithms.RsaSha256)
        });

    public static void TrustHubKey(IServiceCollection services, RsaSecurityKey hubKey, string hub) =>
        services.PostConfigure<JwtBearerOptions>(AgentTokenAuthentication.Scheme, o =>
        {
            var config = new OpenIdConnectConfiguration { Issuer = hub + "/" };
            config.SigningKeys.Add(hubKey);
            o.Configuration = config;
            o.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(config);
        });

    public static async Task<WebApplication> StartAgentAppAsync(WebApplicationBuilder builder, Assembly controllersAssembly)
    {
        builder.Services.AddControllers().AddApplicationPart(controllersAssembly);
        builder.Services.AddAuthorization();
        var app = builder.Build();
        app.UseAuthentication();
        app.UseAgentRouteAllowList();
        app.UseAuthorization();
        app.MapControllers();
        await app.StartAsync();
        return app;
    }
}
