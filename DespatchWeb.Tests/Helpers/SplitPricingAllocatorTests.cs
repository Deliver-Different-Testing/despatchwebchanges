using static DespatchWeb.Helpers.SplitPricingAllocator;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Unit tests for the split pricing allocation maths — the KT1314V fix. Splitting must divide the
/// parent's lines across the legs proportional to each leg's share of trip miles, while leaving the
/// parent's total (and therefore the client invoice) untouched.
/// </summary>
public class SplitPricingAllocatorTests
{
    private static readonly ParentLine Base = new(1, "Base", 64.00m, 32.00m);
    private static readonly ParentLine BaseFuel = new(2, "Base Fuel", 16.00m, 12.00m);
    private static readonly ParentLine Congestion = new(3, "Congestion", 9.00m, 6.00m);

    private static List<ParentLine> Kt1314VLines() => [Base, BaseFuel, Congestion];

    private static List<LegWeight> Legs(decimal milesA, decimal milesB) =>
        [new(1, "A", milesA), new(2, "B", milesB)];

    [Fact]
    public void Shares_AreProportionalToMiles()
    {
        var shares = Shares(Legs(9m, 1m));

        Assert.Equal(0.9m, shares[0]);
        Assert.Equal(0.1m, shares[1]);
    }

    [Fact]
    public void Shares_FallBackToEvenSplit_WhenNoLegHasMiles()
    {
        var shares = Shares(Legs(0m, 0m));

        Assert.Equal(0.5m, shares[0]);
        Assert.Equal(0.5m, shares[1]);
    }

    [Fact]
    public void Shares_PreferUserOverrides_NormalisedToOne()
    {
        var legs = new List<LegWeight>
        {
            new(1, "A", 5m, 70m),
            new(2, "B", 5m, 30m)
        };

        var shares = Shares(legs);

        Assert.Equal(0.7m, shares[0]);
        Assert.Equal(0.3m, shares[1]);
    }

    [Fact]
    public void Shares_AlwaysTotalExactlyOne_EvenForRepeatingFractions()
    {
        var shares = Shares([new LegWeight(1, "A", 1m), new LegWeight(2, "B", 1m), new LegWeight(3, "C", 1m)]);

        Assert.Equal(1m, shares.Sum());
    }

    [Fact]
    public void Allocate_SplitsEveryLinePerLeg_WithPartSuffixedNames()
    {
        var allocated = Allocate(Kt1314VLines(), Legs(7m, 3m));

        Assert.Equal(6, allocated.Count);
        Assert.Equal(
            ["Base Part A", "Base Part B", "Base Fuel Part A", "Base Fuel Part B", "Congestion Part A", "Congestion Part B"
            ],
            allocated.Select(l => l.ChargeName));

        var legA = allocated.Where(l => l.LetterSuffix == "A").ToList();
        Assert.Equal(44.80m, legA[0].ChargeAmount);
        Assert.Equal(22.40m, legA[0].CostAmount);
        Assert.Equal(11.20m, legA[1].ChargeAmount);
        Assert.Equal(6.30m, legA[2].ChargeAmount);
    }

    [Fact]
    public void Allocate_CarriesTheShareUsedForEachLine_AsAPercent()
    {
        var allocated = Allocate(Kt1314VLines(), Legs(7m, 3m));

        Assert.All(allocated.Where(l => l.LetterSuffix == "A"), l => Assert.Equal(70m, l.SharePercent));
        Assert.All(allocated.Where(l => l.LetterSuffix == "B"), l => Assert.Equal(30m, l.SharePercent));
    }

    [Fact]
    public void Allocate_CarriesThePerLineOverrideShare_WhenOneWasGiven()
    {
        var lines = Kt1314VLines();
        var overrides = new List<LineShareOverride> { new(Congestion.PricingBreakdownId, 1, 100m) };
        var allocated = Allocate(lines, Legs(7m, 3m), overrides);

        var congestion = allocated.Where(l => l.PricingBreakdownId == Congestion.PricingBreakdownId).ToList();
        Assert.Equal(100m, congestion.Single(l => l.LetterSuffix == "A").SharePercent);
        Assert.Equal(0m, congestion.Single(l => l.LetterSuffix == "B").SharePercent);
    }

    [Fact]
    public void Allocate_UsesACostOverride_ForThatLegOnly()
    {
        var lines = Kt1314VLines();
        var overrides = new List<LineShareOverride>
        {
            new(Congestion.PricingBreakdownId, 1, 70m, CostOverride: 1.00m),
            new(Congestion.PricingBreakdownId, 2, 30m)
        };
        var allocated = Allocate(lines, Legs(7m, 3m), overrides);

        var congestion = allocated.Where(l => l.PricingBreakdownId == Congestion.PricingBreakdownId).ToList();
        var legA = congestion.Single(l => l.LetterSuffix == "A");
        var legB = congestion.Single(l => l.LetterSuffix == "B");

        Assert.Equal(1.00m, legA.CostAmount);
        Assert.Equal(1.00m, legA.CostOverride);
        Assert.Equal(1.80m, legB.CostAmount);
        Assert.Null(legB.CostOverride);

        Assert.Equal(6.30m, legA.ChargeAmount);
        Assert.Equal(2.70m, legB.ChargeAmount);
    }

    [Fact]
    public void Allocate_PreservesEachLinesTotal_SoTheParentTotalIsUnchanged()
    {
        var lines = Kt1314VLines();
        var allocated = Allocate(lines, Legs(1m, 2m));

        Assert.Equal(lines.Sum(l => l.ChargeAmount), allocated.Sum(l => l.ChargeAmount));
        Assert.Equal(lines.Sum(l => l.CostAmount ?? 0m), allocated.Sum(l => l.CostAmount ?? 0m));
    }

    [Fact]
    public void Allocate_LastLegAbsorbsTheRoundingRemainder()
    {
        var lines = new List<ParentLine> {new(1, "Base", 10.00m, null)};
        var legs = new List<LegWeight> {new(1, "A", 1m), new(2, "B", 1m), new(3, "C", 1m)};

        var allocated = Allocate(lines, legs);

        Assert.Equal(3.33m, allocated[0].ChargeAmount);
        Assert.Equal(3.33m, allocated[1].ChargeAmount);
        Assert.Equal(3.34m, allocated[2].ChargeAmount);
        Assert.Equal(10.00m, allocated.Sum(l => l.ChargeAmount));
    }

    [Fact]
    public void Allocate_LeavesCostNull_WhenTheSourceLineHasNone()
    {
        var allocated = Allocate([new ParentLine(1, "Base", 10.00m, null)], Legs(1m, 1m));

        Assert.All(allocated, l => Assert.Null(l.CostAmount));
    }

    [Fact]
    public void Allocate_CarriesTheAccessorialFlagThrough()
    {
        var allocated = Allocate(
            [new ParentLine(1, "Wait Time", 20.00m, 10.00m, IsAccessorial: true)], Legs(1m, 1m));

        Assert.All(allocated, l => Assert.True(l.IsAccessorial));
    }

    [Fact]
    public void Allocate_ReturnsNothing_WhenThereAreNoLinesOrNoLegs()
    {
        Assert.Empty(Allocate([], Legs(1m, 1m)));
        Assert.Empty(Allocate(Kt1314VLines(), []));
    }

    [Fact]
    public void Allocate_GivesAnOverriddenLineItsOwnShares_LeavingTheOtherLinesOnTheLegSplit()
    {
        var allocated = Allocate(
            Kt1314VLines(),
            Legs(7m, 3m),
            [new LineShareOverride(Congestion.PricingBreakdownId, 1, 100m),
                new LineShareOverride(Congestion.PricingBreakdownId, 2, 0m)]);

        var congestion = allocated.Where(l => l.PricingBreakdownId == 3).ToList();
        Assert.Equal(9.00m, congestion[0].ChargeAmount);
        Assert.Equal(6.00m, congestion[0].CostAmount);
        Assert.Equal(0.00m, congestion[1].ChargeAmount);
        Assert.Equal(0.00m, congestion[1].CostAmount);

        Assert.Equal(44.80m, allocated.First(l => l.ChargeName == "Base Part A").ChargeAmount);
        Assert.Equal(19.20m, allocated.First(l => l.ChargeName == "Base Part B").ChargeAmount);
        Assert.Equal(11.20m, allocated.First(l => l.ChargeName == "Base Fuel Part A").ChargeAmount);
    }

    [Fact]
    public void Allocate_PreservesTheParentTotal_EvenWithAnOverriddenLine()
    {
        var lines = Kt1314VLines();
        var allocated = Allocate(
            lines,
            Legs(7m, 3m),
            [new LineShareOverride(3, 1, 100m), new LineShareOverride(3, 2, 0m)]);

        Assert.Equal(lines.Sum(l => l.ChargeAmount), allocated.Sum(l => l.ChargeAmount));
        Assert.Equal(lines.Sum(l => l.CostAmount ?? 0m), allocated.Sum(l => l.CostAmount ?? 0m));
    }

    [Fact]
    public void Allocate_NormalisesAnOverride_ThatDoesNotAddUpToOneHundred()
    {
        var allocated = Allocate(
            [Base],
            Legs(7m, 3m),
            [new LineShareOverride(1, 1, 3m), new LineShareOverride(1, 2, 1m)]);

        Assert.Equal(48.00m, allocated[0].ChargeAmount);
        Assert.Equal(16.00m, allocated[1].ChargeAmount);
    }

    [Fact]
    public void Allocate_TreatsAMissingLegAsZero_SoOneLegCanTakeTheWholeLine()
    {
        var allocated = Allocate([Congestion], Legs(7m, 3m), [new LineShareOverride(3, 2, 100m)]);

        Assert.Equal(0.00m, allocated[0].ChargeAmount);
        Assert.Equal(9.00m, allocated[1].ChargeAmount);
    }

    [Fact]
    public void Allocate_IgnoresOverrides_ForAnUnknownLineOrWithNoShareAtAll()
    {
        var allocated = Allocate(
            [Base, Congestion],
            Legs(7m, 3m),
            [new LineShareOverride(999, 1, 100m),
                new LineShareOverride(3, 1, 0m),
                new LineShareOverride(3, 2, 0m)]);

        Assert.Equal(44.80m, allocated[0].ChargeAmount);
        Assert.Equal(19.20m, allocated[1].ChargeAmount);
        Assert.Equal(6.30m, allocated[2].ChargeAmount);
        Assert.Equal(2.70m, allocated[3].ChargeAmount);
    }

    [Fact]
    public void Allocate_ScalesMileageInTheName_ByTheLinesOwnShare()
    {
        var allocated = Allocate(
            [new ParentLine(1, "Base (100 miles)", 64.00m, null)],
            Legs(7m, 3m),
            [new LineShareOverride(1, 1, 25m), new LineShareOverride(1, 2, 75m)]);

        Assert.Equal("Base (25 miles) Part A", allocated[0].ChargeName);
        Assert.Equal("Base (75 miles) Part B", allocated[1].ChargeName);
    }

    [Fact]
    public void EnsureLines_SynthesisesASingleLine_WhenTheParentHasNoBreakdown()
    {
        var lines = EnsureLines([], 44.50m, 25.00m);

        var line = Assert.Single(lines);
        Assert.Equal(ManuallyRatedChargeName, line.ChargeName);
        Assert.Equal(44.50m, line.ChargeAmount);
        Assert.Equal(25.00m, line.CostAmount);
    }

    [Fact]
    public void EnsureLines_LeavesExistingLinesAlone()
    {
        var lines = Kt1314VLines();

        Assert.Same(lines, EnsureLines(lines, 89.00m, 50.00m));
    }

    [Theory]
    [InlineData("Base (108 miles)", 0.25, "Base (27 miles) Part A")]
    [InlineData("Distance (20 mi incl., 60 mi charged)", 0.5, "Distance (10 mi incl., 30 mi charged) Part A")]
    [InlineData("Base (10.5 miles)", 0.5, "Base (5.3 miles) Part A")]
    public void LegChargeName_ScalesMileageInTheName(string original, double share, string expected) =>
        Assert.Equal(expected, LegChargeName(original, "A", (decimal)share));

    [Fact]
    public void LegChargeName_LeavesNonMileageNamesAlone()
    {
        Assert.Equal("Congestion Part B", LegChargeName("Congestion", "B", 0.3m));
        Assert.Equal("Base (108 miles) Part B", LegChargeName("Base (108 miles)", "B", null));
    }

    [Fact]
    public void LegChargeName_TruncatesSoTheSuffixFitsTheColumn()
    {
        var name = LegChargeName(new string('x', 120), "A", null);

        Assert.Equal(MaxChargeNameLength, name.Length);
        Assert.EndsWith(" Part A", name);
    }

    [Theory]
    [InlineData(0, "A")]
    [InlineData(1, "B")]
    [InlineData(25, "Z")]
    [InlineData(26, "AA")]
    [InlineData(27, "AB")]
    public void LetterSuffix_UsesExcelStyleLetters(int index, string expected) =>
        Assert.Equal(expected, LetterSuffix(index));

    [Fact]
    public void SharesFromWeights_AndDistributeAmount_PreserveTheTotal()
    {
        var shares = SharesFromWeights([8m, 2m]);
        var amounts = DistributeAmount(89.00m, shares);

        Assert.Equal(71.20m, amounts[0]);
        Assert.Equal(17.80m, amounts[1]);
        Assert.Equal(89.00m, amounts.Sum());
    }

    [Theory]
    [InlineData("Distance (20 km)", 0.25, "Distance (5 km) Part A")]
    [InlineData("Base (10.5 km)", 0.5, "Base (5.3 km) Part A")]
    [InlineData("Distance (20 km incl., 60 km charged)", 0.5, "Distance (10 km incl., 30 km charged) Part A")]
    [InlineData("Base (108 miles)", 0.25, "Base (27 miles) Part A")]
    public void LegChargeName_ScalesKilometresAsWellAsMiles(string original, double share, string expected) =>
        Assert.Equal(expected, LegChargeName(original, "A", (decimal)share));

    [Fact]
    public void LegChargeName_LeavesUnitlessNumbersAlone()
    {
        Assert.Equal("Stop Offs (2) Part A", LegChargeName("Stop Offs (2)", "A", 0.5m));
    }

    [Fact]
    public void SharesFromWeights_NegativeTotal_StaysProportionalInsteadOfSplittingEvenly()
    {
        var shares = SharesFromWeights([-100m, -50m]);
        var amounts = DistributeAmount(-60.00m, shares);

        Assert.Equal(-40.00m, amounts[0]);
        Assert.Equal(-20.00m, amounts[1]);
        Assert.Equal(-60.00m, amounts.Sum());
    }

    [Fact]
    public void SharesFromWeights_MixedSignsWithNonZeroTotal_StaysProportional()
    {
        var shares = SharesFromWeights([100m, -20m]);
        var amounts = DistributeAmount(80.00m, shares);

        Assert.Equal(100.00m, amounts[0]);
        Assert.Equal(-20.00m, amounts[1]);
    }

    [Fact]
    public void SharesFromWeights_WeightsCancelToZero_FallsBackToAnEvenSplit()
    {
        var shares = SharesFromWeights([50m, -50m]);

        Assert.Equal(0.5m, shares[0]);
        Assert.Equal(0.5m, shares[1]);
    }
}
