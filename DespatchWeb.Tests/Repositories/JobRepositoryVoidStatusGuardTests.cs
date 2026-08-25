using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Voiding writes ucjbStatus = Void and ucjbVoid = true together. These tests pin the writers that
/// used to move ucjbStatus afterwards without checking ucjbVoid, which left voided jobs reporting a
/// live status (e.g. "New") in the job-search download, and pin the un-void path that used to clear
/// the flag while leaving the status on Void.
/// </summary>
public class JobRepositoryVoidStatusGuardTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryVoidStatusGuardTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
        _tenantInfoServiceMock.GetCurrentTimeFromTimeZone(Arg.Any<TimeZone>()).Returns(TestDates.Now);
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

    [Fact]
    public async Task UpdateJobAsync_StatusOnVoidedLiveJob_LeavesStatusAtVoid()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateVoidedJob(1));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.Status, ((int)JobStatus.New).ToString());

        // Assert
        await using var assertContext = _db.CreateContext();
        var job = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 1, TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Void, job.UcjbStatus);
        Assert.True(job.UcjbVoid);
    }

    [Fact]
    public async Task UpdateJobAsync_StatusOnNonVoidedLiveJob_StillUpdatesStatus()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            var job = CreateVoidedJob(1);
            job.UcjbVoid = false;
            job.UcjbStatus = (int)JobStatus.Dispatched;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.Status, ((int)JobStatus.Accepted).ToString());

        // Assert
        await using var assertContext = _db.CreateContext();
        var updated = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 1, TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Accepted, updated.UcjbStatus);
    }

    [Fact]
    public async Task UpdateJobAsync_UnVoidingLiveJob_ResetsStatusToNew()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateVoidedJob(1));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.Void, "false");

        // Assert - the flag and the status must move together
        await using var assertContext = _db.CreateContext();
        var job = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 1, TestContext.Current.CancellationToken);
        Assert.False(job.UcjbVoid);
        Assert.Equal((int)JobStatus.New, job.UcjbStatus);
    }

    [Fact]
    public async Task UpdateManualPriceAsync_StatusNameOnVoidedJob_LeavesStatusAtVoid()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobStatuses.Add(new TucJobStatus { UcjsId = (int)JobStatus.Dispatched, UcjsName = "Dispatched" });
            context.TucJobs.Add(CreateVoidedJob(1));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateManualPriceAsync([
            new JobManualPriceModel { Id = 1, Amount = 0m, StatusName = "Dispatched" }
        ]);

        // Assert
        await using var assertContext = _db.CreateContext();
        var job = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 1, TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Void, job.UcjbStatus);
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_VoidedJob_LeavesStatusAtVoid()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateVoidedJob(1));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdatePodDetailsAsync(new UpdatePodDetailsRequest
        {
            JobId = 1,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Someone",
            PodTime = TestDates.Now.ToString("O")
        });

        // Assert - the POD name is still recorded, but the void status is not overwritten
        await using var assertContext = _db.CreateContext();
        var job = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 1, TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Void, job.UcjbStatus);
        Assert.Equal("Someone", job.UcjbPodname);
    }

    [Fact]
    public async Task UpdateJobAsync_InternalStatusOnVoidedJob_LeavesStatusAtVoid()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateVoidedJob(1));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.InternalStatusID,
            ((int)InternalJobStatus.NewJobs).ToString());

        // Assert - the internal status moves, the job status does not
        await using var assertContext = _db.CreateContext();
        var job = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 1, TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Void, job.UcjbStatus);
        Assert.Equal((int)InternalJobStatus.NewJobs, job.InternalStatus);
    }

    /// <summary>
    /// A POD on the last non-void child rolls completion up to the parent - a voided parent must
    /// not be resurrected to Completed by that rollup.
    /// </summary>
    [Fact]
    public async Task UpdatePodDetailsAsync_VoidedParent_KeepsVoidStatusOnRollup()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            var parent = CreateVoidedJob(10);
            var child = CreateJob(11, status: (int)JobStatus.Dispatched, parentId: 10);
            context.TucJobs.AddRange(parent, child);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdatePodDetailsAsync(new UpdatePodDetailsRequest
        {
            JobId = 11,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Someone",
            PodTime = TestDates.Now.ToString("O")
        });

        // Assert
        await using var assertContext = _db.CreateContext();
        var parentJob = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 10, TestContext.Current.CancellationToken);
        var childJob = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 11, TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Void, parentJob.UcjbStatus);
        Assert.Equal((int)JobStatus.Completed, childJob.UcjbStatus);
    }

    [Fact]
    public async Task AssignCourierToChildJobsAsync_VoidedChild_KeepsVoidStatus()
    {
        // Arrange - parent dispatched, one voided child and one live child, both auto-dispatch enabled
        await using (var context = _db.CreateContext())
        {
            context.TblJobRelationshipTypes.Add(new TblJobRelationshipType
            {
                JobRelationshipTypeId = 1,
                Name = "Split",
                SystemName = "Split",
                ShortName = "SPL",
                CreatedBy = "test",
                LastModifiedBy = "test",
                AutoDespatchToOtherChildJobs = true
            });

            var grandParent = CreateJob(10, status: (int)JobStatus.Dispatched);
            var dispatchedChild = CreateJob(11, status: (int)JobStatus.Dispatched, parentId: 10);
            dispatchedChild.UcjbCourierId = 5;

            var voidedChild = CreateVoidedJob(12);
            voidedChild.ParentId = 10;
            voidedChild.JobRelationshipTypeId = 1;

            var liveChild = CreateJob(13, status: (int)JobStatus.New, parentId: 10);
            liveChild.JobRelationshipTypeId = 1;

            context.TucJobs.AddRange(grandParent, dispatchedChild, voidedChild, liveChild);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act - cascade the dispatched child's assignment to its siblings
        await repository.AssignCourierToChildJobsAsync([11], InternalJobStatus.NewJobs);

        // Assert
        await using var assertContext = _db.CreateContext();
        var voided = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 12, TestContext.Current.CancellationToken);
        var live = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 13, TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Void, voided.UcjbStatus);
        Assert.Null(voided.UcjbCourierId);
        Assert.Equal((int)JobStatus.Dispatched, live.UcjbStatus);
        Assert.Equal(5, live.UcjbCourierId);
    }

    [Fact]
    public async Task UpdateBulkJobAsync_VoidingBulkJob_AlsoWritesVoidStatus()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TblBulkJobs.Add(CreateBulkJob(1, (int)JobStatus.New));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateBulkJobAsync(1, JobProperty.Void, "true");

        // Assert - the flag and the status must move together, as VoidBulkJobAsync already does
        await using var assertContext = _db.CreateContext();
        var bulkJob = await assertContext.TblBulkJobs
            .FirstAsync(j => j.BulkJobId == 1, TestContext.Current.CancellationToken);
        Assert.True(bulkJob.Void);
        Assert.Equal((int)JobStatus.Void, bulkJob.JobStatus);
    }

    [Fact]
    public async Task UpdateBulkJobAsync_UnVoidingBulkJob_ClearsFlagAndStatusTogether()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TblBulkJobs.Add(CreateBulkJob(1, (int)JobStatus.Void, isVoid: true));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateBulkJobAsync(1, JobProperty.Void, "false");

        // Assert - mirrors the live-job un-void path, which also returns the status to New
        await using var assertContext = _db.CreateContext();
        var bulkJob = await assertContext.TblBulkJobs
            .FirstAsync(j => j.BulkJobId == 1, TestContext.Current.CancellationToken);
        Assert.False(bulkJob.Void);
        Assert.Equal((int)JobStatus.New, bulkJob.JobStatus);
    }

    private static TblBulkJob CreateBulkJob(int id, int status, bool isVoid = false) =>
        new()
        {
            BulkJobId = id,
            JobNumber = $"BULK-{id:D3}",
            BookDate = TestDates.Now.Date,
            BookTime = TestDates.Now.Date.AddHours(9),
            JobStatus = status,
            Void = isVoid
        };

    private static TucJob CreateVoidedJob(int id)
    {
        var job = CreateJob(id, (int)JobStatus.Void);
        job.UcjbVoid = true;
        return job;
    }

    private static TucJob CreateJob(int id, int status, int? parentId = null) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = $"JOB-{id:D3}",
            UcjbDate = TestDates.Now.Date,
            UcjbTime = TestDates.Now.Date.AddHours(9),
            UcjbStatus = status,
            ParentId = parentId
        };
}
