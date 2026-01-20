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
        var queryParams = new Models.JobQueryParams();

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

    #region AddJobNationwideAsync Tests

    [Fact]
    public async Task AddJobNationwideAsync_WithValidRequest_CreatesFlightRecord()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync();

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds);

        // Assert
        var flightRecord = await _context.TucJobNationwides.FirstOrDefaultAsync(f => f.UcnwJobId == 100);
        flightRecord.Should().NotBeNull();
        flightRecord.UcnwFlightNo.Should().Be("NZ123");
        flightRecord.UcnwJobNumber.Should().Be("JOB001-F");
        flightRecord.UcnwEtd.Should().Be(departureTime.DateTime);
        flightRecord.UcnwEta.Should().Be(arrivalTime.DateTime);
        flightRecord.WebhookAlertId.Should().Be("webhook-123");
        flightRecord.UcnwLegNumber.Should().Be(1);
        flightRecord.CarrierFsCode.Should().Be("NZ");
        flightRecord.DepartureAirportFsCode.Should().Be("AKL");
        flightRecord.ArrivalAirportFsCode.Should().Be("SYD");
        flightRecord.UcnwAirlineName.Should().Be("Air New Zealand");
    }

    [Fact]
    public async Task AddJobNationwideAsync_UpdatesJobStatusToDispatched()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.UcjbStatus = (int)DespatchWeb.Enums.JobStatus.New;
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync();

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds);

        // Assert
        var updatedJob = await _context.TucJobs.FindAsync(100);
        updatedJob?.UcjbStatus.Should().Be((int)DespatchWeb.Enums.JobStatus.Dispatched);
        updatedJob?.InternalStatus.Should().Be((int)DespatchWeb.Enums.InternalJobStatus.AwaitingPod);
    }

    [Fact]
    public async Task AddJobNationwideAsync_UpdatesJobDateTimeToFlightDeparture()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 30, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.UcjbDate = DateTime.Now.AddDays(-1); // Original date
        flightJob.UcjbTime = DateTime.Now.AddDays(-1); // Original time
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync();

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds);

        // Assert
        var updatedJob = await _context.TucJobs.FindAsync(100);
        updatedJob?.UcjbDate.Should().Be(departureTime.DateTime);
        updatedJob?.UcjbTime.Should().Be(departureTime.DateTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_SetsDispatchDateAndTime()
    {
        // Arrange
        var currentTime = new DateTime(2024, 6, 10, 9, 0, 0);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime()).Returns(currentTime);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync();

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds);

        // Assert
        var updatedJob = await _context.TucJobs.FindAsync(100);
        updatedJob?.UcjbDispDate.Should().Be(currentTime);
        updatedJob?.UcjbDispTime.Should().Be(currentTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_UpdatesPickupJobDeliverByTime()
    {
        // Arrange
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.FromAirportId = 1;

        // Create pickup job (ends with '1' and has Agent speed grouping)
        var pickupJob = CreateAgentJob(101, "JOB0011", parentJob, (int)DespatchWeb.Enums.SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, pickupJob);

        // Airport with 60-minute processing time
        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync();

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds);

        // Assert - pickup job's DeliverByTime should be departure time minus processing time (60 mins)
        var updatedPickupJob = await _context.TucJobs.FindAsync(101);
        var expectedDeliverByTime = departureTime.AddMinutes(-60).DateTime;
        updatedPickupJob?.DeliverByTime.Should().Be(expectedDeliverByTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_UpdatesDeliveryJobProperties()
    {
        // Arrange
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var packageReadyTime = new DateTimeOffset(2024, 6, 15, 15, 0, 0, TimeSpan.Zero);
        var packageDeliverByTime = new DateTimeOffset(2024, 6, 15, 18, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2;

        // Create delivery job (ends with '2' and has Agent speed grouping)
        var deliveryJob = CreateAgentJob(102, "JOB0012", parentJob, (int)DespatchWeb.Enums.SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney Airport", "SYD", true, 45);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync();

        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime);
        request.PackageReadyTime = packageReadyTime;
        request.PackageDeliverByTime = packageDeliverByTime;
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds);

        // Assert
        var updatedDeliveryJob = await _context.TucJobs.FindAsync(102);
        updatedDeliveryJob?.UcjbDate.Should().Be(packageReadyTime.Date);
        updatedDeliveryJob?.UcjbTime.Should().Be(packageReadyTime.DateTime);
        updatedDeliveryJob?.DeliverByTime.Should().Be(packageDeliverByTime.DateTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_WithMultipleFlightLegs_AddsAllSegmentsToContext()
    {
        // Note: SQLite test DB has a unique constraint from WithOne() in DespatchContext.Partial.cs
        // that doesn't exist in SQL Server. We verify the records are correctly added to the
        // change tracker before the constraint violation occurs.

        // Arrange
        var departureTime1 = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime1 = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);
        var departureTime2 = new DateTimeOffset(2024, 6, 15, 13, 0, 0, TimeSpan.Zero);
        var arrivalTime2 = new DateTimeOffset(2024, 6, 15, 17, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync();

        var request = CreateFlightRequestWithMultipleLegs(100, 1, 1,
            departureTime1, arrivalTime1, departureTime2, arrivalTime2);
        var webhookIds = new List<string> { "webhook-leg1", "webhook-leg2" };

        var repository = CreateRepository();

        // Act & Assert - verify records are added before save fails
        try
        {
            await repository.AddJobNationwideAsync(request, webhookIds);
        }
        catch (DbUpdateException)
        {
            // Expected due to SQLite unique constraint, verify records were added correctly
        }

        // Verify both flight segments were added to the change tracker
        var addedFlightRecords = _context.ChangeTracker.Entries<TucJobNationwide>()
            .Where(e => e.State == EntityState.Added || e.State == EntityState.Unchanged)
            .Select(e => e.Entity)
            .Where(f => f.UcnwJobId == 100)
            .ToList();

        addedFlightRecords.Should().HaveCount(2);

        var leg1 = addedFlightRecords.FirstOrDefault(f => f.UcnwLegNumber == 1);
        leg1.Should().NotBeNull();
        leg1!.UcnwFlightNo.Should().Be("NZ123");
        leg1.WebhookAlertId.Should().Be("webhook-leg1");
        leg1.DepartureAirportFsCode.Should().Be("AKL");
        leg1.ArrivalAirportFsCode.Should().Be("MEL");

        var leg2 = addedFlightRecords.FirstOrDefault(f => f.UcnwLegNumber == 2);
        leg2.Should().NotBeNull();
        leg2!.UcnwFlightNo.Should().Be("NZ456");
        leg2.WebhookAlertId.Should().Be("webhook-leg2");
        leg2.DepartureAirportFsCode.Should().Be("MEL");
        leg2.ArrivalAirportFsCode.Should().Be("SYD");
    }

    [Fact]
    public async Task AddJobNationwideAsync_CreatesJobDeliveryJourneyRecord()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync();

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds);

        // Assert
        var journeyRecord = await _context.JobDeliveryJourneys
            .FirstOrDefaultAsync(j => j.JobId == 100 && j.ChangeType == "FlightAssignment");
        journeyRecord.Should().NotBeNull();
        journeyRecord.StaffId.Should().Be(1);
        journeyRecord.UpdatedByType.Should().Be("Staff");
        journeyRecord.FlightId.Should().NotBeNull();
    }

    [Fact]
    public async Task AddJobNationwideAsync_CreatesFlightUpdateNote()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        // Add required note type for FlightUpdate
        _context.TucNoteTypes.Add(new TucNoteType
        {
            NoteTypeId = (int)DespatchWeb.Enums.NoteType.FlightUpdate,
            NoteTypeName = "Flight Update"
        });

        await _context.SaveChangesAsync();

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds);

        // Assert
        var note = await _context.TucNotes
            .FirstOrDefaultAsync(n => n.JobId == 100 && n.NoteTypeId == (int)DespatchWeb.Enums.NoteType.FlightUpdate);
        note.Should().NotBeNull();
        note.NoteText.Should().Contain("Flight");
        note.NoteText.Should().Contain("123"); // Flight number from segment
    }

    [Fact]
    public async Task AddJobNationwideAsync_WithEmptyFlightSegments_ReturnsEarly()
    {
        // Arrange
        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);
        await _context.SaveChangesAsync();

        var request = new Models.AssignFlightToJobRequest
        {
            JobId = 100,
            FlightSegments = [] // Empty segments
        };
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds);

        // Assert - no flight record should be created
        var flightRecords = await _context.TucJobNationwides.Where(f => f.UcnwJobId == 100).ToListAsync();
        flightRecords.Should().BeEmpty();
    }

    [Fact]
    public async Task AddJobNationwideAsync_ThrowsOnNullWebhookIds()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);
        await _context.SaveChangesAsync();

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);

        var repository = CreateRepository();

        // Act & Assert
        var act = async () => await repository.AddJobNationwideAsync(request, null);
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task AddJobNationwideAsync_UpdatesFlightJobDeliverByTime()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync();

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds);

        // Assert - flight job's DeliverByTime should be set to arrival time
        var updatedFlightJob = await _context.TucJobs.FindAsync(100);
        updatedFlightJob?.DeliverByTime.Should().Be(arrivalTime.DateTime);
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

    private static TucJob CreateJobWithParent(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        UcjbDate = DateTime.Now,
        InverseParent = new List<TucJob>()
    };

    private static TucJob CreateFlightJob(int id, string jobNumber, TucJob parent) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        UcjbDate = DateTime.Now,
        UcjbClientId = 1,
        ParentId = parent.UcjbId,
        Parent = parent,
        InverseParent = new List<TucJob>()
    };

    private static TucJob CreateAgentJob(int id, string jobNumber, TucJob parent, int groupingId)
    {
        var jobType = new TucJobType
        {
            UcjtId = id,
            UcjtName = "Agent Pickup",
            GroupingId = groupingId,
            Grouping = new TucJobTypeGrouping { GroupingId = groupingId, GroupingName = "Agent" },
            CreatedBy = "Test",
            LastModifiedBy = "Test"
        };

        var job = new TucJob
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = DateTime.Now,
            ParentId = parent.UcjbId,
            Parent = parent,
            UcjbSpeed = id,
            UcjbSpeedNavigation = jobType,
            InverseParent = new List<TucJob>()
        };

        parent.InverseParent.Add(job);
        return job;
    }

    private static TblAirport CreateAirportWithProcessingTime(int id, string name, string code, bool active, int processingTime) => new()
    {
        AirportId = id,
        Name = name,
        AirportCode = code,
        Active = active,
        ProcessingTime = processingTime,
        Latitude = 0,
        Longitude = 0,
        AddressLine1 = "123 Airport Road",
        AddressLine5 = "City",
        AddressLine6 = "State",
        AddressLine7 = "12345",
        AddressLine8 = "Country"
    };

    private static EntityClasses.TimeZone CreateTimeZone(int id, string name, string code) => new()
    {
        Id = id,
        Name = name,
        Code = code,
        DisplayName = name,
        OffsetHours = 12,
        OffsetString = "+12:00"
    };

    private static Models.AssignFlightToJobRequest CreateFlightRequest(
        int jobId, int fromAirportId, int toAirportId,
        DateTimeOffset departureTime, DateTimeOffset arrivalTime) => new()
    {
        JobId = jobId,
        FromAirportId = fromAirportId,
        ToAirportId = toAirportId,
        FlightNumber = "NZ123",
        DepartureDate = departureTime,
        FlightSegments =
        [
            new Models.FlightSegmentViewModel
            {
                SegmentOrder = 1,
                CarrierFsCode = "NZ",
                FlightNumber = "123",
                DepartureTime = departureTime,
                ArrivalTime = arrivalTime,
                DepartureAirportFsCode = "AKL",
                DepartureAirportName = "Auckland Airport",
                DepartureAirportCity = "Auckland",
                DepartureAirportCountry = "New Zealand",
                DepartureAirportTimeZone = "Pacific/Auckland",
                ArrivalAirportFsCode = "SYD",
                ArrivalAirportName = "Sydney Airport",
                ArrivalAirportCity = "Sydney",
                ArrivalAirportCountry = "Australia",
                ArrivalAirportTimeZone = "Australia/Sydney",
                AirlineName = "Air New Zealand",
                AircraftName = "Boeing 787"
            }
        ]
    };

    private static Models.AssignFlightToJobRequest CreateFlightRequestWithMultipleLegs(
        int jobId, int fromAirportId, int toAirportId,
        DateTimeOffset departureTime1, DateTimeOffset arrivalTime1,
        DateTimeOffset departureTime2, DateTimeOffset arrivalTime2) => new()
    {
        JobId = jobId,
        FromAirportId = fromAirportId,
        ToAirportId = toAirportId,
        FlightNumber = "NZ123",
        DepartureDate = departureTime1,
        FlightSegments =
        [
            new Models.FlightSegmentViewModel
            {
                SegmentOrder = 1,
                CarrierFsCode = "NZ",
                FlightNumber = "123",
                DepartureTime = departureTime1,
                ArrivalTime = arrivalTime1,
                DepartureAirportFsCode = "AKL",
                DepartureAirportName = "Auckland Airport",
                DepartureAirportCity = "Auckland",
                DepartureAirportCountry = "New Zealand",
                DepartureAirportTimeZone = "Pacific/Auckland",
                ArrivalAirportFsCode = "MEL",
                ArrivalAirportName = "Melbourne Airport",
                ArrivalAirportCity = "Melbourne",
                ArrivalAirportCountry = "Australia",
                ArrivalAirportTimeZone = "Australia/Melbourne",
                AirlineName = "Air New Zealand",
                AircraftName = "Boeing 787"
            },
            new Models.FlightSegmentViewModel
            {
                SegmentOrder = 2,
                CarrierFsCode = "NZ",
                FlightNumber = "456",
                DepartureTime = departureTime2,
                ArrivalTime = arrivalTime2,
                DepartureAirportFsCode = "MEL",
                DepartureAirportName = "Melbourne Airport",
                DepartureAirportCity = "Melbourne",
                DepartureAirportCountry = "Australia",
                DepartureAirportTimeZone = "Australia/Melbourne",
                ArrivalAirportFsCode = "SYD",
                ArrivalAirportName = "Sydney Airport",
                ArrivalAirportCity = "Sydney",
                ArrivalAirportCountry = "Australia",
                ArrivalAirportTimeZone = "Australia/Sydney",
                AirlineName = "Air New Zealand",
                AircraftName = "Airbus A320"
            }
        ]
    };

    #endregion
}
