using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// A network partner's maps open on their own address rather than the geographic
/// centre of the tenant's country. The address comes from the agent record the
/// NpAgentId claim already points at — the same claim that scopes their job rows.
/// </summary>
public class NetworkPartnerContextServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private NetworkPartnerContextService CreateService(ScopeContext scope)
    {
        var scopeProvider = Substitute.For<IScopeProvider>();
        scopeProvider.Scope.Returns(scope);
        return new NetworkPartnerContextService(_db.CreateFactoryMock(), scopeProvider);
    }

    private async Task SeedAgentAsync(int id, decimal? latitude, decimal? longitude)
    {
        await using var seed = _db.CreateContext();
        seed.TucAgents.Add(new TucAgent
        {
            UcagId = id,
            UcagName = $"Agent {id}",
            CreatedBy = "test",
            LastModifiedBy = "test",

            Latitude = latitude,
            Longitude = longitude
        });
        await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static ScopeContext NpScope(int? npAgentId) =>
        new((int)ClientType.NetworkPartner, ClientId: null, NpAgentId: npAgentId);

    [Fact]
    public async Task NetworkPartner_ReturnsTheirGeocodedAgentAddress()
    {
        await SeedAgentAsync(77, -36.8485m, 174.7633m);

        var centre = await CreateService(NpScope(77)).GetMapCentreAsync();

        Assert.Equal(new MapCentre(-36.8485m, 174.7633m), centre);
    }

    [Fact]
    public async Task NetworkPartner_WithUngeocodedAgent_ReturnsNull()
    {
        // Half a coordinate is not a location — fall back to the country centre.
        await SeedAgentAsync(77, -36.8485m, null);

        Assert.Null(await CreateService(NpScope(77)).GetMapCentreAsync());
    }

    [Fact]
    public async Task NetworkPartner_WithNoAgentRecord_ReturnsNull()
    {
        Assert.Null(await CreateService(NpScope(404)).GetMapCentreAsync());
    }

    [Fact]
    public async Task NetworkPartner_WithNoAgentLinkage_ReturnsNull()
    {
        await SeedAgentAsync(77, -36.8485m, 174.7633m);

        Assert.Null(await CreateService(NpScope(null)).GetMapCentreAsync());
    }

    [Theory]
    [InlineData((int)ClientType.Customer)]
    [InlineData((int)ClientType.Tenant)]
    [InlineData((int)ClientType.DfrntAdmin)]
    public async Task EveryOtherAudience_KeepsTheCountryCentre(int clientTypeId)
    {
        await SeedAgentAsync(77, -36.8485m, 174.7633m);

        var service = CreateService(new ScopeContext(clientTypeId, ClientId: 1, NpAgentId: 77));

        Assert.Null(await service.GetMapCentreAsync());
    }
}
