using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// D12: the clear list's area counts come from GetAreaRemainingCounts. Staff get tenant-wide counts,
/// a network partner its own (the proc's @NpAgentId), anyone else none.
/// </summary>
public class CourierRepositoryAreaCountScopeTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DespatchContext Context(ClientType clientType, int? npAgentId = null, int? clientId = null)
    {
        var provider = Substitute.For<IScopeProvider>();
        provider.Scope.Returns(new ScopeContext(ClientTypeId: (int)clientType, ClientId: clientId, NpAgentId: npAgentId));
        return new DespatchContext(_db.Options, provider);
    }

    [Fact]
    public async Task Staff_GetTenantWideCounts()
    {
        await using var context = Context(ClientType.Tenant);

        var scope = CourierRepository.AreaCountScopeFor(context);

        Assert.NotNull(scope);
        Assert.Null(scope.Value.NpAgentId);
        Assert.Equal("ClearList:AreaRemainingCounts", scope.Value.CacheKey);
    }

    [Fact]
    public async Task NetworkPartner_GetsItsOwnCountsUnderItsOwnCacheKey()
    {
        await using var context = Context(ClientType.NetworkPartner, npAgentId: 77);

        var scope = CourierRepository.AreaCountScopeFor(context);

        Assert.Equal(77, scope?.NpAgentId);
        Assert.Equal("ClearList:AreaRemainingCounts:np:77", scope?.CacheKey);
    }

    [Fact]
    public async Task NetworkPartnerWithoutAgent_AndCustomers_GetNone()
    {
        await using var unlinked = Context(ClientType.NetworkPartner);
        await using var customer = Context(ClientType.Customer, clientId: 10);

        Assert.Null(CourierRepository.AreaCountScopeFor(unlinked));
        Assert.Null(CourierRepository.AreaCountScopeFor(customer));
    }
}
