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
    public async Task UpdateJobAsync_Size_OnParent_PropagatesToAllChildren()
    {
        // Multi-leg job (Urgent / non-US tenant): editing the parent's vehicle should
        // fan out to every child leg. Regression for the bug where flipping the parent
        // from van -> truck left the children on van.
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                new TucJob
                {
                    UcjbId = 10,
                    UcjbNumber = "PARENT",
                    UcjbDate = new DateTime(2024, 6, 10),
                    UcjbSize = (int)UrgentVehicleType.Van,
                    UcjbVan = true,
                    Truck = false
                },
                new TucJob
                {
                    UcjbId = 11,
                    UcjbNumber = "CHILD-1",
                    UcjbDate = new DateTime(2024, 6, 10),
                    UcjbSize = (int)UrgentVehicleType.Van,
                    UcjbVan = true,
                    Truck = false,
                    ParentId = 10
                },
                new TucJob
                {
                    UcjbId = 12,
                    UcjbNumber = "CHILD-2",
                    UcjbDate = new DateTime(2024, 6, 10),
                    UcjbSize = (int)UrgentVehicleType.Van,
                    UcjbVan = true,
                    Truck = false,
                    ParentId = 10
                });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateJobAsync(10, JobProperty.Size, ((int)UrgentVehicleType.Truck).ToString());

        await using var verifyContext = CreateContext();
        var jobs = await verifyContext.TucJobs
            .Where(j => j.UcjbId == 10 || j.UcjbId == 11 || j.UcjbId == 12)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.All(jobs, j =>
        {
            Assert.Equal((int)UrgentVehicleType.Truck, j.UcjbSize);
            Assert.True(j.Truck);
            Assert.False(j.UcjbVan);
        });
    }

    [Fact]
    public async Task UpdateJobAsync_Size_OnChild_PropagatesToParentAndSiblings()
    {
        // Editing any leg of a multi-leg job should sync every other leg (matches Weight semantics).
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                new TucJob
                {
                    UcjbId = 20,
                    UcjbNumber = "PARENT",
                    UcjbDate = new DateTime(2024, 6, 10),
                    UcjbSize = (int)UrgentVehicleType.Van,
                    UcjbVan = true,
                    Truck = false
                },
                new TucJob
                {
                    UcjbId = 21,
                    UcjbNumber = "CHILD-A",
                    UcjbDate = new DateTime(2024, 6, 10),
                    UcjbSize = (int)UrgentVehicleType.Van,
                    UcjbVan = true,
                    Truck = false,
                    ParentId = 20
                },
                new TucJob
                {
                    UcjbId = 22,
                    UcjbNumber = "CHILD-B",
                    UcjbDate = new DateTime(2024, 6, 10),
                    UcjbSize = (int)UrgentVehicleType.Van,
                    UcjbVan = true,
                    Truck = false,
                    ParentId = 20
                });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Edit the child — parent and the other sibling should follow.
        await repository.UpdateJobAsync(21, JobProperty.Size, ((int)UrgentVehicleType.Truck).ToString());

        await using var verifyContext = CreateContext();
        var jobs = await verifyContext.TucJobs
            .Where(j => j.UcjbId == 20 || j.UcjbId == 21 || j.UcjbId == 22)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.All(jobs, j =>
        {
            Assert.Equal((int)UrgentVehicleType.Truck, j.UcjbSize);
            Assert.True(j.Truck);
            Assert.False(j.UcjbVan);
        });
    }

    [Fact]
    public async Task UpdateJobAsync_Size_SingleJob_UpdatesOnlyThatJob()
    {
        // Sanity check that a standalone job (no parent/children) still updates correctly.
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 30,
                UcjbNumber = "SOLO",
                UcjbDate = new DateTime(2024, 6, 10),
                UcjbSize = (int)UrgentVehicleType.Van,
                UcjbVan = true,
                Truck = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateJobAsync(30, JobProperty.Size, ((int)UrgentVehicleType.Truck).ToString());

        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 30, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((int)UrgentVehicleType.Truck, updated.UcjbSize);
        Assert.True(updated.Truck);
        Assert.False(updated.UcjbVan);
    }

    [Fact]
    public async Task UpdateJobAsync_Size_NonUsTenant_CarDoesNotFlipTruckFlag()
    {
        // Regression: VehicleType.Truck (id=2) collides with UrgentVehicleType.Car (id=2).
        // On a non-US tenant, picking Car must NOT flip Truck=true. Prior to the fix the
        // switch OR'd both enums and "Car" landed as a Truck.
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 40,
                UcjbNumber = "JOB-040",
                UcjbDate = new DateTime(2024, 6, 10),
                UcjbSize = (int)UrgentVehicleType.Van,
                UcjbVan = true,
                Truck = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateJobAsync(40, JobProperty.Size, ((int)UrgentVehicleType.Car).ToString());

        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 40, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((int)UrgentVehicleType.Car, updated.UcjbSize);
        Assert.False(updated.Truck);
        // Van flag preserved from before the size change (Car isn't a Van either,
        // and we deliberately don't clear non-matched flags).
        Assert.True(updated.UcjbVan);
    }

    [Fact]
    public async Task UpdateJobAsync_Size_NonUsTenant_BikeDoesNotFlipVanFlag()
    {
        // Regression: VehicleType.Van (id=1) collides with UrgentVehicleType.Bike (id=1).
        // On a non-US tenant, picking Bike must NOT flip UcjbVan=true.
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 41,
                UcjbNumber = "JOB-041",
                UcjbDate = new DateTime(2024, 6, 10),
                UcjbSize = (int)UrgentVehicleType.Truck,
                UcjbVan = false,
                Truck = true
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateJobAsync(41, JobProperty.Size, ((int)UrgentVehicleType.Bike).ToString());

        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 41, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((int)UrgentVehicleType.Bike, updated.UcjbSize);
        Assert.False(updated.UcjbVan);
        // Bike isn't a Truck either - prior Truck flag is left as-is.
        Assert.True(updated.Truck);
    }

    [Fact]
    public async Task UpdateJobAsync_Size_UsTenant_Van_SetsVanFlag()
    {
        // US tenant uses VehicleType: Van=1, Truck=2. Confirms the gate picks the US enum
        // so id=1 is treated as Van.
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 50,
                UcjbNumber = "JOB-050",
                UcjbDate = new DateTime(2024, 6, 10),
                UcjbSize = (int)VehicleType.Truck,
                UcjbVan = false,
                Truck = true
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateJobAsync(50, JobProperty.Size, ((int)VehicleType.Van).ToString());

        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 50, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((int)VehicleType.Van, updated.UcjbSize);
        Assert.True(updated.UcjbVan);
        Assert.False(updated.Truck);
    }

    [Fact]
    public async Task UpdateJobAsync_Size_UsTenant_Truck_SetsTruckFlag()
    {
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 51,
                UcjbNumber = "JOB-051",
                UcjbDate = new DateTime(2024, 6, 10),
                UcjbSize = (int)VehicleType.Van,
                UcjbVan = true,
                Truck = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateJobAsync(51, JobProperty.Size, ((int)VehicleType.Truck).ToString());

        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 51, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((int)VehicleType.Truck, updated.UcjbSize);
        Assert.True(updated.Truck);
        Assert.False(updated.UcjbVan);
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
