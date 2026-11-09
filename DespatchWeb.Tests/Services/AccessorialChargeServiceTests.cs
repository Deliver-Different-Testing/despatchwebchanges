using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Accessorial;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for AccessorialChargeService — primarily the Recalculate logic
/// tested via UpdateChargeAsync, plus delegation tests for other methods.
/// </summary>
public class AccessorialChargeServiceTests
{
    private readonly IAccessorialChargeRepository _repositoryMock = Substitute.For<IAccessorialChargeRepository>();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    private AccessorialChargeService CreateService() =>
        new(_repositoryMock, _tenantInfoServiceMock);

    private void SetupStaffInfo(string name = "Test User") =>
        _tenantInfoServiceMock.GetStaffInfoAsync()
            .Returns(new Suggestion { Text = name });

    private void SetupUpdateRepository() =>
        _repositoryMock.UpdateChargeAsync(
                Arg.Any<int>(), Arg.Any<decimal>(), Arg.Any<decimal?>(),
                Arg.Any<decimal?>(), Arg.Any<decimal?>(), Arg.Any<decimal?>(), Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns(Task.CompletedTask);

    private async Task<JobAccessorialChargeDto> CallUpdate(JobAccessorialChargeDto existing,
        JobAccessorialChargeUpdateRequest? request = null)
    {
        request ??= new JobAccessorialChargeUpdateRequest
        {
            InputValue = existing.InputValue,
            ItemCount = existing.ItemCount
        };

        _repositoryMock.GetAppliedChargeWithDetailsAsync(1)
            .Returns(existing);

        SetupUpdateRepository();
        SetupStaffInfo();

        return await CreateService().UpdateChargeAsync(1, request);
    }

    [Fact]
    public async Task Recalculate_QuoteBased_ReturnsInputValueDirectly()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "quote_based", ItemCount = 1 };

        var result = await CallUpdate(jac,
            new JobAccessorialChargeUpdateRequest { InputValue = 75.50m, ItemCount = 1 });

        Assert.Equal(75.50m, result.CalculatedAmount);
    }

    [Fact]
    public async Task GetJobAmountAsync_DelegatesToRepository()
    {
        _repositoryMock.GetJobAmountAsync(500)
            .Returns(127.50m);

        var result = await CreateService().GetJobAmountAsync(500);

        Assert.Equal(127.50m, result);
        await _repositoryMock.Received().GetJobAmountAsync(500);
    }

    [Fact]
    public async Task GetPortionJobsAsync_DelegatesToRepository()
    {
        var expected = new List<PortionJobInfoDto>
        {
            new() { JobId = 101, Label = "Pickup", AccessorialChargeGroupId = 5 },
            new() { JobId = 102, Label = "Flight", AccessorialChargeGroupId = 6 }
        };
        _repositoryMock.GetPortionJobsAsync(200)
            .Returns(expected);

        var result = await CreateService().GetPortionJobsAsync(200);

        Assert.Equivalent(expected, result);
        await _repositoryMock.Received().GetPortionJobsAsync(200);
    }

    [Fact]
    public async Task Recalculate_FlatCharge_ReturnsBaseRate()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "flat", BaseRate = 50m, ItemCount = 1 };

        var result = await CallUpdate(jac);

        Assert.Equal(50m, result.CalculatedAmount);
    }

    [Fact]
    public async Task Recalculate_FlatCharge_IgnoresInputValue()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "flat", BaseRate = 50m, ItemCount = 1 };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 999m, ItemCount = 1 });

        Assert.Equal(50m, result.CalculatedAmount);
    }

    [Fact]
    public async Task Recalculate_PerUnit_MultipliesInputByItemCountAndRate()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "per_unit", RatePerUnit = 10m, ItemCount = 2 };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 5m, ItemCount = 2 });

        Assert.Equal(100m, result.CalculatedAmount); // 5 * 2 * 10
    }

    [Fact]
    public async Task Recalculate_PerUnit_WithFreeAllowanceSameUnit_SubtractsFreeAllowance()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 10m,
            FreeAllowance = 2m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 5m, ItemCount = 1 });

        Assert.Equal(30m, result.CalculatedAmount); // (5 - 2) * 1 * 10
    }

    [Fact]
    public async Task Recalculate_PerUnit_FreeAllowanceExceedsInput_ClampsBillableToZero()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 10m,
            FreeAllowance = 10m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 3m, ItemCount = 1 });

        Assert.Equal(0m, result.CalculatedAmount); // max(0, 3-10) = 0
    }

    [Fact]
    public async Task Recalculate_Hourly_FreeAllowanceMinutesConvertedToHours()
    {
        // 2 hours input, 30 minutes free → 0.5 hours free → 1.5 billable hours × $60/hr = $90
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "hourly",
            RatePerUnit = 60m,
            UnitTypeName = "Hour",
            FreeAllowance = 30m,
            FreeAllowanceUnitTypeName = "Minute",
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 2m, ItemCount = 1 });

        Assert.Equal(90m, result.CalculatedAmount);
    }

    [Fact]
    public async Task Recalculate_PerUnit_FreeAllowanceHoursConvertedToMinutes()
    {
        // 90 minutes input, 1 hour free → 60 minutes free → 30 billable minutes × $2/min = $60
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 2m,
            UnitTypeName = "Minute",
            FreeAllowance = 1m,
            FreeAllowanceUnitTypeName = "Hour",
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 90m, ItemCount = 1 });

        Assert.Equal(60m, result.CalculatedAmount);
    }

    [Fact]
    public async Task Recalculate_PerUnit_WithMinimumQuantity_BillableClampedToMinimum()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 10m,
            MinimumQuantity = 3m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 1m, ItemCount = 1 });

        Assert.Equal(30m, result.CalculatedAmount); // min qty 3 → 3 * 1 * 10
    }

    [Fact]
    public async Task Recalculate_Percentage_AppliesRateToInputValue()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "percentage",
            PercentageRate = 10m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 1000m, ItemCount = 1 });

        Assert.Equal(100m, result.CalculatedAmount); // 1000 * 10 / 100
    }

    [Fact]
    public async Task Recalculate_Percentage_FractionalRate_CalculatesCorrectly()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "percentage",
            PercentageRate = 8.5m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 200m, ItemCount = 1 });

        Assert.Equal(17m, result.CalculatedAmount); // 200 * 8.5 / 100
    }

    [Fact]
    public async Task Recalculate_AmountBelowMinimumCharge_ClampedToMinimum()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "flat",
            BaseRate = 5m,
            MinimumCharge = 10m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac);

        Assert.Equal(10m, result.CalculatedAmount);
    }

    [Fact]
    public async Task Recalculate_AmountAboveMaximumCharge_ClampedToMaximum()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 100m,
            MaximumCharge = 500m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 10m, ItemCount = 1 });

        Assert.Equal(500m, result.CalculatedAmount); // would be 1000, capped at 500
    }

    [Fact]
    public async Task Recalculate_AmountWithinMinMaxBounds_NotClamped()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "flat",
            BaseRate = 50m,
            MinimumCharge = 10m,
            MaximumCharge = 100m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac);

        Assert.Equal(50m, result.CalculatedAmount);
    }

    [Fact]
    public async Task RecalculateDriver_Flat_ReturnsDriverBaseRate()
    {
        var jac = new JobAccessorialChargeDto
            { ChargeType = "flat", BaseRate = 10m, DriverBaseRate = 8m, ItemCount = 1 };

        var result = await CallUpdate(jac);

        Assert.Equal(10m, result.CalculatedAmount);
        Assert.Equal(8m, result.DriverCalculatedAmount);
    }

    [Fact]
    public async Task RecalculateDriver_Flat_NoDriverRate_ReturnsNull()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "flat", BaseRate = 10m, ItemCount = 1 };

        var result = await CallUpdate(jac);

        Assert.Null(result.DriverCalculatedAmount);
    }

    [Fact]
    public async Task RecalculateDriver_PerUnit_MultipliesInputByItemCountAndDriverRate()
    {
        var jac = new JobAccessorialChargeDto
            { ChargeType = "per_unit", RatePerUnit = 10m, DriverRatePerUnit = 4m, ItemCount = 2 };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 5m, ItemCount = 2 });

        Assert.Equal(100m, result.CalculatedAmount);
        Assert.Equal(40m, result.DriverCalculatedAmount); // 5 * 2 * 4
    }

    [Fact]
    public async Task RecalculateDriver_PerUnit_UsesSameBillableUnitsAsCustomerAmount()
    {
        // Free allowance and minimum quantity apply to the driver side exactly as they do to the customer side.
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 10m,
            DriverRatePerUnit = 4m,
            FreeAllowance = 2m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 5m, ItemCount = 1 });

        Assert.Equal(30m, result.CalculatedAmount);
        Assert.Equal(12m, result.DriverCalculatedAmount); // (5 - 2) * 1 * 4
    }

    [Fact]
    public async Task RecalculateDriver_PerUnit_MinimumQuantity_BillableClampedToMinimum()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 10m,
            DriverRatePerUnit = 4m,
            MinimumQuantity = 3m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 1m, ItemCount = 1 });

        Assert.Equal(12m, result.DriverCalculatedAmount); // min qty 3 → 3 * 1 * 4
    }

    [Fact]
    public async Task RecalculateDriver_PerUnit_NoDriverRate_ReturnsNull()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "per_unit", RatePerUnit = 10m, ItemCount = 1 };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 5m, ItemCount = 1 });

        Assert.Null(result.DriverCalculatedAmount);
    }

    [Fact]
    public async Task RecalculateDriver_Hourly_UsesDriverRatePerUnit()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "hourly",
            RatePerUnit = 60m,
            DriverRatePerUnit = 40m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 2m, ItemCount = 1 });

        Assert.Equal(80m, result.DriverCalculatedAmount);
    }

    [Fact]
    public async Task RecalculateDriver_Percentage_IsPercentageOfChargeAmountNotInputValue()
    {
        var jac = new JobAccessorialChargeDto
            { ChargeType = "percentage", PercentageRate = 10m, DriverPercentageRate = 80m, ItemCount = 1 };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 1000m, ItemCount = 1 });

        Assert.Equal(100m, result.CalculatedAmount); // 1000 * 10%
        Assert.Equal(80m, result.DriverCalculatedAmount); // 100 * 80%, not 1000 * 80%
    }

    [Fact]
    public async Task RecalculateDriver_Percentage_RoundsChargeAmountToTwoDecimalsFirst_MatchingStoredProc()
    {
        // Charge = 329.325 * 10% = 32.9325. sp_AddJobAccessorial stores it as 32.93 (decimal(10,2)) before applying
        // the driver %, giving 26.344 (stored 26.34). Applying 80% to the unrounded 32.9325 would give 26.346 (26.35).
        var jac = new JobAccessorialChargeDto
            { ChargeType = "percentage", PercentageRate = 10m, DriverPercentageRate = 80m, ItemCount = 1 };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 329.325m, ItemCount = 1 });

        Assert.Equal(26.344m, result.DriverCalculatedAmount);
    }

    [Fact]
    public async Task RecalculateDriver_Percentage_UsesChargeAmountAfterMinMaxClamp()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "percentage",
            PercentageRate = 10m,
            DriverPercentageRate = 80m,
            MaximumCharge = 50m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 1000m, ItemCount = 1 });

        Assert.Equal(50m, result.CalculatedAmount); // 100 capped at 50
        Assert.Equal(40m, result.DriverCalculatedAmount); // 50 * 80%
    }

    [Fact]
    public async Task RecalculateDriver_Percentage_NoDriverPercentage_ReturnsNull()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "percentage", PercentageRate = 10m, ItemCount = 1 };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 1000m, ItemCount = 1 });

        Assert.Null(result.DriverCalculatedAmount);
    }

    [Fact]
    public async Task RecalculateDriver_QuoteBased_ReturnsNullEvenWhenDriverRatesSet()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "quote_based",
            DriverBaseRate = 8m,
            DriverRatePerUnit = 4m,
            DriverPercentageRate = 80m,
            ItemCount = 1
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 75m, ItemCount = 1 });

        Assert.Null(result.DriverCalculatedAmount);
    }

    [Fact]
    public async Task UpdateChargeAsync_DriverOverride_ReturnedAndPassedToRepository()
    {
        var jac = new JobAccessorialChargeDto
            { ChargeType = "flat", BaseRate = 10m, DriverBaseRate = 8m, ItemCount = 1 };

        var result = await CallUpdate(jac,
            new JobAccessorialChargeUpdateRequest { ItemCount = 1, DriverOverrideAmount = 6m });

        Assert.Equal(6m, result.DriverOverrideAmount);
        Assert.Equal(8m, result.DriverCalculatedAmount); // the calculated value is kept alongside the override
        await _repositoryMock.Received(1).UpdateChargeAsync(
            1, 10m, null, 8m, 6m, null, 1, null, "Test User");
    }

    [Fact]
    public async Task UpdateChargeAsync_CustomerOverride_DoesNotAffectDriverAmounts()
    {
        var jac = new JobAccessorialChargeDto
            { ChargeType = "flat", BaseRate = 10m, DriverBaseRate = 8m, ItemCount = 1 };

        var result = await CallUpdate(jac,
            new JobAccessorialChargeUpdateRequest { ItemCount = 1, OverrideAmount = 5m });

        Assert.Equal(5m, result.OverrideAmount);
        Assert.Equal(8m, result.DriverCalculatedAmount);
        Assert.Null(result.DriverOverrideAmount);
    }

    [Fact]
    public async Task AddChargesAsync_CallsRepositoryForEachCharge()
    {
        SetupStaffInfo("Jane Smith");
        _repositoryMock.AddChargeAsync(Arg.Any<int>(), Arg.Any<JobAccessorialChargeCreateRequest>(),
                Arg.Any<string>())
            .Returns(Task.CompletedTask);

        var charges = new List<JobAccessorialChargeCreateRequest>
        {
            new() { AccessorialChargeId = 1, ItemCount = 1 },
            new() { AccessorialChargeId = 2, ItemCount = 1 }
        };

        await CreateService().AddChargesAsync(500, charges);

        await _repositoryMock
            .Received(2)
            .AddChargeAsync(500, Arg.Any<JobAccessorialChargeCreateRequest>(), "Jane Smith");
    }

    [Fact]
    public async Task AddChargesAsync_UsesUnknownWhenStaffInfoIsNull()
    {
        _tenantInfoServiceMock.GetStaffInfoAsync()
            .Returns((Suggestion?)null);
        _repositoryMock.AddChargeAsync(Arg.Any<int>(), Arg.Any<JobAccessorialChargeCreateRequest>(),
                Arg.Any<string>())
            .Returns(Task.CompletedTask);

        await CreateService().AddChargesAsync(500,
            [new JobAccessorialChargeCreateRequest { AccessorialChargeId = 1, ItemCount = 1 }]);

        await _repositoryMock
            .Received(1)
            .AddChargeAsync(500, Arg.Any<JobAccessorialChargeCreateRequest>(), "Unknown");
    }
}