using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Controllers;

/// <summary>
/// Unit tests for NationwideJobController - tests flight search and agent assignment endpoints.
/// </summary>
public class NationwideJobControllerTests
{
    private readonly Mock<INationwideJobRepository> _repositoryMock = new();
    private readonly Mock<IFlightStatsService> _flightServiceMock = new();
    private readonly Mock<IClientAccessValidatorService> _clientAccessValidatorMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IFlightRateService> _flightRateServiceMock = new();
    private readonly Mock<IClientRepository> _clientRepositoryMock = new();
    private readonly Mock<IAddAgentRecoveryJobService> _recoveryJobServiceMock = new();

    private NationwideJobController CreateController()
    {
        return new NationwideJobController(
            _repositoryMock.Object,
            _flightServiceMock.Object,
            _clientAccessValidatorMock.Object,
            _tenantInfoServiceMock.Object,
            _flightRateServiceMock.Object,
            _clientRepositoryMock.Object,
            _recoveryJobServiceMock.Object);
    }

    #region GetScheduledFlightOptions Tests

    [Fact]
    public async Task GetScheduledFlightOptions_ValidRequest_ReturnsFlights()
    {
        // Arrange
        var departureDate = DateTimeOffset.Now.AddDays(1);
        const int jobId = 16992;
        const int departureAirportId = 150;
        const int arrivalAirportId = 96;

        var expectedFlights = new List<FlightViewModel>
        {
            CreateTestFlight("NZ", "123", "AKL", "SYD"),
            CreateTestFlight("QF", "456", "AKL", "SYD"),
        };

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                jobId,
                departureDate,
                null, // no airline filter
                departureAirportId,
                arrivalAirportId,
                null,
                null,
                60))
            .ReturnsAsync(expectedFlights);

        _flightRateServiceMock.Setup(x => x.GetCarrierFlightRateByJobIdAsync(
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<bool>(),
                It.IsAny<DateTime>()))
            .ReturnsAsync(100.00m);

        var controller = CreateController();

        // Act
        var result = await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId: null,
            departureAirportId,
            arrivalAirportId,
            minimumLayoverMinutes: 60);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var flights = jsonResult.Value as List<FlightViewModel>;
        flights.Should().NotBeNull();
        flights.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_WithAirlineFilter_PassesAirlineIdToService()
    {
        // Arrange
        var departureDate = DateTimeOffset.Now.AddDays(1);
        const int jobId = 16992;
        const int airlineId = 3;
        const int departureAirportId = 150;
        const int arrivalAirportId = 96;

        var expectedFlights = new List<FlightViewModel>
        {
            CreateTestFlight("QF", "789", "AKL", "SYD"),
        };

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                jobId,
                departureDate,
                airlineId, // airline filter
                departureAirportId,
                arrivalAirportId,
                null,
                null,
                60))
            .ReturnsAsync(expectedFlights);

        _flightRateServiceMock.Setup(x => x.GetCarrierFlightRateByJobIdAsync(
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<bool>(),
                It.IsAny<DateTime>()))
            .ReturnsAsync(150.00m);

        var controller = CreateController();

        // Act
        var result = await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId,
            departureAirportId,
            arrivalAirportId,
            minimumLayoverMinutes: 60);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var flights = jsonResult.Value as List<FlightViewModel>;
        flights.Should().NotBeNull();
        flights.Should().HaveCount(1);
        flights![0].AirlineCode.Should().Be("QF");

        // Verify airline filter was passed
        _flightServiceMock.Verify(x => x.GetFlightsAsync(
            jobId,
            departureDate,
            airlineId,
            departureAirportId,
            arrivalAirportId,
            null,
            null,
            60), Times.Once);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_NoFlightsFound_ReturnsEmptyList()
    {
        // Arrange
        var departureDate = DateTimeOffset.Now.AddDays(1);
        const int jobId = 16992;
        const int departureAirportId = 150;
        const int arrivalAirportId = 96;

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                It.IsAny<int>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<string>(),
                It.IsAny<List<string>>(),
                It.IsAny<int>()))
            .ReturnsAsync([]);

        var controller = CreateController();

        // Act
        var result = await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId: null,
            departureAirportId,
            arrivalAirportId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var flights = jsonResult.Value as List<FlightViewModel>;
        flights.Should().NotBeNull();
        flights.Should().BeEmpty();
    }

    [Fact]
    public async Task GetScheduledFlightOptions_NullFlightsFromService_ReturnsEmptyList()
    {
        // Arrange
        var departureDate = DateTimeOffset.Now.AddDays(1);
        const int jobId = 16992;

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                It.IsAny<int>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<string>(),
                It.IsAny<List<string>>(),
                It.IsAny<int>()))
            .ReturnsAsync((List<FlightViewModel>)null!);

        var controller = CreateController();

        // Act
        var result = await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId: null,
            departureAirportId: 150,
            arrivalAirportId: 96);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var flights = jsonResult.Value as List<FlightViewModel>;
        flights.Should().NotBeNull();
        flights.Should().BeEmpty();
    }

    [Fact]
    public async Task GetScheduledFlightOptions_ServiceThrowsException_Returns500()
    {
        // Arrange
        var departureDate = DateTimeOffset.Now.AddDays(1);
        const int jobId = 16992;

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                It.IsAny<int>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<string>(),
                It.IsAny<List<string>>(),
                It.IsAny<int>()))
            .ThrowsAsync(new ArgumentException("Departure airport with ID 150 not found in active airports"));

        var controller = CreateController();

        // Act
        var result = await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId: null,
            departureAirportId: 150,
            arrivalAirportId: 96);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_WithMinimumLayover_PassesLayoverToService()
    {
        // Arrange
        var departureDate = DateTimeOffset.Now.AddDays(1);
        const int jobId = 16992;
        const int minimumLayover = 90;

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                It.IsAny<int>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<string>(),
                It.IsAny<List<string>>(),
                minimumLayover))
            .ReturnsAsync([]);

        var controller = CreateController();

        // Act
        await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId: null,
            departureAirportId: 150,
            arrivalAirportId: 96,
            minimumLayoverMinutes: minimumLayover);

        // Assert
        _flightServiceMock.Verify(x => x.GetFlightsAsync(
            jobId,
            departureDate,
            null,
            150,
            96,
            null,
            null,
            minimumLayover), Times.Once);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_FlightRateServiceCalled_ForEachFlight()
    {
        // Arrange
        var departureDate = DateTimeOffset.Now.AddDays(1);
        const int jobId = 16992;

        var flights = new List<FlightViewModel>
        {
            CreateTestFlight("NZ", "1", "AKL", "SYD"),
            CreateTestFlight("QF", "2", "AKL", "SYD"),
            CreateTestFlight("AA", "3", "AKL", "SYD"),
        };

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                It.IsAny<int>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<string>(),
                It.IsAny<List<string>>(),
                It.IsAny<int>()))
            .ReturnsAsync(flights);

        _flightRateServiceMock.Setup(x => x.GetCarrierFlightRateByJobIdAsync(
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<bool>(),
                It.IsAny<DateTime>()))
            .ReturnsAsync(100.00m);

        var controller = CreateController();

        // Act
        await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId: null,
            departureAirportId: 150,
            arrivalAirportId: 96);

        // Assert - Rate service called once per flight
        _flightRateServiceMock.Verify(x => x.GetCarrierFlightRateByJobIdAsync(
            jobId,
            It.IsAny<string>(),
            It.IsAny<bool>(),
            It.IsAny<DateTime>()), Times.Exactly(3));
    }

    [Fact]
    public async Task GetScheduledFlightOptions_DefaultMinimumLayover_Is60Minutes()
    {
        // Arrange
        var departureDate = DateTimeOffset.Now.AddDays(1);
        const int jobId = 16992;

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                It.IsAny<int>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<string>(),
                It.IsAny<List<string>>(),
                60)) // Default value
            .ReturnsAsync([]);

        var controller = CreateController();

        // Act - Call without specifying minimumLayoverMinutes
        await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId: null,
            departureAirportId: 150,
            arrivalAirportId: 96);

        // Assert
        _flightServiceMock.Verify(x => x.GetFlightsAsync(
            jobId,
            departureDate,
            null,
            150,
            96,
            null,
            null,
            60), Times.Once);
    }

    #endregion

    #region Helper Methods

    private static FlightViewModel CreateTestFlight(string airlineCode, string flightNumber, string departure, string arrival)
    {
        return new FlightViewModel
        {
            AirlineCode = airlineCode,
            FlightNumber = flightNumber,
            DepartureTime = DateTimeOffset.Now.AddHours(3),
            ArrivalTime = DateTimeOffset.Now.AddHours(6),
            FlightSegments =
            [
                new FlightSegmentViewModel
                {
                    CarrierFsCode = airlineCode,
                    FlightNumber = flightNumber,
                    DepartureAirportFsCode = departure,
                    ArrivalAirportFsCode = arrival,
                    DepartureTime = DateTimeOffset.Now.AddHours(3),
                    ArrivalTime = DateTimeOffset.Now.AddHours(6),
                }
            ]
        };
    }

    #endregion
}
