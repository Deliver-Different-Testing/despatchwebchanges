using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the PickupArrivalTime and DeliveryArrivalTime edit paths in JobRepository.EditOperations.
/// These fields are only on live jobs (TucJob), not on archived jobs (TucJobArchive).
/// Both use the ExecuteUpdateAsync (direct update) path.
/// </summary>
public class JobRepositoryEditArrivalTimeTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryEditArrivalTimeTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DespatchContext CreateContext() => _db.CreateContext();

    private JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _createJobServiceMock,
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
    );

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
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var newArrival = new DateTimeOffset(2024, 6, 10, 9, 15, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.PickupArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 1, cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(newArrival.DateTime, updatedJob.PickupArrivalTime); // PickupArrivalTime should be stored as wall-clock time
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
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Use a non-zero offset to verify wall-clock extraction (10:30 PDT stored as 10:30)
        var newArrival = new DateTimeOffset(2024, 6, 10, 10, 30, 0, TimeSpan.FromHours(-7));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(2, JobProperty.PickupArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 2, cancellationToken: TestContext.Current.CancellationToken);

        Assert.NotEqual(originalArrival, updatedJob.PickupArrivalTime); // the old PickupArrivalTime should be overwritten
        Assert.Equal(10, updatedJob.PickupArrivalTime!.Value.Hour); // 10:30 PDT (-07:00) should be stored as wall-clock 10:30
        Assert.Equal(30, updatedJob.PickupArrivalTime!.Value.Minute);
    }

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
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var newArrival = new DateTimeOffset(2024, 6, 10, 14, 45, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(3, JobProperty.DeliveryArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 3, cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(newArrival.DateTime, updatedJob.DeliveryArrivalTime); // DeliveryArrivalTime should be stored as wall-clock time
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
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Use a non-zero offset to verify wall-clock extraction (16:15 EDT stored as 16:15)
        var newArrival = new DateTimeOffset(2024, 6, 10, 16, 15, 0, TimeSpan.FromHours(-4));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(4, JobProperty.DeliveryArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 4, cancellationToken: TestContext.Current.CancellationToken);

        Assert.NotEqual(originalArrival, updatedJob.DeliveryArrivalTime); // the old DeliveryArrivalTime should be overwritten
        Assert.Equal(16, updatedJob.DeliveryArrivalTime!.Value.Hour); // 16:15 EDT (-04:00) should be stored as wall-clock 16:15
        Assert.Equal(15, updatedJob.DeliveryArrivalTime!.Value.Minute);
    }

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
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var newArrival = new DateTimeOffset(2024, 6, 10, 9, 15, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(5, JobProperty.PickupArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 5, cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(newArrival.DateTime, updated.PickupArrivalTime); // archived PickupArrivalTime should be stored as wall-clock time
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
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Use a non-zero offset to verify wall-clock extraction (10:45 PDT stored as 10:45)
        var newArrival = new DateTimeOffset(2024, 6, 10, 10, 45, 0, TimeSpan.FromHours(-7));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(6, JobProperty.PickupArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 6, cancellationToken: TestContext.Current.CancellationToken);

        Assert.NotEqual(originalArrival, updated.PickupArrivalTime);
        Assert.Equal(10, updated.PickupArrivalTime!.Value.Hour); // 10:45 PDT (-07:00) should be stored as wall-clock 10:45
        Assert.Equal(45, updated.PickupArrivalTime!.Value.Minute);
    }

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
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var newArrival = new DateTimeOffset(2024, 6, 10, 15, 30, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(7, JobProperty.DeliveryArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 7, cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(newArrival.DateTime, updated.DeliveryArrivalTime); // archived DeliveryArrivalTime should be stored as wall-clock time
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
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Use a non-zero offset to verify wall-clock extraction (17:00 EDT stored as 17:00)
        var newArrival = new DateTimeOffset(2024, 6, 10, 17, 0, 0, TimeSpan.FromHours(-4));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(8, JobProperty.DeliveryArrivalTime, newArrival.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 8, cancellationToken: TestContext.Current.CancellationToken);

        Assert.NotEqual(originalArrival, updated.DeliveryArrivalTime);
        Assert.Equal(17, updated.DeliveryArrivalTime!.Value.Hour); // 17:00 EDT (-04:00) should be stored as wall-clock 17:00
        Assert.Equal(0, updated.DeliveryArrivalTime!.Value.Minute);
    }

}
