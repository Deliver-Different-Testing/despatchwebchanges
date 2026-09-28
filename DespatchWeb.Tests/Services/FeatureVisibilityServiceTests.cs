using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// The dashboard-visibility rule DespatchWeb consumes from the DF-Admin feature
/// catalogue. Mirrors the configurator's ClientTypeFeatureResolver: a dashboard
/// reaches a session only when its ClientTypeFeature grant is visible AND the
/// catalogue row is ClientVisible AND its ReleaseStatus is Live.
/// </summary>
public class FeatureVisibilityServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private FeatureVisibilityService CreateService(ScopeContext scope)
    {
        var scopeProvider = Substitute.For<IScopeProvider>();
        scopeProvider.Scope.Returns(scope);
        return new FeatureVisibilityService(_db.CreateFactoryMock(), scopeProvider);
    }

    private static ScopeContext NpScope() =>
        new(ClientTypeId: (int)ClientType.NetworkPartner, ClientId: null, NpAgentId: 77);

    private async Task SeedAsync(params (Feature Feature, ClientTypeFeature[] Grants)[] rows)
    {
        await using var seed = _db.CreateContext();
        foreach (var (feature, grants) in rows)
        {
            seed.Features.Add(feature);
            seed.ClientTypeFeatures.AddRange(grants);
        }

        await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static Feature LiveFeature(string key, string parent = DashboardFeatureKeys.DespatchWebTile) =>
        new()
        {
            FeatureKey = key, DisplayName = key, ParentKey = parent,
            ClientVisible = true, ReleaseStatus = "Live"
        };

    private static ClientTypeFeature Grant(string key, int clientTypeId = (int)ClientType.NetworkPartner,
        bool visible = true) =>
        new() {FeatureKey = key, ClientTypeId = clientTypeId, Visible = visible};

    [Fact]
    public async Task NetworkPartner_ReturnsOnlyDashboardsGrantedToThatClientType()
    {
        await SeedAsync(
            (LiveFeature(DashboardFeatureKeys.Dispatch), [Grant(DashboardFeatureKeys.Dispatch)]),
            (LiveFeature(DashboardFeatureKeys.JobSearch), [Grant(DashboardFeatureKeys.JobSearch)]),
            // Granted to Customer, not to NP.
            (LiveFeature(DashboardFeatureKeys.Overview),
                [Grant(DashboardFeatureKeys.Overview, (int)ClientType.Customer)]),
            // Explicitly switched off for NP.
            (LiveFeature(DashboardFeatureKeys.CourierMap),
                [Grant(DashboardFeatureKeys.CourierMap, visible: false)]),
            // In the catalogue with no grant row at all — absent, not broken.
            (LiveFeature(DashboardFeatureKeys.Nationwide), []));

        var visible = await CreateService(NpScope()).GetVisibleDashboardsAsync();

        Assert.NotNull(visible);
        Assert.Equal(
            [DashboardFeatureKeys.Dispatch, DashboardFeatureKeys.JobSearch],
            visible.OrderBy(k => k, StringComparer.Ordinal));
    }

    [Fact]
    public async Task NetworkPartner_HidesFeatureThatIsNotClientVisibleOrNotLive()
    {
        var killSwitched = LiveFeature(DashboardFeatureKeys.Dispatch);
        killSwitched.ClientVisible = false;

        var stillDraft = LiveFeature(DashboardFeatureKeys.TaskDashboard);
        stillDraft.ReleaseStatus = "Draft";

        await SeedAsync(
            (killSwitched, [Grant(DashboardFeatureKeys.Dispatch)]),
            (stillDraft, [Grant(DashboardFeatureKeys.TaskDashboard)]),
            (LiveFeature(DashboardFeatureKeys.JobSearch), [Grant(DashboardFeatureKeys.JobSearch)]));

        var visible = await CreateService(NpScope()).GetVisibleDashboardsAsync();

        Assert.NotNull(visible);
        Assert.Equal([DashboardFeatureKeys.JobSearch], visible);
    }

    [Fact]
    public async Task NetworkPartner_IgnoresFeaturesOutsideTheDespatchWebTile()
    {
        await SeedAsync(
            (LiveFeature("hub-booking-recurring", "hub-tile-booking"), [Grant("hub-booking-recurring")]),
            (LiveFeature(DashboardFeatureKeys.Dispatch), [Grant(DashboardFeatureKeys.Dispatch)]));

        var visible = await CreateService(NpScope()).GetVisibleDashboardsAsync();

        Assert.NotNull(visible);
        Assert.Equal([DashboardFeatureKeys.Dispatch], visible);
    }

    [Fact]
    public async Task NetworkPartner_WithNothingGranted_ReturnsEmptySetNotNull()
    {
        await SeedAsync((LiveFeature(DashboardFeatureKeys.Dispatch), []));

        var visible = await CreateService(NpScope()).GetVisibleDashboardsAsync();

        Assert.NotNull(visible);
        Assert.Empty(visible);
    }

    [Theory]
    [InlineData((int)ClientType.Customer)]
    [InlineData((int)ClientType.Internal)]
    [InlineData((int)ClientType.Tenant)]
    [InlineData((int)ClientType.DfrntAdmin)]
    [InlineData((int)ClientType.ConnectedTenant)]
    public async Task NonNetworkPartnerSessions_AreNotGated(int clientTypeId)
    {
        // Nothing granted to anyone: an ungated audience must still be null
        // (every dashboard reachable), never an empty set.
        await SeedAsync((LiveFeature(DashboardFeatureKeys.Dispatch), []));

        var service = CreateService(new ScopeContext(clientTypeId, ClientId: 1, NpAgentId: null));

        Assert.Null(await service.GetVisibleDashboardsAsync());
    }

    [Fact]
    public async Task NoResolvedScope_IsNotGated()
    {
        var scopeProvider = Substitute.For<IScopeProvider>();
        scopeProvider.Scope.Returns((ScopeContext?)null);
        var service = new FeatureVisibilityService(_db.CreateFactoryMock(), scopeProvider);

        Assert.Null(await service.GetVisibleDashboardsAsync());
    }
}
