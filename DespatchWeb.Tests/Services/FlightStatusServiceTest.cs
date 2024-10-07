using System;
using System.Threading.Tasks;
using DespatchWeb.Services;
using Microsoft.Extensions.Configuration;
using NUnit.Framework;

namespace DespatchWeb.Tests.Services;

[TestFixture]
[TestOf(typeof(FlightStatusService))]
public class FlightStatusServiceTest
{
    [SetUp]
    public void Setup()
    {
        // Set up configuration
        _configuration = new ConfigurationBuilder()
            .AddJsonFile("appsettings.json")
            ?.Build();

        _service = new FlightStatusService(_configuration);
    }

    private IConfiguration _configuration;
    private FlightStatusService _service;

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
            // Add more assertions as needed based on the expected structure of FlightOptionsViewModel
        }

        // Check if the list is ordered by ascending departure time
        Assert.That(result, Is.Ordered.By("DepartureTime").Ascending);
    }

    [Test]
    [Category("Unit")]
    public void Constructor_WithValidConfiguration_InitializesService()
    {
        Assert.DoesNotThrow(() => new FlightStatusService(_configuration));
    }
}
