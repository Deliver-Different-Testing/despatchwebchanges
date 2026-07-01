using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

[TestSubject(typeof(NationwideJobController))]
public class NationwideJobControllerTests
{
    private readonly INationwideJobRepository _repositoryMock = Substitute.For<INationwideJobRepository>();
    private readonly IFlightStatsService _flightServiceMock = Substitute.For<IFlightStatsService>();
    private readonly IFlightAssignmentService _flightAssignmentServiceMock = Substitute.For<IFlightAssignmentService>();
    private readonly IClientAccessValidatorService _clientAccessValidatorMock = Substitute.For<IClientAccessValidatorService>();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IFlightRateService _flightRateServiceMock = Substitute.For<IFlightRateService>();
    private readonly IClientRepository _clientRepositoryMock = Substitute.For<IClientRepository>();
    private readonly IAddAgentRecoveryJobService _recoveryJobServiceMock = Substitute.For<IAddAgentRecoveryJobService>();

    private NationwideJobController CreateController() =>
        new(
            _repositoryMock,
            _flightServiceMock,
            _flightAssignmentServiceMock,
            _clientAccessValidatorMock,
            _tenantInfoServiceMock,
            _flightRateServiceMock,
            _clientRepositoryMock,
            _recoveryJobServiceMock);

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

        _flightServiceMock.GetFlightsAsync(
                jobId,
                departureDate,
                null, // no airline filter
                departureAirportId,
                arrivalAirportId,
                "FS").Returns(expectedFlights);

        _flightRateServiceMock.GetCarrierFlightRateByJobIdAsync(
                Arg.Any<int>(),
                Arg.Any<string>(),
                Arg.Any<bool>(),
                Arg.Any<DateTime>()).Returns(100.00m);

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
    public async Task GetRecurringFlightOptions_ValidRoute_ReturnsFlightsWithoutRating()
    {
        var departureDate = DateTimeOffset.Now.AddDays(7);
        const int bookingId = 555;
        const int departureAirportId = 150;
        const int arrivalAirportId = 96;

        _flightServiceMock.GetFlightsAsync(
                bookingId,
                departureDate,
                null,
                departureAirportId,
                arrivalAirportId,
                "FS").Returns(new List<FlightViewModel> { CreateTestFlight("NZ", "123", "AKL", "WLG") });

        var controller = CreateController();

        var result = await controller.GetRecurringFlightOptions(
            departureDate, bookingId, departureAirportId, arrivalAirportId);

        var response = Assert.IsType<FlightSearchResponse>(Assert.IsType<JsonResult>(result).Value);
        Assert.Single(response.Flights);
        // The recurring picker never rate-calculates — the rate service stays untouched.
        await _flightRateServiceMock.DidNotReceiveWithAnyArgs()
            .GetCarrierFlightRateByJobIdAsync(0, null, false, null);
    }

    [Fact]
    public async Task GetRecurringFlightOptions_MissingAirports_ReturnsMessageWithoutSearching()
    {
        var controller = CreateController();

        var result = await controller.GetRecurringFlightOptions(
            DateTimeOffset.Now.AddDays(7), bookingId: 555, departureAirportId: null, arrivalAirportId: null);

        var response = Assert.IsType<FlightSearchResponse>(Assert.IsType<JsonResult>(result).Value);
        Assert.Empty(response.Flights);
        Assert.False(string.IsNullOrEmpty(response.Message));
        await _flightServiceMock.DidNotReceiveWithAnyArgs().GetFlightsAsync(0);
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

        _flightServiceMock.GetFlightsAsync(
                jobId,
                departureDate,
                airlineId, // airline filter
                departureAirportId,
                arrivalAirportId,
                "FS").Returns(expectedFlights);

        _flightRateServiceMock.GetCarrierFlightRateByJobIdAsync(
                Arg.Any<int>(),
                Arg.Any<string>(),
                Arg.Any<bool>(),
                Arg.Any<DateTime>()).Returns(150.00m);

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
        await _flightServiceMock.Received().GetFlightsAsync(
            jobId,
            departureDate,
            airlineId,
            departureAirportId,
            arrivalAirportId,
            "FS");
    }

    [Fact]
    public async Task GetScheduledFlightOptions_NoFlightsFound_ReturnsEmptyListWithMessage()
    {
        // Arrange
        var departureDate = DateTimeOffset.Now.AddDays(1);
        const int jobId = 16992;
        const int departureAirportId = 150;
        const int arrivalAirportId = 96;

        _flightServiceMock.GetFlightsAsync(
                Arg.Any<int>(),
                Arg.Any<DateTimeOffset?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<string>(),
                Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<int>()).Returns([]);

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

        _flightServiceMock.GetFlightsAsync(
                Arg.Any<int>(),
                Arg.Any<DateTimeOffset?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<string>(),
                Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<int>()).Returns((List<FlightViewModel>)null!);

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

        _flightServiceMock.GetFlightsAsync(
                Arg.Any<int>(),
                Arg.Any<DateTimeOffset?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<string>(),
                Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<int>()).ThrowsAsync(new ArgumentException("Departure airport with ID 150 not found in active airports"));

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

        _flightServiceMock.GetFlightsAsync(
                Arg.Any<int>(),
                Arg.Any<DateTimeOffset?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<string>(),
                Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<int>()).ThrowsAsync(new InvalidOperationException("Something unexpected went wrong"));

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

        _flightServiceMock.GetFlightsAsync(
                Arg.Any<int>(),
                Arg.Any<DateTimeOffset?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<string>(),
                Arg.Any<IReadOnlyList<string>>(),
                minimumLayover).Returns([]);

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
        await _flightServiceMock.Received().GetFlightsAsync(
            jobId,
            departureDate,
            null,
            150,
            96,
            "FS",
            null,
            minimumLayover);
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

        _flightServiceMock.GetFlightsAsync(
                Arg.Any<int>(),
                Arg.Any<DateTimeOffset?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<string>(),
                Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<int>()).Returns(flights);

        _flightRateServiceMock.GetCarrierFlightRateByJobIdAsync(
                Arg.Any<int>(),
                Arg.Any<string>(),
                Arg.Any<bool>(),
                Arg.Any<DateTime>()).Returns(100.00m);

        var controller = CreateController();

        // Act
        await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId: null,
            departureAirportId: 150,
            arrivalAirportId: 96);

        // Assert - Rate service called once per flight
        await _flightRateServiceMock.Received(3).GetCarrierFlightRateByJobIdAsync(
            jobId,
            Arg.Any<string>(),
            Arg.Any<bool>(),
            Arg.Any<DateTime>());
    }

    [Fact]
    public async Task GetScheduledFlightOptions_DefaultMinimumLayover_Is60Minutes()
    {
        // Arrange
        var departureDate = DateTimeOffset.Now.AddDays(1);
        const int jobId = 16992;

        _flightServiceMock.GetFlightsAsync(
                Arg.Any<int>(),
                Arg.Any<DateTimeOffset?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<int?>(),
                Arg.Any<string>(),
                Arg.Any<IReadOnlyList<string>>()) // Default value
            .Returns([]);

        var controller = CreateController();

        // Act - Call without specifying minimumLayoverMinutes
        await controller.GetScheduledFlightOptions(
            departureDate,
            jobId,
            airlineId: null,
            departureAirportId: 150,
            arrivalAirportId: 96);

        // Assert
        await _flightServiceMock.Received().GetFlightsAsync(
            jobId,
            departureDate,
            null,
            150,
            96,
            "FS");
    }

    [Fact]
    public async Task AssignFlightToJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = CreateTestAssignRequest(jobId: 100);
        var controller = CreateController();

        // Act
        var result = await controller.AssignFlightToJob(request);

        // Assert — controller delegates the webhook + persistence to the service.
        Assert.IsType<OkResult>(result);
        await _flightAssignmentServiceMock.Received(1).AssignFlightAsync(request);
    }

    [Fact]
    public async Task AssignFlightToJob_JobAlreadyHasFlight_ReturnsConflict()
    {
        // Arrange
        var request = CreateTestAssignRequest(jobId: 100);

        _flightAssignmentServiceMock.AssignFlightAsync(request)
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

        _flightAssignmentServiceMock.AssignFlightAsync(request)
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
