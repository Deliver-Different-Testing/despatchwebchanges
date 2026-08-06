using DespatchWeb.EntityClasses;
using DespatchWeb.Interceptors;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using NSubstitute;

namespace DespatchWeb.Tests;

/// <summary>
/// Tests for the tenant-aware DbContext factory. The staff-attribution
/// interceptor has to be attached here — this is the single place every
/// repository and service obtains its context from — so this asserts the wiring
/// rather than re-testing the interceptor itself.
/// </summary>
public sealed class DynamicDespatchDbContextFactoryTests
{
    private const string DummyConnectionString =
        "Server=(localdb)\\mssqllocaldb;Database=dummy;Trusted_Connection=True;";

    private static DynamicDespatchDbContextFactory CreateFactory(
        StaffSessionContextInterceptor interceptor)
    {
        var options = Substitute.For<Microsoft.Extensions.Options.IOptions<DbContextOptions<DespatchContext>>>();
        options.Value.Returns(new DbContextOptionsBuilder<DespatchContext>().Options);

        var connectionStringManager = Substitute.For<IConnectionStringManager>();
        connectionStringManager.GetConnectionStringFromMemoryCache(Arg.Any<string>())
            .Returns(DummyConnectionString);

        var contextAccessor = Substitute.For<IHttpContextAccessor>();
        contextAccessor.HttpContext.Returns(new DefaultHttpContext());

        var serviceProvider = Substitute.For<IServiceProvider>();
        serviceProvider.GetService(typeof(IScopeProvider)).Returns(Substitute.For<IScopeProvider>());

        return new DynamicDespatchDbContextFactory(
            options, connectionStringManager, contextAccessor, serviceProvider, interceptor);
    }

    [Fact]
    public void CreateDbContext_RegistersStaffSessionContextInterceptor()
    {
        // Arrange
        var interceptor = new StaffSessionContextInterceptor(Substitute.For<IHttpContextAccessor>());
        var factory = CreateFactory(interceptor);

        // Act — no connection is opened, so this needs no SQL Server.
        using var context = factory.CreateDbContext();

        // Assert
        var coreOptions = context.GetService<IDbContextOptions>().FindExtension<CoreOptionsExtension>();
        Assert.NotNull(coreOptions);
        Assert.NotNull(coreOptions.Interceptors);
        Assert.Contains(interceptor, coreOptions.Interceptors);
    }
}
