using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for the split pricing preview — the read-only proposal the user confirms before a
/// split is committed. Nothing here may write.
/// </summary>
public class SplitPricingPreviewServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _seedContext;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly IRateJobService _rateJobServiceMock = Substitute.For<IRateJobService>();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public SplitPricingPreviewServiceTests()
    {
        _seedContext = _db.CreateContext();
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _seedContext.DisposeAsync();
        await _db.DisposeAsync();
    }

    private SplitPricingPreviewService CreateService() =>
        new(_contextFactoryMock, _rateJobServiceMock, _tenantInfoServiceMock);

    private static AddressViewModel MeetingPoint() => new(
        addressLine1: "611 5th Ave",
        addressLine2: string.Empty,
        addressLine3: string.Empty,
        addressLine4: string.Empty,
        addressLine5: "New York",
        addressLine6: string.Empty,
        addressLine7: "10022",
        addressLine8: string.Empty)
    {
        Latitude = 40.7580m,
        Longitude = -73.9770m
    };

    /// <summary>The KT1314V job: 89.00 revenue / 50.00 cost across Base, Base Fuel and Congestion.</summary>
    private void SeedKt1314V(bool withLines = true, bool withCoordinates = true)
    {
        _seedContext.TucJobs.Add(new TucJob
        {
            UcjbId = 100,
            UcjbNumber = "KT1314V",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2026, 8, 4),
            UcjbAmount = 89.00m,
            CourierPayment = 50.00m,
            PickUpLatitude = withCoordinates ? 40.7644m : null,
            PickUpLongitude = withCoordinates ? -73.8730m : null,
            DeliveryLatitude = withCoordinates ? 40.7484m : null,
            DeliveryLongitude = withCoordinates ? -73.9857m : null
        });

        if (withLines)
        {
            _seedContext.PricingBreakdowns.AddRange(
                new PricingBreakdown {JobId = 100, ChargeName = "Base", ChargeAmount = 64.00m, CostAmount = 32.00m},
                new PricingBreakdown
                {
                    JobId = 100, ChargeName = "Base Fuel", ChargeAmount = 16.00m, CostAmount = 12.00m
                },
                new PricingBreakdown
                {
                    JobId = 100, ChargeName = "Congestion", ChargeAmount = 9.00m, CostAmount = 6.00m
                });
        }

        _seedContext.SaveChanges();
    }

    [Fact]
    public async Task PreviewAsync_ProposesPerLegLines_ProportionalToRoadMiles()
    {
        SeedKt1314V();
        // Leg A (from the job's pickup) covers 7 miles; leg B (from the meeting point) covers 3.
        _rateJobServiceMock
            .GetRoadDistanceMilesAsync(Arg.Any<decimal?>(), Arg.Any<decimal?>(), Arg.Any<decimal?>(),
                Arg.Any<decimal?>())
            .Returns(call => call.ArgAt<decimal?>(0) == 40.7644m ? 7d : 3d);

        var preview = await CreateService().PreviewAsync(100, MeetingPoint(),
            TestContext.Current.CancellationToken);

        Assert.Equal("RoadMiles", preview.Basis);
        Assert.False(preview.IsSynthesised);
        Assert.Equal(89.00m, preview.ParentTotalRevenue);
        Assert.Equal(50.00m, preview.ParentTotalCost);

        var legA = preview.Legs.Single(l => l.Sequence == 1);
        var legB = preview.Legs.Single(l => l.Sequence == 2);

        Assert.Equal("KT1314VA", legA.JobNumber);
        Assert.Equal("KT1314VB", legB.JobNumber);
        Assert.Equal(7m, legA.Distance);
        Assert.Equal(70m, legA.SharePercent);
        Assert.Equal(30m, legB.SharePercent);

        // Per-leg lines, named as the bug report's Expected section requires.
        Assert.Equal(
            ["Base Part A", "Base Fuel Part A", "Congestion Part A"],
            legA.Lines.Select(l => l.Name));
        Assert.Equal(
            ["Base Part B", "Base Fuel Part B", "Congestion Part B"],
            legB.Lines.Select(l => l.Name));

        Assert.Equal(62.30m, legA.TotalRevenue);
        Assert.Equal(26.70m, legB.TotalRevenue);
        Assert.Equal(35.00m, legA.TotalCost);
        Assert.Equal(15.00m, legB.TotalCost);

        // The legs always add back to the parent — the invoice guarantee the dialog states.
        Assert.Equal(89.00m, preview.Legs.Sum(l => l.TotalRevenue));
        Assert.Equal(50.00m, preview.Legs.Sum(l => l.TotalCost));
    }

    [Fact]
    public async Task PreviewAsync_ReturnsTheUndividedParentLines_SoASingleLineCanBeOverridden()
    {
        SeedKt1314V();

        var preview = await CreateService().PreviewAsync(100, MeetingPoint(),
            TestContext.Current.CancellationToken);

        // Original names, not the "Part A" copies — this is what the dialog offers a share against.
        Assert.Equal(["Base", "Base Fuel", "Congestion"], preview.ParentLines.Select(l => l.Name));
        Assert.Equal(89.00m, preview.ParentLines.Sum(l => l.Revenue));
        Assert.Equal(50.00m, preview.ParentLines.Sum(l => l.Cost));

        // Every parent line is addressable, and its per-leg copies point back at it.
        Assert.All(preview.ParentLines, l => Assert.True(l.PricingBreakdownId > 0));
        var congestionId = preview.ParentLines.Single(l => l.Name == "Congestion").PricingBreakdownId;
        Assert.Equal(
            congestionId,
            preview.Legs[0].Lines.Single(l => l.Name == "Congestion Part A").PricingBreakdownId);
    }

    [Fact]
    public async Task PreviewAsync_WritesNothing()
    {
        SeedKt1314V();

        await CreateService().PreviewAsync(100, MeetingPoint(), TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        // Still the three original unattributed parent rows, and no child jobs.
        var lines = await verifyCtx.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken);
        Assert.Equal(3, lines.Count);
        Assert.All(lines, l => Assert.Null(l.ChildJobId));
        Assert.Equal(1, await verifyCtx.TucJobs.CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task PreviewAsync_FallsBackToStraightLineMiles_WhenNoRoadDistanceIsAvailable()
    {
        SeedKt1314V();

        var preview = await CreateService().PreviewAsync(100, MeetingPoint(),
            TestContext.Current.CancellationToken);

        Assert.Equal("StraightLine", preview.Basis);
        Assert.All(preview.Legs, l => Assert.True(l.Distance > 0m));
        Assert.Equal(100m, preview.Legs.Sum(l => l.SharePercent));
        Assert.Equal(89.00m, preview.Legs.Sum(l => l.TotalRevenue));
    }

    [Fact]
    public async Task PreviewAsync_ReportsAnEvenSplit_WhenTheJobHasNoCoordinates()
    {
        SeedKt1314V(withCoordinates: false);

        var preview = await CreateService().PreviewAsync(100, MeetingPoint(),
            TestContext.Current.CancellationToken);

        Assert.Equal("EvenSplit", preview.Basis);
        Assert.All(preview.Legs, l => Assert.Equal(0m, l.Distance));
        Assert.All(preview.Legs, l => Assert.Equal(50m, l.SharePercent));
        Assert.Equal(44.50m, preview.Legs[0].TotalRevenue);
    }

    [Fact]
    public async Task PreviewAsync_FlagsASynthesisedLine_WhenTheJobHasNoBreakdown()
    {
        SeedKt1314V(withLines: false);

        var preview = await CreateService().PreviewAsync(100, MeetingPoint(),
            TestContext.Current.CancellationToken);

        Assert.True(preview.IsSynthesised);
        // Divides the header amount and driver pay instead of leaving the dialog empty.
        Assert.Equal(89.00m, preview.ParentTotalRevenue);
        Assert.Equal(50.00m, preview.ParentTotalCost);
        Assert.Equal("Manually Rated Part A", preview.Legs[0].Lines.Single().Name);
        // The synthesised line has no row behind it, so it can't be singled out in the dialog.
        Assert.Equal(0, preview.ParentLines.Single().PricingBreakdownId);
    }

    [Fact]
    public async Task PreviewAsync_UsTenant_ReportsLegDistancesInMiles()
    {
        SeedKt1314V();
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        _rateJobServiceMock
            .GetRoadDistanceMilesAsync(Arg.Any<decimal?>(), Arg.Any<decimal?>(), Arg.Any<decimal?>(),
                Arg.Any<decimal?>())
            .Returns(call => call.ArgAt<decimal?>(0) == 40.7644m ? 7d : 3d);

        var preview = await CreateService().PreviewAsync(100, MeetingPoint(),
            TestContext.Current.CancellationToken);

        Assert.Equal("mi", preview.DistanceUnit);
        Assert.Equal(7m, preview.Legs.Single(l => l.Sequence == 1).Distance);
    }

    [Fact]
    public async Task PreviewAsync_NzTenant_ReportsLegDistancesInKilometres()
    {
        // The routing engine answers in miles; NZ reads distance in kilometres, so the figure shown
        // has to be converted rather than relabelled — and the shares are unaffected either way.
        SeedKt1314V();
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _rateJobServiceMock
            .GetRoadDistanceMilesAsync(Arg.Any<decimal?>(), Arg.Any<decimal?>(), Arg.Any<decimal?>(),
                Arg.Any<decimal?>())
            .Returns(call => call.ArgAt<decimal?>(0) == 40.7644m ? 7d : 3d);

        var preview = await CreateService().PreviewAsync(100, MeetingPoint(),
            TestContext.Current.CancellationToken);

        Assert.Equal("km", preview.DistanceUnit);
        Assert.Equal(11.27m, preview.Legs.Single(l => l.Sequence == 1).Distance);
        Assert.Equal(4.83m, preview.Legs.Single(l => l.Sequence == 2).Distance);

        // Converting the display figure must not move the money.
        Assert.Equal(70m, preview.Legs.Single(l => l.Sequence == 1).SharePercent);
        Assert.Equal(89.00m, preview.Legs.Sum(l => l.TotalRevenue));
    }

    [Fact]
    public async Task PreviewAsync_ThrowsWhenTheJobDoesNotExist()
    {
        var service = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await service.PreviewAsync(999, MeetingPoint(), TestContext.Current.CancellationToken));

        Assert.Contains("Job 999 not found", ex.Message);
    }
}
