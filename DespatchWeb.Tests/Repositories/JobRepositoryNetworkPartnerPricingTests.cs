using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// What a logged-in network partner sees for money in the job detail modal: their pay
/// (CourierPayment + CourierFuel), never the tenant's PricingBreakdown rows, split grid or charge.
/// See network-partner-pay-visibility.md §3 and JobRepository.NetworkPartner.cs.
/// </summary>
public class JobRepositoryNetworkPartnerPricingTests : IAsyncDisposable
{
    private const int OwnAgentId = 77;
    private const int OtherAgentId = 88;

    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryNetworkPartnerPricingTests()
    {
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private static ScopeContext NpScope(int npAgentId) =>
        new(ClientTypeId: (int)ClientType.NetworkPartner, ClientId: null, NpAgentId: npAgentId);

    private static ScopeContext TenantScope() =>
        new(ClientTypeId: (int)ClientType.Tenant, ClientId: null, NpAgentId: null);

    private DespatchContext CreateContext(ScopeContext scope)
    {
        var provider = Substitute.For<IScopeProvider>();
        provider.Scope.Returns(scope);
        return new DespatchContext(_db.Options, provider);
    }

    private JobRepository CreateRepository(DespatchContext context) => new(
        SqliteTestDatabase.CreateFactoryMock(context),
        _tenantInfoServiceMock,
        _clock,
        Substitute.For<IClearListEnvelopeService>(),
        Substitute.For<ICreateJobService>(),
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>());

    private async Task SeedAsync()
    {
        await using var seed = _db.CreateContext();
        seed.TucJobs.AddRange(
            new TucJob
            {
                UcjbId = 100, UcjbNumber = "OWN-LIVE", NpAgentId = OwnAgentId,
                UcjbAmount = 100.00m, CourierPayment = 57.00m, CourierFuel = 8.50m
            },
            new TucJob
            {
                UcjbId = 200, UcjbNumber = "OTHER-LIVE", NpAgentId = OtherAgentId,
                UcjbAmount = 300.00m, CourierPayment = 171.00m, CourierFuel = 20.00m
            });
        seed.TucJobArchives.Add(new TucJobArchive
        {
            UcjbId = 300, UcjbNumber = "OWN-ARCH", NpAgentId = OwnAgentId,
            UcjbAmount = 80.00m, CourierPayment = 45.60m, CourierFuel = 6.00m
        });
        seed.PricingBreakdowns.AddRange(
            new PricingBreakdown { PricingBreakdownId = 1, JobId = 100, ChargeName = "Base Charge", ChargeAmount = 100.00m, CostAmount = 57.00m },
            new PricingBreakdown { PricingBreakdownId = 2, JobId = 100, ChargeName = "Fuel Surcharge", ChargeAmount = 8.50m, CostAmount = 8.50m });
        await seed.SaveChangesAsync();
    }

    // ── Price breakdown (job detail modal) ───────────────────────────────

    [Fact]
    public async Task GetJobPriceBreakdownAsync_AsNetworkPartner_ReturnsPayLinesNotRevenueRows()
    {
        await SeedAsync();
        await using var context = CreateContext(NpScope(OwnAgentId));
        var repo = CreateRepository(context);

        var rows = await repo.GetJobPriceBreakdownAsync(100, isPrebook: false);

        Assert.Equal(2, rows.Count);
        Assert.Collection(rows,
            r =>
            {
                Assert.Equal("Base", r.Name);
                Assert.Equal(57.00m, r.Amount);
                Assert.Null(r.CostAmount);
                Assert.Equal(100, r.JobId);
            },
            r =>
            {
                Assert.Equal("Fuel", r.Name);
                Assert.Equal(8.50m, r.Amount);
                Assert.Null(r.CostAmount);
            });
        // The tenant's rows must not be present under any name.
        Assert.DoesNotContain(rows, r => r.Name == "Base Charge" || r.Amount == 100.00m);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_AsNetworkPartner_ArchivedJob_ReadsArchivePay()
    {
        await SeedAsync();
        await using var context = CreateContext(NpScope(OwnAgentId));
        var repo = CreateRepository(context);

        var rows = await repo.GetJobPriceBreakdownAsync(300, isPrebook: false, isArchived: true);

        Assert.Equal([45.60m, 6.00m], rows.Select(r => r.Amount).ToArray());
        Assert.All(rows, r => Assert.True(r.IsArchived));
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_AsNetworkPartner_OtherPartnersJob_ReturnsNothing()
    {
        await SeedAsync();
        await using var context = CreateContext(NpScope(OwnAgentId));
        var repo = CreateRepository(context);

        var rows = await repo.GetJobPriceBreakdownAsync(200, isPrebook: false);

        Assert.Empty(rows);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_AsTenant_StillReturnsRevenueRows()
    {
        await SeedAsync();
        await using var context = CreateContext(TenantScope());
        var repo = CreateRepository(context);

        var rows = await repo.GetJobPriceBreakdownAsync(100, isPrebook: false);

        Assert.Equal(2, rows.Count);
        Assert.Contains(rows, r => r.Name == "Base Charge" && r.Amount == 100.00m && r.CostAmount == 57.00m);
    }

    // ── Split grid (split job detail modal) ───────────────────────────────

    [Fact]
    public async Task GetSplitPricingBreakdownAsync_AsNetworkPartner_ReturnsNull()
    {
        await SeedAsync();
        await using var context = CreateContext(NpScope(OwnAgentId));
        var repo = CreateRepository(context);

        var grid = await repo.GetSplitPricingBreakdownAsync(100);

        Assert.Null(grid);
    }

    // ── Pay lookup ────────────────────────────────────────────────────────

    [Fact]
    public async Task GetNetworkPartnerPayAsync_LiveThenArchive_ThenNullWhenNotVisible()
    {
        await SeedAsync();
        await using var context = CreateContext(NpScope(OwnAgentId));
        var repo = CreateRepository(context);

        var live = await repo.GetNetworkPartnerPayAsync(100);
        var archived = await repo.GetNetworkPartnerPayAsync(300);
        var other = await repo.GetNetworkPartnerPayAsync(200);

        Assert.Equal(new NetworkPartnerPay(57.00m, 8.50m), live);
        Assert.Equal(65.50m, live!.Total);
        Assert.Equal(new NetworkPartnerPay(45.60m, 6.00m), archived);
        Assert.Null(other);
    }

    // ── Charge substitution on the job group (Pricing tile) ───────────────

    [Fact]
    public void ApplyNetworkPartnerCharges_ReplacesChargeOnJobAndRelated_NullsWhatPartnerCannotSee()
    {
        var group = new JobGroupViewModel
        {
            Job = new JobViewModel { Id = 100, Charge = 100.00m },
            RelatedJobs =
            [
                new JobViewModel { Id = 101, Charge = 250.00m },
                new JobViewModel { Id = 102, Charge = 999.00m }
            ]
        };
        var pay = new Dictionary<int, NetworkPartnerPay>
        {
            [100] = new(57.00m, 8.50m),
            [101] = new(120.00m, 0m)
        };

        JobRepository.ApplyNetworkPartnerCharges(group, pay);

        Assert.Equal(65.50m, group.Job.Charge);
        Assert.Equal(120.00m, group.RelatedJobs[0].Charge);
        Assert.Null(group.RelatedJobs[1].Charge);
    }

    [Fact]
    public void BuildNetworkPartnerBreakdown_UsesStableSyntheticIds()
    {
        var rows = JobRepository.BuildNetworkPartnerBreakdown(42, false, new NetworkPartnerPay(10m, 1m));

        Assert.Equal([-1, -2], rows.Select(r => r.ChargeId).ToArray());
        Assert.Equal(["Base", "Fuel"], rows.Select(r => r.Name).ToArray());
    }
}
