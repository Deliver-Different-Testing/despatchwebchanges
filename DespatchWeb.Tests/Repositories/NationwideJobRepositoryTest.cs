using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models.FlightStats;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MockQueryable.FakeItEasy;
using Moq;
using NUnit.Framework;

namespace DespatchWeb.Tests.Repositories;

[TestFixture]
[TestOf(typeof(NationwideJobRepository))]
public class NationwideJobRepositoryTest
{
    [SetUp]
    public void Setup()
    {
        _contextMock = new Mock<DespatchContext>();
        _loggerMock = new Mock<ILogger<NationwideJobRepository>>();
        _jobsDbSetMock = new Mock<DbSet<TucJob>>();
        _nationwideDbSetMock = new Mock<DbSet<TucJobNationwide>>();
        _repository = new NationwideJobRepository(_contextMock.Object, _loggerMock.Object);
    }

    [TearDown]
    public void Cleanup()
    {
        _contextMock = null;
        _loggerMock = null;
        _jobsDbSetMock = null;
        _nationwideDbSetMock = null;
        _repository = null;
    }

    private Mock<DespatchContext> _contextMock;
    private Mock<ILogger<NationwideJobRepository>> _loggerMock;
    private Mock<DbSet<TucJob>> _jobsDbSetMock;
    private Mock<DbSet<TucJobNationwide>> _nationwideDbSetMock;
    private NationwideJobRepository _repository;


    private void SetupMockContext(List<TucJob> jobs)
    {
        var jobsQueryable = jobs.AsQueryable().BuildMockDbSet();
        _contextMock.Setup(c => c.TucJobs).Returns(jobsQueryable);

        var nationwideJobs = new List<TucJobNationwide>().AsQueryable().BuildMockDbSet();
        _contextMock.Setup(c => c.TucJobNationwides).Returns(nationwideJobs);
    }

    [Test]
    public async Task AddJobNationwideAsync_ValidInput_ReturnsTrue()
    {
        // Arrange
        var existingJob = new TucJob
        {
            UcjbId = 1,
            UcjbNumber = "TEST123",
            UcjbClientId = 100
        };

        SetupMockContext(new List<TucJob> { existingJob });

        TucJobNationwide capturedNationwideJob = null;
        _contextMock.Setup(c => c.TucJobNationwides.Add(It.IsAny<TucJobNationwide>()))
            .Callback<TucJobNationwide>(job => capturedNationwideJob = job);

        var flight = new ScheduledFlight
        {
            CarrierFsCode = "BA",
            FlightNumber = "123",
            DepartureTime = DateTime.UtcNow.AddHours(2),
            ArrivalTime = DateTime.UtcNow.AddHours(4)
        };

        // Act
        var result = await _repository.AddJobNationwideAsync(1, flight, "webhook123");

        // Assert
        Assert.Multiple(() =>
        {
            Assert.That(result, Is.True);
            Assert.That(capturedNationwideJob, Is.Not.Null);
            Assert.That(capturedNationwideJob.UcnwJobId, Is.EqualTo(1));
            Assert.That(capturedNationwideJob.UcnwJobNumber, Is.EqualTo("TEST123"));
            Assert.That(capturedNationwideJob.UcnwClientId, Is.EqualTo(100));
            Assert.That(capturedNationwideJob.UcnwFlightNo, Is.EqualTo("BA123"));
            Assert.That(capturedNationwideJob.WebhookAlertId, Is.EqualTo("webhook123"));
            Assert.That(capturedNationwideJob.UcnwEtd, Is.EqualTo(flight.DepartureTime));
            Assert.That(capturedNationwideJob.UcnwEta, Is.EqualTo(flight.ArrivalTime));
        });

        _contextMock.Verify(c => c.SaveChangesAsync(default), Times.Once);
    }

    [Test]
    public void AddJobNationwideAsync_JobNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        SetupMockContext(new List<TucJob>());

        var flight = new ScheduledFlight
        {
            CarrierFsCode = "BA",
            FlightNumber = "123",
            DepartureTime = DateTime.UtcNow.AddHours(2),
            ArrivalTime = DateTime.UtcNow.AddHours(4)
        };

        // Act & Assert
        var exception = Assert.ThrowsAsync<KeyNotFoundException>(async () =>
            await _repository.AddJobNationwideAsync(999, flight, "webhook123"));

        Assert.That(exception.Message, Is.EqualTo("Job with ID 999 not found."));
        _contextMock.Verify(c => c.SaveChangesAsync(default), Times.Never);
    }

    [TestCase(0)]
    [TestCase(-1)]
    public void AddJobNationwideAsync_InvalidJobId_ThrowsArgumentException(int jobId)
    {
        // Arrange
        SetupMockContext(new List<TucJob>());

        var flight = new ScheduledFlight
        {
            CarrierFsCode = "BA",
            FlightNumber = "123",
            DepartureTime = DateTime.UtcNow.AddHours(2),
            ArrivalTime = DateTime.UtcNow.AddHours(4)
        };

        // Act & Assert
        var exception = Assert.ThrowsAsync<ArgumentException>(async () =>
            await _repository.AddJobNationwideAsync(jobId, flight, "webhook123"));

        Assert.That(exception.Message, Is.EqualTo("Job ID must be greater than zero. (Parameter 'jobId')"));
        _contextMock.Verify(c => c.SaveChangesAsync(default), Times.Never);
    }

    [Test]
    public void AddJobNationwideAsync_NullFlight_ThrowsArgumentNullException()
    {
        // Arrange
        SetupMockContext(new List<TucJob>());

        // Act & Assert
        var exception = Assert.ThrowsAsync<ArgumentNullException>(async () =>
            await _repository.AddJobNationwideAsync(1, null, "webhook123"));

        Assert.That(exception.Message, Is.EqualTo("Flight information cannot be null. (Parameter 'flight')"));
        _contextMock.Verify(c => c.SaveChangesAsync(default), Times.Never);
    }

    [TestCase(null, "123")]
    [TestCase("BA", null)]
    [TestCase(null, null)]
    [TestCase("", "")]
    [TestCase(" ", " ")]
    public void AddJobNationwideAsync_InvalidFlightDetails_ThrowsArgumentException(
        string carrierCode, string flightNumber)
    {
        // Arrange
        SetupMockContext(new List<TucJob>());

        var flight = new ScheduledFlight
        {
            CarrierFsCode = carrierCode,
            FlightNumber = flightNumber,
            DepartureTime = DateTime.UtcNow.AddHours(2),
            ArrivalTime = DateTime.UtcNow.AddHours(4)
        };

        // Act & Assert
        var exception = Assert.ThrowsAsync<ArgumentException>(async () =>
            await _repository.AddJobNationwideAsync(1, flight, "webhook123"));

        Assert.That(exception.Message,
            Is.EqualTo("Flight carrier code and number must be provided. (Parameter 'flight')"));
        _contextMock.Verify(c => c.SaveChangesAsync(default), Times.Never);
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase(" ")]
    public void AddJobNationwideAsync_InvalidWebhookAlertId_ThrowsArgumentException(
        string webhookAlertId)
    {
        // Arrange
        SetupMockContext(new List<TucJob>());

        var flight = new ScheduledFlight
        {
            CarrierFsCode = "BA",
            FlightNumber = "123",
            DepartureTime = DateTime.UtcNow.AddHours(2),
            ArrivalTime = DateTime.UtcNow.AddHours(4)
        };

        // Act & Assert
        var exception = Assert.ThrowsAsync<ArgumentException>(async () =>
            await _repository.AddJobNationwideAsync(1, flight, webhookAlertId));

        Assert.That(exception.Message, Is.EqualTo("Webhook alert ID cannot be empty. (Parameter 'webhookAlertId')"));
        _contextMock.Verify(c => c.SaveChangesAsync(default), Times.Never);
    }

    [Test]
    public async Task AddJobNationwideAsync_VerifyJobStatusUpdate()
    {
        // Arrange
        var existingJob = new TucJob
        {
            UcjbId = 1,
            UcjbNumber = "TEST123",
            UcjbClientId = 100,
            InternalStatus = (int)InternalJobStatus.NewJobs
        };

        SetupMockContext(new List<TucJob> { existingJob });

        var flight = new ScheduledFlight
        {
            CarrierFsCode = "BA",
            FlightNumber = "123",
            DepartureTime = DateTime.UtcNow.AddHours(2),
            ArrivalTime = DateTime.UtcNow.AddHours(4)
        };

        // Act
        await _repository.AddJobNationwideAsync(1, flight, "webhook123");

        // Assert
        Assert.Multiple(() =>
        {
            Assert.That(existingJob.InternalStatus, Is.EqualTo((int)InternalJobStatus.AwaitingPod));
            _contextMock.Verify(c => c.SaveChangesAsync(default), Times.Once);
        });
    }
}
