using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// The despatch views list is what the dispatch page lands a user on, so it is
/// also what scopes their Driver Locations panel and map. A Network Partner must
/// get the NP-audience views and nothing else — landing them on a tenant zone
/// view would populate Driver Locations tenant-wide, which
/// docs/JACOB-NP-DESPATCHWEB-DASHBOARD-VISIBILITY-2026-08-30.md forbids.
/// </summary>
public class DfrntViewsRepositoryTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DfrntViewsRepository CreateRepository(ScopeContext scope)
    {
        var scopeProvider = Substitute.For<IScopeProvider>();
        scopeProvider.Scope.Returns(scope);
        return new DfrntViewsRepository(_db.CreateFactoryMock(), scopeProvider);
    }

    private async Task SeedViewsAsync()
    {
        await using var seed = _db.CreateContext();
        seed.TblDespatchViews.AddRange(
            NewView(1, "Central", clientTypeId: null),
            NewView(2, "West Mid", clientTypeId: null),
            NewView(3, "NP All Jobs", clientTypeId: (int)ClientType.NetworkPartner));
        seed.DfrntpageViews.AddRange(
            new DfrntpageView {PageId = (int)AppPage.Dispatch, ViewId = 1, CreatedBy = "test"},
            new DfrntpageView {PageId = (int)AppPage.Dispatch, ViewId = 2, CreatedBy = "test"},
            new DfrntpageView {PageId = (int)AppPage.Dispatch, ViewId = 3, CreatedBy = "test"},
            new DfrntpageView {PageId = (int)AppPage.JobSearch, ViewId = 1, CreatedBy = "test"});
        await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static TblDespatchView NewView(int id, string name, int? clientTypeId) => new()
    {
        DespatchViewId = id,
        Name = name,
        WhereCondition = "1=1",
        ClientTypeId = clientTypeId,
        CreatedBy = "test",
        LastModifiedBy = "test"
    };

    [Fact]
    public async Task NetworkPartner_GetsOnlyTheNpAudienceViews()
    {
        await SeedViewsAsync();
        var repository = CreateRepository(
            new ScopeContext((int)ClientType.NetworkPartner, ClientId: null, NpAgentId: 77));

        var views = await repository.GetViewsByUserAndPageAsync(1, AppPage.Dispatch);

        Assert.Equal(["NP All Jobs"], views.Select(v => v.Name));
    }

    [Theory]
    [InlineData((int)ClientType.Customer)]
    [InlineData((int)ClientType.Internal)]
    [InlineData((int)ClientType.Tenant)]
    [InlineData((int)ClientType.DfrntAdmin)]
    public async Task EveryOtherAudience_GetsTheTenantViewsAndNotTheNpOne(int clientTypeId)
    {
        await SeedViewsAsync();
        var repository = CreateRepository(new ScopeContext(clientTypeId, ClientId: 5, NpAgentId: null));

        var views = await repository.GetViewsByUserAndPageAsync(1, AppPage.Dispatch);

        Assert.Equal(["Central", "West Mid"], views.Select(v => v.Name).OrderBy(n => n, StringComparer.Ordinal));
    }

    [Fact]
    public async Task UnresolvedScope_IsTreatedAsTheTenantAudience()
    {
        await SeedViewsAsync();
        var repository = CreateRepository(ScopeContext.Unscoped);

        var views = await repository.GetViewsByUserAndPageAsync(1, AppPage.Dispatch);

        Assert.DoesNotContain("NP All Jobs", views.Select(v => v.Name));
    }

    [Fact]
    public async Task StillScopesToTheRequestedPage()
    {
        await SeedViewsAsync();
        var repository = CreateRepository(new ScopeContext((int)ClientType.Customer, 5, null));

        var views = await repository.GetViewsByUserAndPageAsync(1, AppPage.JobSearch);

        Assert.Equal(["Central"], views.Select(v => v.Name));
    }
}
