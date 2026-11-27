using DespatchWeb.Models;
using DespatchWeb.Repositories;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Inter-courier charges are recorded as a CourierDeduction against the "from" courier and a
/// CourierExtraPayment to the "to" courier (replacing the old +/- phantom job pair).
/// </summary>
public class JobRepositoryInterCourierChargeTests
{
    private static readonly DateTime FixedTime = new(2026, 6, 16, 9, 30, 0);

    private static InterCourierChargeViewModel Vm(decimal amount = 35m, string reference = "ref") => new()
    {
        FromCourierId = 235,
        ToCourierId = 275,
        Reference = reference,
        Amount = amount
    };

    [Fact]
    public void BuildIccAdjustments_DeductsFromCourier_PaysToCourier()
    {
        var (deduction, extra) = JobRepository.BuildIccAdjustments(Vm(), 7, 8, FixedTime);

        Assert.Equal(235, deduction.CourierId);
        var dLine = Assert.Single(deduction.CourierDeductionLines);
        Assert.Equal(7, dLine.DeductionTypeId);
        Assert.Equal(1m, dLine.Quantity);
        Assert.Equal(35m, dLine.UnitPrice);

        Assert.Equal(275, extra.CourierId);
        var eLine = Assert.Single(extra.CourierExtraPaymentLines);
        Assert.Equal(8, eLine.ExtraPaymentTypeId);
        Assert.Equal(1m, eLine.Quantity);
        Assert.Equal(35m, eLine.UnitPrice);
    }

    [Fact]
    public void BuildIccAdjustments_NormalisesNegativeAmount()
    {
        var (deduction, extra) = JobRepository.BuildIccAdjustments(Vm(-35m), 7, 8, FixedTime);

        Assert.Equal(35m, deduction.CourierDeductionLines.Single().UnitPrice);
        Assert.Equal(35m, extra.CourierExtraPaymentLines.Single().UnitPrice);
    }

    [Fact]
    public void BuildIccAdjustments_UsesTenantDateAndCreatedTime()
    {
        var (deduction, extra) = JobRepository.BuildIccAdjustments(Vm(), 7, 8, FixedTime);

        Assert.Equal(FixedTime.Date, deduction.Date);
        Assert.Equal(FixedTime.Date, extra.Date);
        Assert.Equal(FixedTime, deduction.Created);
        Assert.Equal(FixedTime, extra.Created);
    }

    [Fact]
    public void BuildIccAdjustments_DescriptionsNameTheOtherCourier()
    {
        var (deduction, extra) = JobRepository.BuildIccAdjustments(Vm(), 7, 8, FixedTime);

        Assert.Equal("Inter-courier charge to courier # 275", deduction.CourierDeductionLines.Single().Description);
        Assert.Equal("Inter-courier charge from courier # 235", extra.CourierExtraPaymentLines.Single().Description);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData("  INV-1 ", "INV-1")]
    public void BuildIccAdjustments_NormalisesReference(string input, string expected)
    {
        var (deduction, extra) = JobRepository.BuildIccAdjustments(Vm(reference: input), 7, 8, FixedTime);

        Assert.Equal(expected, deduction.Reference);
        Assert.Equal(expected, extra.Reference);
    }

    [Fact]
    public void BuildIccAdjustments_TruncatesReferenceToFiftyChars()
    {
        var (deduction, extra) = JobRepository.BuildIccAdjustments(
            Vm(reference: new string('x', 80)), 7, 8, FixedTime);

        Assert.Equal(50, deduction.Reference.Length);
        Assert.Equal(50, extra.Reference.Length);
    }
}
