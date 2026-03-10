using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the PickupArrivalTime and DeliveryArrivalTime edit paths in JobRepository.EditOperations.
/// These fields are only on live jobs (TucJob), not on archived jobs (TucJobArchive).
/// Both use the ExecuteUpdateAsync (direct update) path.
/// </summary>
public class JobRepositoryEditArrivalTimeTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<DespatchContext> _contextOptions;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly Mock<ICreateJobService> _createJobServiceMock = new();

    public JobRepositoryEditArrivalTimeTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        _connection.CreateFunction("getdate", () => DateTime.Now);
        _connection.CreateFunction("getutcdate", () => DateTime.UtcNow);

        _contextOptions = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        using var context = new DespatchContext(_contextOptions);
        context.Database.EnsureCreated();

        _contextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(_contextOptions));

        _contextFactoryMock.Setup(f => f.CreateDbContext())
            .Returns(() => new DespatchContext(_contextOptions));

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime()).Returns(DateTime.Now);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    private DespatchContext CreateContext() => new(_contextOptions);

    private JobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clearListEnvelopeServiceMock.Object,
        _createJobServiceMock.Object
    );

    #region PickupArrivalTime Tests

    [Fact]
    public async Task UpdateJobAsync_PickupArrivalTime_SetsPickupArrivalTimeOnLiveJob()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 1,
                UcjbNumber = "JOB-001",
                UcjbDate = new DateTime(2024, 6, 10),
                PickupArrivalTime = null
            });
            await context.SaveChangesAsync();
        }

        var newArrival = new DateTimeOffset(2024, 6, 10, 9, 15, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.PickupArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 1);

        updatedJob.PickupArrivalTime.Should().Be(newArrival.DateTime,
            "PickupArrivalTime should be stored as wall-clock time");
    }

    [Fact]
    public async Task UpdateJobAsync_PickupArrivalTime_OverwritesPreviousValue()
    {
        // Arrange
        var originalArrival = new DateTime(2024, 6, 10, 8, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 2,
                UcjbNumber = "JOB-002",
                UcjbDate = new DateTime(2024, 6, 10),
                PickupArrivalTime = originalArrival
            });
            await context.SaveChangesAsync();
        }

        // Use a non-zero offset to verify wall-clock extraction (10:30 PDT stored as 10:30)
        var newArrival = new DateTimeOffset(2024, 6, 10, 10, 30, 0, TimeSpan.FromHours(-7));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(2, JobProperty.PickupArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 2);

        updatedJob.PickupArrivalTime.Should().NotBe(originalArrival,
            "the old PickupArrivalTime should be overwritten");
        updatedJob.PickupArrivalTime!.Value.Hour.Should().Be(10,
            "10:30 PDT (-07:00) should be stored as wall-clock 10:30");
        updatedJob.PickupArrivalTime!.Value.Minute.Should().Be(30);
    }

    #endregion

    #region DeliveryArrivalTime Tests

    [Fact]
    public async Task UpdateJobAsync_DeliveryArrivalTime_SetsDeliveryArrivalTimeOnLiveJob()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 3,
                UcjbNumber = "JOB-003",
                UcjbDate = new DateTime(2024, 6, 10),
                DeliveryArrivalTime = null
            });
            await context.SaveChangesAsync();
        }

        var newArrival = new DateTimeOffset(2024, 6, 10, 14, 45, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(3, JobProperty.DeliveryArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 3);

        updatedJob.DeliveryArrivalTime.Should().Be(newArrival.DateTime,
            "DeliveryArrivalTime should be stored as wall-clock time");
    }

    [Fact]
    public async Task UpdateJobAsync_DeliveryArrivalTime_OverwritesPreviousValue()
    {
        // Arrange
        var originalArrival = new DateTime(2024, 6, 10, 13, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 4,
                UcjbNumber = "JOB-004",
                UcjbDate = new DateTime(2024, 6, 10),
                DeliveryArrivalTime = originalArrival
            });
            await context.SaveChangesAsync();
        }

        // Use a non-zero offset to verify wall-clock extraction (16:15 EDT stored as 16:15)
        var newArrival = new DateTimeOffset(2024, 6, 10, 16, 15, 0, TimeSpan.FromHours(-4));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(4, JobProperty.DeliveryArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 4);

        updatedJob.DeliveryArrivalTime.Should().NotBe(originalArrival,
            "the old DeliveryArrivalTime should be overwritten");
        updatedJob.DeliveryArrivalTime!.Value.Hour.Should().Be(16,
            "16:15 EDT (-04:00) should be stored as wall-clock 16:15");
        updatedJob.DeliveryArrivalTime!.Value.Minute.Should().Be(15);
    }

    #endregion

    #region Archived Job PickupArrivalTime Tests

    [Fact]
    public async Task UpdateJobAsync_PickupArrivalTime_ArchivedJob_SetsValue()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 5,
                UcjbNumber = "JOB-005",
                UcjbDate = new DateTime(2024, 6, 10),
                PickupArrivalTime = null
            });
            await context.SaveChangesAsync();
        }

        var newArrival = new DateTimeOffset(2024, 6, 10, 9, 15, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(5, JobProperty.PickupArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 5);

        updated.PickupArrivalTime.Should().Be(newArrival.DateTime,
            "archived PickupArrivalTime should be stored as wall-clock time");
    }

    [Fact]
    public async Task UpdateJobAsync_PickupArrivalTime_ArchivedJob_OverwritesPreviousValue()
    {
        // Arrange
        var originalArrival = new DateTime(2024, 6, 10, 8, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 6,
                UcjbNumber = "JOB-006",
                UcjbDate = new DateTime(2024, 6, 10),
                PickupArrivalTime = originalArrival
            });
            await context.SaveChangesAsync();
        }

        // Use a non-zero offset to verify wall-clock extraction (10:45 PDT stored as 10:45)
        var newArrival = new DateTimeOffset(2024, 6, 10, 10, 45, 0, TimeSpan.FromHours(-7));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(6, JobProperty.PickupArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 6);

        updated.PickupArrivalTime.Should().NotBe(originalArrival);
        updated.PickupArrivalTime!.Value.Hour.Should().Be(10,
            "10:45 PDT (-07:00) should be stored as wall-clock 10:45");
        updated.PickupArrivalTime!.Value.Minute.Should().Be(45);
    }

    #endregion

    #region Archived Job DeliveryArrivalTime Tests

    [Fact]
    public async Task UpdateJobAsync_DeliveryArrivalTime_ArchivedJob_SetsValue()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 7,
                UcjbNumber = "JOB-007",
                UcjbDate = new DateTime(2024, 6, 10),
                DeliveryArrivalTime = null
            });
            await context.SaveChangesAsync();
        }

        var newArrival = new DateTimeOffset(2024, 6, 10, 15, 30, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(7, JobProperty.DeliveryArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 7);

        updated.DeliveryArrivalTime.Should().Be(newArrival.DateTime,
            "archived DeliveryArrivalTime should be stored as wall-clock time");
    }

    [Fact]
    public async Task UpdateJobAsync_DeliveryArrivalTime_ArchivedJob_OverwritesPreviousValue()
    {
        // Arrange
        var originalArrival = new DateTime(2024, 6, 10, 14, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 8,
                UcjbNumber = "JOB-008",
                UcjbDate = new DateTime(2024, 6, 10),
                DeliveryArrivalTime = originalArrival
            });
            await context.SaveChangesAsync();
        }

        // Use a non-zero offset to verify wall-clock extraction (17:00 EDT stored as 17:00)
        var newArrival = new DateTimeOffset(2024, 6, 10, 17, 0, 0, TimeSpan.FromHours(-4));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(8, JobProperty.DeliveryArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 8);

        updated.DeliveryArrivalTime.Should().NotBe(originalArrival);
        updated.DeliveryArrivalTime!.Value.Hour.Should().Be(17,
            "17:00 EDT (-04:00) should be stored as wall-clock 17:00");
        updated.DeliveryArrivalTime!.Value.Minute.Should().Be(0);
    }

    #endregion
}
