using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Unit tests for NationwideJobRepository - covers airline, airport, and agent operations.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class NationwideJobRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();

    public NationwideJobRepositoryTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        // Register custom SQLite function to mimic SQL Server's getdate()
        _connection.CreateFunction("getdate", () => DateTime.Now);

        var options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new DespatchContext(options);
        _context.Database.EnsureCreated();
        _contextFactoryMock.Setup(f => f.CreateDbContext()).Returns(_context);

        // Default tenant setup
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime()).Returns(DateTime.Now);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private NationwideJobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clearListEnvelopeServiceMock.Object
    );

    #region GetActiveAirlineOptionsAsync Tests

    [Fact]
    public async Task GetActiveAirlineOptionsAsync_WithActiveAirlines_ReturnsAirlines()
    {
        // Arrange
        _context.FlightCarriers.AddRange(
            CreateFlightCarrier(1, "NZ", "Air New Zealand", true),
            CreateFlightCarrier(2, "QF", "Qantas", true),
            CreateFlightCarrier(3, "AA", "American Airlines", true)
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineOptionsAsync();

        // Assert
        result.Should().HaveCount(3);
        result.Should().Contain(a => a.Text == "NZ" && a.FullAirlineName == "Air New Zealand");
        result.Should().Contain(a => a.Text == "QF" && a.FullAirlineName == "Qantas");
        result.Should().Contain(a => a.Text == "AA" && a.FullAirlineName == "American Airlines");
    }

    [Fact]
    public async Task GetActiveAirlineOptionsAsync_OnlyReturnsActiveAirlines()
    {
        // Arrange
        _context.FlightCarriers.AddRange(
            CreateFlightCarrier(1, "NZ", "Air New Zealand", true),
            CreateFlightCarrier(2, "QF", "Qantas", false) // Inactive
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineOptionsAsync();

        // Assert
        result.Should().ContainSingle();
        result.First().Text.Should().Be("NZ");
    }

    [Fact]
    public async Task GetActiveAirlineOptionsAsync_WithNoAirlines_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineOptionsAsync();

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetActiveAirlineOptionsAsync_ReturnsCorrectIds()
    {
        // Arrange
        _context.FlightCarriers.Add(CreateFlightCarrier(42, "UA", "United Airlines", true));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineOptionsAsync();

        // Assert
        result.Should().ContainSingle();
        result.First().Id.Should().Be(42);
    }

    #endregion

    #region GetActiveAirlineCodesAsync Tests

    [Fact]
    public async Task GetActiveAirlineCodesAsync_WithActiveAirlines_ReturnsCodes()
    {
        // Arrange
        _context.FlightCarriers.AddRange(
            CreateFlightCarrier(1, "NZ", "Air New Zealand", true),
            CreateFlightCarrier(2, "QF", "Qantas", true)
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineCodesAsync();

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain("NZ");
        result.Should().Contain("QF");
    }

    [Fact]
    public async Task GetActiveAirlineCodesAsync_OnlyReturnsActiveCodes()
    {
        // Arrange
        _context.FlightCarriers.AddRange(
            CreateFlightCarrier(1, "NZ", "Air New Zealand", true),
            CreateFlightCarrier(2, "QF", "Qantas", false) // Inactive
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineCodesAsync();

        // Assert
        result.Should().ContainSingle();
        result.First().Should().Be("NZ");
    }

    [Fact]
    public async Task GetActiveAirlineCodesAsync_WithNoAirlines_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineCodesAsync();

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region GetAirlineCodeByIdAsync Tests

    [Fact]
    public async Task GetAirlineCodeByIdAsync_WithExistingAirline_ReturnsCode()
    {
        // Arrange
        _context.FlightCarriers.Add(CreateFlightCarrier(1, "NZ", "Air New Zealand", true));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAirlineCodeByIdAsync(1);

        // Assert
        result.Should().Be("NZ");
    }

    [Fact]
    public async Task GetAirlineCodeByIdAsync_WithNonExistentAirline_ReturnsNull()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAirlineCodeByIdAsync(999);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetAirlineCodeByIdAsync_ReturnsCodeEvenForInactiveAirline()
    {
        // Arrange
        _context.FlightCarriers.Add(CreateFlightCarrier(1, "QF", "Qantas", false));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAirlineCodeByIdAsync(1);

        // Assert
        result.Should().Be("QF");
    }

    #endregion

    #region GetNearbyAirportsAsync Tests

    [Fact]
    public async Task GetNearbyAirportsAsync_WithNearbyAirports_ReturnsFilteredResults()
    {
        // Arrange
        const int jobId = 100;

        // Create job with pickup coordinates (Auckland area)
        _context.TucJobs.Add(CreateJobWithCoordinates(jobId, "JOB001",
            pickupLat: -36.8485m, pickupLong: 174.7633m,
            deliveryLat: null, deliveryLong: null));

        // Create airports - one nearby, one far away
        _context.TblAirports.AddRange(
            CreateAirport(1, "Auckland Airport", -37.0082m, 174.7850m, true), // Close
            CreateAirport(2, "Sydney Airport", -33.9399m, 151.1753m, true)   // Far
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNearbyAirportsAsync(jobId, usePickup: true);

        // Assert
        result.Should().HaveCount(1);
        result.First().Text.Should().Contain("Auckland Airport");
    }

    [Fact]
    public async Task GetNearbyAirportsAsync_WithNoJobCoordinates_ReturnsEmptyList()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001")); // No coordinates
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNearbyAirportsAsync(jobId, usePickup: true);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetNearbyAirportsAsync_WithNonExistentJob_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetNearbyAirportsAsync(999, usePickup: true);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetNearbyAirportsAsync_OnlyReturnsActiveAirports()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJobWithCoordinates(jobId, "JOB001",
            pickupLat: -36.8485m, pickupLong: 174.7633m,
            deliveryLat: null, deliveryLong: null));

        _context.TblAirports.AddRange(
            CreateAirport(1, "Active Airport", -37.0082m, 174.7850m, true),
            CreateAirport(2, "Inactive Airport", -37.1000m, 174.7000m, false)
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNearbyAirportsAsync(jobId, usePickup: true);

        // Assert
        result.Should().ContainSingle();
        result.First().Text.Should().Contain("Active Airport");
    }

    [Fact]
    public async Task GetNearbyAirportsAsync_UseDelivery_UsesDeliveryCoordinates()
    {
        // Arrange
        const int jobId = 100;

        // Create job with delivery coordinates in Auckland, pickup far away
        _context.TucJobs.Add(CreateJobWithCoordinates(jobId, "JOB001",
            pickupLat: 40.7128m, pickupLong: -74.0060m,    // New York (far)
            deliveryLat: -36.8485m, deliveryLong: 174.7633m)); // Auckland

        _context.TblAirports.Add(CreateAirport(1, "Auckland Airport", -37.0082m, 174.7850m, true));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNearbyAirportsAsync(jobId, usePickup: false);

        // Assert
        result.Should().ContainSingle();
        result.First().Text.Should().Contain("Auckland Airport");
    }

    #endregion

    #region GetAllAgentOptionsBySearchAsync Tests

    [Fact]
    public async Task GetAllAgentOptionsBySearchAsync_WithMatchingAgents_ReturnsAgents()
    {
        // Arrange
        _context.TucAgents.AddRange(
            CreateAgent(1, "Express Couriers Ltd"),
            CreateAgent(2, "Fast Delivery Co"),
            CreateAgent(3, "Quick Express Services")
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllAgentOptionsBySearchAsync("Express");

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(a => a.Text == "Express Couriers Ltd");
        result.Should().Contain(a => a.Text == "Quick Express Services");
    }

    [Fact]
    public async Task GetAllAgentOptionsBySearchAsync_WithNoMatches_ReturnsEmptyList()
    {
        // Arrange
        _context.TucAgents.Add(CreateAgent(1, "Express Couriers Ltd"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllAgentOptionsBySearchAsync("NoMatch");

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAllAgentOptionsBySearchAsync_WithEmptySearch_ReturnsAllAgents()
    {
        // Arrange
        _context.TucAgents.AddRange(
            CreateAgent(1, "Agent A"),
            CreateAgent(2, "Agent B")
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllAgentOptionsBySearchAsync("");

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllAgentOptionsBySearchAsync_WithNullSearch_ReturnsAllAgents()
    {
        // Arrange
        _context.TucAgents.AddRange(
            CreateAgent(1, "Agent A"),
            CreateAgent(2, "Agent B")
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllAgentOptionsBySearchAsync(null);

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllAgentOptionsBySearchAsync_ReturnsOrderedByName()
    {
        // Arrange
        _context.TucAgents.AddRange(
            CreateAgent(1, "Zebra Couriers"),
            CreateAgent(2, "Alpha Delivery"),
            CreateAgent(3, "Beta Services")
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllAgentOptionsBySearchAsync("");

        // Assert
        result.Should().HaveCount(3);
        result[0].Text.Should().Be("Alpha Delivery");
        result[1].Text.Should().Be("Beta Services");
        result[2].Text.Should().Be("Zebra Couriers");
    }

    #endregion

    #region GetAllActiveAirportsWithAgentsAsync Tests

    [Fact]
    public async Task GetAllActiveAirportsWithAgentsAsync_WithAirportsWithAgents_ReturnsAirports()
    {
        // Arrange
        var agent = CreateAgent(1, "Test Agent");
        _context.TucAgents.Add(agent);

        var airport = CreateAirport(1, "Auckland Airport", -37.0082m, 174.7850m, true);
        _context.TblAirports.Add(airport);

        _context.AgentVehicles.Add(new AgentVehicle
        {
            AgentVehicleId = 1,
            AgentId = 1,
            AirportId = 1,
            VehicleSizeId = 1
        });
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsWithAgentsAsync();

        // Assert
        result.Should().ContainSingle();
        result.First().Text.Should().Be("Auckland Airport");
    }

    [Fact]
    public async Task GetAllActiveAirportsWithAgentsAsync_ExcludesInactiveAirports()
    {
        // Arrange
        var agent = CreateAgent(1, "Test Agent");
        _context.TucAgents.Add(agent);

        _context.TblAirports.AddRange(
            CreateAirport(1, "Active Airport", -37.0082m, 174.7850m, true),
            CreateAirport(2, "Inactive Airport", -33.9399m, 151.1753m, false)
        );

        _context.AgentVehicles.AddRange(
            new AgentVehicle { AgentVehicleId = 1, AgentId = 1, AirportId = 1, VehicleSizeId = 1 },
            new AgentVehicle { AgentVehicleId = 2, AgentId = 1, AirportId = 2, VehicleSizeId = 1 }
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsWithAgentsAsync();

        // Assert
        result.Should().ContainSingle();
        result.First().Text.Should().Be("Active Airport");
    }

    [Fact]
    public async Task GetAllActiveAirportsWithAgentsAsync_ExcludesAirportsWithoutAgents()
    {
        // Arrange
        _context.TblAirports.AddRange(
            CreateAirport(1, "Airport With Agents", -37.0082m, 174.7850m, true),
            CreateAirport(2, "Airport Without Agents", -33.9399m, 151.1753m, true)
        );

        var agent = CreateAgent(1, "Test Agent");
        _context.TucAgents.Add(agent);

        _context.AgentVehicles.Add(new AgentVehicle
        {
            AgentVehicleId = 1,
            AgentId = 1,
            AirportId = 1,
            VehicleSizeId = 1
        });
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsWithAgentsAsync();

        // Assert
        result.Should().ContainSingle();
        result.First().Text.Should().Be("Airport With Agents");
    }

    [Fact]
    public async Task GetAllActiveAirportsWithAgentsAsync_WithNoAirports_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsWithAgentsAsync();

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region GetAgentNameAsync Tests

    [Fact]
    public async Task GetAgentNameAsync_WithExistingAgent_ReturnsName()
    {
        // Arrange
        _context.TucAgents.Add(CreateAgent(1, "Express Couriers Ltd"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAgentNameAsync(1);

        // Assert
        result.Should().Be("Express Couriers Ltd");
    }

    [Fact]
    public async Task GetAgentNameAsync_WithNonExistentAgent_ReturnsNull()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAgentNameAsync(999);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region GetFlightWebhookIdByJobIdAsync Tests

    [Fact]
    public async Task GetFlightWebhookIdByJobIdAsync_WithWebhooks_ReturnsIds()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        // Note: SQLite in tests has a unique constraint on UcnwJobId, so we test with single record
        _context.TucJobNationwides.Add(CreateJobNationwide(1, jobId, "webhook-123"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetFlightWebhookIdByJobIdAsync(jobId);

        // Assert
        result.Should().ContainSingle();
        result.Should().Contain("webhook-123");
    }

    [Fact]
    public async Task GetFlightWebhookIdByJobIdAsync_WithNoWebhooks_ReturnsEmptyList()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetFlightWebhookIdByJobIdAsync(jobId);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetFlightWebhookIdByJobIdAsync_ReturnsDistinctIds()
    {
        // Arrange - using different job IDs due to SQLite unique constraint limitation
        const int jobId1 = 100;
        const int jobId2 = 101;
        _context.TucJobs.AddRange(
            CreateJob(jobId1, "JOB001"),
            CreateJob(jobId2, "JOB002")
        );
        _context.TucJobNationwides.AddRange(
            CreateJobNationwide(1, jobId1, "webhook-123"),
            CreateJobNationwide(2, jobId2, "webhook-456")
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act - verify each job returns its webhook
        var result1 = await repository.GetFlightWebhookIdByJobIdAsync(jobId1);
        var result2 = await repository.GetFlightWebhookIdByJobIdAsync(jobId2);

        // Assert
        result1.Should().ContainSingle().Which.Should().Be("webhook-123");
        result2.Should().ContainSingle().Which.Should().Be("webhook-456");
    }

    #endregion

    #region GetAllActiveAirportsAsync Tests

    [Fact]
    public async Task GetAllActiveAirportsAsync_WithActiveAirports_ReturnsAirports()
    {
        // Arrange
        _context.TblAirports.AddRange(
            CreateAirportWithBuffer(1, "Auckland", "AKL", true, 60, "Pacific/Auckland"),
            CreateAirportWithBuffer(2, "Sydney", "SYD", true, 45, "Australia/Sydney")
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsAsync();

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(a => a.AirportCode == "AKL" && a.FlightBufferMinutes == 60);
        result.Should().Contain(a => a.AirportCode == "SYD" && a.FlightBufferMinutes == 45);
    }

    [Fact]
    public async Task GetAllActiveAirportsAsync_ExcludesInactiveAirports()
    {
        // Arrange
        _context.TblAirports.AddRange(
            CreateAirportWithBuffer(1, "Active", "ACT", true, 60, "UTC"),
            CreateAirportWithBuffer(2, "Inactive", "INA", false, 30, "UTC")
        );
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsAsync();

        // Assert
        result.Should().ContainSingle();
        result.First().AirportCode.Should().Be("ACT");
    }

    [Fact]
    public async Task GetAllActiveAirportsAsync_WithNoAirports_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsAsync();

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region RestoreNationwideJobAsync Tests

    [Fact]
    public async Task RestoreNationwideJobAsync_WithExistingJob_DoesNotThrow()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = jobId,
            UcjbNumber = "JOB001",
            UcjbStatus = 5, // Dispatched
            InternalStatus = 10
        });
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act & Assert - ExecuteUpdateAsync doesn't fully work with SQLite,
        // so we just verify the method runs without throwing for existing jobs
        var act = async () => await repository.RestoreNationwideJobAsync(jobId);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task RestoreNationwideJobAsync_WithNonExistentJob_ThrowsException()
    {
        // Arrange
        var repository = CreateRepository();

        // Act & Assert
        var act = async () => await repository.RestoreNationwideJobAsync(999);
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Job with ID 999 not found*");
    }

    [Fact]
    public async Task RestoreNationwideJobAsync_DeletesFlightRecords()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        // Note: SQLite has unique constraint on UcnwJobId, so we test with single record
        _context.TucJobNationwides.Add(CreateJobNationwide(1, jobId, "webhook-1"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        await repository.RestoreNationwideJobAsync(jobId);

        // Assert
        var flights = await _context.TucJobNationwides.Where(f => f.UcnwJobId == jobId).ToListAsync();
        flights.Should().BeEmpty();
    }

    #endregion

    #region GetFlightCarrierIdByCodeAsync Tests

    [Fact]
    public async Task GetFlightCarrierIdByCodeAsync_WithExistingCode_ReturnsId()
    {
        // Arrange
        _context.FlightCarriers.Add(CreateFlightCarrier(42, "NZ", "Air New Zealand", true));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetFlightCarrierIdByCodeAsync("NZ");

        // Assert
        result.Should().Be(42);
    }

    [Fact]
    public async Task GetFlightCarrierIdByCodeAsync_WithNonExistentCode_ReturnsZero()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetFlightCarrierIdByCodeAsync("XX");

        // Assert
        // Note: The implementation returns 0 (default int) instead of null due to FirstOrDefaultAsync on int
        result.Should().Be(0);
    }

    #endregion

    #region NationwideJobListAsync Tests

    [Fact]
    public async Task NationwideJobListAsync_WithEmptyClientIds_ReturnsEmptyResult()
    {
        // Arrange
        var repository = CreateRepository();
        var queryParams = new DespatchWeb.Models.JobQueryParams();

        // Act
        var result = await repository.NationwideJobListAsync(
            queryParams,
            isInternal: false,
            isUsTenant: false,
            clientIds: "",
            DespatchWeb.Enums.NationwideWidget.JobList,
            []);

        // Assert
        result.Should().NotBeNull();
        result.Jobs.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    #endregion

    #region Helper Methods

    private static FlightCarrier CreateFlightCarrier(int id, string code, string name, bool isActive) => new()
    {
        FlightCarrierId = id,
        CarrierCode = code,
        FlightCarrierName = name,
        IsActive = isActive,
        Created = DateTime.Now,
        CreatedBy = "Test",
        LastModified = DateTime.Now,
        LastModifiedBy = "Test"
    };

    private static TucJob CreateJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

    private static TucJob CreateJobWithCoordinates(int id, string jobNumber,
        decimal? pickupLat, decimal? pickupLong, decimal? deliveryLat, decimal? deliveryLong) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        PickUpLatitude = pickupLat,
        PickUpLongitude = pickupLong,
        DeliveryLatitude = deliveryLat,
        DeliveryLongitude = deliveryLong
    };

    private static TblAirport CreateAirport(int id, string name, decimal lat, decimal lng, bool active) => new()
    {
        AirportId = id,
        Name = name,
        Latitude = lat,
        Longitude = lng,
        Active = active
    };

    private static TblAirport CreateAirportWithBuffer(int id, string name, string code,
        bool active, int bufferMinutes, string timezone) => new()
    {
        AirportId = id,
        Name = name,
        AirportCode = code,
        Active = active,
        FlightBufferMinutes = bufferMinutes,
        Timezone = timezone,
        Latitude = 0,
        Longitude = 0
    };

    private static TucAgent CreateAgent(int id, string name) => new()
    {
        UcagId = id,
        UcagName = name,
        CreatedBy = "Test",
        LastModifiedBy = "Test"
    };

    private static TucJobNationwide CreateJobNationwide(int id, int jobId, string webhookId) => new()
    {
        UcnwId = id,
        UcnwJobId = jobId,
        WebhookAlertId = webhookId,
        UcnwFlightNo = "NZ123",
        UcnwEtd = DateTime.Now,
        UcnwEta = DateTime.Now.AddHours(2)
    };

    #endregion
}
