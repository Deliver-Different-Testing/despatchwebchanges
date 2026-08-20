using DespatchWeb.Repositories;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Unit tests for <see cref="RecurringJobRepository.BuildRepricePlan"/> — the pure
/// raw-base resolution + grouping that drives InsertRecurringToLive's batched
/// reprice. No database, so the pricing UDF is not involved here.
/// </summary>
public class RecurringJobRepositoryRepricePlanTests
{
    private static Dictionary<int, RecurringJobRepository.TemplatePricing> Pricing(
        params RecurringJobRepository.TemplatePricing[] rows) =>
        rows.ToDictionary(r => r.UcbkId);

    [Fact]
    public void UsesTemplateRawBaseDirectly_NoSelfHeal()
    {
        var pricing = Pricing(new RecurringJobRepository.TemplatePricing(10, null, 42m, 99m, 5m, false));

        var plan = RecurringJobRepository.BuildRepricePlan([(1, 10)], pricing);

        Assert.Empty(plan.SelfHealTemplateRawBases);
        Assert.Equal(1, plan.RepricedJobCount);
        var group = Assert.Single(plan.Groups);
        Assert.Equal(42m, group.RawBaseAmount);
        Assert.Equal([1], group.JobIds);
    }

    [Fact]
    public void WalksUpToParentRawBase_WhenTemplateRawBaseNull_NoSelfHeal()
    {
        var pricing = Pricing(
            new RecurringJobRepository.TemplatePricing(10, null, 100m, null, null, false),
            new RecurringJobRepository.TemplatePricing(11, 10, null, null, null, false));

        var plan = RecurringJobRepository.BuildRepricePlan([(1, 11)], pricing);

        Assert.Empty(plan.SelfHealTemplateRawBases);
        var group = Assert.Single(plan.Groups);
        Assert.Equal(100m, group.RawBaseAmount);
    }

    [Fact]
    public void FallsBackToFormula_RecordsSelfHeal()
    {
        // No raw base anywhere; derive headline (80) - fuel (5) = 75.
        var pricing = Pricing(new RecurringJobRepository.TemplatePricing(10, null, null, 80m, 5m, false));

        var plan = RecurringJobRepository.BuildRepricePlan([(1, 10)], pricing);

        Assert.Equal(75m, Assert.Single(plan.Groups).RawBaseAmount);
        Assert.Equal(75m, plan.SelfHealTemplateRawBases[10]);
    }

    [Fact]
    public void FormulaFallback_ClampsNegativeToZero()
    {
        var pricing = Pricing(new RecurringJobRepository.TemplatePricing(10, null, null, 5m, 20m, false));

        var plan = RecurringJobRepository.BuildRepricePlan([(1, 10)], pricing);

        Assert.Equal(0m, Assert.Single(plan.Groups).RawBaseAmount);
        Assert.Equal(0m, plan.SelfHealTemplateRawBases[10]);
    }

    [Fact]
    public void SkipsJob_WhenNoRawBaseAndNoFormulaInputs()
    {
        var pricing = Pricing(new RecurringJobRepository.TemplatePricing(10, null, null, null, null, false));

        var plan = RecurringJobRepository.BuildRepricePlan([(1, 10)], pricing);

        Assert.Empty(plan.Groups);
        Assert.Empty(plan.SelfHealTemplateRawBases);
        Assert.Equal(0, plan.RepricedJobCount);
    }

    [Fact]
    public void SkipsJob_WithNullBookingParent()
    {
        var pricing = Pricing(new RecurringJobRepository.TemplatePricing(10, null, 42m, null, null, false));

        var plan = RecurringJobRepository.BuildRepricePlan([(1, null)], pricing);

        Assert.Empty(plan.Groups);
        Assert.Equal(0, plan.RepricedJobCount);
    }

    [Fact]
    public void SkipsJob_WhenTemplateMissingFromPricing()
    {
        var plan = RecurringJobRepository.BuildRepricePlan(
            [(1, 999)],
            new Dictionary<int, RecurringJobRepository.TemplatePricing>());

        Assert.Empty(plan.Groups);
        Assert.Equal(0, plan.RepricedJobCount);
    }

    [Fact]
    public void GroupsJobsSharingRawBase_IntoSingleUpdate()
    {
        // Two templates that both resolve to raw base 50 → one group, both jobs.
        var pricing = Pricing(
            new RecurringJobRepository.TemplatePricing(10, null, 50m, null, null, false),
            new RecurringJobRepository.TemplatePricing(20, null, 50m, null, null, false),
            new RecurringJobRepository.TemplatePricing(30, null, 60m, null, null, false));

        var plan = RecurringJobRepository.BuildRepricePlan(
            [(1, 10), (2, 20), (3, 30)], pricing);

        Assert.Equal(3, plan.RepricedJobCount);
        Assert.Equal(2, plan.Groups.Count);

        var fifty = Assert.Single(plan.Groups, g => g.RawBaseAmount == 50m);
        Assert.Equal([1, 2], fifty.JobIds.OrderBy(x => x));
        var sixty = Assert.Single(plan.Groups, g => g.RawBaseAmount == 60m);
        Assert.Equal([3], sixty.JobIds);
    }

    [Fact]
    public void SelfHealRecordedOncePerTemplate_AcrossMultipleJobs()
    {
        // Two jobs off the same formula-derived template.
        var pricing = Pricing(new RecurringJobRepository.TemplatePricing(10, null, null, 80m, 5m, false));

        var plan = RecurringJobRepository.BuildRepricePlan([(1, 10), (2, 10)], pricing);

        Assert.Equal(2, plan.RepricedJobCount);
        Assert.Equal(75m, Assert.Single(plan.SelfHealTemplateRawBases).Value);
        Assert.Equal([1, 2], Assert.Single(plan.Groups).JobIds.OrderBy(x => x));
    }

    [Fact]
    public void SkipsJob_WhenTemplateRatedManually()
    {
        // Manually-rated templates keep their copied pricing untouched — same
        // gate the SQL cron path uses (tucJobBooking.RatedManually), replacing
        // the old per-client RecalcRecurringFuel toggle.
        var pricing = Pricing(new RecurringJobRepository.TemplatePricing(10, null, 42m, 99m, 5m, true));

        var plan = RecurringJobRepository.BuildRepricePlan([(1, 10)], pricing);

        Assert.Empty(plan.Groups);
        Assert.Empty(plan.SelfHealTemplateRawBases);
        Assert.Equal(0, plan.RepricedJobCount);
    }

    [Fact]
    public void RepricesOnlyDynamicJobs_WhenBatchMixesRatedManuallyTemplates()
    {
        var pricing = Pricing(
            new RecurringJobRepository.TemplatePricing(10, null, 50m, null, null, false),
            new RecurringJobRepository.TemplatePricing(20, null, 50m, null, null, true));

        var plan = RecurringJobRepository.BuildRepricePlan([(1, 10), (2, 20)], pricing);

        Assert.Equal(1, plan.RepricedJobCount);
        var group = Assert.Single(plan.Groups);
        Assert.Equal([1], group.JobIds);
    }
}
