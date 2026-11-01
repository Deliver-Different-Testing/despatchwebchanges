using DespatchWeb.Models.AutoMate;
using DespatchWeb.Services.AutoMate;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AutoMate;

public class CspBaseUrlResolverTests
{
    private static CspBaseUrlResolver Create(string? configured, string environment, string? host)
    {
        var accessor = Substitute.For<IHttpContextAccessor>();
        if (host is not null)
        {
            var context = new DefaultHttpContext();
            context.Request.Host = new HostString(host);
            accessor.HttpContext.Returns(context);
        }

        return new CspBaseUrlResolver(
            Options.Create(new CspKnowledgeOptions { BaseUrl = configured }),
            accessor,
            AutoMateTestEnv.Environment(environment));
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Development")]
    public void ConfiguredBaseUrl_Wins_WithTrailingSlashTrimmed(string environment) =>
        Assert.Equal("https://csp.example.com",
            Create("https://csp.example.com/", environment, "despatch.urgent.deliverdifferent.com").Resolve());

    [Theory]
    [InlineData("despatch.urgent.deliverdifferent.com", "https://dfrntcrm.urgent.deliverdifferent.com")]
    [InlineData("despatch.urgent.staging.deliverdifferent.com", "https://dfrntcrm.urgent.staging.deliverdifferent.com")]
    [InlineData("DESPATCH.Urgent.DeliverDifferent.com", "https://dfrntcrm.urgent.deliverdifferent.com")]
    [InlineData("despatch.otg-cargo.staging.deliverdifferent.com", "https://dfrntcrm.otg-cargo.staging.deliverdifferent.com")]
    public void Deployed_DerivesTheDfrntcrmSiblingOfATenantHost(string host, string expected) =>
        Assert.Equal(expected, Create(null, "Production", host).Resolve());

    [Theory]
    [InlineData("despatch.evil.com")]
    [InlineData("evil-despatch.deliverdifferent.com")]
    [InlineData("despatch.urgent.deliverdifferent.com.evil.com")]
    [InlineData("xdespatch.urgent.deliverdifferent.com")]
    [InlineData("despatch.deliverdifferent.com")]
    [InlineData("despatch.a.b.deliverdifferent.com")]
    [InlineData("despatch.urgent.prod.deliverdifferent.com")]
    [InlineData("dfrntcrm.urgent.deliverdifferent.com")]
    [InlineData("localhost")]
    public void Deployed_RejectsAnyHostThatIsNotATenantHost(string host) =>
        Assert.Null(Create(null, "Production", host).Resolve());

    [Fact]
    public void Deployed_IgnoresThePortOnTheHost() =>
        Assert.Equal("https://dfrntcrm.urgent.deliverdifferent.com",
            Create(null, "Production", "despatch.urgent.deliverdifferent.com:8443").Resolve());

    [Fact]
    public void Deployed_WithoutAnHttpContext_IsNull() =>
        Assert.Null(Create(null, "Production", null).Resolve());

    [Fact]
    public void Development_WithoutConfiguration_IsNullEvenForATenantHost() =>
        Assert.Null(Create(null, "Development", "despatch.urgent.deliverdifferent.com").Resolve());
}
