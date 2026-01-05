using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using FluentAssertions;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for FlightRateService - tests air freight rate calculations.
/// </summary>
public class FlightRateServiceTests
{
    private readonly Mock<INationwideJobRepository> _repositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();

    private FlightRateService CreateService() => new(
        _repositoryMock.Object,
        _tenantInfoServiceMock.Object
    );

    #region GetCarrierFlightRateByJobIdAsync Tests

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_NoCarrierId_ReturnsZero()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, null))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetFlightCarrierIdByCodeAsync("AA"))
            .ReturnsAsync((int?)null);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime())
            .Returns(DateTime.Now);

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        result.Should().Be(0);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_NoFromZone_ReturnsZero()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, null))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetFlightCarrierIdByCodeAsync("AA"))
            .ReturnsAsync(100);
        _repositoryMock.Setup(x => x.IsHolidayAsync(It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(false);
        _repositoryMock.Setup(x => x.IsAfterHoursAsync(It.IsAny<int>(), It.IsAny<DateTime>(), false))
            .ReturnsAsync(false);
        _repositoryMock.Setup(x => x.GetZoneNameAsync(100, "CA", "Los Angeles"))
            .ReturnsAsync((string)null); // No from zone
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime())
            .Returns(DateTime.Now);

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        result.Should().Be(0);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_NoAirFreightRateId_ReturnsZero()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, null))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetFlightCarrierIdByCodeAsync("AA"))
            .ReturnsAsync(100);
        _repositoryMock.Setup(x => x.IsHolidayAsync(It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(false);
        _repositoryMock.Setup(x => x.IsAfterHoursAsync(It.IsAny<int>(), It.IsAny<DateTime>(), false))
            .ReturnsAsync(false);
        _repositoryMock.Setup(x => x.GetZoneNameAsync(100, "CA", "Los Angeles"))
            .ReturnsAsync("Zone1");
        _repositoryMock.Setup(x => x.GetZoneNameAsync(100, "NY", "New York"))
            .ReturnsAsync("Zone2");
        _repositoryMock.Setup(x => x.GetAirFreightRateIdFromZoneComboAsync(100, "Zone1", "Zone2"))
            .ReturnsAsync((int?)null);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime())
            .Returns(DateTime.Now);

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        result.Should().Be(0);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_NoAirFreightRates_ReturnsZero()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();

        SetupBasicRepositoryMocks(dto);
        _repositoryMock.Setup(x => x.GetAirFreightRatesAsync(1))
            .ReturnsAsync([]);

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        result.Should().Be(0);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_WithValidData_ReturnsCalculatedRate()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();

        SetupBasicRepositoryMocks(dto);

        var airFreightRates = new List<AirFreightRate>
        {
            new()
            {
                FlightBaseCharge = 100m,
                CargoSurchargeWeightBreakpoint = 50m,
                CargoSurchargeBelowCharge = 20m,
                AirFreightFuelSurcharge = 0.1m,
                ApplyFlightBaseChargeFuel = true,
                ApplyCargoSurchargeFuel = false,
                SpeedId = 1
            }
        };
        _repositoryMock.Setup(x => x.GetAirFreightRatesAsync(1))
            .ReturnsAsync(airFreightRates);

        _repositoryMock.Setup(x => x.GetByIdAsync<WeightBreakGroup>(It.IsAny<int>()))
            .ReturnsAsync((WeightBreakGroup)null);
        _repositoryMock.Setup(x => x.GetExtraItemMultiplierByExtraChargeIdAsync(It.IsAny<int>()))
            .ReturnsAsync(0m);
        _repositoryMock.Setup(x => x.CalculateExtraRatesAsync(It.IsAny<ExtraRateCalculationRequest>()))
            .ReturnsAsync(new ExtraRateResultDto { Amount = 10m, DriverPay = 5m });
        _repositoryMock.Setup(x => x.GetJobTypeFlightRatingDtoAsync(1))
            .ReturnsAsync(new JobTypeFlightRatingDto
            {
                JobTypeId = 1,
                JobTypeName = "Express Air",
                Description = "Express air freight",
                Mins = 120
            });

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        result.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_WithBookTime_UsesProvidedTime()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();
        var bookTime = new DateTime(2024, 12, 25, 10, 0, 0);

        dto.BookTime = bookTime;

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, bookTime))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetFlightCarrierIdByCodeAsync("AA"))
            .ReturnsAsync((int?)null);

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, bookTime);

        // Assert
        _repositoryMock.Verify(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, bookTime), Times.Once);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_HolidayRate_ChecksHoliday()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, null))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetFlightCarrierIdByCodeAsync("AA"))
            .ReturnsAsync(100);
        _repositoryMock.Setup(x => x.IsHolidayAsync(dto.ClientId, It.IsAny<DateTime>()))
            .ReturnsAsync(true);
        _repositoryMock.Setup(x => x.IsAfterHoursAsync(dto.ClientId, It.IsAny<DateTime>(), true))
            .ReturnsAsync(false);
        _repositoryMock.Setup(x => x.GetZoneNameAsync(100, "CA", "Los Angeles"))
            .ReturnsAsync((string)null);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime())
            .Returns(DateTime.Now);

        // Act
        await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        _repositoryMock.Verify(x => x.IsHolidayAsync(dto.ClientId, It.IsAny<DateTime>()), Times.Once);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_WithCargoSurchargeAboveBreakpoint_UsesAboveRate()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();
        dto.TotalWeight = 100m; // Above breakpoint of 50

        SetupBasicRepositoryMocks(dto);

        var airFreightRates = new List<AirFreightRate>
        {
            new()
            {
                FlightBaseCharge = 50m,
                CargoSurchargeWeightBreakpoint = 50m,
                CargoSurchargeBelowCharge = 10m,
                CargoSurchargeAboveRate = 0.5m, // 0.5 per unit weight
                AirFreightFuelSurcharge = 0m,
                SpeedId = 1
            }
        };
        _repositoryMock.Setup(x => x.GetAirFreightRatesAsync(1))
            .ReturnsAsync(airFreightRates);

        _repositoryMock.Setup(x => x.GetByIdAsync<WeightBreakGroup>(It.IsAny<int>()))
            .ReturnsAsync((WeightBreakGroup)null);
        _repositoryMock.Setup(x => x.GetExtraItemMultiplierByExtraChargeIdAsync(It.IsAny<int>()))
            .ReturnsAsync(0m);
        _repositoryMock.Setup(x => x.CalculateExtraRatesAsync(It.IsAny<ExtraRateCalculationRequest>()))
            .ReturnsAsync(new ExtraRateResultDto { Amount = 0m, DriverPay = 0m });
        _repositoryMock.Setup(x => x.GetJobTypeFlightRatingDtoAsync(1))
            .ReturnsAsync(new JobTypeFlightRatingDto
            {
                JobTypeId = 1,
                JobTypeName = "Standard",
                Mins = 60
            });

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        // Cargo surcharge above breakpoint uses rate * weight = 0.5 * 100 = 50
        // Base 50 + cargo surcharge 50 + (cargo surcharge with fuel 50) + (base with fuel 50) = 200
        result.Should().Be(200m);
    }

    #endregion

    #region Helper Methods

    private static FlightRateCalculationDto CreateBasicFlightRateDto() => new()
    {
        CarrierCode = "AA",
        FromState = "CA",
        FromCity = "Los Angeles",
        ToState = "NY",
        ToCity = "New York",
        TotalWeight = 25m,
        Quantity = 1,
        ClientId = 1
    };

    private void SetupBasicRepositoryMocks(FlightRateCalculationDto dto)
    {
        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, null))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetFlightCarrierIdByCodeAsync("AA"))
            .ReturnsAsync(100);
        _repositoryMock.Setup(x => x.IsHolidayAsync(It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(false);
        _repositoryMock.Setup(x => x.IsAfterHoursAsync(It.IsAny<int>(), It.IsAny<DateTime>(), false))
            .ReturnsAsync(false);
        _repositoryMock.Setup(x => x.GetZoneNameAsync(100, "CA", "Los Angeles"))
            .ReturnsAsync("Zone1");
        _repositoryMock.Setup(x => x.GetZoneNameAsync(100, "NY", "New York"))
            .ReturnsAsync("Zone2");
        _repositoryMock.Setup(x => x.GetAirFreightRateIdFromZoneComboAsync(100, "Zone1", "Zone2"))
            .ReturnsAsync(1);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime())
            .Returns(DateTime.Now);
    }

    #endregion
}
