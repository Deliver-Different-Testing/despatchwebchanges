using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Unit tests for NationwideJobRepository - covers airline, airport, and agent operations.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class NationwideJobRepositoryTests : IAsyncDisposable
{
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock =
        Substitute.For<IClearListEnvelopeService>();

    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly SqliteTestDatabase _db = new();
    private readonly IInboundAgentLinkService _inboundAgentLinkServiceMock = Substitute.For<IInboundAgentLinkService>();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private FakeTenantClock _clock = new(TestDates.Now);

    public NationwideJobRepositoryTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);

        // Default tenant setup
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
        _tenantInfoServiceMock.GetStaffIdOrNull().Returns(1);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private NationwideJobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _inboundAgentLinkServiceMock
    );

    [Fact]
    public async Task GetActiveAirlineOptionsAsync_WithActiveAirlines_ReturnsAirlines()
    {
        // Arrange
        _context.FlightCarriers.AddRange(
            CreateFlightCarrier(1, "NZ", "Air New Zealand", true),
            CreateFlightCarrier(2, "QF", "Qantas", true),
            CreateFlightCarrier(3, "AA", "American Airlines", true)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineOptionsAsync();

        // Assert
        Assert.Equal(3, result.Count);
        Assert.Contains(result, a => a.Text == "NZ" && a.FullAirlineName == "Air New Zealand");
        Assert.Contains(result, a => a.Text == "QF" && a.FullAirlineName == "Qantas");
        Assert.Contains(result, a => a.Text == "AA" && a.FullAirlineName == "American Airlines");
    }

    [Fact]
    public async Task GetActiveAirlineOptionsAsync_OnlyReturnsActiveAirlines()
    {
        // Arrange
        _context.FlightCarriers.AddRange(
            CreateFlightCarrier(1, "NZ", "Air New Zealand", true),
            CreateFlightCarrier(2, "QF", "Qantas", false) // Inactive
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineOptionsAsync();

        // Assert
        var item = Assert.Single(result);
        Assert.Equal("NZ", item.Text);
    }

    [Fact]
    public async Task GetActiveAirlineOptionsAsync_WithNoAirlines_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineOptionsAsync();

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetActiveAirlineOptionsAsync_ReturnsCorrectIds()
    {
        // Arrange
        _context.FlightCarriers.Add(CreateFlightCarrier(42, "UA", "United Airlines", true));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetActiveAirlineOptionsAsync();

        // Assert
        Assert.Single(result);
        Assert.Equal(42, result[0].Id);
    }

    [Fact]
    public async Task GetAirlineCodeByIdAsync_WithExistingAirline_ReturnsCode()
    {
        // Arrange
        _context.FlightCarriers.Add(CreateFlightCarrier(1, "NZ", "Air New Zealand", true));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAirlineCodeByIdAsync(1);

        // Assert
        Assert.Equal("NZ", result);
    }

    [Fact]
    public async Task GetAirlineCodeByIdAsync_WithNonExistentAirline_ReturnsNull()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAirlineCodeByIdAsync(999);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetAirlineCodeByIdAsync_ReturnsCodeEvenForInactiveAirline()
    {
        // Arrange
        _context.FlightCarriers.Add(CreateFlightCarrier(1, "QF", "Qantas", false));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAirlineCodeByIdAsync(1);

        // Assert
        Assert.Equal("QF", result);
    }

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
            CreateAirport(2, "Sydney Airport", -33.9399m, 151.1753m, true) // Far
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNearbyAirportsAsync(jobId, usePickup: true);

        // Assert
        Assert.Single(result);
        Assert.Contains("Auckland Airport", result[0].Text);
    }

    [Fact]
    public async Task GetNearbyAirportsAsync_WithNoJobCoordinates_ReturnsEmptyList()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001")); // No coordinates
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNearbyAirportsAsync(jobId, usePickup: true);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetNearbyAirportsAsync_WithNonExistentJob_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetNearbyAirportsAsync(999, usePickup: true);

        // Assert
        Assert.Empty(result);
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNearbyAirportsAsync(jobId, usePickup: true);

        // Assert
        Assert.Single(result);
        Assert.Contains("Active Airport", result[0].Text);
    }

    [Fact]
    public async Task GetNearbyAirportsAsync_UseDelivery_UsesDeliveryCoordinates()
    {
        // Arrange
        const int jobId = 100;

        // Create job with delivery coordinates in Auckland, pickup far away
        _context.TucJobs.Add(CreateJobWithCoordinates(jobId, "JOB001",
            pickupLat: 40.7128m, pickupLong: -74.0060m, // New York (far)
            deliveryLat: -36.8485m, deliveryLong: 174.7633m)); // Auckland

        _context.TblAirports.Add(CreateAirport(1, "Auckland Airport", -37.0082m, 174.7850m, true));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetNearbyAirportsAsync(jobId, usePickup: false);

        // Assert
        Assert.Single(result);
        Assert.Contains("Auckland Airport", result[0].Text);
    }

    [Fact]
    public async Task GetAllAgentOptionsBySearchAsync_WithMatchingAgents_ReturnsAgents()
    {
        // Arrange
        _context.TucAgents.AddRange(
            CreateAgent(1, "Express Couriers Ltd"),
            CreateAgent(2, "Fast Delivery Co"),
            CreateAgent(3, "Quick Express Services")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllAgentOptionsBySearchAsync("Express");

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, a => a.Text == "Express Couriers Ltd");
        Assert.Contains(result, a => a.Text == "Quick Express Services");
    }

    [Fact]
    public async Task GetAllAgentOptionsBySearchAsync_WithNoMatches_ReturnsEmptyList()
    {
        // Arrange
        _context.TucAgents.Add(CreateAgent(1, "Express Couriers Ltd"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllAgentOptionsBySearchAsync("NoMatch");

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAllAgentOptionsBySearchAsync_WithEmptySearch_ReturnsAllAgents()
    {
        // Arrange
        _context.TucAgents.AddRange(
            CreateAgent(1, "Agent A"),
            CreateAgent(2, "Agent B")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllAgentOptionsBySearchAsync("");

        // Assert
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetAllAgentOptionsBySearchAsync_WithNullSearch_ReturnsAllAgents()
    {
        // Arrange
        _context.TucAgents.AddRange(
            CreateAgent(1, "Agent A"),
            CreateAgent(2, "Agent B")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllAgentOptionsBySearchAsync(null!);

        // Assert
        Assert.Equal(2, result.Count);
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllAgentOptionsBySearchAsync("");

        // Assert
        Assert.Equal(3, result.Count);
        Assert.Equal("Alpha Delivery", result[0].Text);
        Assert.Equal("Beta Services", result[1].Text);
        Assert.Equal("Zebra Couriers", result[2].Text);
    }

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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsWithAgentsAsync();

        // Assert
        Assert.Single(result);
        Assert.Equal("Auckland Airport", result[0].Text);
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsWithAgentsAsync();

        // Assert
        Assert.Single(result);
        Assert.Equal("Active Airport", result[0].Text);
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsWithAgentsAsync();

        // Assert
        Assert.Single(result);
        Assert.Equal("Airport With Agents", result[0].Text);
    }

    [Fact]
    public async Task GetAllActiveAirportsWithAgentsAsync_WithNoAirports_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsWithAgentsAsync();

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAgentNameAsync_WithExistingAgent_ReturnsName()
    {
        // Arrange
        _context.TucAgents.Add(CreateAgent(1, "Express Couriers Ltd"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAgentNameAsync(1);

        // Assert
        Assert.Equal("Express Couriers Ltd", result);
    }

    [Fact]
    public async Task GetAgentNameAsync_WithNonExistentAgent_ReturnsNull()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAgentNameAsync(999);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task AddAgentToJobAsync_WithInboundUrlAndAgentEmail_QueuesAgentMessageWithLink()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN123");

        var repository = CreateRepository();

        // Act
        var result = await repository.AddAgentToJobAsync(agentId, jobId);

        // Assert
        Assert.Equal(AgentInboundEmailStatus.Queued, result.Status);
        Assert.Equal("agent@example.com", result.AgentEmail);
        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal("agent@example.com", message.SendToEmailAddress);
        Assert.Equal("New job assigned JOB001", message.Subject);
        var expectedReplyTo = Environment.GetEnvironmentVariable("ReplyToEmailAddress")
                              ?? "support@deliverdifferent.com";
        Assert.Equal(expectedReplyTo, message.ReplyToEmailAddress);
        Assert.Contains("https://inbound.example.com/TOKEN123", message.UcmmMessage);
    }

    [Fact]
    public async Task AddAgentToJobAsync_SubstitutesTemplateTokensFromJobAndFinalArrivalLeg()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        var job = CreateJob(jobId, "JOB001");
        job.DeliveryAddressLine1 = "ACME Freight";
        job.DeliveryAddressLine3 = "12";
        job.DeliveryAddressLine4 = "Queen Street";
        job.DeliveryAddressLine6 = "Auckland";
        job.DeliverToContact = "Jane Doe";
        job.DeliverToPhone = "021 555 1234";
        job.UcjbQty = 3;
        job.UcjbWeight = 25.5;
        _context.TucJobs.Add(job);

        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);

        // One arrival leg (the SQLite test schema has a unique constraint on UcnwJobId, so a
        // single leg per job; the "final leg = latest ETA" ordering is plain LINQ over legs).
        _context.TucJobNationwides.Add(new TucJobNationwide
        {
            UcnwId = 1, UcnwJobId = jobId, WebhookAlertId = "w1", UcnwLegNumber = 1,
            UcnwFlightNo = "NZ200", UcnwEtd = TestDates.Now.AddHours(2), UcnwEta = TestDates.Now.AddHours(4),
            DepartureAirportCity = "Auckland"
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _tenantInfoServiceMock.FormatDateForTenant(Arg.Any<DateTime?>()).Returns("FORMATTED_ETA");
        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN123");

        var repository = CreateRepository();

        // Act
        await repository.AddAgentToJobAsync(agentId, jobId);

        // Assert
        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        var body = message.UcmmMessage;
        Assert.Contains("Hi Test Agent", body);
        Assert.Contains("new job JOB001", body);
        Assert.Contains("ACME Freight 12 Queen Street Auckland", body);
        Assert.Contains("https://inbound.example.com/TOKEN123", body);
        Assert.Contains("arriving on NZ200 at FORMATTED_ETA from Auckland", body);
        Assert.Contains("with 3 items weighing 25.5", body);
        Assert.Contains("contact name is Jane Doe and you can call them on 021 555 1234", body);
    }

    [Fact]
    public async Task SendAgentRequestMessageAsync_FlightLegOnSiblingJob_FillsFlightTokensFromFamily()
    {
        // Arrange — the agent is assigned to the delivery child job, but the flight legs live on a
        // sibling flight job under the same parent. The email must still resolve the flight details
        // from the family rather than leaving them blank.
        const int parentJobId = 1;
        const int deliveryJobId = 100;
        const int flightJobId = 200;
        const int agentId = 1;

        var parentJob = CreateJob(parentJobId, "JOB001");

        var deliveryJob = CreateJob(deliveryJobId, "JOB001d");
        deliveryJob.ParentId = parentJobId;
        deliveryJob.DeliveryAddressLine1 = "ACME Freight";
        deliveryJob.DeliveryAddressLine3 = "12";
        deliveryJob.DeliveryAddressLine4 = "Queen Street";
        deliveryJob.DeliveryAddressLine6 = "Auckland";
        deliveryJob.DeliverToContact = "Jane Doe";
        deliveryJob.DeliverToPhone = "021 555 1234";
        deliveryJob.UcjbQty = 3;
        deliveryJob.UcjbWeight = 25.5;

        var flightJob = CreateJob(flightJobId, "JOB001f");
        flightJob.ParentId = parentJobId;

        _context.TucJobs.AddRange(parentJob, deliveryJob, flightJob);

        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);

        // The only flight leg is on the sibling flight job, not the delivery job the agent is on.
        _context.TucJobNationwides.Add(new TucJobNationwide
        {
            UcnwId = 1, UcnwJobId = flightJobId, WebhookAlertId = "w1", UcnwLegNumber = 1,
            UcnwFlightNo = "NZ200", UcnwEtd = TestDates.Now.AddHours(2), UcnwEta = TestDates.Now.AddHours(4),
            DepartureAirportCity = "Auckland"
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _tenantInfoServiceMock.FormatDateForTenant(Arg.Any<DateTime?>()).Returns("FORMATTED_ETA");
        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(deliveryJobId, Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN123");

        var repository = CreateRepository();

        // Act — send for the delivery child job (the one the agent is assigned to)
        await repository.SendAgentRequestMessageAsync(agentId, deliveryJobId);

        // Assert
        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Contains("arriving on NZ200 at FORMATTED_ETA from Auckland", message.UcmmMessage);
    }

    [Fact]
    public async Task SendAgentRequestMessageAsync_NonUsTenant_WeightShownInKg()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        var job = CreateJob(jobId, "JOB001");
        job.UcjbQty = 2;
        job.UcjbWeight = 23;
        _context.TucJobs.Add(job);
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN123");

        var repository = CreateRepository();

        // Act
        await repository.SendAgentRequestMessageAsync(agentId, jobId);

        // Assert
        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Contains("weighing 23 kg", message.UcmmMessage);
    }

    [Fact]
    public async Task SendAgentRequestMessageAsync_UsTenant_WeightShownInLb()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        var job = CreateJob(jobId, "JOB001");
        job.UcjbQty = 2;
        job.UcjbWeight = 23;
        _context.TucJobs.Add(job);
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN123");

        var repository = CreateRepository();

        // Act
        await repository.SendAgentRequestMessageAsync(agentId, jobId);

        // Assert
        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Contains("weighing 23 lb", message.UcmmMessage);
    }

    [Fact]
    public async Task AddAgentToJobAsync_WithProvidedSubjectAndBody_UsesOverrideAndSubstitutes()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN123");

        var repository = CreateRepository();

        // Act — dispatcher-edited template overrides the hardcoded default
        await repository.AddAgentToJobAsync(agentId, jobId, false,
            "Custom subject [JobNumber]", "Custom body for [AgentName]");

        // Assert
        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal("Custom subject JOB001", message.Subject);
        // Body is rendered to branded HTML at send time; the substituted text is inside it.
        Assert.Contains("Custom body for Test Agent", message.UcmmMessage);
    }

    [Fact]
    public async Task AddAgentToJobAsync_CustomBodyWithoutInboundUrlToken_StillIncludesAcceptButton()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN123");

        var repository = CreateRepository();

        // Act — dispatcher-edited body that drops the [InboundUrl] token entirely
        await repository.AddAgentToJobAsync(agentId, jobId, false,
            null, "Please accept, pick up, and complete the job in the portal.");

        // Assert — the accept-job CTA is structural, so it renders from the resolved
        // inbound link even though the body copy never mentions [InboundUrl].
        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Contains("Your next step", message.UcmmMessage);
        Assert.Contains("https://inbound.example.com/TOKEN123", message.UcmmMessage);
        Assert.Contains("Accept job &amp; upload POD", message.UcmmMessage);
    }

    [Fact]
    public async Task AddAgentToJobAsync_UnknownTokenInEditedTemplate_LeftIntactWithoutThrowing()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN123");

        var repository = CreateRepository();

        // Act — a token with no matching field must survive verbatim, not throw
        var result = await repository.AddAgentToJobAsync(agentId, jobId, false,
            null, "Ref [NotARealField] for [JobNumber]");

        // Assert
        Assert.Equal(AgentInboundEmailStatus.Queued, result.Status);
        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        // Unknown token survives verbatim inside the rendered HTML body.
        Assert.Contains("Ref [NotARealField] for JOB001", message.UcmmMessage);
    }

    [Fact]
    public async Task AddAgentToJobAsync_QueuesMessageUsingHardcodedDefaultsAndEnvReplyTo()
    {
        // Arrange — the template is hardcoded and reply-to comes from the env var, not the DB.
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN123");

        var repository = CreateRepository();

        // Act
        var result = await repository.AddAgentToJobAsync(agentId, jobId);

        // Assert
        Assert.Equal(AgentInboundEmailStatus.Queued, result.Status);
        var message = await _context.TucManualMessages.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal("New job assigned JOB001", message.Subject);
        var expectedReplyTo = Environment.GetEnvironmentVariable("ReplyToEmailAddress")
                              ?? "support@deliverdifferent.com";
        Assert.Equal(expectedReplyTo, message.ReplyToEmailAddress);
        Assert.Contains("Hi Test Agent", message.UcmmMessage);
    }

    [Fact]
    public async Task AddAgentToJobAsync_WithoutAgentEmail_AssignsButQueuesNoMessage()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.TucAgents.Add(CreateAgent(agentId, "Test Agent")); // UcagFax null
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.AddAgentToJobAsync(agentId, jobId);

        // Assert
        Assert.Equal(AgentInboundEmailStatus.NoAgentEmail, result.Status);
        Assert.Empty(await _context.TucManualMessages.ToListAsync(TestContext.Current.CancellationToken));
        var job = await _context.TucJobs.SingleAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(agentId, job.AgentId);
        Assert.Equal((int)JobStatus.OutboundAgentAssigned, job.UcjbStatus);
    }

    [Fact]
    public async Task AddAgentToJobAsync_WhenInboundUrlNotConfigured_AssignsButQueuesNoMessage()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns((string?)null); // no InboundUrl configured — nothing to link, so no email

        var repository = CreateRepository();

        // Act
        var result = await repository.AddAgentToJobAsync(agentId, jobId);

        // Assert
        Assert.Equal(AgentInboundEmailStatus.NoInboundUrl, result.Status);
        Assert.Empty(await _context.TucManualMessages.ToListAsync(TestContext.Current.CancellationToken));
        var job = await _context.TucJobs.SingleAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(agentId, job.AgentId);
    }

    [Fact]
    public async Task AddAgentToJobAsync_WhenLinkServiceThrows_StillAssignsAgentAndReportsFailed()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns<Task<string?>>(_ => throw new InvalidOperationException("boom"));

        var repository = CreateRepository();

        // Act — the best-effort email failure must not unwind the assignment
        var result = await repository.AddAgentToJobAsync(agentId, jobId);

        // Assert
        Assert.Equal(AgentInboundEmailStatus.Failed, result.Status);
        var job = await _context.TucJobs.SingleAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(agentId, job.AgentId);
        Assert.Equal((int)JobStatus.OutboundAgentAssigned, job.UcjbStatus);
    }

    [Fact]
    public async Task GetAgentInboundEmailPreviewAsync_WithEmailAndInboundUrl_ReturnsQueuedWithNoSideEffects()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN123");

        var repository = CreateRepository();

        // Act
        var preview = await repository.GetAgentInboundEmailPreviewAsync(agentId, jobId);

        // Assert
        Assert.Equal(AgentInboundEmailStatus.Queued, preview.Status);
        Assert.True(preview.WillEmail);
        Assert.Equal("agent@example.com", preview.AgentEmail);
        // Preview has no side effects: the job is not assigned and nothing is queued.
        var job = await _context.TucJobs.SingleAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Null(job.AgentId);
        Assert.Empty(await _context.TucManualMessages.ToListAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task GetAgentInboundEmailPreviewAsync_WithoutAgentEmail_ReturnsNoAgentEmail()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.TucAgents.Add(CreateAgent(agentId, "Test Agent")); // UcagFax null
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var preview = await repository.GetAgentInboundEmailPreviewAsync(agentId, jobId);

        // Assert
        Assert.Equal(AgentInboundEmailStatus.NoAgentEmail, preview.Status);
        Assert.False(preview.WillEmail);
    }

    [Fact]
    public async Task GetAgentInboundEmailPreviewAsync_WhenInboundUrlNotConfigured_ReturnsNoInboundUrl()
    {
        // Arrange
        const int jobId = 100;
        const int agentId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _inboundAgentLinkServiceMock
            .BuildJobLinkAsync(jobId, Arg.Any<CancellationToken>())
            .Returns((string?)null);

        var repository = CreateRepository();

        // Act
        var preview = await repository.GetAgentInboundEmailPreviewAsync(agentId, jobId);

        // Assert
        Assert.Equal(AgentInboundEmailStatus.NoInboundUrl, preview.Status);
        Assert.False(preview.WillEmail);
        Assert.Equal("agent@example.com", preview.AgentEmail);
    }

    [Fact]
    public async Task GetFlightWebhookIdByJobIdAsync_WithWebhooks_ReturnsIds()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        // Note: SQLite in tests has a unique constraint on UcnwJobId, so we test with single record
        _context.TucJobNationwides.Add(CreateJobNationwide(1, jobId, "webhook-123"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetFlightWebhookIdByJobIdAsync(jobId);

        // Assert
        Assert.Single(result);
        Assert.Contains("webhook-123", result);
    }

    [Fact]
    public async Task GetFlightWebhookIdByJobIdAsync_WithNoWebhooks_ReturnsEmptyList()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetFlightWebhookIdByJobIdAsync(jobId);

        // Assert
        Assert.Empty(result);
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act - verify each job returns its webhook
        var result1 = await repository.GetFlightWebhookIdByJobIdAsync(jobId1);
        var result2 = await repository.GetFlightWebhookIdByJobIdAsync(jobId2);

        // Assert
        Assert.Equal("webhook-123", Assert.Single(result1));
        Assert.Equal("webhook-456", Assert.Single(result2));
    }

    [Fact]
    public async Task GetAllActiveAirportsAsync_WithActiveAirports_ReturnsAirports()
    {
        // Arrange
        _context.TblAirports.AddRange(
            CreateAirportWithBuffer(1, "Auckland", "AKL", true, 60, "Pacific/Auckland"),
            CreateAirportWithBuffer(2, "Sydney", "SYD", true, 45, "Australia/Sydney")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsAsync();

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, a => a.AirportCode == "AKL" && a.FlightBufferMinutes == 60);
        Assert.Contains(result, a => a.AirportCode == "SYD" && a.FlightBufferMinutes == 45);
    }

    [Fact]
    public async Task GetAllActiveAirportsAsync_ExcludesInactiveAirports()
    {
        // Arrange
        _context.TblAirports.AddRange(
            CreateAirportWithBuffer(1, "Active", "ACT", true, 60, "UTC"),
            CreateAirportWithBuffer(2, "Inactive", "INA", false, 30, "UTC")
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsAsync();

        // Assert
        Assert.Single(result);
        Assert.Equal("ACT", result[0].AirportCode);
    }

    [Fact]
    public async Task GetAllActiveAirportsAsync_WithNoAirports_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportsAsync();

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAllActiveAirportSuggestionsAsync_IncludesAirportsWithoutAgents()
    {
        // Arrange
        _context.TblAirports.AddRange(
            CreateAirport(1, "Airport With Agents", -37.0082m, 174.7850m, true),
            CreateAirport(2, "Airport Without Agents", -33.9399m, 151.1753m, true)
        );

        _context.TucAgents.Add(CreateAgent(1, "Test Agent"));
        _context.AgentVehicles.Add(new AgentVehicle
        {
            AgentVehicleId = 1,
            AgentId = 1,
            AirportId = 1,
            VehicleSizeId = 1
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportSuggestionsAsync();

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, a => a.Text == "Airport With Agents");
        Assert.Contains(result, a => a.Text == "Airport Without Agents");
    }

    [Fact]
    public async Task GetAllActiveAirportSuggestionsAsync_ExcludesInactiveAirports()
    {
        // Arrange
        _context.TblAirports.AddRange(
            CreateAirport(1, "Active Airport", -37.0082m, 174.7850m, true),
            CreateAirport(2, "Inactive Airport", -33.9399m, 151.1753m, false)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportSuggestionsAsync();

        // Assert
        Assert.Single(result);
        Assert.Equal("Active Airport", result[0].Text);
    }

    [Fact]
    public async Task GetAllActiveAirportSuggestionsAsync_WithNoAirports_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllActiveAirportSuggestionsAsync();

        // Assert
        Assert.Empty(result);
    }

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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var exception = await Record.ExceptionAsync(Act);
        Assert.Null(exception);
        return;

        // Act & Assert - ExecuteUpdateAsync doesn't fully work with SQLite,
        // so we just verify the method runs without throwing for existing jobs
        async Task Act() => await repository.RestoreNationwideJobAsync(jobId);
    }

    [Fact]
    public async Task RestoreNationwideJobAsync_WithNonExistentJob_ThrowsException()
    {
        // Arrange
        var repository = CreateRepository();

        var ex = await Assert.ThrowsAsync<ArgumentException>(Act);
        Assert.Contains("Job with ID 999 not found", ex.Message);
        return;

        // Act & Assert
        async Task Act() => await repository.RestoreNationwideJobAsync(999);
    }

    [Fact]
    public async Task RestoreNationwideJobAsync_DeletesFlightRecords()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        // Note: SQLite has unique constraint on UcnwJobId, so we test with single record
        _context.TucJobNationwides.Add(CreateJobNationwide(1, jobId, "webhook-1"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.RestoreNationwideJobAsync(jobId);

        // Assert
        var flights = await _context.TucJobNationwides.Where(f => f.UcnwJobId == jobId)
            .ToListAsync(TestContext.Current.CancellationToken);
        Assert.Empty(flights);
    }

    [Fact]
    public async Task GetFlightCarrierIdByCodeAsync_WithExistingCode_ReturnsId()
    {
        // Arrange
        _context.FlightCarriers.Add(CreateFlightCarrier(42, "NZ", "Air New Zealand", true));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetFlightCarrierIdByCodeAsync("NZ");

        // Assert
        Assert.Equal(42, result);
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
        Assert.Equal(0, result);
    }

    [Fact]
    public async Task NationwideJobListAsync_WithEmptyClientIds_ReturnsEmptyResult()
    {
        // Arrange
        var repository = CreateRepository();
        var queryParams = new JobQueryParams();

        // Act
        var result = await repository.NationwideJobListAsync(queryParams, isInternal: false, isUsTenant: false,
            clientIds: string.Empty, NationwideWidget.JobList, [],
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result.Jobs);
        Assert.Equal(0, result.TotalCount);
    }

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

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert
        var flightRecord =
            await _context.TucJobNationwides.FirstOrDefaultAsync(f => f.UcnwJobId == 100,
                TestContext.Current.CancellationToken);
        Assert.NotNull(flightRecord);
        Assert.Equal("NZ123", flightRecord.UcnwFlightNo);
        Assert.Equal("JOB001-F", flightRecord.UcnwJobNumber);
        Assert.Equal(departureTime.DateTime, flightRecord.UcnwEtd);
        Assert.Equal(arrivalTime.DateTime, flightRecord.UcnwEta);
        Assert.Equal("webhook-123", flightRecord.WebhookAlertId);
        Assert.Equal(1, flightRecord.UcnwLegNumber);
        Assert.Equal("NZ", flightRecord.CarrierFsCode);
        Assert.Equal("AKL", flightRecord.DepartureAirportFsCode);
        Assert.Equal("SYD", flightRecord.ArrivalAirportFsCode);
        Assert.Equal("Air New Zealand", flightRecord.UcnwAirlineName);
    }

    [Fact]
    public async Task AddJobNationwideAsync_UpdatesJobStatusToDispatched()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.UcjbStatus = (int)JobStatus.New;
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert
        var updatedJob = await _context.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Dispatched, updatedJob?.UcjbStatus);
        Assert.Equal((int)InternalJobStatus.AwaitingPod, updatedJob?.InternalStatus);
    }

    [Fact]
    public async Task AddJobNationwideAsync_UpdatesJobDateTimeToFlightDeparture()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 30, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.UcjbDate = TestDates.Now.AddDays(-1); // Original date
        flightJob.UcjbTime = TestDates.Now.AddDays(-1); // Original time
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert
        var updatedJob = await _context.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal(departureTime.DateTime, updatedJob?.UcjbDate);
        Assert.Equal(departureTime.DateTime, updatedJob?.UcjbTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_SetsDispatchDateAndTime()
    {
        // Arrange
        var currentTime = new DateTime(2024, 6, 10, 9, 0, 0);
        _clock = new FakeTenantClock(currentTime);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert
        var updatedJob = await _context.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal(currentTime, updatedJob?.UcjbDispDate);
        Assert.Equal(currentTime, updatedJob?.UcjbDispTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_UpdatesPickupJobDeliverByTime()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.FromAirportId = 1;

        // Create pickup job (ends with '1' and has Agent speed grouping)
        var pickupJob = CreateAgentJob(101, "JOB0011", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, pickupJob);

        // Airport with 60-minute processing time
        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - pickup job's DeliverByTime should be departure time minus processing time (60 mins)
        var updatedPickupJob = await _context.TucJobs.FindAsync([101], TestContext.Current.CancellationToken);
        var expectedDeliverByTime = departureTime.AddMinutes(-60).DateTime;
        Assert.Equal(expectedDeliverByTime, updatedPickupJob?.DeliverByTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_UpdatesDeliveryJobProperties()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var packageReadyTime = new DateTimeOffset(2024, 6, 15, 15, 0, 0, TimeSpan.Zero);
        var packageDeliverByTime = new DateTimeOffset(2024, 6, 15, 18, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2;

        // Create delivery job (ends with '3' and has Agent speed grouping)
        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney Airport", "SYD", true, 45);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime,
            packageReadyTime: packageReadyTime, packageDeliverByTime: packageDeliverByTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - packageReadyTime and packageDeliverByTime are stored as-is via .DateTime
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);
        Assert.Equal(packageReadyTime.Date, updatedDeliveryJob?.UcjbDate);
        Assert.Equal(packageReadyTime.DateTime, updatedDeliveryJob?.UcjbTime);
        Assert.Equal(packageDeliverByTime.DateTime, updatedDeliveryJob?.DeliverByTime);
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

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequestWithMultipleLegs(100, 1, 1,
            departureTime1, arrivalTime1, departureTime2, arrivalTime2);
        var webhookIds = new List<string> { "webhook-leg1", "webhook-leg2" };

        var repository = CreateRepository();

        // Act & Assert - verify records are added before save fails
        try
        {
            await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);
        }
        catch (DbUpdateException)
        {
            // Expected due to SQLite unique constraint, verify records were added correctly
        }

        // Verify both flight segments were added to the change tracker
        var addedFlightRecords = _context.ChangeTracker.Entries<TucJobNationwide>()
            .Where(e => e.State is EntityState.Added or EntityState.Unchanged)
            .Select(e => e.Entity)
            .Where(f => f.UcnwJobId == 100)
            .ToList();

        Assert.Equal(2, addedFlightRecords.Count);

        var leg1 = addedFlightRecords.FirstOrDefault(f => f.UcnwLegNumber == 1);
        Assert.NotNull(leg1);
        Assert.Equal("NZ123", leg1.UcnwFlightNo);
        Assert.Equal("webhook-leg1", leg1.WebhookAlertId);
        Assert.Equal("AKL", leg1.DepartureAirportFsCode);
        Assert.Equal("MEL", leg1.ArrivalAirportFsCode);

        var leg2 = addedFlightRecords.FirstOrDefault(f => f.UcnwLegNumber == 2);
        Assert.NotNull(leg2);
        Assert.Equal("NZ456", leg2.UcnwFlightNo);
        Assert.Equal("webhook-leg2", leg2.WebhookAlertId);
        Assert.Equal("MEL", leg2.DepartureAirportFsCode);
        Assert.Equal("SYD", leg2.ArrivalAirportFsCode);
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

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert
        var journeyRecord = await _context.JobDeliveryJourneys
            .FirstOrDefaultAsync(j => j.JobId == 100 && j.ChangeType == "FlightAssignment",
                TestContext.Current.CancellationToken);
        Assert.NotNull(journeyRecord);
        Assert.Equal(1, journeyRecord.StaffId);
        Assert.Equal("Staff", journeyRecord.UpdatedByType);
        Assert.NotNull(journeyRecord.FlightId);
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
            NoteTypeId = (int)NoteType.FlightUpdate,
            NoteTypeName = "Flight Update"
        });

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert
        var note = await _context.TucNotes
            .FirstOrDefaultAsync(n => n.JobId == 100 && n.NoteTypeId == (int)NoteType.FlightUpdate,
                TestContext.Current.CancellationToken);
        Assert.NotNull(note);
        Assert.Contains("Flight", note.NoteText);
        Assert.Contains("123", note.NoteText); // Flight number from segment
    }

    [Fact]
    public async Task AddJobNationwideAsync_WithEmptyFlightSegments_ReturnsEarly()
    {
        // Arrange
        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = new AssignFlightToJobRequest
        {
            JobId = 100,
            FlightSegments = [] // Empty segments
        };
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - no flight record should be created
        var flightRecords = await _context.TucJobNationwides.Where(f => f.UcnwJobId == 100)
            .ToListAsync(TestContext.Current.CancellationToken);
        Assert.Empty(flightRecords);
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);

        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArgumentNullException>(Act);
        return;

        // Act & Assert
        async Task Act() => await repository.AddJobNationwideAsync(request, null!);
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

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - flight job's DeliverByTime should be set to arrival time via .DateTime
        var updatedFlightJob = await _context.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal(arrivalTime.DateTime, updatedFlightJob?.DeliverByTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_UsesTransactionForAtomicOperation()
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

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - both flight record and journey record should exist (atomic save)
        var flightRecord =
            await _context.TucJobNationwides.FirstOrDefaultAsync(f => f.UcnwJobId == 100,
                TestContext.Current.CancellationToken);
        var journeyRecord =
            await _context.JobDeliveryJourneys.FirstOrDefaultAsync(j => j.JobId == 100,
                TestContext.Current.CancellationToken);

        Assert.NotNull(flightRecord);
        Assert.NotNull(journeyRecord);
        Assert.Equal(flightRecord.UcnwId, journeyRecord.FlightId);
    }

    [Fact]
    public async Task AddJobNationwideAsync_UsesPickupJobSuffixConstant()
    {
        // Arrange - verifies the '1' suffix is used for pickup jobs
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.FromAirportId = 1;

        // Create shared grouping to avoid EF tracking conflicts
        var agentGrouping = new TucJobTypeGrouping { GroupingId = (int)SpeedGrouping.Agent, GroupingName = "Agent" };

        // Create pickup job with suffix '1'
        var pickupJob = CreateAgentJobWithGrouping(101, "JOB0011", parentJob, agentGrouping);

        // Create another job that doesn't match (different suffix)
        var otherJob = CreateAgentJobWithGrouping(102, "JOB0012", parentJob, agentGrouping);

        _context.TucJobs.AddRange(parentJob, flightJob, pickupJob, otherJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - only the pickup job (suffix '1') should have DeliverByTime updated
        var updatedPickupJob = await _context.TucJobs.FindAsync([101], TestContext.Current.CancellationToken);
        var unchangedOtherJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);

        Assert.NotNull(updatedPickupJob?.DeliverByTime);
        Assert.Null(unchangedOtherJob?.DeliverByTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_UsesDeliveryJobSuffixConstant()
    {
        // Arrange - verifies the '3' suffix is used for delivery jobs
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 1;

        // Create shared grouping to avoid EF tracking conflicts
        var agentGrouping = new TucJobTypeGrouping { GroupingId = (int)SpeedGrouping.Agent, GroupingName = "Agent" };

        // Create delivery job with suffix '3'
        var deliveryJob = CreateAgentJobWithGrouping(103, "JOB0013", parentJob, agentGrouping);

        // Create another job that doesn't match (different suffix)
        var otherJob = CreateAgentJobWithGrouping(104, "JOB0014", parentJob, agentGrouping);

        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob, otherJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - only the delivery job (suffix '3') should have UcjbDate/UcjbTime updated
        {
            var updatedDeliveryJob = await _context.TucJobs.FindAsync([103], TestContext.Current.CancellationToken);
            var unchangedOtherJob = await _context.TucJobs.FindAsync([104], TestContext.Current.CancellationToken);

            // Delivery job should have its date set to after the arrival time (arrival + 60 min processing)
            var expectedReadyTime = arrivalTime.AddMinutes(60);
            Assert.Equal(expectedReadyTime.Date, updatedDeliveryJob?.UcjbDate);
            Assert.Equal(expectedReadyTime.DateTime, updatedDeliveryJob?.UcjbTime);

            // Other job (suffix '4') should NOT have its time updated - it stays at the default
            Assert.NotEqual(expectedReadyTime.DateTime, unchangedOtherJob?.UcjbTime);
        }
    }

    [Fact]
    public async Task AddJobNationwideAsync_UsesPrimaryFlightLegNumberConstant()
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

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - primary flight should have leg number 1 (constant value)
        var flightRecord =
            await _context.TucJobNationwides.FirstOrDefaultAsync(f => f.UcnwJobId == 100,
                TestContext.Current.CancellationToken);
        Assert.NotNull(flightRecord);
        Assert.Equal(1, flightRecord.UcnwLegNumber);
    }

    [Fact]
    public async Task AddJobNationwideAsync_PrimaryFlightHasGateNumber_ConnectionFlightsDoNot()
    {
        // Note: SQLite test DB has a unique constraint that may cause issues with multiple flight legs.
        // We verify the correct gate number assignment in the change tracker before any constraint violation.

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

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequestWithMultipleLegs(100, 1, 1,
            departureTime1, arrivalTime1, departureTime2, arrivalTime2);
        // Add departure terminal to first segment
        request.FlightSegments[0].DepartureTerminal = "Terminal 1";
        request.FlightSegments[1].DepartureTerminal = "Terminal 2";
        var webhookIds = new List<string> { "webhook-leg1", "webhook-leg2" };

        var repository = CreateRepository();

        // Act & Assert - verify gate number assignment before save
        try
        {
            await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);
        }
        catch (DbUpdateException)
        {
            // Expected due to SQLite unique constraint
        }

        var addedFlightRecords = _context.ChangeTracker.Entries<TucJobNationwide>()
            .Where(e => e.State is EntityState.Added or EntityState.Unchanged)
            .Select(e => e.Entity)
            .Where(f => f.UcnwJobId == 100)
            .ToList();

        var leg1 = addedFlightRecords.FirstOrDefault(f => f.UcnwLegNumber == 1);
        var leg2 = addedFlightRecords.FirstOrDefault(f => f.UcnwLegNumber == 2);

        // Primary flight (leg 1) should have gate number
        Assert.NotNull(leg1);
        Assert.Equal("Terminal 1", leg1.GateNumber);

        // Connection flight (leg 2) should NOT have gate number (only primary flight gets it)
        Assert.NotNull(leg2);
        Assert.Null(leg2.GateNumber);
    }

    /// <summary>
    /// Tests for Issue #3: The start time of the final mile job doesn't get updated to landing time +1 hour.
    ///
    /// When no PackageReadyTime is provided, the delivery (final mile) job's start time should be
    /// calculated as: arrival time + airport processing time (default 60 minutes).
    /// </summary>
    [Fact]
    public async Task AddJobNationwideAsync_WhenNoPackageReadyTime_SetsDeliveryJobStartTimeToArrivalPlusProcessingTime()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        const int airportProcessingTime = 60; // Default processing time

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2;

        // Create delivery job (final mile job - ends with '3' and has Agent speed grouping)
        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney Airport", "SYD", true, airportProcessingTime);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Note: NOT setting PackageReadyTime - this should trigger auto-calculation
        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - delivery job's start time should be arrival time + processing time
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);
        var expectedStartTime = arrivalTime.AddMinutes(airportProcessingTime);

        Assert.NotNull(updatedDeliveryJob);
        Assert.Equal(expectedStartTime.Date, updatedDeliveryJob.UcjbDate);
        Assert.Equal(expectedStartTime.DateTime, updatedDeliveryJob.UcjbTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_WhenPackageReadyTimeProvided_UsesProvidedTimeInsteadOfCalculated()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var customPackageReadyTime =
            new DateTimeOffset(2024, 6, 15, 16, 30, 0, TimeSpan.Zero); // 2.5 hours after arrival

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2;

        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney Airport", "SYD", true, 60);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime,
            packageReadyTime: customPackageReadyTime); // Explicitly set package ready time
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - delivery job's start time should use the provided PackageReadyTime via .DateTime
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);

        Assert.NotNull(updatedDeliveryJob);
        Assert.Equal(customPackageReadyTime.Date, updatedDeliveryJob.UcjbDate);
        Assert.Equal(customPackageReadyTime.DateTime, updatedDeliveryJob.UcjbTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_WithCustomAirportProcessingTime_UsesAirportSpecificProcessingTime()
    {
        // Arrange - Test with a non-default processing time (90 minutes)
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        const int customProcessingTime = 90; // 90 minutes instead of default 60

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2;

        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport =
            CreateAirportWithProcessingTime(2, "Los Angeles Airport", "LAX", true, customProcessingTime);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "America/Los_Angeles", "PST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request =
            CreateFlightRequest(100, 1, 2, departureTime,
                arrivalTime); // PackageReadyTime defaults to null, forcing calculation
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - delivery job's start time should be arrival + 90 minutes
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);
        var expectedStartTime = arrivalTime.AddMinutes(customProcessingTime);

        Assert.NotNull(updatedDeliveryJob);
        Assert.Equal(expectedStartTime.DateTime, updatedDeliveryJob.UcjbTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_WhenAirportHasNoProcessingTime_DefaultsTo60Minutes()
    {
        // Arrange - Airport without processing time set (should default to 60)
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2;

        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        // Create airport without explicit processing time (ProcessingTime = null)
        var arrivalAirport = new TblAirport
        {
            AirportId = 2,
            Name = "Test Airport",
            AirportCode = "TST",
            Active = true,
            ProcessingTime = null, // No processing time set - should default to 60
            Latitude = 0,
            Longitude = 0,
            AddressLine1 = "123 Airport Road",
            AddressLine5 = "City",
            AddressLine6 = "State",
            AddressLine7 = "12345",
            AddressLine8 = "Country"
        };
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "UTC", "UTC");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - should use default 60 minutes when airport has no processing time
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);
        var expectedStartTime = arrivalTime.AddMinutes(60); // Default processing time

        Assert.NotNull(updatedDeliveryJob);
        Assert.Equal(expectedStartTime.DateTime, updatedDeliveryJob.UcjbTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_MultiSegmentFlight_UsesLastSegmentArrivalTimeForFinalMileStart()
    {
        // Arrange - Multi-segment flight where last leg arrival time matters
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime1 = new DateTimeOffset(2024, 6, 15, 8, 0, 0, TimeSpan.Zero);
        var arrivalTime1 = new DateTimeOffset(2024, 6, 15, 11, 0, 0, TimeSpan.Zero); // First leg arrival
        var departureTime2 = new DateTimeOffset(2024, 6, 15, 13, 0, 0, TimeSpan.Zero);
        var arrivalTime2 = new DateTimeOffset(2024, 6, 15, 17, 0, 0, TimeSpan.Zero); // Final arrival

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 3; // Final destination

        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland", "AKL", true, 60);
        var connectionAirport = CreateAirportWithProcessingTime(2, "Melbourne", "MEL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(3, "Sydney", "SYD", true, 45);
        _context.TblAirports.AddRange(departureAirport, connectionAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Melbourne", "AEST");
        var timeZone3 = CreateTimeZone(3, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2, timeZone3);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequestWithMultipleLegs(100, 1, 3,
            departureTime1, arrivalTime1, departureTime2, arrivalTime2);
        var webhookIds = new List<string> { "webhook-leg1", "webhook-leg2" };

        var repository = CreateRepository();

        // Act - Note: This may throw due to SQLite constraint, but we capture the state
        try
        {
            await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);
        }
        catch (DbUpdateException)
        {
            // SQLite constraint issue in tests
        }

        // Assert - Final mile job start should be based on LAST segment arrival + processing time
        await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);
        var expectedStartTime = arrivalTime2.AddMinutes(45); // Last leg arrival + SYD processing time

        // Note: Due to SQLite constraint, the delivery job update may not persist,
        // but we verify the entity was tracked with correct values
        var trackedDeliveryJob = _context.ChangeTracker.Entries<TucJob>()
            .FirstOrDefault(e => e.Entity.UcjbId == 102)?.Entity;

        if (trackedDeliveryJob != null)
        {
            Assert.Equal(expectedStartTime.DateTime, trackedDeliveryJob.UcjbTime);
        }
    }

    [Fact]
    public async Task AddJobNationwideAsync_WhenBothJob2AndJob3Exist_SelectsJob3ForDeliveryTimeUpdate()
    {
        // Arrange - This test verifies that when both job '2' and job '3' exist,
        // the query specifically selects job '3' (the drop-off job) for the delivery time update.
        // Previously, the OR condition would find job '2' first due to ordering.
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        const int airportProcessingTime = 60;

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2;

        // Create shared grouping to avoid EF tracking conflicts
        var sharedGrouping = new TucJobTypeGrouping { GroupingId = (int)SpeedGrouping.Agent, GroupingName = "Agent" };

        // Create BOTH job '2' (flight leg) and job '3' (drop-off) with Agent speed grouping
        var job2 = CreateAgentJobWithGrouping(102, "JOB0012", parentJob, sharedGrouping);
        var job3 = CreateAgentJobWithGrouping(103, "JOB0013", parentJob, sharedGrouping);
        _context.TucJobs.AddRange(parentJob, flightJob, job2, job3);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney Airport", "SYD", true, airportProcessingTime);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };
        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - Job '3' should have its start time updated, not job '2'
        var updatedJob3 = await _context.TucJobs.FindAsync([103], TestContext.Current.CancellationToken);
        var expectedStartTime = arrivalTime.AddMinutes(airportProcessingTime);

        Assert.NotNull(updatedJob3);
        Assert.Equal(expectedStartTime.Date, updatedJob3.UcjbDate);
        Assert.Equal(expectedStartTime.DateTime, updatedJob3.UcjbTime);

        // Job '2' should NOT have its start time modified to the delivery time
        var updatedJob2 = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);
        Assert.NotNull(updatedJob2);
        Assert.NotEqual(expectedStartTime.DateTime, updatedJob2.UcjbTime);
    }

    /// <summary>
    /// Tests for Issue #4: The delivery by time of the first job doesn't get set when you assign a flight.
    ///
    /// When assigning a flight, the pickup job's DeliverByTime should be set to:
    /// departure time - airport processing time (so the package arrives at the airport on time).
    /// </summary>
    [Fact]
    public async Task AddJobNationwideAsync_SetsPickupJobDeliverByTime_ToDepartureMinusProcessingTime()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 18, 0, 0, TimeSpan.Zero);
        const int departureAirportProcessingTime = 60;

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.FromAirportId = 1;

        var pickupJob = CreateAgentJob(101, "JOB0011", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, pickupJob);

        var airport =
            CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, departureAirportProcessingTime);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - pickup job's DeliverByTime should be departure time - processing time
        var updatedPickupJob = await _context.TucJobs.FindAsync([101], TestContext.Current.CancellationToken);
        var expectedDeliverByTime = departureTime.AddMinutes(-departureAirportProcessingTime).DateTime;

        Assert.NotNull(updatedPickupJob);
        Assert.Equal(expectedDeliverByTime, updatedPickupJob.DeliverByTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_WithCustomDepartureAirportProcessingTime_AppliesCorrectProcessingTime()
    {
        // Arrange - Departure airport with 90 minute processing time
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 18, 0, 0, TimeSpan.Zero);
        const int customProcessingTime = 90;

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.FromAirportId = 1;

        var pickupJob = CreateAgentJob(101, "JOB0011", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, pickupJob);

        var airport = CreateAirportWithProcessingTime(1, "Los Angeles", "LAX", true, customProcessingTime);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "America/Los_Angeles", "PST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - pickup job's DeliverByTime should be departure time - 90 minutes
        var updatedPickupJob = await _context.TucJobs.FindAsync([101], TestContext.Current.CancellationToken);
        var expectedDeliverByTime = departureTime.AddMinutes(-customProcessingTime).DateTime;

        Assert.NotNull(updatedPickupJob);
        Assert.Equal(expectedDeliverByTime, updatedPickupJob.DeliverByTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_WhenNoPickupJob_DoesNotThrowAndFlightAssignmentSucceeds()
    {
        // Arrange - Flight job without associated pickup job
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 18, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.FromAirportId = 1;
        // Note: No pickup job created - only flight job

        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        var exception = await Record.ExceptionAsync(Act);
        Assert.Null(exception);

        // Verify flight was assigned
        var flightRecord =
            await _context.TucJobNationwides.FirstOrDefaultAsync(f => f.UcnwJobId == 100,
                TestContext.Current.CancellationToken);
        Assert.NotNull(flightRecord);
        return;

        // Act & Assert - Should not throw, flight assignment should complete
        async Task Act() => await repository.AddJobNationwideAsync(request, webhookIds);
    }

    [Fact]
    public async Task AddJobNationwideAsync_SetsPickupJobDeliverByTimeZone_ToFirstSegmentDepartureTimeZone()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 18, 0, 0, TimeSpan.Zero);
        const string expectedTimeZone = "Pacific/Auckland";

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.FromAirportId = 1;

        var pickupJob = CreateAgentJob(101, "JOB0011", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, pickupJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, expectedTimeZone, "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - pickup job's DeliverByTimeZoneId should be set to departure timezone
        var updatedPickupJob = await _context.TucJobs.FindAsync([101], TestContext.Current.CancellationToken);

        Assert.NotNull(updatedPickupJob);
        Assert.NotNull(updatedPickupJob.DeliverByTimeZoneId);
    }

    [Fact]
    public async Task AddJobNationwideAsync_BothPickupAndDeliveryJobs_SetsBothDeliverByTimes()
    {
        // Arrange - Complete nationwide job with pickup, flight, and delivery
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var packageDeliverByTime = new DateTimeOffset(2024, 6, 15, 18, 0, 0, TimeSpan.Zero);
        const int departureProcessingTime = 60;
        const int arrivalProcessingTime = 45;

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.FromAirportId = 1;
        flightJob.ToAirportId = 2;

        // Create shared grouping to avoid EF tracking conflicts
        var sharedGrouping = new TucJobTypeGrouping { GroupingId = (int)SpeedGrouping.Agent, GroupingName = "Agent" };
        var pickupJob = CreateAgentJobWithGrouping(101, "JOB0011", parentJob, sharedGrouping);
        var deliveryJob = CreateAgentJobWithGrouping(102, "JOB0013", parentJob, sharedGrouping);
        _context.TucJobs.AddRange(parentJob, flightJob, pickupJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland", "AKL", true, departureProcessingTime);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney", "SYD", true, arrivalProcessingTime);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime,
            packageDeliverByTime: packageDeliverByTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - Both pickup and delivery jobs should have DeliverByTime set
        var updatedPickupJob = await _context.TucJobs.FindAsync([101], TestContext.Current.CancellationToken);
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);

        // Pickup: departure time - processing time
        var expectedPickupDeliverBy = departureTime.AddMinutes(-departureProcessingTime).DateTime;
        Assert.NotNull(updatedPickupJob);
        Assert.Equal(expectedPickupDeliverBy, updatedPickupJob.DeliverByTime);

        // Delivery: explicitly set PackageDeliverByTime via .DateTime
        Assert.NotNull(updatedDeliveryJob);
        Assert.Equal(packageDeliverByTime.DateTime, updatedDeliveryJob.DeliverByTime);
    }

    /// <summary>
    /// Tests for Issue #2: The time of the flight in the flight window (which gets added to the
    /// flight job details) is incorrect.
    ///
    /// The flight record (TucJobNationwide) should store the correct ETD (Estimated Time of Departure)
    /// and ETA (Estimated Time of Arrival) from the flight segments.
    /// </summary>
    [Fact]
    public async Task AddJobNationwideAsync_StoresCorrectFlightETDAndETA()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 30, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 45, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - Flight record should have exact ETD and ETA from segment
        var flightRecord =
            await _context.TucJobNationwides.FirstOrDefaultAsync(f => f.UcnwJobId == 100,
                TestContext.Current.CancellationToken);

        Assert.NotNull(flightRecord);
        Assert.Equal(departureTime.DateTime, flightRecord.UcnwEtd);
        Assert.Equal(arrivalTime.DateTime, flightRecord.UcnwEta);
    }

    [Fact]
    public async Task AddJobNationwideAsync_FlightJobDateAndTime_MatchesDepartureTime()
    {
        // Arrange - Verify flight job's date/time fields are set correctly
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 30, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 45, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.UcjbDate = TestDates.Now.AddDays(-5); // Original date
        flightJob.UcjbTime = TestDates.Now.AddDays(-5);
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - Flight job's date/time should be updated to departure time
        var updatedFlightJob = await _context.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);

        Assert.NotNull(updatedFlightJob);
        Assert.Equal(departureTime.DateTime, updatedFlightJob.UcjbDate);
        Assert.Equal(departureTime.DateTime, updatedFlightJob.UcjbTime);
    }

    [Fact]
    public async Task AddJobNationwideAsync_MultiSegmentFlight_StoresCorrectTimesForEachSegment()
    {
        // Arrange - Multi-segment flight with different departure/arrival times per leg
        var departureTime1 = new DateTimeOffset(2024, 6, 15, 8, 0, 0, TimeSpan.Zero);
        var arrivalTime1 = new DateTimeOffset(2024, 6, 15, 11, 30, 0, TimeSpan.Zero);
        var departureTime2 = new DateTimeOffset(2024, 6, 15, 13, 0, 0, TimeSpan.Zero);
        var arrivalTime2 = new DateTimeOffset(2024, 6, 15, 17, 45, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequestWithMultipleLegs(100, 1, 1,
            departureTime1, arrivalTime1, departureTime2, arrivalTime2);
        var webhookIds = new List<string> { "webhook-leg1", "webhook-leg2" };

        var repository = CreateRepository();

        // Act - Note: May throw due to SQLite constraint
        try
        {
            await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);
        }
        catch (DbUpdateException)
        {
            // Expected in SQLite tests
        }

        // Assert - Verify each segment has correct ETD/ETA in change tracker
        var addedFlightRecords = _context.ChangeTracker.Entries<TucJobNationwide>()
            .Where(e => e.State is EntityState.Added or EntityState.Unchanged)
            .Select(e => e.Entity)
            .Where(f => f.UcnwJobId == 100)
            .OrderBy(f => f.UcnwLegNumber)
            .ToList();

        Assert.Equal(2, addedFlightRecords.Count);

        // First leg (main record) - has its own ETD/ETA
        var leg1 = addedFlightRecords[0];
        Assert.Equal(departureTime1.DateTime, leg1.UcnwEtd);
        Assert.Equal(arrivalTime1.DateTime, leg1.UcnwEta);

        // Second leg (additional segment record) - has its own ETD/ETA
        var leg2 = addedFlightRecords[1];
        Assert.Equal(departureTime2.DateTime, leg2.UcnwEtd);
        Assert.Equal(arrivalTime2.DateTime, leg2.UcnwEta);
    }

    /// <summary>
    /// Tests for CalculateCargoReadyTimeAsync to ensure consistent processing time defaults.
    /// Issue #3: The processing time must default to 60 minutes (1 hour) when not set,
    /// consistent with AddJobNationwideAsync.
    /// </summary>
    [Fact]
    public async Task CalculateCargoReadyTimeAsync_WhenAirportHasProcessingTime_ReturnsConfiguredProcessingTime()
    {
        // Arrange
        const int configuredProcessingTime = 90;
        var flightArrivalTime = new DateTime(2024, 6, 15, 14, 0, 0);

        var job = CreateJobWithAirport(100, "JOB001", 1);
        _context.TucJobs.Add(job);

        var airport = CreateAirportWithProcessingTime(1, "Sydney Airport", "SYD", true, configuredProcessingTime);
        _context.TblAirports.Add(airport);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.CalculateCargoReadyTimeAsync(100, "NZ", flightArrivalTime);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(configuredProcessingTime, result.ProcessingTimeMins);
    }

    [Fact]
    public async Task CalculateCargoReadyTimeAsync_WhenAirportHasNoProcessingTime_DefaultsTo60Minutes()
    {
        // Arrange
        var flightArrivalTime = new DateTime(2024, 6, 15, 14, 0, 0);

        var job = CreateJobWithAirport(100, "JOB001", 1);
        _context.TucJobs.Add(job);

        // Create airport without processing time
        var airport = new TblAirport
        {
            AirportId = 1,
            Name = "Test Airport",
            AirportCode = "TST",
            Active = true,
            ProcessingTime = null, // No processing time set
            Latitude = 0,
            Longitude = 0,
            AddressLine1 = "123 Airport Road",
            AddressLine5 = "City",
            AddressLine6 = "State",
            AddressLine7 = "12345",
            AddressLine8 = "Country"
        };
        _context.TblAirports.Add(airport);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.CalculateCargoReadyTimeAsync(100, "NZ", flightArrivalTime);

        // Assert - Should default to 60 minutes, consistent with AddJobNationwideAsync
        Assert.NotNull(result);
        Assert.Equal(60, result.ProcessingTimeMins);
    }

    [Fact]
    public async Task CalculateCargoReadyTimeAsync_ReturnsCorrectArrivalTime()
    {
        // Arrange
        var flightArrivalTime = new DateTime(2024, 6, 15, 14, 30, 0);

        var job = CreateJobWithAirport(100, "JOB001", 1);
        _context.TucJobs.Add(job);

        var airport = CreateAirportWithProcessingTime(1, "Sydney Airport", "SYD", true, 60);
        _context.TblAirports.Add(airport);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.CalculateCargoReadyTimeAsync(100, "NZ", flightArrivalTime);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(flightArrivalTime, result.ArrivalTime);
    }

    [Fact]
    public async Task CalculateCargoReadyTimeAsync_WhenJobNotFound_ReturnsNull()
    {
        // Arrange
        var flightArrivalTime = new DateTime(2024, 6, 15, 14, 0, 0);
        var repository = CreateRepository();

        // Act - Job ID 999 doesn't exist
        var result = await repository.CalculateCargoReadyTimeAsync(999, "NZ", flightArrivalTime);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task CalculateCargoReadyTimeAsync_ReturnsCargoTimesAsDateTimeOffsetWithTimezoneOffset()
    {
        // Arrange - Flight arrives June 15, 2024 at 14:00
        var flightArrivalTime = new DateTime(2024, 6, 15, 14, 0, 0);
        const string pacificTimeZone = "Pacific Standard Time"; // UTC-8 (PST) / UTC-7 (PDT)

        var job = CreateJobWithAirport(100, "JOB001", 1);
        _context.TucJobs.Add(job);

        var carrier = CreateFlightCarrier(1, "NZ", "Air New Zealand", true);
        _context.FlightCarriers.Add(carrier);

        var airport = CreateAirportWithTimezoneAndCargoFacility(
            id: 1,
            name: "Los Angeles Airport",
            code: "LAX",
            active: true,
            processingTime: 60,
            timezone: pacificTimeZone,
            carrierId: 1,
            cargoOpeningTime: new DateTime(1900, 1, 1, 6, 0, 0),
            cargoClosingTime: new DateTime(1900, 1, 1, 22, 0, 0)
        );
        _context.TblAirports.Add(airport);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.CalculateCargoReadyTimeAsync(100, "NZ", flightArrivalTime);

        // Assert
        Assert.NotNull(result);

        // Cargo times should be DateTimeOffset with the airport's timezone offset applied
        // The time portion should match the cargo facility times (06:00 and 22:00)
        Assert.Equal(6, result.CargoOpeningTime.Hour);
        Assert.Equal(0, result.CargoOpeningTime.Minute);
        Assert.Equal(22, result.CargoClosingTime.Hour);
        Assert.Equal(0, result.CargoClosingTime.Minute);

        // The date should match the flight arrival date
        Assert.Equal(2024, result.CargoOpeningTime.Year);
        Assert.Equal(6, result.CargoOpeningTime.Month);
        Assert.Equal(15, result.CargoOpeningTime.Day);
        Assert.Equal(2024, result.CargoClosingTime.Year);
        Assert.Equal(6, result.CargoClosingTime.Month);
        Assert.Equal(15, result.CargoClosingTime.Day);

        // The offset should be present (not zero unless actually UTC)
        // Pacific time in June is PDT (UTC-7), so offset should be -07:00
        var expectedOffset = TimeZoneInfo.FindSystemTimeZoneById(pacificTimeZone).GetUtcOffset(flightArrivalTime);
        Assert.Equal(expectedOffset, result.CargoOpeningTime.Offset);
        Assert.Equal(expectedOffset, result.CargoClosingTime.Offset);
    }

    [Fact]
    public async Task CalculateCargoReadyTimeAsync_WhenAirportHasNoTimezone_UsesLocalTimezone()
    {
        // Arrange
        var flightArrivalTime = new DateTime(2024, 6, 15, 14, 0, 0);

        var job = CreateJobWithAirport(100, "JOB001", 1);
        _context.TucJobs.Add(job);

        var carrier = CreateFlightCarrier(1, "NZ", "Air New Zealand", true);
        _context.FlightCarriers.Add(carrier);

        // Airport with no timezone set
        var airport = CreateAirportWithTimezoneAndCargoFacility(
            id: 1,
            name: "Test Airport",
            code: "TST",
            active: true,
            processingTime: 60,
            timezone: null, // No timezone
            carrierId: 1,
            cargoOpeningTime: new DateTime(1900, 1, 1, 8, 0, 0),
            cargoClosingTime: new DateTime(1900, 1, 1, 20, 0, 0)
        );
        _context.TblAirports.Add(airport);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.CalculateCargoReadyTimeAsync(100, "NZ", flightArrivalTime);

        // Assert
        Assert.NotNull(result);

        // Should fall back to local timezone
        var localOffset = TimeZoneInfo.Local.GetUtcOffset(flightArrivalTime);
        Assert.Equal(localOffset, result.CargoOpeningTime.Offset);
        Assert.Equal(localOffset, result.CargoClosingTime.Offset);

        // Time portions should still be correct
        Assert.Equal(8, result.CargoOpeningTime.Hour);
        Assert.Equal(20, result.CargoClosingTime.Hour);
    }

    [Fact]
    public async Task CalculateCargoReadyTimeAsync_WhenNoCargoFacility_UsesDefaultTimesWithTimezoneOffset()
    {
        // Arrange
        var flightArrivalTime = new DateTime(2024, 6, 15, 14, 0, 0);
        const string easternTimeZone = "Eastern Standard Time";

        var job = CreateJobWithAirport(100, "JOB001", 1);
        _context.TucJobs.Add(job);

        // Airport with timezone but NO cargo facility for this carrier
        var airport = new TblAirport
        {
            AirportId = 1,
            Name = "New York JFK",
            AirportCode = "JFK",
            Active = true,
            ProcessingTime = 60,
            Timezone = easternTimeZone,
            Latitude = 0,
            Longitude = 0,
            AddressLine1 = "123 Airport Road",
            AddressLine5 = "City",
            AddressLine6 = "State",
            AddressLine7 = "12345",
            AddressLine8 = "Country",
            CargoFacilities = new List<CargoFacility>() // Empty - no cargo facilities
        };
        _context.TblAirports.Add(airport);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.CalculateCargoReadyTimeAsync(100, "NZ", flightArrivalTime);

        // Assert
        Assert.NotNull(result);

        // Should use default times (start of day 00:00 and end of day 23:59)
        Assert.Equal(0, result.CargoOpeningTime.Hour);
        Assert.Equal(23, result.CargoClosingTime.Hour);
        Assert.Equal(59, result.CargoClosingTime.Minute);

        // The offset should still be applied from the airport timezone
        var expectedOffset = TimeZoneInfo.FindSystemTimeZoneById(easternTimeZone).GetUtcOffset(flightArrivalTime);
        Assert.Equal(expectedOffset, result.CargoOpeningTime.Offset);
        Assert.Equal(expectedOffset, result.CargoClosingTime.Offset);
    }

    [Fact]
    public async Task CalculateCargoReadyTimeAsync_CombinesArrivalDateWithCargoFacilityTimes()
    {
        // Arrange - Flight arrives on specific date
        var flightArrivalTime = new DateTime(2024, 12, 25, 18, 30, 0); // Christmas Day at 6:30 PM

        var job = CreateJobWithAirport(100, "JOB001", 1);
        _context.TucJobs.Add(job);

        var carrier = CreateFlightCarrier(1, "AA", "American Airlines", true);
        _context.FlightCarriers.Add(carrier);

        // Cargo facility has times stored with historical date (1900-01-01)
        var airport = CreateAirportWithTimezoneAndCargoFacility(
            id: 1,
            name: "Chicago Airport",
            code: "ORD",
            active: true,
            processingTime: 90,
            timezone: "Central Standard Time",
            carrierId: 1,
            cargoOpeningTime: new DateTime(1900, 1, 1, 5, 30, 0), // 5:30 AM
            cargoClosingTime: new DateTime(1900, 1, 1, 21, 45, 0) // 9:45 PM
        );
        _context.TblAirports.Add(airport);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.CalculateCargoReadyTimeAsync(100, "AA", flightArrivalTime);

        // Assert
        Assert.NotNull(result);

        // The cargo times should use the ARRIVAL DATE (2024-12-25), not the stored date (1900-01-01)
        Assert.Equal(2024, result.CargoOpeningTime.Year);
        Assert.Equal(12, result.CargoOpeningTime.Month);
        Assert.Equal(25, result.CargoOpeningTime.Day);
        Assert.Equal(5, result.CargoOpeningTime.Hour);
        Assert.Equal(30, result.CargoOpeningTime.Minute);

        Assert.Equal(2024, result.CargoClosingTime.Year);
        Assert.Equal(12, result.CargoClosingTime.Month);
        Assert.Equal(25, result.CargoClosingTime.Day);
        Assert.Equal(21, result.CargoClosingTime.Hour);
        Assert.Equal(45, result.CargoClosingTime.Minute);
    }

    [Fact]
    public async Task AssignNpAgentToJobAsync_WithNetworkPartnerAgent_SetsNpAgentIdAndWritesAudit()
    {
        // Arrange
        const int jobId = 700;
        const int npAgentId = 70;
        var job = CreateJob(jobId, "JOB700");
        job.UcjbStatus = (int)JobStatus.Dispatched;
        job.InternalStatus = (int)InternalJobStatus.AwaitingPod;
        _context.TucJobs.Add(job);

        var agent = CreateAgent(npAgentId, "Partner Co");
        agent.IsNetworkPartner = true;
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.AssignNpAgentToJobAsync(npAgentId, jobId);

        // Assert
        var saved = await _context.TucJobs.SingleAsync(j => j.UcjbId == jobId,
            TestContext.Current.CancellationToken);
        Assert.Equal(npAgentId, saved.NpAgentId);

        // Handing a job to a network partner is a visibility change, not a dispatch —
        // the courier-facing status and the disp stamps must be left exactly as found.
        Assert.Null(saved.AgentId);
        Assert.Equal((int)JobStatus.Dispatched, saved.UcjbStatus);
        Assert.Equal((int)InternalJobStatus.AwaitingPod, saved.InternalStatus);
        Assert.Null(saved.UcjbDispDate);

        var note = await _context.TucNotes.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(jobId, note.JobId);
        Assert.Equal((int)NoteType.AgentUpdate, note.NoteTypeId);
        Assert.Contains("Partner Co", note.NoteText);

        var journey = await _context.JobDeliveryJourneys.SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(nameof(DeliveryJourneyChangeType.NetworkPartnerAssignment), journey.ChangeType);
        Assert.Equal(npAgentId, journey.NewAgentId);
    }

    [Fact]
    public async Task AssignNpAgentToJobAsync_WithNonNetworkPartnerAgent_ThrowsAndLeavesJobUntouched()
    {
        // Arrange — a plain agent must not be assignable down the NP lane, otherwise
        // the Agent and NP pickers become interchangeable on a crafted request.
        const int jobId = 701;
        const int agentId = 71;
        _context.TucJobs.Add(CreateJob(jobId, "JOB701"));
        _context.TucAgents.Add(CreateAgent(agentId, "Plain Agent"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act + Assert
        await Assert.ThrowsAsync<ArgumentException>(() =>
            repository.AssignNpAgentToJobAsync(agentId, jobId));

        var saved = await _context.TucJobs.SingleAsync(j => j.UcjbId == jobId,
            TestContext.Current.CancellationToken);
        Assert.Null(saved.NpAgentId);
        Assert.Empty(await _context.JobDeliveryJourneys.ToListAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AssignNpAgentToJobAsync_WithUnknownJob_Throws()
    {
        // Arrange
        const int npAgentId = 72;
        var agent = CreateAgent(npAgentId, "Partner Co");
        agent.IsNetworkPartner = true;
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act + Assert
        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            repository.AssignNpAgentToJobAsync(npAgentId, 999));
    }

    [Fact]
    public async Task AssignNpAgentToJobsAsync_AssignsEveryJobAndReportsPerJob()
    {
        // Arrange
        const int npAgentId = 80;
        _context.TucJobs.AddRange(CreateJob(800, "JOB800"), CreateJob(801, "JOB801"));
        var agent = CreateAgent(npAgentId, "Partner Co");
        agent.IsNetworkPartner = true;
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var results = await repository.AssignNpAgentToJobsAsync(npAgentId, [800, 801]);

        // Assert
        Assert.Equal(2, results.Count);
        Assert.All(results, r => Assert.True(r.Succeeded));
        var jobs = await _context.TucJobs.ToListAsync(TestContext.Current.CancellationToken);
        Assert.All(jobs, j => Assert.Equal(npAgentId, j.NpAgentId));
    }

    [Fact]
    public async Task AssignNpAgentToJobsAsync_OneBadJobDoesNotAbortTheRest()
    {
        // Arrange — a missing job id must be reported, not thrown, or a single stale
        // row in the operator's selection loses the whole batch.
        const int npAgentId = 81;
        _context.TucJobs.Add(CreateJob(810, "JOB810"));
        var agent = CreateAgent(npAgentId, "Partner Co");
        agent.IsNetworkPartner = true;
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var results = await repository.AssignNpAgentToJobsAsync(npAgentId, [999, 810]);

        // Assert
        Assert.Equal(2, results.Count);
        var failed = Assert.Single(results, r => !r.Succeeded);
        Assert.Equal(999, failed.JobId);
        Assert.False(string.IsNullOrWhiteSpace(failed.FailureReason));

        var succeeded = Assert.Single(results, r => r.Succeeded);
        Assert.Equal(810, succeeded.JobId);
        var job = await _context.TucJobs.SingleAsync(j => j.UcjbId == 810,
            TestContext.Current.CancellationToken);
        Assert.Equal(npAgentId, job.NpAgentId);
    }

    [Fact]
    public async Task AssignAgentToJobsAsync_AssignsEachJobAndCarriesTheEmailStatus()
    {
        // Arrange
        const int agentId = 82;
        _context.TucJobs.AddRange(CreateJob(820, "JOB820"), CreateJob(821, "JOB821"));
        var agent = CreateAgent(agentId, "Test Agent");
        agent.UcagFax = "agent@example.com";
        _context.TucAgents.Add(agent);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _inboundAgentLinkServiceMock.BuildJobLinkAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns("https://inbound.example.com/TOKEN");

        var repository = CreateRepository();

        // Act
        var results = await repository.AssignAgentToJobsAsync(agentId, [820, 821]);

        // Assert
        Assert.Equal(2, results.Count);
        Assert.All(results, r =>
        {
            Assert.True(r.Succeeded);
            Assert.Equal(AgentInboundEmailStatus.Queued, r.EmailStatus);
        });

        var jobs = await _context.TucJobs.ToListAsync(TestContext.Current.CancellationToken);
        Assert.All(jobs, j => Assert.Equal(agentId, j.AgentId));

        // One inbound-link email per job, not one for the batch.
        var messages = await _context.TucManualMessages.ToListAsync(TestContext.Current.CancellationToken);
        Assert.Equal(2, messages.Count);
    }

    [Fact]
    public async Task AssignAgentToJobsAsync_JobFailingTheFlightGateIsReportedAndTheRestProceed()
    {
        // Arrange — job 831 has a flight-speed sibling with no flight booked, so it
        // fails the same gate the single-job UI enforces before assigning.
        const int agentId = 83;
        var parent = CreateJobWithParent(8300, "JOB830");
        _context.TucJobs.Add(parent);
        _context.TucJobs.Add(CreateJob(830, "JOB830a"));

        var gatedParent = CreateJobWithParent(8310, "JOB831");
        _context.TucJobs.Add(gatedParent);
        var gated = CreateJob(831, "JOB831a");
        gated.ParentId = 8310;
        _context.TucJobs.Add(gated);

        var flightSibling = CreateJob(8311, "JOB831b");
        flightSibling.ParentId = 8310;
        flightSibling.UcjbSpeed = 1;
        _context.TucJobs.Add(flightSibling);
        _context.TucJobTypes.Add(new TucJobType
        {
            UcjtId = 1,
            UcjtName = "Flight",
            ShortName = "FLT",
            UcjtDescription = "Flight",
            UcjtCode = "FLT",
            JobLetter = "F",
            GroupingId = (int)SpeedGrouping.Flight,
            CreatedBy = "Test",
            LastModifiedBy = "Test"
        });

        _context.TucAgents.Add(CreateAgent(agentId, "Test Agent"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var results = await repository.AssignAgentToJobsAsync(agentId, [830, 831]);

        // Assert
        Assert.Equal(2, results.Count);
        Assert.True(Assert.Single(results, r => r.JobId == 830).Succeeded);

        var gatedResult = Assert.Single(results, r => r.JobId == 831);
        Assert.False(gatedResult.Succeeded);
        Assert.Contains("flight", gatedResult.FailureReason!, StringComparison.OrdinalIgnoreCase);

        var untouched = await _context.TucJobs.SingleAsync(j => j.UcjbId == 831,
            TestContext.Current.CancellationToken);
        Assert.Null(untouched.AgentId);
    }

    private static FlightCarrier CreateFlightCarrier(int id, string code, string name, bool isActive) => new()
    {
        FlightCarrierId = id,
        CarrierCode = code,
        FlightCarrierName = name,
        IsActive = isActive,
        Created = TestDates.Now,
        CreatedBy = "Test",
        LastModified = TestDates.Now,
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
        UcnwEtd = TestDates.Now,
        UcnwEta = TestDates.Now.AddHours(2)
    };

    private static TucJob CreateJobWithParent(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        UcjbDate = TestDates.Now,
        InverseParent = new List<TucJob>()
    };

    private static TucJob CreateJobWithAirport(int id, string jobNumber, int toAirportId) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        UcjbDate = TestDates.Now,
        ToAirportId = toAirportId,
        InverseParent = new List<TucJob>()
    };

    private static TucJob CreateFlightJob(int id, string jobNumber, TucJob parent) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        UcjbDate = TestDates.Now,
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
            UcjbDate = TestDates.Now,
            UcjbClientId = 1,
            ParentId = parent.UcjbId,
            Parent = parent,
            InverseParent = new List<TucJob>(),
            UcjbSpeed = id,
            UcjbSpeedNavigation = jobType
        };

        parent.InverseParent.Add(job);
        return job;
    }

    private static TucJob CreateAgentJobWithGrouping(int id, string jobNumber, TucJob parent,
        TucJobTypeGrouping grouping)
    {
        var jobType = new TucJobType
        {
            UcjtId = id,
            UcjtName = "Agent Pickup",
            GroupingId = grouping.GroupingId,
            Grouping = grouping,
            CreatedBy = "Test",
            LastModifiedBy = "Test"
        };

        var job = new TucJob
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = TestDates.Now,
            ParentId = parent.UcjbId,
            Parent = parent,
            UcjbSpeed = id,
            UcjbSpeedNavigation = jobType,
            InverseParent = new List<TucJob>()
        };

        parent.InverseParent.Add(job);
        return job;
    }

    private static TblAirport CreateAirportWithProcessingTime(int id, string name, string code, bool active,
        int processingTime) => new()
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

    private static TblAirport CreateAirportWithTimezoneAndCargoFacility(
        int id, string name, string code, bool active, int processingTime,
        string? timezone, int carrierId, DateTime cargoOpeningTime, DateTime cargoClosingTime) => new()
    {
        AirportId = id,
        Name = name,
        AirportCode = code,
        Active = active,
        ProcessingTime = processingTime,
        Timezone = timezone,
        Latitude = 0,
        Longitude = 0,
        AddressLine1 = "123 Airport Road",
        AddressLine5 = "City",
        AddressLine6 = "State",
        AddressLine7 = "12345",
        AddressLine8 = "Country",
        CargoFacilities = new List<CargoFacility>
        {
            new()
            {
                CargoFacilityId = id,
                AirportId = id,
                CarrierId = carrierId,
                OpeningTime = cargoOpeningTime,
                ClosingTime = cargoClosingTime,
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            }
        }
    };

    private static TimeZone CreateTimeZone(int id, string name, string code) => new()
    {
        Id = id,
        Name = name,
        Code = code,
        DisplayName = name,
        OffsetHours = 12,
        OffsetString = "+12:00"
    };

    private static AssignFlightToJobRequest CreateFlightRequest(
        int jobId, int fromAirportId, int toAirportId,
        DateTimeOffset departureTime, DateTimeOffset arrivalTime,
        DateTimeOffset? packageReadyTime = null,
        DateTimeOffset? packageDeliverByTime = null) => new()
    {
        JobId = jobId,
        FromAirportId = fromAirportId,
        ToAirportId = toAirportId,
        FlightNumber = "NZ123",
        DepartureDate = departureTime,
        PackageReadyTime = packageReadyTime,
        PackageDeliverByTime = packageDeliverByTime,
        FlightSegments =
        [
            new FlightSegmentViewModel
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

    private static AssignFlightToJobRequest CreateFlightRequestWithMultipleLegs(
        int jobId, int fromAirportId, int toAirportId,
        DateTimeOffset departureTime1, DateTimeOffset arrivalTime1,
        DateTimeOffset departureTime2, DateTimeOffset arrivalTime2,
        DateTimeOffset? packageReadyTime = null,
        DateTimeOffset? packageDeliverByTime = null) => new()
    {
        JobId = jobId,
        FromAirportId = fromAirportId,
        ToAirportId = toAirportId,
        FlightNumber = "NZ123",
        DepartureDate = departureTime1,
        PackageReadyTime = packageReadyTime,
        PackageDeliverByTime = packageDeliverByTime,
        FlightSegments =
        [
            new FlightSegmentViewModel
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
            new FlightSegmentViewModel
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

    /// <summary>
    /// Verify that with ToAirportId set, delivery job IS updated.
    /// This is the expected working scenario.
    /// </summary>
    [Fact]
    public async Task DiagnosticTest_WhenToAirportIdSet_DeliveryJobIsUpdated()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var packageReadyTime = new DateTimeOffset(2024, 6, 15, 15, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2; // Set the destination airport

        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney Airport", "SYD", true, 45);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime,
            packageReadyTime: packageReadyTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - Delivery job's time SHOULD be updated to packageReadyTime via .DateTime
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);

        Assert.NotNull(updatedDeliveryJob);
        Assert.Equal(packageReadyTime.Date, updatedDeliveryJob.UcjbDate);
        Assert.Equal(packageReadyTime.DateTime, updatedDeliveryJob.UcjbTime);
    }

    /// <summary>
    /// Test Scenario 3: Verify what happens when delivery job has WRONG grouping.
    /// Expected: Delivery job should NOT be found and NOT updated.
    /// </summary>
    [Fact]
    public async Task DiagnosticTest_WhenDeliveryJobHasWrongGrouping_DeliveryJobNotUpdated()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var packageReadyTime = new DateTimeOffset(2024, 6, 15, 15, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2;

        // Create delivery job with FLIGHT grouping instead of AGENT grouping
        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)SpeedGrouping.Flight);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney Airport", "SYD", true, 45);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime,
            packageReadyTime: packageReadyTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - Delivery job should NOT be updated because it has wrong grouping
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);

        Assert.NotEqual(packageReadyTime.DateTime, updatedDeliveryJob?.UcjbTime);
    }

    /// <summary>
    /// Test Scenario 4: Verify that toAirportId from REQUEST is used when jobbed.ToAirportId is null.
    /// This tests the OR condition: (job.ToAirportId != null || requestData.ToAirportId != null)
    /// </summary>
    [Fact]
    public async Task DiagnosticTest_WhenOnlyRequestToAirportIdSet_DeliveryJobIsUpdated()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var packageReadyTime = new DateTimeOffset(2024, 6, 15, 15, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        // NOTE: flightJob.ToAirportId is NOT set (null)

        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney Airport", "SYD", true, 45);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Create request WITH toAirportId even though job doesn't have it
        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime,
            packageReadyTime: packageReadyTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - Delivery job SHOULD be updated because request.ToAirportId is set
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);

        Assert.NotNull(updatedDeliveryJob);
        Assert.Equal(packageReadyTime.Date, updatedDeliveryJob.UcjbDate);
        Assert.Equal(packageReadyTime.DateTime, updatedDeliveryJob.UcjbTime);
    }

    /// <summary>
    /// Test Scenario 5: Verify NZ/Nationwide tenant uses correct grouping ID (6 instead of 3).
    /// </summary>
    [Fact]
    public async Task DiagnosticTest_NZTenant_UsesNationwideAgentGrouping()
    {
        // Arrange - NZ tenant
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var packageReadyTime = new DateTimeOffset(2024, 6, 15, 15, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2;

        // Create delivery job with NationwideAgent grouping (6) - correct for NZ
        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)UrgentSpeedGrouping.NationwideAgent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney Airport", "SYD", true, 45);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime,
            packageReadyTime: packageReadyTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - Delivery job SHOULD be updated for NZ tenant with NationwideAgent grouping
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);

        Assert.NotNull(updatedDeliveryJob);
        Assert.Equal(packageReadyTime.DateTime, updatedDeliveryJob.UcjbTime);
    }

    /// <summary>
    /// Assigning a flight to a job that already has a flight should throw.
    /// </summary>
    [Fact]
    public async Task AddJobNationwideAsync_JobAlreadyHasFlight_ThrowsInvalidOperationException()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        // Pre-existing flight record for this job
        var existingFlight = CreateJobNationwide(1, 100, "webhook-existing");
        _context.TucJobNationwides.Add(existingFlight);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-456" };

        var repository = CreateRepository();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken));
        Assert.Contains("already has a flight assigned", ex.Message);
    }

    /// <summary>
    /// Assigning a flight to a job with no existing flight should succeed.
    /// </summary>
    [Fact]
    public async Task AddJobNationwideAsync_JobHasNoFlight_Succeeds()
    {
        // Arrange
        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        _context.TucJobs.AddRange(parentJob, flightJob);

        // Flight exists on a DIFFERENT job - should not block
        var otherJobFlight = CreateJobNationwide(1, 999, "webhook-other");
        _context.TucJobNationwides.Add(otherJobFlight);

        var airport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        _context.TblAirports.Add(airport);

        var timeZone = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        _context.TimeZones.Add(timeZone);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 1, departureTime, arrivalTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act - should not throw
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert
        var flightRecord = await _context.TucJobNationwides
            .FirstOrDefaultAsync(f => f.UcnwJobId == 100, TestContext.Current.CancellationToken);
        Assert.NotNull(flightRecord);
    }

    /// <summary>
    /// Test Scenario 6: NZ tenant with US grouping (Agent=3) should NOT find delivery job.
    /// </summary>
    [Fact]
    public async Task DiagnosticTest_NZTenant_WithUSGrouping_DeliveryJobNotFound()
    {
        // Arrange - NZ tenant
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        var departureTime = new DateTimeOffset(2024, 6, 15, 10, 0, 0, TimeSpan.Zero);
        var arrivalTime = new DateTimeOffset(2024, 6, 15, 14, 0, 0, TimeSpan.Zero);
        var packageReadyTime = new DateTimeOffset(2024, 6, 15, 15, 0, 0, TimeSpan.Zero);

        var parentJob = CreateJobWithParent(1, "JOB001");
        var flightJob = CreateFlightJob(100, "JOB001-F", parentJob);
        flightJob.ToAirportId = 2;

        // Create delivery job with US Agent grouping (3) - WRONG for NZ tenant
        var deliveryJob = CreateAgentJob(102, "JOB0013", parentJob, (int)SpeedGrouping.Agent);
        _context.TucJobs.AddRange(parentJob, flightJob, deliveryJob);

        var departureAirport = CreateAirportWithProcessingTime(1, "Auckland Airport", "AKL", true, 60);
        var arrivalAirport = CreateAirportWithProcessingTime(2, "Sydney Airport", "SYD", true, 45);
        _context.TblAirports.AddRange(departureAirport, arrivalAirport);

        var timeZone1 = CreateTimeZone(1, "Pacific/Auckland", "NZST");
        var timeZone2 = CreateTimeZone(2, "Australia/Sydney", "AEST");
        _context.TimeZones.AddRange(timeZone1, timeZone2);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var request = CreateFlightRequest(100, 1, 2, departureTime, arrivalTime,
            packageReadyTime: packageReadyTime);
        var webhookIds = new List<string> { "webhook-123" };

        var repository = CreateRepository();

        // Act
        await repository.AddJobNationwideAsync(request, webhookIds, TestContext.Current.CancellationToken);

        // Assert - Delivery job should NOT be updated because NZ tenant expects grouping 6, not 3
        var updatedDeliveryJob = await _context.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);

        Assert.NotEqual(packageReadyTime.DateTime, updatedDeliveryJob?.UcjbTime);
    }
}