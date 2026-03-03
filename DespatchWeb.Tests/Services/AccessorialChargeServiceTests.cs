using DespatchWeb.Interfaces;
using DespatchWeb.Models.Accessorial;
using DespatchWeb.Models;
using DespatchWeb.Services;
using FluentAssertions;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for AccessorialChargeService — primarily the Recalculate logic
/// tested via UpdateChargeAsync, plus delegation tests for other methods.
/// </summary>
public class AccessorialChargeServiceTests
{
    private readonly Mock<IAccessorialChargeRepository> _repositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();

    private AccessorialChargeService CreateService() =>
        new(_repositoryMock.Object, _tenantInfoServiceMock.Object);

    private void SetupStaffInfo(string name = "Test User") =>
        _tenantInfoServiceMock
            .Setup(t => t.GetStaffInfoAsync())
            .ReturnsAsync(new Suggestion { Text = name });

    private void SetupUpdateRepository() =>
        _repositoryMock
            .Setup(r => r.UpdateChargeAsync(
                It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal?>(),
                It.IsAny<decimal?>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>()))
            .Returns(Task.CompletedTask);

    private async Task<JobAccessorialChargeDto> CallUpdate(JobAccessorialChargeDto existing, JobAccessorialChargeUpdateRequest? request = null)
    {
        request ??= new JobAccessorialChargeUpdateRequest
        {
            InputValue = existing.InputValue,
            ItemCount = existing.ItemCount,
        };

        _repositoryMock
            .Setup(r => r.GetAppliedChargeWithDetailsAsync(1))
            .ReturnsAsync(existing);

        SetupUpdateRepository();
        SetupStaffInfo();

        return await CreateService().UpdateChargeAsync(1, request);
    }

    #region Flat Charge

    [Fact]
    public async Task Recalculate_FlatCharge_ReturnsBaseRate()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "flat", BaseRate = 50m, ItemCount = 1 };

        var result = await CallUpdate(jac);

        result.CalculatedAmount.Should().Be(50m);
    }

    [Fact]
    public async Task Recalculate_FlatCharge_IgnoresInputValue()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "flat", BaseRate = 50m, ItemCount = 1 };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 999m, ItemCount = 1 });

        result.CalculatedAmount.Should().Be(50m);
    }

    #endregion

    #region Per Unit / Hourly Charge

    [Fact]
    public async Task Recalculate_PerUnit_MultipliesInputByItemCountAndRate()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "per_unit", RatePerUnit = 10m, ItemCount = 2 };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 5m, ItemCount = 2 });

        result.CalculatedAmount.Should().Be(100m); // 5 * 2 * 10
    }

    [Fact]
    public async Task Recalculate_PerUnit_WithFreeAllowanceSameUnit_SubtractsFreeAllowance()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 10m,
            FreeAllowance = 2m,
            ItemCount = 1,
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 5m, ItemCount = 1 });

        result.CalculatedAmount.Should().Be(30m); // (5 - 2) * 1 * 10
    }

    [Fact]
    public async Task Recalculate_PerUnit_FreeAllowanceExceedsInput_ClampsBillableToZero()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 10m,
            FreeAllowance = 10m,
            ItemCount = 1,
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 3m, ItemCount = 1 });

        result.CalculatedAmount.Should().Be(0m); // max(0, 3-10) = 0
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
            ItemCount = 1,
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 2m, ItemCount = 1 });

        result.CalculatedAmount.Should().Be(90m);
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
            ItemCount = 1,
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 90m, ItemCount = 1 });

        result.CalculatedAmount.Should().Be(60m);
    }

    [Fact]
    public async Task Recalculate_PerUnit_WithMinimumQuantity_BillableClampedToMinimum()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 10m,
            MinimumQuantity = 3m,
            ItemCount = 1,
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 1m, ItemCount = 1 });

        result.CalculatedAmount.Should().Be(30m); // min qty 3 → 3 * 1 * 10
    }

    #endregion

    #region Percentage Charge

    [Fact]
    public async Task Recalculate_Percentage_AppliesRateToInputValue()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "percentage",
            PercentageRate = 10m,
            ItemCount = 1,
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 1000m, ItemCount = 1 });

        result.CalculatedAmount.Should().Be(100m); // 1000 * 10 / 100
    }

    [Fact]
    public async Task Recalculate_Percentage_FractionalRate_CalculatesCorrectly()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "percentage",
            PercentageRate = 8.5m,
            ItemCount = 1,
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 200m, ItemCount = 1 });

        result.CalculatedAmount.Should().Be(17m); // 200 * 8.5 / 100
    }

    #endregion

    #region Quote-Based Charge

    [Fact]
    public async Task Recalculate_QuoteBased_ReturnsInputValueDirectly()
    {
        var jac = new JobAccessorialChargeDto { ChargeType = "quote_based", ItemCount = 1 };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 75.50m, ItemCount = 1 });

        result.CalculatedAmount.Should().Be(75.50m);
    }

    #endregion

    #region Min / Max Charge Enforcement

    [Fact]
    public async Task Recalculate_AmountBelowMinimumCharge_ClampedToMinimum()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "flat",
            BaseRate = 5m,
            MinimumCharge = 10m,
            ItemCount = 1,
        };

        var result = await CallUpdate(jac);

        result.CalculatedAmount.Should().Be(10m);
    }

    [Fact]
    public async Task Recalculate_AmountAboveMaximumCharge_ClampedToMaximum()
    {
        var jac = new JobAccessorialChargeDto
        {
            ChargeType = "per_unit",
            RatePerUnit = 100m,
            MaximumCharge = 500m,
            ItemCount = 1,
        };

        var result = await CallUpdate(jac, new JobAccessorialChargeUpdateRequest { InputValue = 10m, ItemCount = 1 });

        result.CalculatedAmount.Should().Be(500m); // would be 1000, capped at 500
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
            ItemCount = 1,
        };

        var result = await CallUpdate(jac);

        result.CalculatedAmount.Should().Be(50m);
    }

    #endregion

    #region AddChargesAsync

    [Fact]
    public async Task AddChargesAsync_CallsRepositoryForEachCharge()
    {
        SetupStaffInfo("Jane Smith");
        _repositoryMock
            .Setup(r => r.AddChargeAsync(It.IsAny<int>(), It.IsAny<JobAccessorialChargeCreateRequest>(), It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        var charges = new List<JobAccessorialChargeCreateRequest>
        {
            new() { AccessorialChargeId = 1, ItemCount = 1 },
            new() { AccessorialChargeId = 2, ItemCount = 1 },
        };

        await CreateService().AddChargesAsync(500, charges);

        _repositoryMock.Verify(
            r => r.AddChargeAsync(500, It.IsAny<JobAccessorialChargeCreateRequest>(), "Jane Smith"),
            Times.Exactly(2));
    }

    [Fact]
    public async Task AddChargesAsync_UsesUnknownWhenStaffInfoIsNull()
    {
        _tenantInfoServiceMock
            .Setup(t => t.GetStaffInfoAsync())
            .ReturnsAsync((Suggestion?)null);
        _repositoryMock
            .Setup(r => r.AddChargeAsync(It.IsAny<int>(), It.IsAny<JobAccessorialChargeCreateRequest>(), It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        await CreateService().AddChargesAsync(500, [new() { AccessorialChargeId = 1, ItemCount = 1 }]);

        _repositoryMock.Verify(
            r => r.AddChargeAsync(500, It.IsAny<JobAccessorialChargeCreateRequest>(), "Unknown"),
            Times.Once);
    }

    #endregion

    #region GetJobAmountAsync

    [Fact]
    public async Task GetJobAmountAsync_DelegatesToRepository()
    {
        _repositoryMock
            .Setup(r => r.GetJobAmountAsync(500))
            .ReturnsAsync(127.50m);

        var result = await CreateService().GetJobAmountAsync(500);

        result.Should().Be(127.50m);
        _repositoryMock.Verify(r => r.GetJobAmountAsync(500), Times.Once);
    }

    #endregion
}
