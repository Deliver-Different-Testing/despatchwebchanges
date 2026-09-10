using DespatchWeb.EntityClasses;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Guard and degrade behaviour of SuburbResolver. The happy path calls
/// dbo.UTL_fncSuburb_FromNameWithPostCode, which SQLite cannot host, so it is covered by
/// JobRepositoryUpdateAddressTests against a substituted ISuburbResolver instead.
/// </summary>
public class SuburbResolverTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ResolveAsync_BlankSuburbName_ReturnsNullWithoutQuerying(string suburbName)
    {
        var factory = Substitute.For<IDbContextFactory<DespatchContext>>();

        var resolved = await new SuburbResolver(factory)
            .ResolveAsync(suburbName, "1010", TestContext.Current.CancellationToken);

        Assert.Null(resolved);
        await factory.DidNotReceive().CreateDbContextAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ResolveAsync_LookupFails_ReturnsNullRatherThanThrowing()
    {
        var factory = Substitute.For<IDbContextFactory<DespatchContext>>();
        factory.CreateDbContextAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("no such function"));

        var resolved = await new SuburbResolver(factory)
            .ResolveAsync("Ponsonby", "1011", TestContext.Current.CancellationToken);

        Assert.Null(resolved);
    }
}
