using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
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

    private NationwideJobController CreateController() =>
        new(
            _repositoryMock.Object,
            _flightServiceMock.Object,
            _clientAccessValidatorMock.Object,
            _tenantInfoServiceMock.Object,
            _flightRateServiceMock.Object,
            _clientRepositoryMock.Object,
            _recoveryJobServiceMock.Object);

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
            CreateTestFlight("QF", "456", "AKL", "SYD")
        };

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                jobId,
                departureDate,
                null, // no airline filter
                departureAirportId,
                arrivalAirportId,
                "FS",
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
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var response = Assert.IsType<FlightSearchResponse>(jsonResult.Value);
        Assert.Equal(2, response.Flights.Count);
        Assert.Null(response.Message);
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
            CreateTestFlight("QF", "789", "AKL", "SYD")
        };

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                jobId,
                departureDate,
                airlineId, // airline filter
                departureAirportId,
                arrivalAirportId,
                "FS",
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
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var response = Assert.IsType<FlightSearchResponse>(jsonResult.Value);
        Assert.Single(response.Flights);
        Assert.Equal("QF", response.Flights[0].AirlineCode);

        // Verify airline filter was passed
        _flightServiceMock.Verify(x => x.GetFlightsAsync(
            jobId,
            departureDate,
            airlineId,
            departureAirportId,
            arrivalAirportId,
            "FS",
            null,
            60), Times.Once);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_NoFlightsFound_ReturnsEmptyListWithMessage()
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
                It.IsAny<IReadOnlyList<string>>(),
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
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var response = Assert.IsType<FlightSearchResponse>(jsonResult.Value);
        Assert.Empty(response.Flights);
        Assert.NotNull(response.Message);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_NullFlightsFromService_ReturnsEmptyListWithMessage()
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
                It.IsAny<IReadOnlyList<string>>(),
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
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var response = Assert.IsType<FlightSearchResponse>(jsonResult.Value);
        Assert.Empty(response.Flights);
        Assert.NotNull(response.Message);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_ArgumentException_ReturnsEmptyFlightsWithMessage()
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
                It.IsAny<IReadOnlyList<string>>(),
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

        // Assert - Now returns JSON with message instead of 500
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var response = Assert.IsType<FlightSearchResponse>(jsonResult.Value);
        Assert.Empty(response.Flights);
        Assert.Contains("Departure airport with ID 150 not found", response.Message);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_UnexpectedException_Returns500()
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
                It.IsAny<IReadOnlyList<string>>(),
                It.IsAny<int>()))
            .ThrowsAsync(new InvalidOperationException("Something unexpected went wrong"));

        var controller = CreateController();

        // Act
        var result = await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId: null,
            departureAirportId: 150,
            arrivalAirportId: 96);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
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
                It.IsAny<IReadOnlyList<string>>(),
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
            "FS",
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
            CreateTestFlight("AA", "3", "AKL", "SYD")
        };

        _flightServiceMock.Setup(x => x.GetFlightsAsync(
                It.IsAny<int>(),
                It.IsAny<DateTimeOffset?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<string>(),
                It.IsAny<IReadOnlyList<string>>(),
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
                It.IsAny<IReadOnlyList<string>>(),
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
            "FS",
            null,
            60), Times.Once);
    }

    [Fact]
    public async Task AssignFlightToJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = CreateTestAssignRequest(jobId: 100);

        _repositoryMock.Setup(x => x.AddJobNationwideAsync(
                request,
                It.IsAny<IReadOnlyList<string>>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.AssignFlightToJob(request);

        // Assert
        Assert.IsType<OkResult>(result);
        _repositoryMock.Verify(x => x.AddJobNationwideAsync(
            request,
            It.IsAny<IReadOnlyList<string>>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AssignFlightToJob_JobAlreadyHasFlight_ReturnsConflict()
    {
        // Arrange
        var request = CreateTestAssignRequest(jobId: 100);

        _repositoryMock.Setup(x => x.AddJobNationwideAsync(
                request,
                It.IsAny<IReadOnlyList<string>>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Job 100 already has a flight assigned"));

        var controller = CreateController();

        // Act
        var result = await controller.AssignFlightToJob(request);

        // Assert
        Assert.IsType<ConflictObjectResult>(result);
        var conflictResult = (ConflictObjectResult)result;
        Assert.Contains("already has a flight assigned", conflictResult.Value?.ToString());
    }

    [Fact]
    public async Task AssignFlightToJob_UnexpectedException_Returns500()
    {
        // Arrange
        var request = CreateTestAssignRequest(jobId: 100);

        _repositoryMock.Setup(x => x.AddJobNationwideAsync(
                request,
                It.IsAny<IReadOnlyList<string>>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.AssignFlightToJob(request);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

    private static AssignFlightToJobRequest CreateTestAssignRequest(int jobId) => new()
    {
        JobId = jobId,
        FromAirportId = 1,
        ToAirportId = 2,
        FlightNumber = "NZ123",
        DepartureDate = DateTimeOffset.Now.AddDays(1),
        FlightSegments =
        [
            new FlightSegmentViewModel
            {
                SegmentOrder = 1,
                CarrierFsCode = "NZ",
                FlightNumber = "123",
                DepartureAirportFsCode = "AKL",
                ArrivalAirportFsCode = "SYD",
                DepartureTime = DateTimeOffset.Now.AddHours(3),
                ArrivalTime = DateTimeOffset.Now.AddHours(6)
            }
        ]
    };

    private static FlightViewModel CreateTestFlight(string airlineCode, string flightNumber, string departure, string arrival) =>
        new()
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
                    ArrivalTime = DateTimeOffset.Now.AddHours(6)
                }
            ]
        };

}
