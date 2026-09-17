using DespatchWeb.EntityClasses;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for PricingBreakdownAllocationService — the single write path for a split parent
/// job's PricingBreakdownAllocation rows (docs/pricing/job-splitting-price-breakdown.md). Uses
/// SQLite in-memory so the read-mutate-save + ExecuteUpdateAsync header writes run for real.
/// </summary>
public class PricingBreakdownAllocationServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly PricingBreakdownAllocationService _service = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private async Task<int> SeedParentItemAsync(int parentJobId, string chargeName, decimal chargeAmount, decimal? costAmount, bool isAccessorial = false)
    {
        await using var context = _db.CreateContext();
        var item = new PricingBreakdown
        {
            JobId = parentJobId,
            ChargeName = chargeName,
            ChargeAmount = chargeAmount,
            CostAmount = costAmount,
            IsAccessorial = isAccessorial
        };
        context.PricingBreakdowns.Add(item);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return item.PricingBreakdownId;
    }

    private async Task SeedJobsAsync(int parentJobId, params (int Id, string Number, bool Void)[] legs)
    {
        await using var context = _db.CreateContext();
        context.TucJobs.Add(new TucJob { UcjbId = parentJobId, UcjbNumber = $"J{parentJobId}", UcjbDate = new DateTime(2026, 9, 16) });
        foreach (var leg in legs)
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = leg.Id,
                UcjbNumber = leg.Number,
                UcjbDate = new DateTime(2026, 9, 16),
                ParentId = parentJobId,
                UcjbVoid = leg.Void
            });
        }
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<PricingBreakdownAllocation>> GetAllocationsAsync(int parentPricingBreakdownId)
    {
        await using var context = _db.CreateContext();
        return context.PricingBreakdownAllocations
            .Where(a => a.ParentPricingBreakdownId == parentPricingBreakdownId)
            .OrderBy(a => a.LegJobId)
            .ToList();
    }

    private async Task<TucJob> GetJobAsync(int jobId)
    {
        await using var context = _db.CreateContext();
        return context.TucJobs.Single(j => j.UcjbId == jobId);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_SeedsNewRows_FromExplicitShares()
    {
        await SeedJobsAsync(100, (101, "J100A", false), (102, "J100B", false));
        var itemId = await SeedParentItemAsync(100, "Base", 64.00m, 32.00m);

        await using var context = _db.CreateContext();
        var seeds = new Dictionary<(int, int), decimal>
        {
            [(itemId, 101)] = 80m,
            [(itemId, 102)] = 20m
        };
        await _service.RewriteAllocationsForParentAsync(context, 100, seeds, ct: TestContext.Current.CancellationToken);

        var rows = await GetAllocationsAsync(itemId);
        Assert.Equal(2, rows.Count);
        var legA = rows.Single(r => r.LegJobId == 101);
        var legB = rows.Single(r => r.LegJobId == 102);
        Assert.Equal(80m, legA.SharePercent);
        Assert.Equal(51.20m, legA.ChargeAmount);
        Assert.Equal(25.60m, legA.CostAmount);
        Assert.Null(legA.CostOverride);
        Assert.Equal(20m, legB.SharePercent);
        Assert.Equal(12.80m, legB.ChargeAmount);
        Assert.Equal(6.40m, legB.CostAmount);

        var jobA = await GetJobAsync(101);
        Assert.Equal(51.20m, jobA.UcjbAmount);
        Assert.Equal(25.60m, jobA.CourierPayment);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_SeedCostOverrides_SeedsANewRowsOverride()
    {
        await SeedJobsAsync(1100, (1101, "J1100A", false), (1102, "J1100B", false));
        var itemId = await SeedParentItemAsync(1100, "Base", 64.00m, 32.00m);

        await using var context = _db.CreateContext();
        var seeds = new Dictionary<(int, int), decimal> { [(itemId, 1101)] = 80m, [(itemId, 1102)] = 20m };
        var costOverrideSeeds = new Dictionary<(int, int), decimal> { [(itemId, 1101)] = 5.00m };
        await _service.RewriteAllocationsForParentAsync(
            context, 1100, seeds, seedCostOverrides: costOverrideSeeds, ct: TestContext.Current.CancellationToken);

        var rows = await GetAllocationsAsync(itemId);
        var legA = rows.Single(r => r.LegJobId == 1101);
        var legB = rows.Single(r => r.LegJobId == 1102);

        Assert.Equal(5.00m, legA.CostAmount);
        Assert.Equal(5.00m, legA.CostOverride);
        Assert.Equal(6.40m, legB.CostAmount);
        Assert.Null(legB.CostOverride);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_SeedCostOverrides_NeverAppliedToAnExistingRow()
    {
        await SeedJobsAsync(1200, (1201, "J1200A", false), (1202, "J1200B", false));
        var itemId = await SeedParentItemAsync(1200, "Base", 64.00m, 32.00m);

        await using (var context = _db.CreateContext())
        {
            var seeds = new Dictionary<(int, int), decimal> { [(itemId, 1201)] = 80m, [(itemId, 1202)] = 20m };
            await _service.RewriteAllocationsForParentAsync(context, 1200, seeds, ct: TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            var row = context.PricingBreakdownAllocations.Single(a => a.ParentPricingBreakdownId == itemId && a.LegJobId == 1201);
            row.CostOverride = 9.00m;
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            var staleSeed = new Dictionary<(int, int), decimal> { [(itemId, 1201)] = 1.00m };
            await _service.RewriteAllocationsForParentAsync(
                context, 1200, seedCostOverrides: staleSeed, ct: TestContext.Current.CancellationToken);
        }

        var legA = (await GetAllocationsAsync(itemId)).Single(r => r.LegJobId == 1201);
        Assert.Equal(9.00m, legA.CostOverride);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_ReRunAfterRevenueEdit_PreservesShare_RecomputesAmount()
    {
        await SeedJobsAsync(200, (201, "J200A", false), (202, "J200B", false));
        var itemId = await SeedParentItemAsync(200, "Base", 100.00m, 40.00m);

        await using (var context = _db.CreateContext())
        {
            var seeds = new Dictionary<(int, int), decimal> { [(itemId, 201)] = 70m, [(itemId, 202)] = 30m };
            await _service.RewriteAllocationsForParentAsync(context, 200, seeds, ct: TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            var item = context.PricingBreakdowns.Single(p => p.PricingBreakdownId == itemId);
            item.ChargeAmount = 200.00m;
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            await _service.RewriteAllocationsForParentAsync(context, 200, ct: TestContext.Current.CancellationToken);
        }

        var rows = await GetAllocationsAsync(itemId);
        var legA = rows.Single(r => r.LegJobId == 201);
        var legB = rows.Single(r => r.LegJobId == 202);
        Assert.Equal(70m, legA.SharePercent);
        Assert.Equal(140.00m, legA.ChargeAmount);
        Assert.Equal(30m, legB.SharePercent);
        Assert.Equal(60.00m, legB.ChargeAmount);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_CostOverrideSurvivesAShareChange()
    {
        await SeedJobsAsync(300, (301, "J300A", false), (302, "J300B", false));
        var itemId = await SeedParentItemAsync(300, "Base", 100.00m, 50.00m);

        await using (var context = _db.CreateContext())
        {
            var seeds = new Dictionary<(int, int), decimal> { [(itemId, 301)] = 50m, [(itemId, 302)] = 50m };
            await _service.RewriteAllocationsForParentAsync(context, 300, seeds, ct: TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            var row = context.PricingBreakdownAllocations.Single(a => a.ParentPricingBreakdownId == itemId && a.LegJobId == 301);
            row.CostOverride = 10.00m;
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            var row = context.PricingBreakdownAllocations.Single(a => a.ParentPricingBreakdownId == itemId && a.LegJobId == 301);
            row.SharePercent = 70m;
            var other = context.PricingBreakdownAllocations.Single(a => a.ParentPricingBreakdownId == itemId && a.LegJobId == 302);
            other.SharePercent = 30m;
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            await _service.RewriteAllocationsForParentAsync(context, 300, ct: TestContext.Current.CancellationToken);
        }

        var rows = await GetAllocationsAsync(itemId);
        var legA = rows.Single(r => r.LegJobId == 301);
        Assert.Equal(10.00m, legA.CostOverride);
        Assert.Equal(10.00m, legA.CostAmount);
        Assert.Equal(70m, legA.SharePercent);

        var jobA = await GetJobAsync(301);
        Assert.Equal(10.00m, jobA.CourierPayment);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_NewItemDefaultsToAverageOfSiblingShares()
    {
        await SeedJobsAsync(400, (401, "J400A", false), (402, "J400B", false));
        var baseId = await SeedParentItemAsync(400, "Base", 100.00m, 40.00m);

        await using (var context = _db.CreateContext())
        {
            var seeds = new Dictionary<(int, int), decimal> { [(baseId, 401)] = 80m, [(baseId, 402)] = 20m };
            await _service.RewriteAllocationsForParentAsync(context, 400, seeds, ct: TestContext.Current.CancellationToken);
        }

        var congestionId = await SeedParentItemAsync(400, "Congestion", 10.00m, 4.00m);

        await using (var context = _db.CreateContext())
        {
            await _service.RewriteAllocationsForParentAsync(context, 400, ct: TestContext.Current.CancellationToken);
        }

        var rows = await GetAllocationsAsync(congestionId);
        Assert.Equal(2, rows.Count);
        Assert.Equal(80m, rows.Single(r => r.LegJobId == 401).SharePercent);
        Assert.Equal(8.00m, rows.Single(r => r.LegJobId == 401).ChargeAmount);
        Assert.Equal(20m, rows.Single(r => r.LegJobId == 402).SharePercent);
        Assert.Equal(2.00m, rows.Single(r => r.LegJobId == 402).ChargeAmount);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_FirstItemWithNoSiblingsAndNoSeed_DefaultsToEqualSplit()
    {
        await SeedJobsAsync(500, (501, "J500A", false), (502, "J500B", false), (503, "J500C", false));
        var itemId = await SeedParentItemAsync(500, "Base", 90.00m, null);

        await using var context = _db.CreateContext();
        await _service.RewriteAllocationsForParentAsync(context, 500, ct: TestContext.Current.CancellationToken);

        var rows = await GetAllocationsAsync(itemId);
        Assert.Equal(3, rows.Count);
        Assert.All(rows, r => Assert.Equal(Math.Round(100m / 3m, 6), Math.Round(r.SharePercent, 6)));
        Assert.Equal(90.00m, rows.Sum(r => r.ChargeAmount));
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_VoidLeg_HasItsAllocationRowsRemoved()
    {
        await SeedJobsAsync(600, (601, "J600A", false), (602, "J600B", false));
        var itemId = await SeedParentItemAsync(600, "Base", 100.00m, 40.00m);

        await using (var context = _db.CreateContext())
        {
            var seeds = new Dictionary<(int, int), decimal> { [(itemId, 601)] = 50m, [(itemId, 602)] = 50m };
            await _service.RewriteAllocationsForParentAsync(context, 600, seeds, ct: TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            var legB = context.TucJobs.Single(j => j.UcjbId == 602);
            legB.UcjbVoid = true;
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            await _service.RewriteAllocationsForParentAsync(context, 600, ct: TestContext.Current.CancellationToken);
        }

        var rows = await GetAllocationsAsync(itemId);
        Assert.Single(rows);
        Assert.Equal(601, rows[0].LegJobId);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_HeaderFuelTotal_SumsOnlyFuelClassifiedItems()
    {
        await SeedJobsAsync(700, (701, "J700A", false), (702, "J700B", false));
        var baseId = await SeedParentItemAsync(700, "Base", 100.00m, 40.00m);
        var fuelId = await SeedParentItemAsync(700, "Base Fuel", 20.00m, 15.00m);

        await using var context = _db.CreateContext();
        var seeds = new Dictionary<(int, int), decimal>
        {
            [(baseId, 701)] = 50m, [(baseId, 702)] = 50m,
            [(fuelId, 701)] = 50m, [(fuelId, 702)] = 50m
        };
        await _service.RewriteAllocationsForParentAsync(context, 700, seeds, ct: TestContext.Current.CancellationToken);

        var jobA = await GetJobAsync(701);
        Assert.Equal(60.00m, jobA.UcjbAmount);
        Assert.Equal(10.00m, jobA.FuelSurchargeAmount);
        Assert.Equal(27.50m, jobA.CourierPayment);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_SelfReferencingParentId_NeverTreatsTheRootAsItsOwnLeg()
    {
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(new TucJob { UcjbId = 1000, UcjbNumber = "J1000", UcjbDate = new DateTime(2026, 9, 16), ParentId = 1000 });
            context.TucJobs.Add(new TucJob { UcjbId = 1001, UcjbNumber = "J1000A", UcjbDate = new DateTime(2026, 9, 16), ParentId = 1000 });
            context.TucJobs.Add(new TucJob { UcjbId = 1002, UcjbNumber = "J1000B", UcjbDate = new DateTime(2026, 9, 16), ParentId = 1000 });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        var itemId = await SeedParentItemAsync(1000, "Base", 100.00m, null);

        await using var context2 = _db.CreateContext();
        var seeds = new Dictionary<(int, int), decimal> { [(itemId, 1001)] = 50m, [(itemId, 1002)] = 50m };
        await _service.RewriteAllocationsForParentAsync(context2, 1000, seeds, ct: TestContext.Current.CancellationToken);

        var rows = await GetAllocationsAsync(itemId);
        Assert.Equal(2, rows.Count);
        Assert.DoesNotContain(rows, r => r.LegJobId == 1000);
        Assert.Equal(50.00m, rows.Single(r => r.LegJobId == 1001).ChargeAmount);
        Assert.Equal(50.00m, rows.Single(r => r.LegJobId == 1002).ChargeAmount);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_ExplicitCurrentLegIds_OverridesSelfDiscoveryAndPrunesReplacedLeg()
    {
        await SeedJobsAsync(900, (901, "J900A", false), (902, "J900B", false));
        var itemId = await SeedParentItemAsync(900, "Base", 100.00m, 40.00m);

        await using (var context = _db.CreateContext())
        {
            var seeds = new Dictionary<(int, int), decimal> { [(itemId, 901)] = 50m, [(itemId, 902)] = 50m };
            await _service.RewriteAllocationsForParentAsync(context, 900, seeds, ct: TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(new TucJob { UcjbId = 903, UcjbNumber = "J900B1", UcjbDate = new DateTime(2026, 9, 16), ParentId = 902 });
            context.TucJobs.Add(new TucJob { UcjbId = 904, UcjbNumber = "J900B2", UcjbDate = new DateTime(2026, 9, 16), ParentId = 902 });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using (var context = _db.CreateContext())
        {
            var seeds = new Dictionary<(int, int), decimal> { [(itemId, 903)] = 25m, [(itemId, 904)] = 25m };
            await _service.RewriteAllocationsForParentAsync(
                context, 900, seeds, currentLegIds: [901, 903, 904], ct: TestContext.Current.CancellationToken);
        }

        var rows = await GetAllocationsAsync(itemId);
        Assert.Equal(3, rows.Count);
        Assert.DoesNotContain(rows, r => r.LegJobId == 902);
        Assert.Equal(50m, rows.Single(r => r.LegJobId == 901).SharePercent);
        Assert.Equal(25m, rows.Single(r => r.LegJobId == 903).SharePercent);
        Assert.Equal(25m, rows.Single(r => r.LegJobId == 904).SharePercent);
    }

    [Fact]
    public async Task RewriteAllocationsForParentAsync_NoLiveLegs_DoesNothing()
    {
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(new TucJob { UcjbId = 800, UcjbNumber = "J800", UcjbDate = new DateTime(2026, 9, 16) });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        var itemId = await SeedParentItemAsync(800, "Base", 64.00m, 32.00m);

        await using var context2 = _db.CreateContext();
        await _service.RewriteAllocationsForParentAsync(context2, 800, ct: TestContext.Current.CancellationToken);

        var rows = await GetAllocationsAsync(itemId);
        Assert.Empty(rows);
    }
}
