using System.Security.Claims;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.FlightStats;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Http;
using Moq;
using Moq.Protected;
using System.Net;
using System.Text.Json;
using DespatchWeb.Models;

namespace DespatchWeb.Tests.Services;

public class FlightStatsServiceTests
{
    private readonly Mock<HttpMessageHandler> _httpHandlerMock = new();
    private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock = new();
    private readonly Mock<INationwideJobRepository> _nationwideJobRepositoryMock = new();
    private FakeTenantClock _clock = new(TestDates.Now);

    private FlightStatsService CreateService()
    {
        var httpClient = new HttpClient(_httpHandlerMock.Object);
        return new FlightStatsService(
            httpClient,
            _httpContextAccessorMock.Object,
            _nationwideJobRepositoryMock.Object,
            _clock);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task CreateFlightRuleByDepartureAsync_NullOrEmptyFlightNumber_ThrowsArgumentException(
        string? flightNumber)
    {
        // Arrange
        var service = CreateService();

        // Assert
        await Assert.ThrowsAnyAsync<ArgumentException>((Func<Task<string>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<string> Act() => await service.CreateFlightRuleByDepartureAsync(flightNumber, DateTimeOffset.Now, "AKL");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task CreateFlightRuleByDepartureAsync_NullOrEmptyAirportCode_ThrowsArgumentException(
        string? airportCode)
    {
        // Arrange
        var service = CreateService();

        // Assert
        await Assert.ThrowsAnyAsync<ArgumentException>((Func<Task<string>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<string> Act() => await service.CreateFlightRuleByDepartureAsync("NZ123", DateTimeOffset.Now, airportCode);
    }

    [Fact]
    public async Task CreateFlightRuleByDepartureAsync_MissingConnectionClaim_ThrowsArgumentException()
    {
        // Arrange
        SetupHttpContextWithClaims((ClaimTypes.Name, "TestUser"));
        var service = CreateService();

        // Assert
        await Assert.ThrowsAnyAsync<ArgumentException>((Func<Task<string>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<string> Act() => await service.CreateFlightRuleByDepartureAsync("NZ123", DateTimeOffset.Now, "AKL");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task DeleteFlightRuleById_NullOrEmptyWebhookId_ReturnsWithoutCalling(string? webhookId)
    {
        // Arrange
        var service = CreateService();

        // Act
        await service.DeleteFlightRuleById(webhookId);

        // Assert - verify no HTTP call was made
        _httpHandlerMock.Protected().Verify(
            "SendAsync",
            Times.Never(),
            ItExpr.IsAny<HttpRequestMessage>(),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task DeleteFlightRuleById_ValidWebhookId_CallsFlightStatsApi()
    {
        // Arrange
        SetupHttpResponse(new { success = true });
        var service = CreateService();

        // Act
        await service.DeleteFlightRuleById("webhook-123");

        // Assert
        _httpHandlerMock.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.RequestUri != null && req.RequestUri.ToString().Contains("json/delete/webhook-123")),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task DeleteFlightRuleById_ApiError_ThrowsException()
    {
        // Arrange
        SetupHttpError(HttpStatusCode.InternalServerError);
        var service = CreateService();

        // Assert
        var ex = await Assert.ThrowsAsync<Exception>(Act);
        Assert.Contains("Failed to disconnect alert", ex.Message);
        return;

        // Act
        async Task Act() => await service.DeleteFlightRuleById("webhook-123");
    }

    [Fact]
    public async Task GetFlightsAsync_NullDepartureAirport_ThrowsArgumentException()
    {
        // Arrange
        SetupAirportMocks(departureAirportExists: false, arrivalAirportExists: true);
        var service = CreateService();

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>((Func<Task<IReadOnlyList<FlightViewModel>>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("Departure airport", ex.Message);
        Assert.Contains("999", ex.Message);
        Assert.Contains("not found", ex.Message);
        return;

        // Act
        async Task<IReadOnlyList<FlightViewModel>> Act() => await service.GetFlightsAsync(jobId: 1, departureDateTime: DateTimeOffset.Now, departureAirportId: 999, arrivalAirportId: 2);
    }

    [Fact]
    public async Task GetFlightsAsync_NullArrivalAirport_ThrowsArgumentException()
    {
        // Arrange
        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: false);
        var service = CreateService();

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>((Func<Task<IReadOnlyList<FlightViewModel>>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("Arrival airport", ex.Message);
        Assert.Contains("999", ex.Message);
        Assert.Contains("not found", ex.Message);
        return;

        // Act
        async Task<IReadOnlyList<FlightViewModel>> Act() => await service.GetFlightsAsync(jobId: 1, departureDateTime: DateTimeOffset.Now, departureAirportId: 1, arrivalAirportId: 999);
    }

    [Fact]
    public async Task GetFlightsAsync_NoConnections_ReturnsEmptyList()
    {
        // Arrange
        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["NZ", "QF"]);
        _clock = new FakeTenantClock(TestDates.Now);

        var response = new FlightConnectionsRoot { Connections = null };
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        var result = await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: DateTimeOffset.Now.AddHours(2),
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetFlightsAsync_WithConnections_ReturnsMappedFlights()
    {
        // Arrange
        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["NZ", "QF"]);
        _clock = new FakeTenantClock(TestDates.Now);

        var response = CreateFlightConnectionsResponse();
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        var result = await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: DateTimeOffset.Now.AddHours(2),
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert
        Assert.NotEmpty(result);
    }

    [Fact]
    public async Task GetFlightsAsync_WithSpecificAirline_FiltersResults()
    {
        // Arrange
        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["NZ", "QF"]);
        _nationwideJobRepositoryMock.Setup(x => x.GetAirlineCodeByIdAsync(5))
            .ReturnsAsync("NZ");
        _clock = new FakeTenantClock(TestDates.Now);

        var response = CreateFlightConnectionsResponse();
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: DateTimeOffset.Now.AddHours(2),
            airlineId: 5,
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert
        _httpHandlerMock.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.RequestUri != null && req.RequestUri.ToString().Contains("includeAirlines=NZ")),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task GetFlightsAsync_NoAirlineSpecified_UsesActiveAirlineCodes()
    {
        // Arrange
        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["NZ", "QF", "AA"]);
        _clock = new FakeTenantClock(TestDates.Now);

        var response = CreateFlightConnectionsResponse();
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: DateTimeOffset.Now.AddHours(2),
            airlineId: null, // No specific airline
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert - should include all active airline codes (comma is URL encoded as %2c or %2C)
        _httpHandlerMock.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.RequestUri != null &&
                req.RequestUri.ToString().Contains("includeAirlines=NZ") &&
                req.RequestUri.ToString().Contains("QF") &&
                req.RequestUri.ToString().Contains("AA")),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task GetFlightsAsync_NoAirlineSpecified_NoActiveAirlines_DoesNotIncludeAirlineFilter()
    {
        // Arrange
        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync([]); // Empty list - no active airlines
        _clock = new FakeTenantClock(TestDates.Now);

        var response = CreateFlightConnectionsResponse();
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: DateTimeOffset.Now.AddHours(2),
            airlineId: null, // No specific airline
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert - should NOT include any airline filter in the URL
        _httpHandlerMock.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.RequestUri != null && !req.RequestUri.ToString().Contains("includeAirlines")),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task GetFlightsAsync_DiagnoseAirlineFilter_OutputsActualUrl()
    {
        // This test captures the actual URL being generated to diagnose airline filtering issues

        // Arrange
        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);

        // Simulate active airlines in database
        var activeAirlines = new List<string> { "NZ", "QF", "AA" };
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(activeAirlines);
        _clock = new FakeTenantClock(TestDates.Now);

        string? capturedUrl = null;
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) => { capturedUrl = req.RequestUri?.ToString(); })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(CreateFlightConnectionsResponse()))
            });

        var service = CreateService();

        // Act - Call WITHOUT specific airline (should use all active airlines)
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: DateTimeOffset.Now.AddHours(2),
            airlineId: null,
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert & Diagnose
        Assert.NotNull(capturedUrl);

        // Output URL for diagnosis
        TestContext.Current.TestOutputHelper?.WriteLine("=== CAPTURED URL (No airlineId specified) ===");
        TestContext.Current.TestOutputHelper?.WriteLine(capturedUrl);
        TestContext.Current.TestOutputHelper?.WriteLine("==============================================");

        // Check if includeAirlines parameter exists
        var containsAirlineFilter = capturedUrl!.Contains("includeAirlines");
        TestContext.Current.TestOutputHelper?.WriteLine($"Contains includeAirlines parameter: {containsAirlineFilter}");

        if (containsAirlineFilter)
        {
            // Extract the includeAirlines value
            var uri = new Uri(capturedUrl);
            var queryParams = System.Web.HttpUtility.ParseQueryString(uri.Query);
            var airlinesValue = queryParams["includeAirlines"];
            TestContext.Current.TestOutputHelper?.WriteLine($"includeAirlines value: '{airlinesValue}'");
            TestContext.Current.TestOutputHelper?.WriteLine("Expected: 'NZ,QF,AA'");

            // Verify the value
            Assert.Equal("NZ,QF,AA", airlinesValue);
        }
        else
        {
            // This would be the bug - no airline filter being added!
            Assert.Fail("BUG: includeAirlines parameter is missing from URL when active airlines exist!");
        }
    }

    [Fact]
    public async Task GetFlightsAsync_CompareWithAndWithoutAirlineId_OutputsBothUrls()
    {
        // Compare URLs generated with specific airline vs. all active airlines

        // Arrange
        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);

        var activeAirlines = new List<string> { "NZ", "QF", "AA" };
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(activeAirlines);
        _nationwideJobRepositoryMock.Setup(x => x.GetAirlineCodeByIdAsync(3))
            .ReturnsAsync("QF");
        _clock = new FakeTenantClock(TestDates.Now);

        var capturedUrls = new List<string>();
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) =>
            {
                capturedUrls.Add(req.RequestUri?.ToString() ?? string.Empty);
            })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(CreateFlightConnectionsResponse()))
            });

        var service = CreateService();

        // Act 1 - Call WITH specific airline
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: DateTimeOffset.Now.AddHours(2),
            airlineId: 3, // Specific airline
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Act 2 - Call WITHOUT specific airline
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: DateTimeOffset.Now.AddHours(2),
            airlineId: null, // All active airlines
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Output for comparison
        TestContext.Current.TestOutputHelper?.WriteLine("=== URL COMPARISON ===");
        TestContext.Current.TestOutputHelper?.WriteLine($"URL with airlineId=3: {capturedUrls[0]}");
        TestContext.Current.TestOutputHelper?.WriteLine($"URL with airlineId=null: {capturedUrls[1]}");
        TestContext.Current.TestOutputHelper?.WriteLine("======================");

        // Parse and compare includeAirlines values
        var uri1 = new Uri(capturedUrls[0]);
        var uri2 = new Uri(capturedUrls[1]);
        var params1 = System.Web.HttpUtility.ParseQueryString(uri1.Query);
        var params2 = System.Web.HttpUtility.ParseQueryString(uri2.Query);

        TestContext.Current.TestOutputHelper?.WriteLine(
            $"With airlineId=3, includeAirlines='{params1["includeAirlines"]}'");
        TestContext.Current.TestOutputHelper?.WriteLine(
            $"With airlineId=null, includeAirlines='{params2["includeAirlines"]}'");

        Assert.Equal("QF", params1["includeAirlines"]);
        Assert.Equal("NZ,QF,AA", params2["includeAirlines"]);
    }

    private void SetupHttpContextWithClaims(params (string type, string value)[] claims)
    {
        var claimsList = claims.Select(c => new Claim(c.type, c.value)).ToList();
        var identity = new ClaimsIdentity(claimsList, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        var httpContext = new DefaultHttpContext { User = principal };
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);
    }

    private void SetupHttpResponse<T>(T responseObject)
    {
        var jsonResponse = JsonSerializer.Serialize(responseObject);
        var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(jsonResponse)
        };

        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(httpResponse);
    }

    private void SetupHttpError(HttpStatusCode statusCode)
    {
        var httpResponse = new HttpResponseMessage(statusCode)
        {
            ReasonPhrase = "Error"
        };

        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(httpResponse);
    }

    private void SetupAirportMocks(bool departureAirportExists, bool arrivalAirportExists)
    {
        var airports = new List<GetAirportsDto>();

        if (departureAirportExists)
            airports.Add(new GetAirportsDto
            {
                AirportId = 1,
                AirportCode = "AKL",
                FlightBufferMinutes = 60,
                Timezone = "Pacific/Auckland"
            });

        if (arrivalAirportExists)
            airports.Add(new GetAirportsDto
            {
                AirportId = 2,
                AirportCode = "SYD",
                FlightBufferMinutes = 60,
                Timezone = "Australia/Sydney"
            });

        _nationwideJobRepositoryMock.Setup(x => x.GetAllActiveAirportsAsync())
            .ReturnsAsync(airports);
    }

    private static FlightConnectionsRoot CreateFlightConnectionsResponse() => new()
    {
        Connections =
        [
            new Connection
            {
                ScheduledFlight =
                [
                    new ScheduledFlight
                    {
                        CarrierFsCode = "NZ",
                        FlightNumber = "123",
                        DepartureTime = TestDates.Now.AddHours(3).ToString("O"),
                        ArrivalTime = TestDates.Now.AddHours(6).ToString("O"),
                        DepartureAirportFsCode = "AKL",
                        ArrivalAirportFsCode = "SYD",
                        FlightEquipmentIataCode = "787",
                        ElapsedTime = 180,
                        Stops = 0
                    }
                ],
                ElapsedTime = 180,
                Score = 95
            }
        ],
        Appendix = new Appendix
        {
            Airlines = [new Airline { Fs = "NZ", Name = "Air New Zealand" }],
            Airports =
            [
                new Airport
                {
                    Fs = "AKL", Name = "Auckland Airport", City = "Auckland",
                    TimeZoneRegionName = "Pacific/Auckland"
                },

                new Airport
                {
                    Fs = "SYD", Name = "Sydney Airport", City = "Sydney",
                    TimeZoneRegionName = "Australia/Sydney"
                }
            ],
            Equipments = [new Equipment { Iata = "787", Name = "Boeing 787 Dreamliner", Jet = true }]
        }
    };

    [Theory]
    [InlineData("AA1234", "AA", "1234")]
    [InlineData("NZ123", "NZ", "123")]
    [InlineData("BXR1984", "BXR", "1984")]
    [InlineData("QF8", "QF", "8")]
    public void SplitFlightCode_ValidFlightNumbers_SplitsCorrectly(string input, string expectedCarrier,
        string expectedFlight)
    {
        var (carrier, flight) = FlightStatsService.SplitFlightCode(input);
        Assert.Equal(expectedCarrier, carrier);
        Assert.Equal(expectedFlight, flight);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void SplitFlightCode_NullOrEmpty_ReturnsInputAndNull(string? input)
    {
        var (carrier, flight) = FlightStatsService.SplitFlightCode(input);
        Assert.Equal(input, carrier);
        Assert.Null(flight);
    }

    [Theory]
    [InlineData("NZ")]
    [InlineData("BXR")]
    [InlineData("ABCD")]
    public void SplitFlightCode_AllAlpha_ReturnsFullStringAsCarrier(string input)
    {
        var (carrier, flight) = FlightStatsService.SplitFlightCode(input);
        Assert.Equal(input, carrier);
        Assert.Null(flight);
    }

    [Theory]
    [InlineData("1234")]
    [InlineData("0")]
    public void SplitFlightCode_StartsWithDigit_ReturnsFullStringAsCarrier(string input)
    {
        var (carrier, flight) = FlightStatsService.SplitFlightCode(input);
        Assert.Equal(input, carrier);
        Assert.Null(flight);
    }

    [Fact]
    public async Task GetFlightsAsync_DoesNotIncludePayloadTypeParameter()
    {
        // Arrange
        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["NZ"]);
        _clock = new FakeTenantClock(TestDates.Now);

        string? capturedUrl = null;
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) => { capturedUrl = req.RequestUri?.ToString(); })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(new FlightConnectionsRoot { Connections = null }))
            });

        var service = CreateService();

        // Act
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: DateTimeOffset.Now.AddHours(2),
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert
        Assert.NotNull(capturedUrl);
        Assert.DoesNotContain("payloadType", capturedUrl);
    }

    [Fact]
    public async Task GetFlightsAsync_PartnerCarrierSegment_ShowsAirlineName()
    {
        // Arrange - A connecting flight where the second segment is operated by a partner carrier
        // not in activeAirlineCodes (e.g., regional affiliate OO operating for AA)
        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["AA"]); // Only AA is active, but OO operates a connecting leg
        _clock = new FakeTenantClock(TestDates.Now);

        var response = new FlightConnectionsRoot
        {
            Connections =
            [
                new Connection
                {
                    ScheduledFlight =
                    [
                        new ScheduledFlight
                        {
                            CarrierFsCode = "AA",
                            FlightNumber = "100",
                            DepartureTime = TestDates.Now.AddHours(3).ToString("O"),
                            ArrivalTime = TestDates.Now.AddHours(5).ToString("O"),
                            DepartureAirportFsCode = "AKL",
                            ArrivalAirportFsCode = "SYD",
                            FlightEquipmentIataCode = "737",
                            ElapsedTime = 120,
                            Stops = 0
                        },
                        new ScheduledFlight
                        {
                            CarrierFsCode = "OO", // Partner carrier not in activeAirlineCodes
                            FlightNumber = "5432",
                            DepartureTime = TestDates.Now.AddHours(6).ToString("O"),
                            ArrivalTime = TestDates.Now.AddHours(8).ToString("O"),
                            DepartureAirportFsCode = "SYD",
                            ArrivalAirportFsCode = "SYD", // using SYD for simplicity
                            FlightEquipmentIataCode = "E75",
                            ElapsedTime = 120,
                            Stops = 0
                        }
                    ],
                    ElapsedTime = 300,
                    Score = 80
                }
            ],
            Appendix = new Appendix
            {
                Airlines =
                [
                    new Airline { Fs = "AA", Name = "American Airlines" },
                    new Airline { Fs = "OO", Name = "SkyWest Airlines" }
                ],
                Airports =
                [
                    new Airport
                    {
                        Fs = "AKL", Name = "Auckland Airport", City = "Auckland",
                        TimeZoneRegionName = "Pacific/Auckland"
                    },
                    new Airport
                    {
                        Fs = "SYD", Name = "Sydney Airport", City = "Sydney", TimeZoneRegionName = "Australia/Sydney"
                    }
                ],
                Equipments =
                [
                    new Equipment { Iata = "737", Name = "Boeing 737", Jet = true },
                    new Equipment { Iata = "E75", Name = "Embraer 175", Jet = true }
                ]
            }
        };

        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        var result = await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: DateTimeOffset.Now.AddHours(2),
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert - The partner carrier segment should have its airline name resolved
        Assert.NotEmpty(result);
        var partnerSegment = result[0].FlightSegments.FirstOrDefault(s => s.CarrierFsCode == "OO");
        Assert.NotNull(partnerSegment);
        Assert.Equal("SkyWest Airlines", partnerSegment.AirlineName);
    }

    /// <summary>
    /// Tests for Issue #1: Available flights ignores current date time so a lazy dispatcher
    /// could assign a job to a flight that has already left.
    ///
    /// The CalculateFlightSearchStartTime method should ensure that when a requested departure
    /// date/time is in the past, the current tenant time is used instead.
    /// </summary>
    [Fact]
    public async Task GetFlightsAsync_WhenDepartureDateIsInPast_UsesCurrentTenantTimeInsteadOfPastDate()
    {
        // Arrange
        var currentTenantTime = new DateTime(2024, 6, 15, 14, 0, 0); // 2:00 PM today
        var pastDepartureDate = new DateTimeOffset(2024, 6, 15, 8, 0, 0, TimeSpan.Zero); // 8:00 AM (past)

        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["NZ"]);
        _clock = new FakeTenantClock(currentTenantTime);

        string? capturedUrl = null;
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) => { capturedUrl = req.RequestUri?.ToString(); })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(new FlightConnectionsRoot { Connections = null }))
            });

        var service = CreateService();

        // Act
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: pastDepartureDate, // Requesting flights from 8:00 AM which has already passed
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert - URL should use current time (14:00) + buffer (60 min) = 15:00, NOT the pastime (08:00)
        Assert.NotNull(capturedUrl);

        // The URL should contain the time based on currentTenantTime + buffer, not the past departure time
        // Expected: leaving_after/2024/6/15/15/0 (current time 14:00 + 60 min buffer)
        // NOT: leaving_after/2024/6/15/8/0 (past departure time)
        Assert.Contains("leaving_after/2024/6/15/15/0", capturedUrl);
        Assert.DoesNotContain("leaving_after/2024/6/15/8", capturedUrl);
    }

    [Fact]
    public async Task GetFlightsAsync_WhenDepartureDateIsFuture_UsesDepartureDatePlusBuffer()
    {
        // Arrange
        var currentTenantTime = new DateTime(2024, 6, 15, 8, 0, 0); // 8:00 AM
        var futureDepartureDate = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero); // 2:00 PM (future)

        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["NZ"]);
        _clock = new FakeTenantClock(currentTenantTime);

        string? capturedUrl = null;
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) => { capturedUrl = req.RequestUri?.ToString(); })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(new FlightConnectionsRoot { Connections = null }))
            });

        var service = CreateService();

        // Act
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: futureDepartureDate, // Requesting flights from 2:00 PM
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert - URL should use future departure time + buffer = 15:00
        Assert.NotNull(capturedUrl);
        Assert.Contains("leaving_after/2024/6/15/15/0", capturedUrl);
    }

    [Fact]
    public async Task GetFlightsAsync_WhenNoDepartureDateProvided_UsesCurrentTenantTimePlusBuffer()
    {
        // Arrange
        var currentTenantTime = new DateTime(2024, 6, 15, 10, 30, 0); // 10:30 AM

        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["NZ"]);
        _clock = new FakeTenantClock(currentTenantTime);

        string? capturedUrl = null;
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) => { capturedUrl = req.RequestUri?.ToString(); })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(new FlightConnectionsRoot { Connections = null }))
            });

        var service = CreateService();

        // Act
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: null, // No departure date specified
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert - URL should use current time (10:30) + buffer (60 min) = 11:30
        Assert.NotNull(capturedUrl);
        Assert.Contains("leaving_after/2024/6/15/11/30", capturedUrl);
    }

    [Fact]
    public async Task GetFlightsAsync_WhenDepartureDateIsExactlyCurrentTime_UsesCurrentTimePlusBuffer()
    {
        // Arrange - Edge case: departure time equals current time exactly
        var currentTenantTime = new DateTime(2024, 6, 15, 12, 0, 0);
        var departureDateSameAsCurrent = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        SetupAirportMocks(departureAirportExists: true, arrivalAirportExists: true);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["NZ"]);
        _clock = new FakeTenantClock(currentTenantTime);

        string? capturedUrl = null;
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) => { capturedUrl = req.RequestUri?.ToString(); })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(new FlightConnectionsRoot { Connections = null }))
            });

        var service = CreateService();

        // Act
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: departureDateSameAsCurrent,
            departureAirportId: 1,
            arrivalAirportId: 2);

        // Assert - Should use departure time (which equals current time) + buffer = 13:00
        Assert.NotNull(capturedUrl);
        Assert.Contains("leaving_after/2024/6/15/13/0", capturedUrl);
    }

    [Fact]
    public async Task GetFlightsAsync_WithDifferentAirportBuffers_AppliesCorrectBuffer()
    {
        // Arrange - Airport with 90 minute buffer
        var currentTenantTime = new DateTime(2024, 6, 15, 10, 0, 0);
        var departureDate = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        const int customBufferMinutes = 90;

        // Setup airport with custom buffer
        _nationwideJobRepositoryMock.Setup(x => x.GetAllActiveAirportsAsync())
            .ReturnsAsync(
            [
                new GetAirportsDto
                {
                    AirportId = 1,
                    AirportCode = "LAX",
                    FlightBufferMinutes = customBufferMinutes, // 90 minutes
                    Timezone = "America/Los_Angeles"
                },
                new GetAirportsDto
                {
                    AirportId = 2,
                    AirportCode = "JFK",
                    FlightBufferMinutes = 60,
                    Timezone = "America/New_York"
                }
            ]);
        _nationwideJobRepositoryMock.Setup(x => x.GetActiveAirlineCodesAsync())
            .ReturnsAsync(["AA"]);
        _clock = new FakeTenantClock(currentTenantTime);

        string? capturedUrl = null;
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) => { capturedUrl = req.RequestUri?.ToString(); })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(new FlightConnectionsRoot { Connections = null }))
            });

        var service = CreateService();

        // Act
        await service.GetFlightsAsync(
            jobId: 1,
            departureDateTime: departureDate,
            departureAirportId: 1, // LAX with 90 min buffer
            arrivalAirportId: 2);

        // Assert - Should use departure time (14:00) + 90 min buffer = 15:30
        Assert.NotNull(capturedUrl);
        Assert.Contains("leaving_after/2024/6/15/15/30", capturedUrl);
    }

}