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
    public async Task GetDepartingFlightsAsync_WithRealApiCall_ReturnsFlightList()
    {
        // Arrange
        const string departureAirportCode = "LAX"; // Los Angeles International Airport
        var now = DateTime.Now.AddDays(1); // Use tomorrows date

        // Act
        var result = await _service.GetDepartingFlightsAsync(
            departureAirportCode,
            now.Year,
            now.Month,
            now.Day,
            now.Hour
        );

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result, Is.Not.Empty, "Should return at least one flight");

        foreach (var flight in result)
        {
            Assert.That(flight.FlightNumber, Is.Not.Null.And.Not.Empty, "Flight number should not be empty");
            Assert.That(flight.DepartureTime, Is.GreaterThanOrEqualTo(now), "Departure time should be in the future");
            // Add more assertions as needed based on the expected structure of ScheduledFlight
        }

        // Check if the list is ordered by descending departure time
        Assert.That(result, Is.Ordered.By("DepartureTime").Descending);
    }

    [Test]
    [Category("Unit")]
    public void Constructor_WithValidConfiguration_InitializesService()
    {
        Assert.DoesNotThrow(() => new FlightStatusService(_configuration));
    }
}
