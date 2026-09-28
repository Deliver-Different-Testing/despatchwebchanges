using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using JetBrains.Annotations;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services;

[TestSubject(typeof(FlightAssignmentService))]
public class FlightAssignmentServiceTests
{
    private readonly IFlightStatsService _flightService = Substitute.For<IFlightStatsService>();
    private readonly INationwideJobRepository _repository = Substitute.For<INationwideJobRepository>();

    private FlightAssignmentService CreateService() => new(_flightService, _repository);

    private static FlightSegmentViewModel Segment(string carrier, string number) => new()
    {
        CarrierFsCode = carrier,
        FlightNumber = number,
        DepartureAirportFsCode = "AKL",
        ArrivalAirportFsCode = "WLG",
        DepartureTime = DateTimeOffset.Parse("2026-07-08T08:00:00Z"),
        ArrivalTime = DateTimeOffset.Parse("2026-07-08T09:00:00Z")
    };

    private static FlightViewModel Flight(string airlineCode, string number, string time = "2026-07-08T08:00:00Z") =>
        new()
        {
            AirlineCode = airlineCode,
            FlightNumber = number,
            DepartureTime = DateTimeOffset.Parse(time),
            ArrivalTime = DateTimeOffset.Parse(time).AddHours(1),
            DepartureAirport = "AKL",
            ArrivalAirport = "WLG",
            FlightSegments = [Segment(airlineCode, number)]
        };

    private static SavedFlightCandidate Candidate(string savedNumber, int jobId = 100) => new()
    {
        JobId = jobId,
        FromAirportId = 1,
        ToAirportId = 2,
        SavedFlightNumber = savedNumber,
        DepartureDate = DateTimeOffset.Parse("2026-07-08T00:00:00Z")
    };

    private void StubFlights(params FlightViewModel[] flights) =>
        _flightService.GetFlightsAsync(
                Arg.Any<int>(), Arg.Any<DateTimeOffset?>(), Arg.Any<int?>(), Arg.Any<int?>(),
                Arg.Any<int?>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<bool>())
            .Returns(flights.ToList());

    [Fact]
    public async Task AssignFlightAsync_CreatesWebhookPerSegment_AndPersists()
    {
        var request = new AssignFlightToJobRequest
        {
            JobId = 100,
            FlightNumber = "NZ123",
            DepartureDate = DateTimeOffset.Parse("2026-07-08T08:00:00Z"),
            FlightSegments = [Segment("NZ", "123"), Segment("NZ", "456")]
        };
        _flightService.CreateFlightRuleByDepartureAsync(Arg.Any<string>(), Arg.Any<DateTimeOffset>(), Arg.Any<string>())
            .Returns("wh-1", "wh-2");

        await CreateService().AssignFlightAsync(request);

        await _flightService.Received(1).CreateFlightRuleByDepartureAsync("NZ123", Arg.Any<DateTimeOffset>(), "AKL");
        await _flightService.Received(1).CreateFlightRuleByDepartureAsync("NZ456", Arg.Any<DateTimeOffset>(), "AKL");
        await _repository.Received(1).AddJobNationwideAsync(
            request,
            Arg.Is<IReadOnlyList<string>>(ids => ids!.Count == 2 && ids.Contains("wh-1") && ids.Contains("wh-2")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AutoAssignSavedFlightsAsync_MatchingFlight_AssignsAndCounts()
    {
        _repository.GetSavedFlightCandidatesAsync(Arg.Any<IReadOnlyList<int>>())
            .Returns([Candidate("NZ123")]);
        StubFlights(Flight("QF", "500"), Flight("NZ", "123"));

        var result = await CreateService().AutoAssignSavedFlightsAsync([100]);

        Assert.Equal(1, result.Assigned);
        Assert.Equal(0, result.Unmatched);
        await _repository.Received(1).AddJobNationwideAsync(
            Arg.Is<AssignFlightToJobRequest>(r =>
                r!.JobId == 100 && r.FlightNumber == "NZ123" && r.FlightSegments.Count == 1),
            Arg.Any<IReadOnlyList<string>>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AutoAssignSavedFlightsAsync_NoMatch_CountsUnmatched_DoesNotAssign()
    {
        _repository.GetSavedFlightCandidatesAsync(Arg.Any<IReadOnlyList<int>>())
            .Returns([Candidate("NZ999")]);
        StubFlights(Flight("NZ", "123"));

        var result = await CreateService().AutoAssignSavedFlightsAsync([100]);

        Assert.Equal(0, result.Assigned);
        Assert.Equal(1, result.Unmatched);
        await _repository.DidNotReceive().AddJobNationwideAsync(
            Arg.Any<AssignFlightToJobRequest>(), Arg.Any<IReadOnlyList<string>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AutoAssignSavedFlightsAsync_SearchThrows_CountsUnmatched_DoesNotThrow()
    {
        _repository.GetSavedFlightCandidatesAsync(Arg.Any<IReadOnlyList<int>>())
            .Returns([Candidate("NZ123")]);
        _flightService.GetFlightsAsync(
                Arg.Any<int>(), Arg.Any<DateTimeOffset?>(), Arg.Any<int?>(), Arg.Any<int?>(),
                Arg.Any<int?>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<string>>(),
                Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<bool>())
            .ThrowsAsync(new HttpRequestException("Cirium down"));

        var result = await CreateService().AutoAssignSavedFlightsAsync([100]);

        Assert.Equal(0, result.Assigned);
        Assert.Equal(1, result.Unmatched);
    }

    [Fact]
    public async Task AutoAssignSavedFlightsAsync_NoCandidates_ReturnsZeroAndSkipsSearch()
    {
        _repository.GetSavedFlightCandidatesAsync(Arg.Any<IReadOnlyList<int>>())
            .Returns([]);

        var result = await CreateService().AutoAssignSavedFlightsAsync([100]);

        Assert.Equal(0, result.Assigned);
        Assert.Equal(0, result.Unmatched);
        await _flightService.DidNotReceiveWithAnyArgs().GetFlightsAsync(0);
    }

    [Fact]
    public async Task AutoAssignSavedFlightsAsync_EmptyJobList_ReturnsZero()
    {
        var result = await CreateService().AutoAssignSavedFlightsAsync([]);

        Assert.Equal(0, result.Assigned);
        Assert.Equal(0, result.Unmatched);
        await _repository.DidNotReceiveWithAnyArgs().GetSavedFlightCandidatesAsync(null);
    }
}