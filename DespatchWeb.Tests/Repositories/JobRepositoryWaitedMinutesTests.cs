using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for deriving WaitedPickUp / WaitedDelivery from a dispatcher arrival-field edit.
/// The derivation must match SQL Server's DATEDIFF(MINUTE, start, end), which counts
/// minute boundaries crossed rather than whole elapsed minutes.
/// </summary>
public class JobRepositoryWaitedMinutesTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryWaitedMinutesTests()
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

    private JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _createJobServiceMock,
        Substitute.For<ICourierRepository>()
    );

    private async Task SeedJobAsync(TucJob job)
    {
        await using var context = _db.CreateContext();
        context.TucJobs.Add(job);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<TucJob> GetJobAsync(int jobId)
    {
        await using var context = _db.CreateContext();
        return await context.TucJobs.FirstAsync(j => j.UcjbId == jobId,
            cancellationToken: TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task UpdateWaitedMinutesFromArrivalAsync_PickupArrival_StoresMinutesUntilPickup()
    {
        await SeedJobAsync(new TucJob
        {
            UcjbId = 1,
            UcjbNumber = "JOB-001",
            UcjbDate = new DateTime(2024, 6, 10),
            PickupArrivalTime = new DateTime(2024, 6, 10, 9, 0, 0),
            PickUpTime = new DateTime(2024, 6, 10, 9, 30, 0)
        });

        var derived = await CreateRepository()
            .UpdateWaitedMinutesFromArrivalAsync(1, JobProperty.PickupArrivalTime);

        Assert.Equal(30, derived);
        Assert.Equal(30, (await GetJobAsync(1)).WaitedPickUp);
    }

    [Fact]
    public async Task UpdateWaitedMinutesFromArrivalAsync_DeliveryArrival_StoresMinutesUntilCompletion()
    {
        await SeedJobAsync(new TucJob
        {
            UcjbId = 2,
            UcjbNumber = "JOB-002",
            UcjbDate = new DateTime(2024, 6, 10),
            DeliveryArrivalTime = new DateTime(2024, 6, 10, 14, 5, 0),
            UcjbComplTime = new DateTime(2024, 6, 10, 14, 50, 0)
        });

        var derived = await CreateRepository()
            .UpdateWaitedMinutesFromArrivalAsync(2, JobProperty.DeliveryArrivalTime);

        Assert.Equal(45, derived);
        Assert.Equal(45, (await GetJobAsync(2)).WaitedDelivery);
    }

    [Fact]
    public async Task UpdateWaitedMinutesFromArrivalAsync_PickupArrivalAfterPickup_ClampsToZero()
    {
        await SeedJobAsync(new TucJob
        {
            UcjbId = 3,
            UcjbNumber = "JOB-003",
            UcjbDate = new DateTime(2024, 6, 10),
            PickupArrivalTime = new DateTime(2024, 6, 10, 9, 45, 0),
            PickUpTime = new DateTime(2024, 6, 10, 9, 30, 0)
        });

        var derived = await CreateRepository()
            .UpdateWaitedMinutesFromArrivalAsync(3, JobProperty.PickupArrivalTime);

        Assert.Equal(0, derived);
        Assert.Equal(0, (await GetJobAsync(3)).WaitedPickUp);
    }

    [Fact]
    public async Task UpdateWaitedMinutesFromArrivalAsync_CountsMinuteBoundariesLikeSqlDateDiff()
    {
        // SQL Server DATEDIFF(MINUTE, '09:00:59', '09:01:00') is 1, not 0 — it counts the
        // boundary crossed, it does not measure elapsed time.
        await SeedJobAsync(new TucJob
        {
            UcjbId = 4,
            UcjbNumber = "JOB-004",
            UcjbDate = new DateTime(2024, 6, 10),
            PickupArrivalTime = new DateTime(2024, 6, 10, 9, 0, 59),
            PickUpTime = new DateTime(2024, 6, 10, 9, 1, 0)
        });

        var derived = await CreateRepository()
            .UpdateWaitedMinutesFromArrivalAsync(4, JobProperty.PickupArrivalTime);

        Assert.Equal(1, derived);
    }

    [Fact]
    public async Task UpdateWaitedMinutesFromArrivalAsync_MissingPickupTime_LeavesWaitedPickUpUntouched()
    {
        await SeedJobAsync(new TucJob
        {
            UcjbId = 5,
            UcjbNumber = "JOB-005",
            UcjbDate = new DateTime(2024, 6, 10),
            PickupArrivalTime = new DateTime(2024, 6, 10, 9, 0, 0),
            PickUpTime = null,
            WaitedPickUp = null
        });

        var derived = await CreateRepository()
            .UpdateWaitedMinutesFromArrivalAsync(5, JobProperty.PickupArrivalTime);

        Assert.Null(derived);
        Assert.Null((await GetJobAsync(5)).WaitedPickUp);
    }

    [Fact]
    public async Task UpdateWaitedMinutesFromArrivalAsync_MissingCompletionTime_LeavesWaitedDeliveryUntouched()
    {
        await SeedJobAsync(new TucJob
        {
            UcjbId = 6,
            UcjbNumber = "JOB-006",
            UcjbDate = new DateTime(2024, 6, 10),
            DeliveryArrivalTime = new DateTime(2024, 6, 10, 14, 0, 0),
            UcjbComplTime = null,
            WaitedDelivery = 12
        });

        var derived = await CreateRepository()
            .UpdateWaitedMinutesFromArrivalAsync(6, JobProperty.DeliveryArrivalTime);

        Assert.Null(derived);
        Assert.Equal(12, (await GetJobAsync(6)).WaitedDelivery);
    }

    [Fact]
    public async Task UpdateWaitedMinutesFromArrivalAsync_PickupEdit_DoesNotTouchWaitedDelivery()
    {
        await SeedJobAsync(new TucJob
        {
            UcjbId = 7,
            UcjbNumber = "JOB-007",
            UcjbDate = new DateTime(2024, 6, 10),
            PickupArrivalTime = new DateTime(2024, 6, 10, 9, 0, 0),
            PickUpTime = new DateTime(2024, 6, 10, 9, 20, 0),
            DeliveryArrivalTime = new DateTime(2024, 6, 10, 14, 0, 0),
            UcjbComplTime = new DateTime(2024, 6, 10, 14, 40, 0),
            WaitedDelivery = null
        });

        await CreateRepository().UpdateWaitedMinutesFromArrivalAsync(7, JobProperty.PickupArrivalTime);

        var job = await GetJobAsync(7);
        Assert.Equal(20, job.WaitedPickUp);
        Assert.Null(job.WaitedDelivery);
    }

    [Fact]
    public async Task UpdateWaitedMinutesFromArrivalAsync_NonArrivalProperty_DerivesNothing()
    {
        await SeedJobAsync(new TucJob
        {
            UcjbId = 8,
            UcjbNumber = "JOB-008",
            UcjbDate = new DateTime(2024, 6, 10),
            PickupArrivalTime = new DateTime(2024, 6, 10, 9, 0, 0),
            PickUpTime = new DateTime(2024, 6, 10, 9, 30, 0)
        });

        var derived = await CreateRepository().UpdateWaitedMinutesFromArrivalAsync(8, JobProperty.RefA);

        Assert.Null(derived);
        Assert.Null((await GetJobAsync(8)).WaitedPickUp);
    }

    [Fact]
    public async Task UpdateWaitedMinutesFromArrivalAsync_UnknownJob_DerivesNothing()
    {
        var derived = await CreateRepository()
            .UpdateWaitedMinutesFromArrivalAsync(999, JobProperty.PickupArrivalTime);

        Assert.Null(derived);
    }
}
