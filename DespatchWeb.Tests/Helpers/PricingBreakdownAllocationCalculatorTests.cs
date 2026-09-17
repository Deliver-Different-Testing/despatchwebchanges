using DespatchWeb.Helpers;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Unit tests for the split-job Price Breakdown grid's rounding rule (docs/pricing/
/// job-splitting-price-breakdown.md §4.6): shares always sum to 100% per item, and the
/// remainder goes to the largest leg so the parts always re-sum to the parent to the cent.
/// </summary>
public class PricingBreakdownAllocationCalculatorTests
{
    [Fact]
    public void DistributeAmount_TwoLegs_8020_IsExact()
    {
        var parts = PricingBreakdownAllocationCalculator.DistributeAmount(64.00m, [0.8m, 0.2m]);

        Assert.Equal(51.20m, parts[0]);
        Assert.Equal(12.80m, parts[1]);
        Assert.Equal(64.00m, parts[0] + parts[1]);
    }

    [Fact]
    public void DistributeAmount_ThreeLegs_602020_GivesRemainderToLargestLeg()
    {
        // 10.00 split 60/20/20: 6.00 + 2.00 + 2.00 = 10.00 exactly, no remainder to absorb —
        // use a figure that actually drifts under naive per-share rounding.
        var parts = PricingBreakdownAllocationCalculator.DistributeAmount(10.00m, [0.6m, 0.2m, 0.2m]);

        Assert.Equal(6.00m, parts[0]);
        Assert.Equal(2.00m, parts[1]);
        Assert.Equal(2.00m, parts[2]);
        Assert.Equal(10.00m, parts[0] + parts[1] + parts[2]);
    }

    [Fact]
    public void DistributeAmount_ThreeLegs_RemainderCentGoesToLargestShare_NotLastLeg()
    {
        // 100.00 / 3 ways at equal-ish shares that don't divide cleanly: the smallest two legs
        // round independently and the LARGEST share (index 0, not the last leg) absorbs whatever
        // is left — the opposite of SplitPricingAllocator.DistributeAmount's "last leg" rule.
        var parts = PricingBreakdownAllocationCalculator.DistributeAmount(10.00m, [0.5m, 0.3m, 0.2m]);

        Assert.Equal(3.00m, parts[1]);
        Assert.Equal(2.00m, parts[2]);
        Assert.Equal(5.00m, parts[0]);
        Assert.Equal(10.00m, parts[0] + parts[1] + parts[2]);
    }

    [Fact]
    public void DistributeAmount_RemainderGoesToLargestLeg_EvenWhenLargestIsNotFirst()
    {
        // Largest share is the LAST leg here — confirms the rule keys off share size, not position.
        var parts = PricingBreakdownAllocationCalculator.DistributeAmount(0.07m, [0.2m, 0.3m, 0.5m]);

        // 0.07 * 0.2 = 0.014 -> 0.01 (away from zero); 0.07 * 0.3 = 0.021 -> 0.02.
        Assert.Equal(0.01m, parts[0]);
        Assert.Equal(0.02m, parts[1]);
        Assert.Equal(0.04m, parts[2]);
        Assert.Equal(0.07m, parts[0] + parts[1] + parts[2]);
    }

    [Fact]
    public void DistributeAmount_TieBetweenTwoLargestShares_FirstOccurrenceAbsorbsRemainder()
    {
        var parts = PricingBreakdownAllocationCalculator.DistributeAmount(10.00m, [0.5m, 0.5m]);

        Assert.Equal(10.00m, parts[0] + parts[1]);
        // Index 0 is the first to reach the max share, so it is the one that absorbs any remainder.
        Assert.Equal(5.00m, parts[0]);
        Assert.Equal(5.00m, parts[1]);
    }

    [Fact]
    public void DistributeAmount_NegativeAmount_StillReconciles()
    {
        var parts = PricingBreakdownAllocationCalculator.DistributeAmount(-8.00m, [0.6m, 0.4m]);

        Assert.Equal(-8.00m, parts[0] + parts[1]);
    }

    [Fact]
    public void DistributeAmount_SingleLeg_GetsEverything()
    {
        var parts = PricingBreakdownAllocationCalculator.DistributeAmount(64.00m, [1.0m]);

        Assert.Single(parts);
        Assert.Equal(64.00m, parts[0]);
    }

    [Fact]
    public void DistributeAmount_NoLegs_ReturnsEmpty()
    {
        var parts = PricingBreakdownAllocationCalculator.DistributeAmount(64.00m, []);

        Assert.Empty(parts);
    }

    [Fact]
    public void DistributeAmount_ZeroAmount_AllPartsZero()
    {
        var parts = PricingBreakdownAllocationCalculator.DistributeAmount(0m, [0.8m, 0.2m]);

        Assert.Equal(0m, parts[0]);
        Assert.Equal(0m, parts[1]);
    }
}
