using DespatchWeb.Enums;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Matrix coverage for the v1 policy. Confirms each (field, stage) cell either auto-applies,
/// requires manual approval from the counterparty, or is prohibited — and that the rule
/// code surfaces enough context to debug edge cases.
/// </summary>
public class JobChangePolicyServiceTests
{
    private readonly JobChangePolicyService _service = new();

    [Theory]
    [InlineData(JobChangeField.Notes)]
    [InlineData(JobChangeField.ProgressNote)]
    [InlineData(JobChangeField.PodNote)]
    public void Note_fields_auto_apply(JobChangeField field)
    {
        var decision = _service.Evaluate(field, "OwnerTenant", JobLifecycleStage.InTransit);

        Assert.True(decision.Allowed);
        Assert.Equal(JobChangeApprovalMode.Auto, decision.Mode);
        Assert.Equal("OwnerTenant", decision.ApprovalPartyType);
        Assert.False(decision.RequiresCommercialRefresh);
    }

    [Theory]
    [InlineData(JobChangeField.Quantity)]
    [InlineData(JobChangeField.Speed)]
    public void Operational_fields_require_counterparty_approval(JobChangeField field)
    {
        var decision = _service.Evaluate(field, "OwnerTenant", JobLifecycleStage.Allocated);

        Assert.True(decision.Allowed);
        Assert.Equal(JobChangeApprovalMode.Manual, decision.Mode);
        Assert.Equal("PartnerTenant", decision.ApprovalPartyType);
        Assert.True(decision.RequiresCommercialRefresh);
    }

    [Fact]
    public void PartnerAgreedRate_is_manual_pre_settlement()
    {
        var decision = _service.Evaluate(JobChangeField.PartnerAgreedRate, "OwnerTenant", JobLifecycleStage.Allocated);

        Assert.True(decision.Allowed);
        Assert.Equal(JobChangeApprovalMode.Manual, decision.Mode);
        Assert.True(decision.RequiresCommercialRefresh);
    }

    [Theory]
    [InlineData("OwnerTenant", "PartnerTenant")]
    [InlineData("PartnerTenant", "OwnerTenant")]
    public void Manual_approval_always_flips_to_counterparty(string requestingParty, string expectedApprover)
    {
        var decision = _service.Evaluate(JobChangeField.Quantity, requestingParty, JobLifecycleStage.Allocated);

        Assert.Equal(expectedApprover, decision.ApprovalPartyType);
    }

    [Fact]
    public void Rule_codes_include_stage_for_traceability()
    {
        var allocated = _service.Evaluate(JobChangeField.Speed, "OwnerTenant", JobLifecycleStage.Allocated);
        var inTransit = _service.Evaluate(JobChangeField.Speed, "OwnerTenant", JobLifecycleStage.InTransit);

        Assert.NotEqual(allocated.RuleCode, inTransit.RuleCode);
        Assert.Contains("Allocated", allocated.RuleCode);
        Assert.Contains("InTransit", inTransit.RuleCode);
    }
}
