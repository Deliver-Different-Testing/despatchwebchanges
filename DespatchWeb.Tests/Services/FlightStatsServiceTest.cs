using System;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Models.FlightStats;
using DespatchWeb.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using NUnit.Framework;

namespace DespatchWeb.Tests.Services;

[TestFixture]
[TestOf(typeof(FlightStatsService))]
public class FlightStatsServiceTest
{
    [SetUp]
    public void Setup()
    {
        // Set up configuration
        _configuration = new ConfigurationBuilder()
            .AddJsonFile("appsettings.json")
            ?.Build();

        _logger = new Mock<ILogger<FlightStatsService>>();
        _service = new FlightStatsService(_configuration, _logger.Object);
    }

    private IConfiguration _configuration;
    private FlightStatsService _service;
    private IMock<ILogger<FlightStatsService>> _logger;

    [Test]
    [Category("Integration")]
    public async Task GetFlightsAndCreateFlightRule_WithRealApiCall_SuccessfullyCreatesAndDeletesRule()
    {
        // Arrange
        const string departureAirportCode = "LAX"; // Los Angeles International Airport
        const string destinationAirportCode = "JFK"; // John F. Kennedy International Airport
        var tomorrow = DateTime.Now.AddDays(1);

        // Act
        var flights = await _service.GetFlightsAsync(departureAirportCode, destinationAirportCode, tomorrow);

        // Assert
        Assert.That(flights, Is.Not.Null.And.Not.Empty, "Should return at least one flight");

        // Select the first flight
        var firstFlight = flights.First();

        // Additional assertions for the flight
        Assert.That(firstFlight.FlightNumber, Is.Not.Null.And.Not.Empty, "Flight number should not be empty");
        Assert.That(firstFlight.DepartureTime, Is.GreaterThanOrEqualTo(DateTime.Now),
            "Departure time should be in the future");
        Assert.That(firstFlight.DepartureAirport, Is.EqualTo(departureAirportCode), "Departure airport should match");
        Assert.That(firstFlight.ArrivalAirport, Is.EqualTo(destinationAirportCode), "Arrival airport should match");

        // Create flight rule and get the returned ID
        string alertId = null;
        Assert.DoesNotThrowAsync(async () =>
        {
            alertId = await _service.CreateFlightRuleByDepartureAsync(
                firstFlight.FlightNumber,
                firstFlight.DepartureTime,
                departureAirportCode
            );
        }, "CreateFlightRuleByDeparture should not throw an exception");

        Assert.That(alertId, Is.Not.Null.And.Not.Empty, "Returned alert ID should not be empty");

        // Confirm the alert was created
        Rule createdAlert = null;
        Assert.DoesNotThrowAsync(async () => { createdAlert = await _service.GetAlertSubscriptionByIdAsync(alertId); },
            "GetAlertSubscriptionByIdAsync should not throw an exception");

        var alertFlightNumber = createdAlert.CarrierFsCode + createdAlert.FlightNumber;
        Assert.That(createdAlert, Is.Not.Null, "Created alert should not be null");
        Assert.That(alertFlightNumber, Is.EqualTo(firstFlight.FlightNumber), "Alert flight number should match");
        Assert.That(createdAlert.DepartureAirportFsCode, Is.EqualTo(departureAirportCode),
            "Alert departure airport should match");

        // Delete the test alert
        Assert.DoesNotThrowAsync(async () => { await _service.DeleteAlertByIdAsync(alertId); },
            "DeleteAlertByIdAsync should not throw an exception");
    }

    [Test]
    [Category("Integration")]
    public async Task GetFlightsAsync_WithRealApiCall_ReturnsFlightList()
    {
        // Arrange
        const string departureAirportCode = "LAX"; // Los Angeles International Airport
        const string destinationAirportCode = "JFK"; // John F. Kennedy International Airport
        var now = DateTime.Now.AddDays(1); // Use tomorrow's date

        // Act
        var result = await _service.GetFlightsAsync(
            departureAirportCode,
            destinationAirportCode,
            now
        );

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result, Is.Not.Empty, "Should return at least one flight");

        foreach (var flight in result)
        {
            Assert.That(flight.FlightNumber, Is.Not.Null.And.Not.Empty, "Flight number should not be empty");
            Assert.That(flight.DepartureTime, Is.GreaterThanOrEqualTo(now), "Departure time should be in the future");
            Assert.That(flight.DepartureAirport, Is.EqualTo(departureAirportCode), "Departure airport should match");
            Assert.That(flight.ArrivalAirport, Is.EqualTo(destinationAirportCode), "Arrival airport should match");
            Assert.That(flight.Duration, Is.GreaterThan(TimeSpan.Zero), "Duration should be positive");
        }

        // Check if the list is ordered by ascending departure time
        Assert.That(result, Is.Ordered.By("DepartureTime").Ascending);
    }

    [Test]
    [Category("Unit")]
    public void Constructor_WithValidConfiguration_InitializesService() =>
        Assert.DoesNotThrow(() => new FlightStatsService(_configuration, _logger.Object));

    [Test]
    [Category("Integration")]
    public async Task GetFlightDetailsByFlightNumberAndDepartureAsync_WithValidInput_ReturnsFlightDetails()
    {
        // Arrange
        const string flightNumber = "DL1132"; // American Airlines flight
        var departureTime = DateTime.Now.AddDays(1); // Set departure as tomorrow

        // Act
        await _service.GetFlightDetailsByFlightNumberAsync(flightNumber, departureTime);
    }

    [Test]
    [Category("Unit")]
    public void CreateFlightRuleByDeparture_NullDepartureAirportCode_ThrowsArgumentException()
    {
        Assert.ThrowsAsync<ArgumentException>(() =>
            _service.CreateFlightRuleByDepartureAsync("AA123", DateTime.Now, null));
    }

    [Test]
    [Category("Unit")]
    public void CreateFlightRuleByDeparture_EmptyDepartureAirportCode_ThrowsArgumentException()
    {
        Assert.ThrowsAsync<ArgumentException>(() =>
            _service.CreateFlightRuleByDepartureAsync("AA123", DateTime.Now, ""));
    }
}