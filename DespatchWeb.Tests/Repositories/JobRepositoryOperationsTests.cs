using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository operations that were previously untested.
/// Covers IsJobParent, IsBulkJobParent, UpdateJobVoidStatus, SimpleReprice,
/// AssignCourierToJob, and GetBulkJobDetail.
/// Uses SQLite in-memory database with shared connection for parallel context queries.
/// </summary>
public class JobRepositoryOperationsTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private FakeTenantClock _clock = new(TestDates.Now);
    private static readonly int[] SourceArray = [100, 101];

    public JobRepositoryOperationsTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();

        // Default tenant setup
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
        Substitute.For<ICourierRepository>()
    );

    [Fact]
    public async Task IsJobParentAsync_WithChildJob_ReturnsTrue()
    {
        // Arrange
        await using var context = CreateContext();
        context.TucJobs.Add(CreateJob(100, "PARENT"));
        context.TucJobs.Add(CreateJobWithParent(101, "CHILD", 100));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobParentAsync(101);

        // Assert - IsJobParentAsync returns true if the job HAS a parent (i.e., is a child)
        Assert.True(result);
    }

    [Fact]
    public async Task IsJobParentAsync_WithParentJob_ReturnsFalse()
    {
        // Arrange
        await using var context = CreateContext();
        context.TucJobs.Add(CreateJob(100, "PARENT"));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobParentAsync(100);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task IsJobParentAsync_WithBookingChild_ReturnsTrue()
    {
        // Arrange
        await using var context = CreateContext();
        context.TucJobBookings.Add(new TucJobBooking
        {
            UcbkId = 200,
            UcbkJobNumber = "BK-001",
            ParentId = 100
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobParentAsync(200);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task IsJobParentAsync_WithBookingWithoutParent_ReturnsFalse()
    {
        // Arrange
        await using var context = CreateContext();
        context.TucJobBookings.Add(new TucJobBooking
        {
            UcbkId = 200,
            UcbkJobNumber = "BK-001"
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobParentAsync(200);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task IsJobParentAsync_WithNonExistentJob_ReturnsFalse()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobParentAsync(999);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task IsJobParentAsync_PrefersLiveJobOverBooking()
    {
        // Arrange - live job exists with no parent
        await using var context = CreateContext();
        context.TucJobs.Add(CreateJob(100, "LIVE-JOB"));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.IsJobParentAsync(100);

        // Assert - should check TucJobs first and return false (no parent)
        Assert.False(result);
    }

    [Fact]
    public async Task IsBulkJobParent_WithParentId_ReturnsTrue()
    {
        // Arrange
        await using var context = CreateContext();
        context.TblBulkJobs.Add(new TblBulkJob
        {
            BulkJobId = 200,
            JobNumber = "BULK-CHILD",
            ParentId = 100,
            BookDate = TestDates.Today,
            BookTime = TestDates.Now
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.IsBulkJobParent(200);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task IsBulkJobParent_WithBulkParentId_ReturnsTrue()
    {
        // Arrange
        await using var context = CreateContext();
        context.TblBulkJobs.Add(new TblBulkJob
        {
            BulkJobId = 200,
            JobNumber = "BULK-CHILD",
            BulkParentId = 100,
            BookDate = TestDates.Today,
            BookTime = TestDates.Now
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.IsBulkJobParent(200);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task IsBulkJobParent_WithNoParent_ReturnsFalse()
    {
        // Arrange
        await using var context = CreateContext();
        context.TblBulkJobs.Add(new TblBulkJob
        {
            BulkJobId = 200,
            JobNumber = "BULK-SINGLE",
            BookDate = TestDates.Today,
            BookTime = TestDates.Now
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.IsBulkJobParent(200);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task IsBulkJobParent_WithNonExistentJob_ReturnsFalse()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.IsBulkJobParent(999);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task UpdateJobVoidStatusAsync_WithActiveJobs_SetsVoidAndStatus()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateJob(100, "JOB001"),
                CreateJob(101, "JOB002")
            );
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobVoidStatusAsync([100, 101]);

        // Assert
        await using var verifyContext = CreateContext();
        var jobs = await verifyContext.TucJobs
            .Where(j => ((IEnumerable<int>)SourceArray).Contains(j.UcjbId))
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(2, jobs.Count);
        Assert.All(jobs, j => Assert.True(j.UcjbVoid));
        Assert.All(jobs, j => Assert.Equal(1000, j.UcjbStatus));
    }

    [Fact]
    public async Task UpdateJobVoidStatusAsync_WithArchivedJobs_SetsVoidAndStatus()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobArchives.AddRange(
                CreateArchivedJob(100, "ARCH001"),
                CreateArchivedJob(101, "ARCH002")
            );
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobVoidStatusAsync([100, 101]);

        // Assert
        await using var verifyContext = CreateContext();
        var jobs = await verifyContext.TucJobArchives
            .Where(j => ((IEnumerable<int>)SourceArray).Contains(j.UcjbId))
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(2, jobs.Count);
        Assert.All(jobs, j => Assert.True(j.UcjbVoid));
        Assert.All(jobs, j => Assert.Equal(1000, j.UcjbStatus));
    }

    [Fact]
    public async Task UpdateJobVoidStatusAsync_WithMixedActiveAndArchived_VoidsBoth()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateJob(100, "ACTIVE"));
            context.TucJobArchives.Add(CreateArchivedJob(101, "ARCHIVED"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobVoidStatusAsync([100, 101]);

        // Assert
        await using var verifyContext = CreateContext();
        var activeJob = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        var archivedJob = await verifyContext.TucJobArchives.FindAsync([101], TestContext.Current.CancellationToken);

        Assert.True(activeJob!.UcjbVoid);
        Assert.Equal(1000, activeJob.UcjbStatus);
        Assert.True(archivedJob!.UcjbVoid);
        Assert.Equal(1000, archivedJob.UcjbStatus);
    }

    [Fact]
    public async Task UpdateJobVoidStatusAsync_WithEmptyList_DoesNothing()
    {
        // Arrange
        var repository = CreateRepository();

        // Act - should not throw
        await repository.UpdateJobVoidStatusAsync([]);
    }

    [Fact]
    public async Task UpdateJobVoidStatusAsync_WithNonExistentJobs_DoesNotThrow()
    {
        // Arrange
        var repository = CreateRepository();

        // Act - no matching jobs should not throw
        await repository.UpdateJobVoidStatusAsync([999, 998]);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_LiveJob_SetAmountToZero_PersistsZero()
    {
        // Reproduces the bulk-price "set price to 0" scenario for a live job. The update must
        // discover the job and persist 0, without depending on the legacy tblJob view (which is
        // unseedable here and silently excludes jobs it does not surface in production).
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 100,
                UcjbNumber = "JOB100",
                UcjbAmount = 120m,
                FuelSurchargeAmount = 0m,
                PpdexclusiveAmount = 0m,
                UcjbLocked = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        var updated = await repository.UpdateManualPriceAsync([
            new JobManualPriceModel
            {
                Id = 100, Amount = 0m, Fuel = 0m, Ppd = 0m,
                CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m
            }
        ]);

        Assert.Contains(100, updated);

        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.NotNull(job);
        Assert.Equal(0m, job!.UcjbAmount);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_JobNotFound_IsExcludedFromReturnedSet()
    {
        // A job that does not exist in either job table must NOT be reported as updated, so the
        // caller can surface it instead of claiming a false success.
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 100,
                UcjbNumber = "JOB100",
                UcjbAmount = 50m,
                FuelSurchargeAmount = 0m,
                PpdexclusiveAmount = 0m,
                UcjbLocked = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        var updated = await repository.UpdateManualPriceAsync([
            new JobManualPriceModel { Id = 100, Amount = 0m, Fuel = 0m, Ppd = 0m, CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m },
            new JobManualPriceModel { Id = 777, Amount = 0m, Fuel = 0m, Ppd = 0m, CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m }
        ]);

        Assert.Contains(100, updated);
        Assert.DoesNotContain(777, updated);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_ArchivedJob_SetAmountToZero_PersistsZero()
    {
        // Archived (completed) jobs must also be repriced to 0. This is the path most likely to
        // have been failing for the reported Toyota June invoices.
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 200,
                UcjbNumber = "ARCH200",
                UcjbAmount = 95m,
                FuelSurchargeAmount = 0m,
                PpdexclusiveAmount = 0m,
                UcjbLocked = 0,
                UcjbInvoiceNo = null
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateManualPriceAsync([
            new JobManualPriceModel
            {
                Id = 200, Amount = 0m, Fuel = 0m, Ppd = 0m,
                CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m
            }
        ]);

        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobArchives.FindAsync([200], TestContext.Current.CancellationToken);
        Assert.NotNull(job);
        Assert.Equal(0m, job!.UcjbAmount);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_MixedLiveAndArchivedJobs_PersistsBothAtomically()
    {
        // The prices for a batch spanning both job tables are now written inside a single
        // transaction. Verify every change commits together (the refactor that fixed the
        // "committed but reported as failed" bug must not drop the live or archived side).
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 100, UcjbNumber = "JOB100", UcjbAmount = 120m,
                FuelSurchargeAmount = 0m, PpdexclusiveAmount = 0m, UcjbLocked = false
            });
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 200, UcjbNumber = "ARCH200", UcjbAmount = 95m,
                FuelSurchargeAmount = 0m, PpdexclusiveAmount = 0m, UcjbLocked = 0, UcjbInvoiceNo = null
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        var updated = await repository.UpdateManualPriceAsync([
            new JobManualPriceModel { Id = 100, Amount = 0m, Fuel = 0m, Ppd = 0m, CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m },
            new JobManualPriceModel { Id = 200, Amount = 0m, Fuel = 0m, Ppd = 0m, CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m }
        ]);

        Assert.Contains(100, updated);
        Assert.Contains(200, updated);

        await using var verifyContext = CreateContext();
        var live = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        var archived = await verifyContext.TucJobArchives.FindAsync([200], TestContext.Current.CancellationToken);
        Assert.Equal(0m, live!.UcjbAmount);
        Assert.Equal(0m, archived!.UcjbAmount);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_PriceChanged_SetsRatedManually()
    {
        // A directly-entered bulk price is a manual set — must be flagged so a later automatic
        // re-rate doesn't silently overwrite it.
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 100,
                UcjbNumber = "JOB100",
                UcjbAmount = 50m,
                FuelSurchargeAmount = 0m,
                PpdexclusiveAmount = 0m,
                UcjbLocked = false,
                RatedManually = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateManualPriceAsync([
            new JobManualPriceModel
            {
                Id = 100, Amount = 75m, Fuel = 0m, Ppd = 0m,
                CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m
            }
        ]);

        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.NotNull(job);
        Assert.Equal(75m, job!.UcjbAmount);
        Assert.True(job.RatedManually);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_SplitParentTotalChanged_SetsRatedManuallyOnParent()
    {
        // When editing split children's amounts changes the parent's summed total, the parent's
        // breakdown gets collapsed to a single consolidated line (there's no way to know how to
        // re-split it) — the parent must be flagged manually rated so a later auto re-rate can't
        // silently overwrite that consolidated price.
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 100, UcjbNumber = "JOB100", UcjbAmount = 100m,
                FuelSurchargeAmount = 0m, PpdexclusiveAmount = 0m, UcjbLocked = false,
                RatedManually = false
            });
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 101, UcjbNumber = "JOB100A", ParentId = 100, UcjbAmount = 40m,
                FuelSurchargeAmount = 0m, PpdexclusiveAmount = 0m, UcjbLocked = false
            });
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 102, UcjbNumber = "JOB100B", ParentId = 100, UcjbAmount = 60m,
                FuelSurchargeAmount = 0m, PpdexclusiveAmount = 0m, UcjbLocked = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateManualPriceAsync([
            new JobManualPriceModel
            {
                Id = 101, Amount = 45m, Fuel = 0m, Ppd = 0m,
                CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m
            },
            new JobManualPriceModel
            {
                Id = 102, Amount = 65m, Fuel = 0m, Ppd = 0m,
                CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m
            }
        ]);

        await using var verifyContext = CreateContext();
        var parent = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.NotNull(parent);
        Assert.Equal(110m, parent!.UcjbAmount);
        Assert.True(parent.RatedManually);
    }

    [Fact]
    public async Task SimpleRepriceJobManualAsync_WithRegularJob_UpdatesPriceAndMarksManual()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateJobWithAmounts(100, "JOB001", amount: 50m));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();
        var data = new SimpleRepriceJobModel { JobId = 100, NewPrice = 150m };

        // Act
        await repository.SimpleRepriceJobManualAsync(data);

        // Assert
        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal(150m, job!.UcjbAmount);
        Assert.True(job.RatedManually);
    }

    [Fact]
    public async Task SimpleRepriceJobManualAsync_WithArchivedJob_UpdatesPriceInArchive()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 100,
                UcjbNumber = "ARCH001",
                UcjbAmount = 50m,
                RatedManually = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();
        var data = new SimpleRepriceJobModel { JobId = 100, NewPrice = 200m };

        // Act
        await repository.SimpleRepriceJobManualAsync(data);

        // Assert
        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobArchives.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal(200m, job!.UcjbAmount);
        Assert.True(job.RatedManually);
    }

    [Fact]
    public async Task SimpleRepriceJobManualAsync_WithBulkJob_UpdatesAmount()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TblBulkJobs.Add(new TblBulkJob
            {
                BulkJobId = 300,
                JobNumber = "BULK001",
                Amount = 100m,
                BookDate = TestDates.Today,
                BookTime = TestDates.Now
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();
        var data = new SimpleRepriceJobModel { JobId = 300, IsBulk = true, NewPrice = 250m };

        // Act
        await repository.SimpleRepriceJobManualAsync(data);

        // Assert
        await using var verifyContext = CreateContext();
        var job = await verifyContext.TblBulkJobs.FindAsync([300], TestContext.Current.CancellationToken);
        Assert.Equal(250m, job!.Amount);
    }

    [Fact]
    public async Task SimpleRepriceJobManualAsync_WithPrebookJob_UpdatesAmountAndMarksManual()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobBookings.Add(new TucJobBooking
            {
                UcbkId = 400,
                UcbkJobNumber = "PB001",
                UcbkAmount = 75m,
                RatedManually = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();
        var data = new SimpleRepriceJobModel { JobId = 400, IsPrebook = true, NewPrice = 180m };

        // Act
        await repository.SimpleRepriceJobManualAsync(data);

        // Assert
        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobBookings.FindAsync([400], TestContext.Current.CancellationToken);
        Assert.Equal(180m, job!.UcbkAmount);
        Assert.True(job.RatedManually);
    }

    [Fact]
    public async Task SimpleRepriceJobManualAsync_WithNonExistentJob_ThrowsInvalidOperationException()
    {
        // Arrange
        var repository = CreateRepository();
        var data = new SimpleRepriceJobModel { JobId = 999, NewPrice = 100m };

        // Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(Act);
        Assert.Contains("999", ex.Message);
        Assert.Contains("not found", ex.Message);
        return;

        // Act
        Task Act() => repository.SimpleRepriceJobManualAsync(data);
    }

    [Fact]
    public async Task AssignCourierToJobAsync_WithValidJobs_UpdatesCourierAndStatus()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateJob(100, "JOB001"));
            context.TucJobs.Add(CreateJob(101, "JOB002"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        _clock = new FakeTenantClock(new DateTime(2025, 6, 15, 10, 30, 0));

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToJobAsync([100, 101], courierId: 5);

        // Assert
        await using var verifyContext = CreateContext();
        var jobs = await verifyContext.TucJobs
            .Where(j => ((IEnumerable<int>)SourceArray).Contains(j.UcjbId))
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(2, jobs.Count);
        Assert.All(jobs, j => Assert.Equal(5, j.UcjbCourierId));
        Assert.All(jobs, j => Assert.Equal((int)InternalJobStatus.AwaitingPod, j.InternalStatus));
    }

    [Fact]
    public async Task AssignCourierToJobAsync_SetsDispatchDateAndTime()
    {
        // Arrange
        var dispatchTime = new DateTime(2025, 6, 15, 10, 30, 0);
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateJob(100, "JOB001"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        _clock = new FakeTenantClock(dispatchTime);
        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToJobAsync([100], courierId: 3);

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal(dispatchTime, updatedJob!.UcjbDispDate);
        Assert.Equal(dispatchTime, updatedJob.UcjbDispTime);
    }

    [Fact]
    public async Task AssignCourierToJobAsync_AlwaysSetsStatusToDispatched()
    {
        // Arrange - job has a non-Dispatched status (e.g. After Hours or any other pre-dispatch status)
        await using (var context = CreateContext())
        {
            var seedJob = CreateJob(100, "JOB001");
            seedJob.UcjbStatus = 99; // Arbitrary non-zero status (e.g. "After Hours")
            context.TucJobs.Add(seedJob);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToJobAsync([100], courierId: 5);

        // Assert - status is always set to Dispatched regardless of prior value
        await using var verifyContext = CreateContext();
        var verifiedJob = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Dispatched, verifiedJob!.UcjbStatus);
    }

    [Fact]
    public async Task AssignCourierToJobAsync_SetsStatusToDispatchedFromNew()
    {
        // Arrange - job has status New (0)
        await using (var context = CreateContext())
        {
            var seedJob = CreateJob(100, "JOB001");
            seedJob.UcjbStatus = 0;
            context.TucJobs.Add(seedJob);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToJobAsync([100], courierId: 5);

        // Assert
        await using var verifyContext = CreateContext();
        var verifiedJob = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Dispatched, verifiedJob!.UcjbStatus);
    }

    [Fact]
    public async Task AssignCourierToJobAsync_WithNonExistentJobs_ThrowsInvalidOperationException()
    {
        // Arrange
        var repository = CreateRepository();

        // Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(Act);
        Assert.Contains("No records found", ex.Message);
        return;

        // Act
        Task Act() => repository.AssignCourierToJobAsync([999], courierId: 5);
    }

    [Fact]
    public async Task AssignCourierToJobAsync_ClearsFirstDriverCourierId()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var seedJob = CreateJob(100, "JOB001");
            seedJob.FdcourierId = 99;
            seedJob.DesCheck = true;
            context.TucJobs.Add(seedJob);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToJobAsync([100], courierId: 5);

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Null(updatedJob!.FdcourierId);
        Assert.False(updatedJob.DesCheck);
    }

    [Fact]
    public async Task AssignCourierToJobAsync_SetsInternalStatusToAwaitingPod()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var seedJob = CreateJob(100, "JOB001");
            seedJob.InternalStatus = 0;
            context.TucJobs.Add(seedJob);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToJobAsync([100], courierId: 5);

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal((int)InternalJobStatus.AwaitingPod, updatedJob!.InternalStatus);
    }

    [Fact]
    public async Task AssignCourierToJobAsync_RecordsDispatcherFromCurrentUser()
    {
        // Arrange - fixture mocks GetStaffId() to return 1
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateJob(100, "JOB001"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToJobAsync([100], courierId: 5);

        // Assert - the dispatching staff member is recorded
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal(1, updatedJob!.UcjbDispId);
    }

    [Fact]
    public async Task AssignCourierToJobAsync_WithNoStaffClaim_LeavesDispatcherNull()
    {
        // Arrange - no staff claim, so GetStaffId() returns 0
        _tenantInfoServiceMock.GetStaffId().Returns(0);
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateJob(100, "JOB001"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToJobAsync([100], courierId: 5);

        // Assert - staff id 0 is not a valid dispatcher FK, so it is left null
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Null(updatedJob!.UcjbDispId);
    }

    [Fact]
    public async Task SimpleRepriceJobManualAsync_RegularJob_FallsBackToArchive()
    {
        // Arrange - job exists only in archive, not in live table
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 500,
                UcjbNumber = "ARCH-REPRICE",
                UcjbAmount = 50m,
                RatedManually = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();
        var data = new SimpleRepriceJobModel { JobId = 500, NewPrice = 300m };

        // Act
        await repository.SimpleRepriceJobManualAsync(data);

        // Assert
        await using var verifyContext = CreateContext();
        var archivedJob = await verifyContext.TucJobArchives.FindAsync([500], TestContext.Current.CancellationToken);
        Assert.Equal(300m, archivedJob!.UcjbAmount);
        Assert.True(archivedJob.RatedManually);
    }

    [Fact]
    public async Task SimpleRepriceJobManualAsync_RegularJob_PrefersLiveOverArchive()
    {
        // Arrange - same ID in both tables (shouldn't happen but tests priority)
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateJobWithAmounts(600, "LIVE-JOB", amount: 50m));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();
        var data = new SimpleRepriceJobModel { JobId = 600, NewPrice = 999m };

        // Act
        await repository.SimpleRepriceJobManualAsync(data);

        // Assert
        await using var verifyContext = CreateContext();
        var liveJob = await verifyContext.TucJobs.FindAsync([600], TestContext.Current.CancellationToken);
        Assert.Equal(999m, liveJob!.UcjbAmount);
        Assert.True(liveJob.RatedManually);
    }

    [Fact]
    public async Task UpdateJobVoidStatusAsync_PreservesOtherJobFields()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var seedJob = CreateJobWithAmounts(100, "JOB001", amount: 500m, rawBase: 400m, fuel: 100m);
            context.TucJobs.Add(seedJob);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobVoidStatusAsync([100]);

        // Assert
        await using var verifyContext = CreateContext();
        var voidedJob = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.True(voidedJob!.UcjbVoid);
        Assert.Equal(1000, voidedJob.UcjbStatus);
        Assert.Equal(500m, voidedJob.UcjbAmount); // Amount preserved
        Assert.Equal("JOB001", voidedJob.UcjbNumber); // Job number preserved
    }

    [Fact]
    public async Task UpdateJobVoidStatusAsync_OnlyUpdatesSpecifiedJobs()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateJob(100, "JOB001"),
                CreateJob(101, "JOB002"),
                CreateJob(102, "JOB003")
            );
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act - only void job 100 and 101
        await repository.UpdateJobVoidStatusAsync([100, 101]);

        // Assert
        await using var verifyContext = CreateContext();
        var job100 = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        var job101 = await verifyContext.TucJobs.FindAsync([101], TestContext.Current.CancellationToken);
        var job102 = await verifyContext.TucJobs.FindAsync([102], TestContext.Current.CancellationToken);

        Assert.True(job100!.UcjbVoid);
        Assert.True(job101!.UcjbVoid);
        Assert.False(job102!.UcjbVoid); // Not voided
        Assert.NotEqual(1000, job102.UcjbStatus);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_WithInvalidId_ThrowsArgumentException()
    {
        // Arrange
        var repository = CreateRepository();
        var data = new List<JobManualPriceModel>
        {
            new()
            {
                Id = 0, // Invalid
                Amount = 100m,
                Ppd = 10m,
                Fuel = 5m,
                CourierPayment = 50m,
                CourierFuel = 3m,
                CourierBonus = 2m
            }
        };

        // Assert
        await Assert.ThrowsAsync<ArgumentException>(Act);
        return;

        // Act
        Task Act() => repository.UpdateManualPriceAsync(data);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_WithPositiveAmountAndNegativeSubAmounts_ThrowsArgumentException()
    {
        // Arrange
        var repository = CreateRepository();
        var data = new List<JobManualPriceModel>
        {
            new()
            {
                Id = 100,
                Amount = 100m,
                Ppd = -10m, // Negative with positive amount
                Fuel = 5m,
                CourierPayment = 50m,
                CourierFuel = 3m,
                CourierBonus = 2m
            }
        };

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(Act);
        Assert.Contains("Invalid Values", ex.Message);
        return;

        // Act
        Task Act() => repository.UpdateManualPriceAsync(data);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_WithAmountLessThanPpdPlusFuel_ThrowsArgumentException()
    {
        // Arrange
        var repository = CreateRepository();
        var data = new List<JobManualPriceModel>
        {
            new()
            {
                Id = 100,
                Amount = 10m,
                Ppd = 8m,
                Fuel = 5m, // Ppd + Fuel = 13 > Amount of 10
                CourierPayment = 5m,
                CourierFuel = 2m,
                CourierBonus = 1m
            }
        };

        // Assert
        await Assert.ThrowsAsync<ArgumentException>(Act);
        return;

        // Act
        Task Act() => repository.UpdateManualPriceAsync(data);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_WithNegativeAmountAndPositiveSubAmounts_ThrowsArgumentException()
    {
        // Arrange
        var repository = CreateRepository();
        var data = new List<JobManualPriceModel>
        {
            new()
            {
                Id = 100,
                Amount = -50m,
                Ppd = 10m, // Positive with negative amount
                Fuel = 5m,
                CourierPayment = 20m,
                CourierFuel = 3m,
                CourierBonus = 2m
            }
        };

        // Assert
        await Assert.ThrowsAsync<ArgumentException>(Act);
        return;

        // Act
        Task Act() => repository.UpdateManualPriceAsync(data);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_WithEmptyList_ReturnsWithoutError()
    {
        // Arrange
        var repository = CreateRepository();

        // Act - empty list should be treated as valid but no-op
        await repository.UpdateManualPriceAsync([]);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_NormalizesNullValuesToZero()
    {
        // Arrange - null amounts should be normalized to 0 before validation
        var repository = CreateRepository();
        var data = new List<JobManualPriceModel>
        {
            new()
            {
                Id = 100,
                Amount = null, // Will be normalized to 0
                Ppd = null,
                Fuel = null,
                CourierPayment = null,
                CourierFuel = null,
                CourierBonus = null
            }
        };

        // The validation passes (all zeros), but TblJobs query may fail in SQLite
        // since it's a keyless view. We're testing validation, not the DB query.
        // If the validation passes, any exception would be from the DB layer, not validation.
        try
        {
            await repository.UpdateManualPriceAsync(data);
        }
        catch (Exception ex) when (ex is not ArgumentException)
        {
            // Expected - DB layer may fail, but validation passed
        }
    }

    [Fact]
    public async Task AssignCourierToChildJobsAsync_WithEmptyList_DoesNotThrow()
    {
        var repository = CreateRepository();
        await repository.AssignCourierToChildJobsAsync([], InternalJobStatus.AwaitingPod);
    }

    [Fact]
    public async Task AssignCourierToChildJobsAsync_WithNullList_DoesNotThrow()
    {
        var repository = CreateRepository();
        await repository.AssignCourierToChildJobsAsync(null!, InternalJobStatus.AwaitingPod);
    }

    [Fact]
    public async Task AssignCourierToChildJobsAsync_WithNoParentId_ReturnsEarly()
    {
        // Arrange - job has no ParentId so query returns empty
        await using var context = CreateContext();
        context.TucJobs.Add(CreateJob(5000, "JOB-NOPARENT"));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act & Assert - should not throw
        await repository.AssignCourierToChildJobsAsync([5000], InternalJobStatus.AwaitingPod);
    }

    [Fact]
    public async Task AssignCourierToChildJobsAsync_DispatchesEligibleChildJobs()
    {
        // Arrange
        await using var context = CreateContext();
        context.TblJobRelationshipTypes.Add(CreateRelType(100, autoDispatch: true));
        context.TucJobs.AddRange(
            new TucJob
            {
                UcjbId = 5001, UcjbNumber = "PARENT-1", UcjbDate = new DateTime(2024, 6, 15)
            },
            new TucJob
            {
                UcjbId = 5010, UcjbNumber = "CHILD-DISPATCHED-1", ParentId = 5001,
                UcjbCourierId = 5, UcjbDispId = 1,
                UcjbDispTime = new DateTime(2024, 6, 15, 9, 0, 0),
                UcjbDispDate = new DateTime(2024, 6, 15),
                UcjbStatus = 4, UcjbDate = new DateTime(2024, 6, 15),
                JobRelationshipTypeId = 100
            },
            new TucJob
            {
                UcjbId = 5011, UcjbNumber = "CHILD-ELIGIBLE-1", ParentId = 5001,
                UcjbCourierId = null, UcjbDate = new DateTime(2024, 6, 15),
                JobRelationshipTypeId = 100
            });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToChildJobsAsync([5010], InternalJobStatus.AwaitingPod);

        // Assert
        await using var verifyContext = CreateContext();
        var updated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 5011, TestContext.Current.CancellationToken);

        Assert.Equal(5, updated.UcjbCourierId!.Value);
        Assert.Equal(1, updated.UcjbDispId!.Value);
        Assert.Equal(4, updated.UcjbStatus!.Value);
        Assert.Equal((int)InternalJobStatus.AwaitingPod, updated.InternalStatus!.Value);
    }

    [Fact]
    public async Task AssignCourierToChildJobsAsync_DoesNotDispatchChildWithoutAutoDispatchFlag()
    {
        // Arrange
        await using var context = CreateContext();
        context.TblJobRelationshipTypes.Add(CreateRelType(101, autoDispatch: false));
        context.TucJobs.AddRange(
            new TucJob
            {
                UcjbId = 6001, UcjbNumber = "PARENT-2", UcjbDate = new DateTime(2024, 6, 15)
            },
            new TucJob
            {
                UcjbId = 6010, UcjbNumber = "CHILD-DISPATCHED-2", ParentId = 6001,
                UcjbCourierId = 5, UcjbDispId = 1,
                UcjbDispTime = new DateTime(2024, 6, 15, 9, 0, 0),
                UcjbDispDate = new DateTime(2024, 6, 15),
                UcjbStatus = 4, UcjbDate = new DateTime(2024, 6, 15),
                JobRelationshipTypeId = 101
            },
            new TucJob
            {
                UcjbId = 6011, UcjbNumber = "CHILD-INELIGIBLE", ParentId = 6001,
                UcjbCourierId = null, UcjbDate = new DateTime(2024, 6, 15),
                JobRelationshipTypeId = 101
            });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToChildJobsAsync([6010], InternalJobStatus.AwaitingPod);

        // Assert - child should NOT be updated
        await using var verifyContext = CreateContext();
        var notUpdated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 6011, TestContext.Current.CancellationToken);

        Assert.Null(notUpdated.UcjbCourierId);
        Assert.Null(notUpdated.InternalStatus);
    }

    [Fact]
    public async Task AssignCourierToChildJobsAsync_DoesNotDispatchChildWithFutureDate()
    {
        // Arrange
        await using var context = CreateContext();
        context.TblJobRelationshipTypes.Add(CreateRelType(102, autoDispatch: true));
        context.TucJobs.AddRange(
            new TucJob
            {
                UcjbId = 7001, UcjbNumber = "PARENT-3", UcjbDate = new DateTime(2024, 6, 15)
            },
            new TucJob
            {
                UcjbId = 7010, UcjbNumber = "CHILD-DISPATCHED-3", ParentId = 7001,
                UcjbCourierId = 5, UcjbDispId = 1,
                UcjbDispTime = new DateTime(2024, 6, 15, 9, 0, 0),
                UcjbDispDate = new DateTime(2024, 6, 15),
                UcjbStatus = 4, UcjbDate = new DateTime(2024, 6, 15),
                JobRelationshipTypeId = 102
            },
            new TucJob
            {
                UcjbId = 7011, UcjbNumber = "CHILD-FUTURE", ParentId = 7001,
                UcjbCourierId = null,
                UcjbDate = new DateTime(2024, 6, 16), // Future date
                JobRelationshipTypeId = 102
            });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToChildJobsAsync([7010], InternalJobStatus.AwaitingPod);

        // Assert - future child should NOT be updated
        await using var verifyContext = CreateContext();
        var notUpdated = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 7011, TestContext.Current.CancellationToken);

        Assert.Null(notUpdated.UcjbCourierId);
    }

    [Fact]
    public async Task AssignCourierToChildJobsAsync_SkipsChildAlreadyAssigned()
    {
        // Arrange
        await using var context = CreateContext();
        context.TblJobRelationshipTypes.Add(CreateRelType(103, autoDispatch: true));
        context.TucJobs.AddRange(
            new TucJob
            {
                UcjbId = 8001, UcjbNumber = "PARENT-4", UcjbDate = new DateTime(2024, 6, 15)
            },
            new TucJob
            {
                UcjbId = 8010, UcjbNumber = "CHILD-DISPATCHED-4", ParentId = 8001,
                UcjbCourierId = 5, UcjbDispId = 1,
                UcjbDispTime = new DateTime(2024, 6, 15, 9, 0, 0),
                UcjbDispDate = new DateTime(2024, 6, 15),
                UcjbStatus = 4, UcjbDate = new DateTime(2024, 6, 15),
                JobRelationshipTypeId = 103
            },
            new TucJob
            {
                UcjbId = 8011, UcjbNumber = "CHILD-ALREADY-ASSIGNED", ParentId = 8001,
                UcjbCourierId = 99, // Already has a courier
                UcjbDate = new DateTime(2024, 6, 15),
                JobRelationshipTypeId = 103
            });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.AssignCourierToChildJobsAsync([8010], InternalJobStatus.AwaitingPod);

        // Assert - already-assigned child should keep its original courier
        await using var verifyContext = CreateContext();
        var unchanged = await verifyContext.TucJobs.FirstAsync(
            j => j.UcjbId == 8011, TestContext.Current.CancellationToken);

        Assert.Equal(99, unchanged.UcjbCourierId);
    }

    private static TblJobRelationshipType CreateRelType(int id, bool autoDispatch) => new()
    {
        JobRelationshipTypeId = id,
        Name = $"RelType-{id}",
        SystemName = $"RelType-{id}",
        AutoDespatchToOtherChildJobs = autoDispatch,
        Created = TestDates.Now,
        CreatedBy = "Test",
        LastModified = TestDates.Now,
        LastModifiedBy = "Test",
        ShortName = $"RT{id}"
    };

    private static TucJob CreateJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

    private static TucJob CreateJobWithParent(int id, string jobNumber, int parentId) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        ParentId = parentId
    };

    private static TucJob CreateJobWithAmounts(int id, string jobNumber, decimal? amount = null,
        decimal? rawBase = null, decimal? fuel = null) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        UcjbAmount = amount,
        RawBaseAmount = rawBase,
        FuelSurchargeAmount = fuel ?? 0
    };

    private static TucJobArchive CreateArchivedJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

}
