using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the Van / Truck / VanOK edit paths in JobRepository.EditOperations.
/// All three go through the ExecuteUpdateAsync (direct update) path on live tucJob rows.
/// Van and Truck are mutually exclusive — setting one clears the other.
/// </summary>
public class JobRepositoryEditVehicleTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryEditVehicleTests()
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
        Substitute.For<IJobApiClient>()
    );

    [Fact]
    public async Task UpdateJobAsync_Van_SetsVanAndClearsTruck()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 1,
                UcjbNumber = "JOB-001",
                UcjbDate = new DateTime(2024, 6, 10),
                Truck = true,
                UcjbVan = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateJobAsync(1, JobProperty.Van, "true");

        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 1, cancellationToken: TestContext.Current.CancellationToken);
        Assert.True(updated.UcjbVan);
        Assert.False(updated.Truck);
    }

    [Fact]
    public async Task UpdateJobAsync_Truck_SetsTruckAndClearsVan()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 2,
                UcjbNumber = "JOB-002",
                UcjbDate = new DateTime(2024, 6, 10),
                Truck = false,
                UcjbVan = true
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateJobAsync(2, JobProperty.Truck, "true");

        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 2, cancellationToken: TestContext.Current.CancellationToken);
        Assert.True(updated.Truck);
        Assert.False(updated.UcjbVan);
    }

    [Fact]
    public async Task UpdateJobAsync_Van_False_ClearsVanWithoutTouchingTruckSelection()
    {
        // Untoggling Van on a job that already has Truck=false should leave Truck=false
        // (it would be wrong to flip Truck=true just because Van turned off).
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 3,
                UcjbNumber = "JOB-003",
                UcjbDate = new DateTime(2024, 6, 10),
                Truck = false,
                UcjbVan = true
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateJobAsync(3, JobProperty.Van, "false");

        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 3, cancellationToken: TestContext.Current.CancellationToken);
        Assert.False(updated.UcjbVan);
        Assert.False(updated.Truck);
    }

    [Fact]
    public async Task UpdateJobAsync_VanOK_SetsVanOk()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 4,
                UcjbNumber = "JOB-004",
                UcjbDate = new DateTime(2024, 6, 10),
                VanOk = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateJobAsync(4, JobProperty.VanOK, "true");

        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 4, cancellationToken: TestContext.Current.CancellationToken);
        Assert.True(updated.VanOk);
    }
}
