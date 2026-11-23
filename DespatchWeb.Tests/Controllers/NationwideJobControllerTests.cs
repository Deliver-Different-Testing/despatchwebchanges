using DespatchWeb.Constants;
using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Filters;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
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

    private readonly IScopeProvider _scopeProviderMock = Substitute.For<IScopeProvider>();
    private readonly IForwardAirApiClient _forwardAirMock = Substitute.For<IForwardAirApiClient>();

    private NationwideJobController CreateController() =>
        new(
            _repositoryMock,
            _flightServiceMock,
            _flightAssignmentServiceMock,
            _clientAccessValidatorMock,
            _tenantInfoServiceMock,
            _flightRateServiceMock,
            _clientRepositoryMock,
            _recoveryJobServiceMock,
            _scopeProviderMock,
            _forwardAirMock);

    /// <summary>ClientTypeId 3 — a network-partner-scoped session.</summary>
    private void GivenNetworkPartnerSession() =>
        _scopeProviderMock.Scope.Returns(new ScopeContext(ClientTypeId: 3, ClientId: null, NpAgentId: 42));

    private void GivenTenantStaffSession() =>
        _scopeProviderMock.Scope.Returns(new ScopeContext(ClientTypeId: 1, ClientId: 7, NpAgentId: null));

    [Fact]
    public async Task AssignNpAgentToJob_ValidRequestAsTenantStaff_AssignsAndReturnsOk()
    {
        // Arrange
        GivenTenantStaffSession();
        var controller = CreateController();

        // Act
        var result = await controller.AssignNpAgentToJob(new AssignNpAgentRequest {NpAgentId = 5, JobId = 10});

        // Assert
        Assert.IsType<OkObjectResult>(result);
        await _repositoryMock.Received(1).AssignNpAgentToJobAsync(5, 10);
    }

    [Fact]
    public async Task AssignNpAgentToJob_MissingIds_ReturnsBadRequestWithoutTouchingTheRepository()
    {
        // Arrange
        GivenTenantStaffSession();
        var controller = CreateController();

        // Act
        var result = await controller.AssignNpAgentToJob(new AssignNpAgentRequest {NpAgentId = null, JobId = 10});

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
        await _repositoryMock.DidNotReceiveWithAnyArgs().AssignNpAgentToJobAsync(0, 0);
    }

    [Fact]
    public async Task AssignEndpoints_RejectNetworkPartnerScopedCallers()
    {
        // A network partner may only dispatch to their own couriers. The dialog hides
        // the Agent/NP options for them, but that is presentation — the endpoints have
        // to refuse a hand-crafted request as well.
        GivenNetworkPartnerSession();
        var controller = CreateController();

        Assert.IsType<ForbidResult>(
            await controller.AssignNpAgentToJob(new AssignNpAgentRequest {NpAgentId = 5, JobId = 10}));
        Assert.IsType<ForbidResult>(
            await controller.AssignAgentToJob(new AgentJobRequestModel {AgentId = 5, JobId = 10}));
        Assert.IsType<ForbidResult>(
            await controller.AssignNpAgentToJobs(new AssignNpAgentToJobsRequest {NpAgentId = 5, JobIds = [10]}));
        Assert.IsType<ForbidResult>(
            await controller.AssignAgentToJobs(new AssignAgentToJobsRequest {AgentId = 5, JobIds = [10]}));

        await _repositoryMock.DidNotReceiveWithAnyArgs().AssignNpAgentToJobAsync(0, 0);
        await _repositoryMock.DidNotReceiveWithAnyArgs().AddAgentToJobAsync(0, 0);
        await _repositoryMock.DidNotReceiveWithAnyArgs().AssignNpAgentToJobsAsync(0, null!);
        await _repositoryMock.DidNotReceiveWithAnyArgs().AssignAgentToJobsAsync(0, null!);
    }

    [Fact]
    public async Task AssignAgentToJobs_AsTenantStaff_ReturnsPerJobOutcomes()
    {
        // Arrange
        GivenTenantStaffSession();
        _repositoryMock.AssignAgentToJobsAsync(5, Arg.Any<IReadOnlyList<int>>())
            .Returns([
                new BulkAssignmentResult(10, true, null, AgentInboundEmailStatus.Queued),
                new BulkAssignmentResult(11, false, "no flight", null)
            ]);
        var controller = CreateController();

        // Act
        var result = await controller.AssignAgentToJobs(
            new AssignAgentToJobsRequest {AgentId = 5, JobIds = [10, 11]});

        // Assert
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
        var payload = ok.Value.GetType();
        Assert.Equal(1, payload.GetProperty("assigned")!.GetValue(ok.Value));
        Assert.Equal(1, payload.GetProperty("failed")!.GetValue(ok.Value));
    }

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
        var result = await controller.AssignFlightToJob(request, TestContext.Current.CancellationToken);

        // Assert — controller delegates the webhook + persistence to the service.
        Assert.IsType<OkResult>(result);
        await _flightAssignmentServiceMock.Received(1).AssignFlightAsync(request, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task AssignFlightToJob_ForwardsCancellationTokenToService()
    {
        // Arrange
        var request = CreateTestAssignRequest(jobId: 100);
        var controller = CreateController();
        using var cts = new CancellationTokenSource();

        // Act
        await controller.AssignFlightToJob(request, cts.Token);

        // Assert
        await _flightAssignmentServiceMock.Received(1).AssignFlightAsync(request, cts.Token);
    }

    [Fact]
    public async Task AssignFlightToJob_JobAlreadyHasFlight_ReturnsConflict()
    {
        // Arrange
        var request = CreateTestAssignRequest(jobId: 100);

        _flightAssignmentServiceMock.AssignFlightAsync(request, TestContext.Current.CancellationToken).ThrowsAsync(new InvalidOperationException("Job 100 already has a flight assigned"));

        var controller = CreateController();

        // Act
        var result = await controller.AssignFlightToJob(request, TestContext.Current.CancellationToken);

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

        _flightAssignmentServiceMock.AssignFlightAsync(request, TestContext.Current.CancellationToken).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.AssignFlightToJob(request, TestContext.Current.CancellationToken);

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

    private const int ForwardAirCarrierId = 900;

    private void GivenForwardAirCarrierActive() =>
        _repositoryMock.GetActiveFlightCarrierIdByCodeAsync(ForwardAirCarrier.Code).Returns(ForwardAirCarrierId);

    private void GivenRates(decimal amount = 100m) =>
        _flightRateServiceMock.GetCarrierFlightRateByJobIdAsync(
            Arg.Any<int>(), Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<DateTime>()).Returns(amount);

    private void GivenFlights(params FlightViewModel[] flights) =>
        _flightServiceMock.GetFlightsAsync(
                Arg.Any<int>(), Arg.Any<DateTimeOffset?>(), Arg.Any<int?>(), Arg.Any<int?>(), Arg.Any<int?>(),
                Arg.Any<string>(), Arg.Any<IReadOnlyList<string>>(), Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<bool>())
            .Returns(flights.ToList());

    private static ForwardAirQuoteResponseDto QuoteWith(params ForwardAirQuoteServiceDto[] services) =>
        new() {Success = true, Services = [.. services]};

    private static ForwardAirQuoteServiceDto T2T(decimal total = 999m) => new()
    {
        ServiceCode = "T2T",
        ServiceName = "Terminal to Terminal",
        OriginAirport = "BNA",
        DestinationAirport = "EWR",
        ShipDate = new DateTime(2026, 12, 1, 10, 0, 0),
        OriginTimeZone = "America/Chicago",
        EstimatedArrival = new DateTime(2026, 12, 2, 9, 0, 0),
        DestinationTimeZone = "America/New_York",
        QuotedTotal = total
    };

    private async Task<FlightSearchResponse> SearchAsync(int? airlineId = null)
    {
        var result = await CreateController().GetScheduledFlightOptions(
            DateTimeOffset.Now.AddDays(1), 16992, airlineId, 150, 96);
        return Assert.IsType<FlightSearchResponse>(Assert.IsType<JsonResult>(result).Value);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_NoFilter_AddsForwardAirRows_MappedLikeFlights()
    {
        GivenForwardAirCarrierActive();
        GivenRates(100m);
        GivenFlights(CreateTestFlight("NZ", "123", "AKL", "SYD"));
        _forwardAirMock.GetLegQuoteAsync(16992, Arg.Any<CancellationToken>()).Returns(QuoteWith(T2T()));

        var response = await SearchAsync();

        Assert.Equal(2, response.Flights.Count);
        var fa = Assert.Single(response.Flights, f => f.AirlineCode == "FWD");
        Assert.Equal("Forward Air", fa.Airline);
        Assert.Equal("T2T", fa.FlightNumber);
        Assert.Equal("Terminal to Terminal", fa.ServiceTypeDescription);
        Assert.Equal("BNA", fa.DepartureAirport);
        Assert.Equal("EWR", fa.ArrivalAirport);
        Assert.Equal("America/Chicago", fa.DepartureTimeZone);
        Assert.Equal("America/New_York", fa.ArrivalTimeZone);
        Assert.Equal(new DateTimeOffset(2026, 12, 1, 10, 0, 0, TimeSpan.FromHours(-6)), fa.DepartureTime);
        Assert.Equal(new DateTimeOffset(2026, 12, 2, 9, 0, 0, TimeSpan.FromHours(-5)), fa.ArrivalTime);
        Assert.Equal(0, fa.Stops);
        var segment = Assert.Single(fa.FlightSegments);
        Assert.Equal("FWD", segment.CarrierFsCode);
        Assert.Equal("T2T", segment.FlightNumber);
        Assert.Equal("BNA", segment.DepartureAirportFsCode);
        Assert.Equal("EWR", segment.ArrivalAirportFsCode);
        Assert.Equal("America/Chicago", segment.DepartureAirportTimeZone);
        Assert.Equal("America/New_York", segment.ArrivalAirportTimeZone);
        Assert.Equal("Forward Air", segment.AirlineName);
        Assert.Equal(150, segment.DepartureAirportId);
        Assert.Equal(96, segment.ArrivalAirportId);
        Assert.Equal(fa.DepartureTime, segment.DepartureTime);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_ForwardAirAmount_ComesFromFlightRateService_NotQuote()
    {
        GivenForwardAirCarrierActive();
        GivenFlights();
        _flightRateServiceMock.GetCarrierFlightRateByJobIdAsync(16992, "FWD", true, Arg.Any<DateTime>()).Returns(42m);
        _forwardAirMock.GetLegQuoteAsync(16992, Arg.Any<CancellationToken>()).Returns(QuoteWith(T2T(999m)));

        var response = await SearchAsync();

        Assert.Equal(42m, Assert.Single(response.Flights).Amount);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_MergedRows_FollowExistingArrivalOrdering()
    {
        GivenForwardAirCarrierActive();
        GivenRates();
        GivenFlights(CreateTestFlight("NZ", "1", "BNA", "EWR"), CreateTestFlight("QF", "2", "BNA", "EWR"));
        _forwardAirMock.GetLegQuoteAsync(16992, Arg.Any<CancellationToken>()).Returns(QuoteWith(T2T()));

        var response = await SearchAsync();

        Assert.Equal(response.Flights.OrderBy(f => f.ArrivalTime).ToList(), response.Flights);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_QuoteSuccessFalse_KeepsFlights_AndReportsReason()
    {
        GivenForwardAirCarrierActive();
        GivenRates();
        GivenFlights(CreateTestFlight("NZ", "123", "AKL", "SYD"));
        _forwardAirMock.GetLegQuoteAsync(16992, Arg.Any<CancellationToken>())
            .Returns(new ForwardAirQuoteResponseDto {Success = false, Error = "Forward Air is not connected"});

        var response = await SearchAsync();

        Assert.Single(response.Flights);
        Assert.Contains("Forward Air is not connected", response.Message);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_QuoteThrows_KeepsFlights_AndReportsReason()
    {
        GivenForwardAirCarrierActive();
        GivenRates();
        GivenFlights(CreateTestFlight("NZ", "123", "AKL", "SYD"));
        _forwardAirMock.GetLegQuoteAsync(16992, Arg.Any<CancellationToken>())
            .Throws(new HttpRequestException("boom"));

        var response = await SearchAsync();

        Assert.Single(response.Flights);
        Assert.Contains("Forward Air", response.Message);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_QuoteFails_AndNoFlights_KeepsNoFlightsMessage_AndAppendsReason()
    {
        GivenForwardAirCarrierActive();
        GivenFlights();
        _forwardAirMock.GetLegQuoteAsync(16992, Arg.Any<CancellationToken>())
            .Returns(new ForwardAirQuoteResponseDto {Success = false, Error = "Forward Air is not connected"});

        var response = await SearchAsync();

        Assert.Empty(response.Flights);
        Assert.Contains("No flights found", response.Message);
        Assert.Contains("Forward Air is not connected", response.Message);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_NoFlights_ButForwardAirServices_ReturnsServicesWithoutNoFlightsMessage()
    {
        GivenForwardAirCarrierActive();
        GivenRates();
        GivenFlights();
        _forwardAirMock.GetLegQuoteAsync(16992, Arg.Any<CancellationToken>()).Returns(QuoteWith(T2T()));

        var response = await SearchAsync();

        Assert.Single(response.Flights);
        Assert.Null(response.Message);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_OtherAirlineFilter_DoesNotCallForwardAir()
    {
        GivenForwardAirCarrierActive();
        GivenRates();
        GivenFlights(CreateTestFlight("NZ", "123", "AKL", "SYD"));

        var response = await SearchAsync(airlineId: 5);

        Assert.Single(response.Flights);
        await _forwardAirMock.DidNotReceiveWithAnyArgs().GetLegQuoteAsync(0);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_ForwardAirFilter_ReturnsOnlyForwardAirRows_WithoutSearchingFlights()
    {
        GivenForwardAirCarrierActive();
        GivenRates();
        GivenFlights(CreateTestFlight("NZ", "123", "AKL", "SYD"));
        _forwardAirMock.GetLegQuoteAsync(16992, Arg.Any<CancellationToken>()).Returns(QuoteWith(T2T()));

        var response = await SearchAsync(airlineId: ForwardAirCarrierId);

        Assert.All(response.Flights, f => Assert.Equal("FWD", f.AirlineCode));
        Assert.Single(response.Flights);
        await _flightServiceMock.DidNotReceiveWithAnyArgs().GetFlightsAsync(0);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_ForwardAirFilter_QuoteFails_ReturnsEmptyWithReason()
    {
        GivenForwardAirCarrierActive();
        _forwardAirMock.GetLegQuoteAsync(16992, Arg.Any<CancellationToken>())
            .Returns(new ForwardAirQuoteResponseDto {Success = false, Error = "Forward Air did not respond in time"});

        var response = await SearchAsync(airlineId: ForwardAirCarrierId);

        Assert.Empty(response.Flights);
        Assert.Contains("did not respond", response.Message);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_TenantWithoutForwardAirCarrier_DoesNotCallForwardAir()
    {
        GivenRates();
        GivenFlights(CreateTestFlight("NZ", "123", "AKL", "SYD"));

        var response = await SearchAsync();

        Assert.Single(response.Flights);
        Assert.Null(response.Message);
        await _forwardAirMock.DidNotReceiveWithAnyArgs().GetLegQuoteAsync(0);
    }

    [Fact]
    public async Task GetScheduledFlightOptions_StartsQuoteBeforeFlightSearchCompletes()
    {
        GivenForwardAirCarrierActive();
        GivenRates();
        var quoteStarted = new TaskCompletionSource();
        _forwardAirMock.GetLegQuoteAsync(16992, Arg.Any<CancellationToken>()).Returns(_ =>
        {
            quoteStarted.SetResult();
            return Task.FromResult(QuoteWith(T2T()));
        });
        _flightServiceMock.GetFlightsAsync(
                Arg.Any<int>(), Arg.Any<DateTimeOffset?>(), Arg.Any<int?>(), Arg.Any<int?>(), Arg.Any<int?>(),
                Arg.Any<string>(), Arg.Any<IReadOnlyList<string>>(), Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<bool>())
            .Returns(async _ =>
            {
                await quoteStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
                return (IReadOnlyList<FlightViewModel>) [];
            });

        var response = await SearchAsync();

        Assert.Single(response.Flights);
    }

    [Fact]
    public async Task RestoreJob_SkipsCiriumDelete_ForEmptyOrNullWebhookIds()
    {
        _repositoryMock.GetFlightWebhookIdByJobIdAsync(10).Returns(new List<string> {"", null, "RULE-1"});

        var result = await CreateController().RestoreJob(new RestoreJobRequest {JobId = 10});

        Assert.IsType<OkResult>(result);
        await _flightServiceMock.Received(1).DeleteFlightRuleById("RULE-1");
        await _flightServiceMock.DidNotReceive().DeleteFlightRuleById("");
        await _flightServiceMock.DidNotReceive().DeleteFlightRuleById(null);
        await _repositoryMock.Received(1).RestoreNationwideJobAsync(10);
    }

    [Fact]
    public async Task GetForwardAirJob_ReturnsClientJobView()
    {
        _forwardAirMock.GetJobAsync(77, Arg.Any<CancellationToken>())
            .Returns(new ForwardAirJobDto {JobId = 77, AirbillNumber = "123"});

        var result = await CreateController().GetForwardAirJob(77, TestContext.Current.CancellationToken);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equal("123", Assert.IsType<ForwardAirJobDto>(json.Value).AirbillNumber);
    }

    [Fact]
    public async Task GetForwardAirJob_NoLink_ReturnsNotFound()
    {
        _forwardAirMock.GetJobAsync(77, Arg.Any<CancellationToken>()).Returns((ForwardAirJobDto) null);

        Assert.IsType<NotFoundResult>(await CreateController().GetForwardAirJob(77, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task GetForwardAirJob_UpstreamFailure_Returns502()
    {
        _forwardAirMock.GetJobAsync(77, Arg.Any<CancellationToken>()).Throws(new HttpRequestException("boom"));

        var result = await CreateController().GetForwardAirJob(77, TestContext.Current.CancellationToken);

        Assert.Equal(502, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Theory]
    [InlineData("LABEL")]
    [InlineData("BOL")]
    [InlineData("DELIVER")]
    [InlineData("bol")]
    public async Task GetForwardAirDocument_AllowedType_StreamsPdf(string type)
    {
        _forwardAirMock.GetDocumentAsync(77, type.ToUpperInvariant(), Arg.Any<CancellationToken>())
            .Returns(new ForwardAirDocument(new MemoryStream([1, 2]), "application/pdf", "bol.pdf"));

        var result = await CreateController().GetForwardAirDocument(77, type, TestContext.Current.CancellationToken);

        var file = Assert.IsType<FileStreamResult>(result);
        Assert.Equal("application/pdf", file.ContentType);
    }

    [Theory]
    [InlineData("POD")]
    [InlineData("../x")]
    [InlineData("")]
    public async Task GetForwardAirDocument_OtherType_ReturnsBadRequest(string type)
    {
        var result = await CreateController().GetForwardAirDocument(77, type, TestContext.Current.CancellationToken);

        Assert.IsType<BadRequestObjectResult>(result);
        await _forwardAirMock.DidNotReceiveWithAnyArgs().GetDocumentAsync(0, null);
    }

    [Fact]
    public async Task GetForwardAirDocument_Missing_ReturnsNotFound()
    {
        _forwardAirMock.GetDocumentAsync(77, "BOL", Arg.Any<CancellationToken>()).Returns((ForwardAirDocument) null);

        Assert.IsType<NotFoundResult>(
            await CreateController().GetForwardAirDocument(77, "BOL", TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData(nameof(NationwideJobController.GetForwardAirJob))]
    [InlineData(nameof(NationwideJobController.GetForwardAirDocument))]
    public void ForwardAirEndpoints_RequireJobScopeOnLegId(string name)
    {
        var method = typeof(NationwideJobController).GetMethod(name)!;

        var scope = Assert.Single(method.GetCustomAttributes(typeof(RequireScopeAttribute), true)
            .Cast<RequireScopeAttribute>());

        Assert.Equal(ScopedRecord.Job, scope.Record);
        Assert.Equal(["legId"], scope.IdPaths);
    }

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
