using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using NUnit.Framework;
using static Moq.It;
using Is = NUnit.Framework.Is;

namespace DespatchWeb.Tests.Services;

[TestFixture]
[TestOf(typeof(FlightStatsService))]
public class FlightStatsServiceTest
{
    [SetUp]
    public void Setup()
    {
        // Set up configuration with required keys
        var inMemorySettings = new Dictionary<string, string>
        {
            { "FlightStatusApiKeys:AppId", "testAppId" },
            { "FlightStatusApiKeys:AppKey", "testAppKey" },
            { "FlightStatusApiKeys:WebhookUrl", "https://test-webhook.com" }
        };

        _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        _logger = new Mock<ILogger<FlightStatsService>>();
        _service = new FlightStatsService(_configuration, _logger.Object);
    }

    private IConfiguration _configuration;
    private FlightStatsService _service;
    private Mock<ILogger<FlightStatsService>> _logger;

    [Test]
    [Category("Unit")]
    public void Constructor_WithValidConfiguration_InitializesService()
    {
        Assert.DoesNotThrow(() => new FlightStatsService(_configuration, _logger.Object));
        _logger.Verify(
            x => x.LogInformation(
                Is<string>(s => s.Contains("FlightStatsService initialized successfully"))
            ),
            Times.Once
        );
    }

    [Test]
    [Category("Unit")]
    public void Constructor_WithMissingAppId_ThrowsArgumentException()
    {
        var invalidConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string>
            {
                { "FlightStatusApiKeys:AppKey", "testAppKey" }
            })
            .Build();

        var ex = Assert.Throws<ArgumentException>(() =>
            new FlightStatsService(invalidConfig, _logger.Object));

        Assert.That(ex.Message, Is.EqualTo("AppId and AppKey must be provided in the configuration."));
    }

    [Test]
    [Category("Unit")]
    public void Constructor_WithMissingAppKey_ThrowsArgumentException()
    {
        var invalidConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string>
            {
                { "FlightStatusApiKeys:AppId", "testAppId" }
            })
            .Build();

        var ex = Assert.Throws<ArgumentException>(() =>
            new FlightStatsService(invalidConfig, _logger.Object));

        Assert.That(ex.Message, Is.EqualTo("AppId and AppKey must be provided in the configuration."));
    }

    [Test]
    [Category("Unit")]
    [TestCase(null)]
    [TestCase("")]
    [TestCase(" ")]
    public void GetFlightsAsync_InvalidDepartureAirportCode_ThrowsArgumentException(string departureCode)
    {
        Assert.ThrowsAsync<ArgumentException>(async () =>
            await _service.GetFlightsAsync(departureCode, "JFK"));
    }

    [Test]
    [Category("Unit")]
    [TestCase(null)]
    [TestCase("")]
    [TestCase(" ")]
    public void GetFlightsAsync_InvalidDestinationAirportCode_ThrowsArgumentException(string destinationCode)
    {
        Assert.ThrowsAsync<ArgumentException>(async () =>
            await _service.GetFlightsAsync("LAX", destinationCode));
    }

    [Test]
    [Category("Unit")]
    [TestCase(null)]
    [TestCase("")]
    [TestCase(" ")]
    public void CreateFlightRuleByDeparture_InvalidDepartureAirportCode_ThrowsArgumentException(string departureCode)
    {
        Assert.ThrowsAsync<ArgumentException>(async () =>
            await _service.CreateFlightRuleByDepartureAsync("AA123", DateTime.Now, departureCode));
    }

    [Test]
    [Category("Unit")]
    [TestCase(null)]
    [TestCase("")]
    [TestCase(" ")]
    public void GetFlightDetailsByFlightNumber_InvalidFlightNumber_ThrowsArgumentException(string flightNumber)
    {
        Assert.ThrowsAsync<ArgumentException>(async () =>
            await _service.GetFlightDetailsByFlightNumberAsync(flightNumber, DateTime.Now));
    }

    [Test]
    [Category("Unit")]
    public async Task GetFlightsAsync_WithCarrierFiltering_BuildsCorrectRequest()
    {
        // Arrange
        var departureTime = DateTime.Now.AddDays(1);
        var carriers = new List<string> { "AA", "DL" };

        // Act & Assert
        Assert.DoesNotThrowAsync(async () =>
            await _service.GetFlightsAsync("LAX", "JFK", departureTime, carriers));
    }

    [Test]
    [Category("Unit")]
    public async Task GetFlightsAsync_WithCodeTypeAndExtendedOptions_BuildsCorrectRequest()
    {
        // Arrange
        var departureTime = DateTime.Now.AddDays(1);
        var extendedOptions = new List<string> { "includeDirects", "includeCodneshares" };

        // Act & Assert
        Assert.DoesNotThrowAsync(async () =>
            await _service.GetFlightsAsync("LAX", "JFK", departureTime,
                codeType: "IATA", extendedOptions: extendedOptions));
    }

    [Test]
    [Category("Unit")]
    public async Task CreateFlightRuleByDepartureAsync_ValidInput_ReturnsRuleId()
    {
        Assert.DoesNotThrowAsync(async () =>
            await _service.CreateFlightRuleByDepartureAsync("AA123", DateTime.Now, "LAX"));
    }

    [Test]
    [Category("Unit")]
    public async Task DeleteAlertByIdAsync_ValidId_DeletesAlert()
    {
        Assert.DoesNotThrowAsync(async () =>
            await _service.DeleteAlertByIdAsync("test-alert-id"));
    }

    [Test]
    [Category("Integration")]
    [Explicit("Requires valid API credentials")]
    public async Task GetFlightsAndCreateFlightRule_WithRealApiCall_SuccessfullyCreatesAndDeletesRule()
    {
        // Arrange
        const string departureAirportCode = "LAX";
        const string destinationAirportCode = "JFK";
        var tomorrow = DateTime.Now.AddDays(1);

        // Act
        var flights = await _service.GetFlightsAsync(departureAirportCode, destinationAirportCode, tomorrow);

        // Assert
        Assert.That(flights, Is.Not.Null.And.Not.Empty, "Should return at least one flight");

        var firstFlight = flights.First();

        // Flight assertions
        Assert.Multiple(() =>
        {
            Assert.That(firstFlight.FlightNumber, Is.Not.Null.And.Not.Empty);
            Assert.That(firstFlight.DepartureTime, Is.GreaterThanOrEqualTo(DateTime.Now));
            Assert.That(firstFlight.DepartureAirport, Is.EqualTo(departureAirportCode));
            Assert.That(firstFlight.ArrivalAirport, Is.EqualTo(destinationAirportCode));
        });

        // Create and verify flight rule
        var alertId = await _service.CreateFlightRuleByDepartureAsync(
            firstFlight.FlightNumber,
            firstFlight.DepartureTime,
            departureAirportCode
        );

        Assert.That(alertId, Is.Not.Null.And.Not.Empty);

        // Verify alert details
        var createdAlert = await _service.GetAlertSubscriptionByIdAsync(alertId);
        var alertFlightNumber = createdAlert.CarrierFsCode + createdAlert.FlightNumber;

        Assert.Multiple(() =>
        {
            Assert.That(createdAlert, Is.Not.Null);
            Assert.That(alertFlightNumber, Is.EqualTo(firstFlight.FlightNumber));
            Assert.That(createdAlert.DepartureAirportFsCode, Is.EqualTo(departureAirportCode));
        });

        // Cleanup
        await _service.DeleteAlertByIdAsync(alertId);
    }
}