using DespatchWeb.EntityClasses;
using DespatchWeb.Interceptors;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public sealed class EfModelWarmupServiceTests
{
    private const string TenantConnectionString =
        "Server=(localdb)\\mssqllocaldb;Database=tenant;Trusted_Connection=True;";

    private readonly IOptions<DbContextOptions<DespatchContext>> _baseOptions =
        Options.Create(new DbContextOptionsBuilder<DespatchContext>().Options);

    private readonly StaffSessionContextInterceptor _interceptor =
        new(Substitute.For<IHttpContextAccessor>());

    [Fact]
    public async Task ExecuteAsync_MarksStateReady()
    {
        var state = new EfModelWarmupState();
        var service = new EfModelWarmupService(_baseOptions, _interceptor, state);

        await service.StartAsync(TestContext.Current.CancellationToken);
        await service.ExecuteTask!;

        Assert.True(state.IsReady);
        Assert.Null(state.Failure);
    }

    [Fact]
    public async Task ExecuteAsync_WarmsTheSameModelTheRequestFactoryUses()
    {
        var state = new EfModelWarmupState();
        var service = new EfModelWarmupService(_baseOptions, _interceptor, state);
        await service.StartAsync(TestContext.Current.CancellationToken);
        await service.ExecuteTask!;

        using var warmed = new DespatchContext(DynamicDespatchDbContextFactory.BuildOptions(
            _baseOptions.Value, EfModelWarmupService.PlaceholderConnectionString, _interceptor));
        using var requestContext = CreateRequestFactory().CreateDbContext();

        Assert.Same(warmed.Model, requestContext.Model);
    }

    [Fact]
    public async Task ExecuteAsync_WhenModelBuildThrows_RecordsFailure()
    {
        var state = new EfModelWarmupState();
        var service = new EfModelWarmupService(_baseOptions, _interceptor, state,
            _ => throw new InvalidOperationException("model is broken"));

        await service.StartAsync(TestContext.Current.CancellationToken);
        await service.ExecuteTask!;

        Assert.False(state.IsReady);
        Assert.Equal("model is broken", state.Failure?.Message);
    }

    private DynamicDespatchDbContextFactory CreateRequestFactory()
    {
        var connectionStringManager = Substitute.For<IConnectionStringManager>();
        connectionStringManager.GetConnectionStringFromMemoryCache(Arg.Any<string>())
            .Returns(TenantConnectionString);

        var contextAccessor = Substitute.For<IHttpContextAccessor>();
        contextAccessor.HttpContext.Returns(new DefaultHttpContext());

        var serviceProvider = Substitute.For<IServiceProvider>();
        serviceProvider.GetService(typeof(IScopeProvider)).Returns(Substitute.For<IScopeProvider>());

        return new DynamicDespatchDbContextFactory(
            _baseOptions, connectionStringManager, contextAccessor, serviceProvider, _interceptor);
    }
}
