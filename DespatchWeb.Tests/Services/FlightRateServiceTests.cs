using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Services;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for FlightRateService - tests air freight rate calculations via stored procedure.
/// </summary>
public class FlightRateServiceTests
{
    private readonly Mock<INationwideJobRepository> _repositoryMock = new();

    private FlightRateService CreateService() => new(_repositoryMock.Object);

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_NullDto_ReturnsZero()
    {
        // Arrange
        var service = CreateService();

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, null))
            .ReturnsAsync((FlightRateCalculationDto)null!);

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        Assert.Equal(0, result);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_EmptyRates_ReturnsZero()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, null))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetCarrierFlightRatesAsync(dto))
            .ReturnsAsync([]);

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        Assert.Equal(0, result);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_WithValidRates_ReturnsFirstRate()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();
        var expectedRate = 150.50m;

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, null))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetCarrierFlightRatesAsync(dto))
            .ReturnsAsync(
            [
                new FlightRateDto
                {
                    JobTypeId = 1,
                    Name = "Express Air",
                    Speed = "Express",
                    Description = "Express air freight",
                    Rate = expectedRate,
                    SaleRate = 120.00m,
                    Availability = "Available",
                    AvailabilityColour = "#00FF00",
                    BookDate = TestDates.Now,
                    Duration = 120,
                    FlightRate = expectedRate
                }
            ]);

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        Assert.Equal(expectedRate, result);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_WithMultipleRates_ReturnsFirstRate()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, null))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetCarrierFlightRatesAsync(dto))
            .ReturnsAsync(
            [
                new FlightRateDto { Rate = 100m },
                new FlightRateDto { Rate = 200m },
                new FlightRateDto { Rate = 300m }
            ]);

        // Act
        var result = await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        Assert.Equal(100m, result);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_WithBookTime_PassesBookTimeToRepository()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();
        var bookTime = new DateTime(2024, 12, 25, 10, 0, 0);

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, bookTime))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetCarrierFlightRatesAsync(dto))
            .ReturnsAsync([]);

        // Act
        await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, bookTime);

        // Assert
        _repositoryMock.Verify(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, bookTime), Times.Once);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_WithExtraStopOffs_PassesExtraStopOffsToRepository()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", true, null))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetCarrierFlightRatesAsync(dto))
            .ReturnsAsync([]);

        // Act
        await service.GetCarrierFlightRateByJobIdAsync(1, "AA", true, null);

        // Assert
        _repositoryMock.Verify(x => x.GetFlightRateCalculationDtoAsync(1, "AA", true, null), Times.Once);
    }

    [Fact]
    public async Task GetCarrierFlightRateByJobIdAsync_CallsStoredProcWithCorrectDto()
    {
        // Arrange
        var service = CreateService();
        var dto = CreateBasicFlightRateDto();

        _repositoryMock.Setup(x => x.GetFlightRateCalculationDtoAsync(1, "AA", false, null))
            .ReturnsAsync(dto);
        _repositoryMock.Setup(x => x.GetCarrierFlightRatesAsync(It.IsAny<FlightRateCalculationDto>()))
            .ReturnsAsync([new FlightRateDto { Rate = 100m }]);

        // Act
        await service.GetCarrierFlightRateByJobIdAsync(1, "AA", false, null);

        // Assert
        _repositoryMock.Verify(x => x.GetCarrierFlightRatesAsync(dto), Times.Once);
    }

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

}
