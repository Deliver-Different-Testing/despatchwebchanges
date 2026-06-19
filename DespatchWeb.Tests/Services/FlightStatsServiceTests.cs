using System.Security.Claims;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto.Cirium;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Http;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// FlightStatsService delegates every Cirium call to the Integration Manager gateway
/// (<see cref="ICiriumApiClient"/>), which is mocked here. These tests assert the delegation,
/// DTO→view-model mapping, the dispatch-minted webhook URL/token, and the input guards.
/// </summary>
public class FlightStatsServiceTests
{
    private readonly IHttpContextAccessor _httpContextAccessor = Substitute.For<IHttpContextAccessor>();
    private readonly INationwideJobRepository _repository = Substitute.For<INationwideJobRepository>();
    private readonly ICiriumApiClient _ciriumApiClient = Substitute.For<ICiriumApiClient>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    private FlightStatsService CreateService() =>
        new(_httpContextAccessor, _repository, _clock, _ciriumApiClient);

    [Fact]
    public async Task GetFlightsAsync_MapsDtoToViewModel_AndPassesTenantContext()
    {
        CiriumFlightSearchRequestDto? captured = null;
        _ciriumApiClient
            .SearchFlightsAsync(Arg.Do<CiriumFlightSearchRequestDto>(r => captured = r), Arg.Any<CancellationToken>())
            .Returns(new CiriumFlightSearchResponseDto
            {
                Flights =
                [
                    new CiriumFlightDto
                    {
                        Airline = "Air New Zealand",
                        AirlineCode = "NZ",
                        FlightNumber = "NZ123",
                        IsCharter = true,
                        ServiceTypeDescription = "Charter (Passenger)",
                        IsMultiSegment = false,
                        FlightSegments =
                        [
                            new CiriumFlightSegmentDto {SegmentOrder = 0, CarrierFsCode = "NZ", FlightNumber = "123"}
                        ]
                    }
                ]
            });

        var service = CreateService();
        var result = await service.GetFlightsAsync(
            jobId: 5,
            departureDateTime: TestDates.Now.AddHours(2),
            departureAirportId: 1,
            arrivalAirportId: 2,
            minimumLayoverMinutes: 90,
            allowNearbyDepartures: true);

        Assert.Single(result);
        Assert.Equal("NZ123", result[0].FlightNumber);
        Assert.True(result[0].IsCharter);
        Assert.Equal("Charter (Passenger)", result[0].ServiceTypeDescription);
        Assert.Single(result[0].FlightSegments);
        Assert.Equal("NZ", result[0].FlightSegments[0].CarrierFsCode);

        Assert.NotNull(captured);
        Assert.Equal(_clock.TenantNow, captured!.TenantNow);
        Assert.Equal(90, captured.MinimumLayoverMinutes);
        Assert.True(captured.AllowNearbyDepartures);
        Assert.Equal(1, captured.DepartureAirportId);
        Assert.Equal(2, captured.ArrivalAirportId);
    }

    [Fact]
    public async Task DeleteFlightRuleById_DelegatesToClient()
    {
        var service = CreateService();
        await service.DeleteFlightRuleById("RULE-1");
        await _ciriumApiClient.Received(1).DeleteAlertAsync("RULE-1", Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task DeleteFlightRuleById_NullOrEmptyWebhookId_DoesNotCallClient(string? webhookId)
    {
        var service = CreateService();
        await service.DeleteFlightRuleById(webhookId);
        await _ciriumApiClient.DidNotReceive().DeleteAlertAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task IsFlightRuleActiveAsync_DelegatesToClient()
    {
        _ciriumApiClient.IsAlertActiveAsync("RULE-1", Arg.Any<CancellationToken>()).Returns(true);
        var service = CreateService();
        Assert.True(await service.IsFlightRuleActiveAsync("RULE-1"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task IsFlightRuleActiveAsync_NullOrEmptyWebhookId_ReturnsFalseWithoutCallingClient(string? webhookId)
    {
        var service = CreateService();
        Assert.False(await service.IsFlightRuleActiveAsync(webhookId));
        await _ciriumApiClient.DidNotReceive().IsAlertActiveAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task CreateFlightRuleByDepartureAsync_NullOrEmptyFlightNumber_ThrowsArgumentException(
        string? flightNumber)
    {
        var service = CreateService();
        await Assert.ThrowsAnyAsync<ArgumentException>(() =>
            service.CreateFlightRuleByDepartureAsync(flightNumber!, DateTimeOffset.Now, "AKL"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task CreateFlightRuleByDepartureAsync_NullOrEmptyAirportCode_ThrowsArgumentException(
        string? airportCode)
    {
        var service = CreateService();
        await Assert.ThrowsAnyAsync<ArgumentException>(() =>
            service.CreateFlightRuleByDepartureAsync("NZ123", DateTimeOffset.Now, airportCode!));
    }

    [Fact]
    public async Task CreateFlightRuleByDepartureAsync_MissingConnectionClaim_ThrowsArgumentException()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, "TestUser")]));
        _httpContextAccessor.HttpContext.Returns(new DefaultHttpContext {User = principal});
        var service = CreateService();

        await Assert.ThrowsAnyAsync<ArgumentException>(() =>
            service.CreateFlightRuleByDepartureAsync("NZ123", DateTimeOffset.Now, "AKL"));
    }

    [Fact]
    public async Task CreateFlightRuleByDepartureAsync_PassesTokenAndNoUrl()
    {
        // IM owns the callback URL now — DespatchWeb sends only the deliverTo token.
        Environment.SetEnvironmentVariable("JWTSecretKey", "0123456789abcdef0123456789abcdef");
        Environment.SetEnvironmentVariable("ClaimsKey", Convert.ToBase64String(new byte[32]));
        Environment.SetEnvironmentVariable("Issuer", "test-issuer");
        Environment.SetEnvironmentVariable("Audience", "test-audience");

        var principal = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim("Connection", "conn-str"),
            new Claim("CurrentTenantID", "42"),
            new Claim("TimeZone", "New Zealand Standard Time"),
            new Claim(ClaimTypes.Name, "tester")
        ]));
        _httpContextAccessor.HttpContext.Returns(new DefaultHttpContext {User = principal});
        _repository.GetWebhookEventsAsStringAsync().Returns("all");

        CiriumCreateAlertRequestDto? captured = null;
        _ciriumApiClient
            .CreateAlertAsync(Arg.Do<CiriumCreateAlertRequestDto>(r => captured = r), Arg.Any<CancellationToken>())
            .Returns("RULE-9");

        var service = CreateService();
        var ruleId = await service.CreateFlightRuleByDepartureAsync("NZ123", TestDates.Now, "AKL");

        Assert.Equal("RULE-9", ruleId);
        Assert.NotNull(captured);
        Assert.Equal("NZ123", captured!.CompleteFlightNumber);
        Assert.Equal("AKL", captured.DepartureAirportCode);
        Assert.Null(captured.DeliverToUrl);
        Assert.Equal("all", captured.Events);
        Assert.False(string.IsNullOrEmpty(captured.DeliverToToken));
    }
}
