using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for restoring/re-dispatching jobs back onto the dispatch board. Restore is now
/// implemented in C# (EF Core) rather than the uspRestoreJobs proc: it clears the lifecycle
/// columns, resets status to New and internal status to New Jobs, notifies the courier device
/// via UTL_stpJob_RestoreDevice, and recomputes the courier clear-list order. Completed jobs
/// (done and not void) are restored too — the operator confirms that in the UI. The POD name is
/// always cleared; the captured images in S3 are only removed when the caller opts in.
/// </summary>
public class JobRepositoryRestoreJobsTests : IAsyncDisposable
{
    private readonly IClearListEnvelopeService _clearListEnvelopeService = Substitute.For<IClearListEnvelopeService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactory;
    private readonly ICourierRepository _courierRepository = Substitute.For<ICourierRepository>();
    private readonly ICreateJobService _createJobService = Substitute.For<ICreateJobService>();
    private readonly SqliteTestDatabase _db = new();
    private readonly IDespatchContextProcedures _procedures = Substitute.For<IDespatchContextProcedures>();
    private readonly ITenantInfoService _tenantInfoService = Substitute.For<ITenantInfoService>();

    public JobRepositoryRestoreJobsTests()
    {
        _context = _db.CreateContext();
        _context.Procedures = _procedures;
        _contextFactory = SqliteTestDatabase.CreateFactoryMock(_context);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _contextFactory,
        _tenantInfoService,
        _clock,
        _clearListEnvelopeService,
        _createJobService,
        _courierRepository
    );

    private async Task SeedJobAsync(int id, bool done, bool @void, int? courierId = null,
        string? podName = null, int? internalStatus = null, int? dispId = null, int? parentId = null)
    {
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = id,
            UcjbNumber = $"JOB{id}",
            UcjbDate = TestDates.Now,
            UcjbJobDone = done,
            UcjbVoid = @void,
            UcjbCourierId = courierId,
            UcjbPodname = podName,
            UcjbComplTime = done ? TestDates.Now : null,
            UcjbStatus = done ? (int)JobStatus.Completed : (int)JobStatus.Dispatched,
            InternalStatus = internalStatus,
            UcjbDispId = dispId,
            ParentId = parentId,
            DisplayInDespatch = false
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private Task<TucJob> ReloadAsync(int id) =>
        _context.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == id, TestContext.Current.CancellationToken);

    [Fact]
    public async Task RestoreJobsAsync_CompletedJob_IsRestoredAndClearsPod()
    {
        await SeedJobAsync(1, done: true, @void: false, courierId: 55, podName: "pod.jpg",
            internalStatus: (int)InternalJobStatus.AwaitingPod);

        await CreateRepository().RestoreJobsAsync([1]);

        var job = await ReloadAsync(1);
        Assert.False(job.UcjbJobDone);
        Assert.False(job.UcjbVoid);
        Assert.Equal((int)JobStatus.New, job.UcjbStatus);
        Assert.Null(job.UcjbCourierId);
        Assert.Null(job.UcjbComplTime);
        // POD name is cleared so the job re-enters the DESWEB_qryDespatch board view.
        Assert.True(string.IsNullOrEmpty(job.UcjbPodname));
        Assert.Equal((int)InternalJobStatus.NewJobs, job.InternalStatus);
        Assert.True(job.DisplayInDespatch);
        await _procedures.Received(1)
            .UTL_stpJob_RestoreDeviceAsync(1, cancellationToken: Arg.Any<CancellationToken>());
        await _courierRepository.Received(1).ResetClearListAreaOrderAsync(55);
    }

    [Fact]
    public async Task RestoreJobsAsync_NonCompletedJob_RestoresAndClearsPod()
    {
        await SeedJobAsync(1, done: false, @void: false, courierId: 55, podName: "keep.jpg");

        await CreateRepository().RestoreJobsAsync([1]);

        var job = await ReloadAsync(1);
        Assert.Equal((int)JobStatus.New, job.UcjbStatus);
        Assert.Null(job.UcjbCourierId);
        Assert.True(job.DisplayInDespatch);
        Assert.True(string.IsNullOrEmpty(job.UcjbPodname));
        await _procedures.Received(1)
            .UTL_stpJob_RestoreDeviceAsync(1, cancellationToken: Arg.Any<CancellationToken>());
        await _courierRepository.Received(1).ResetClearListAreaOrderAsync(55);
    }

    [Fact]
    public async Task RestoreJobsAsync_VoidedJob_IsRestored()
    {
        await SeedJobAsync(1, done: true, @void: true, courierId: 55);

        await CreateRepository().RestoreJobsAsync([1]);

        var job = await ReloadAsync(1);
        Assert.False(job.UcjbVoid);
        Assert.Equal((int)JobStatus.New, job.UcjbStatus);
        await _procedures.Received(1)
            .UTL_stpJob_RestoreDeviceAsync(1, cancellationToken: Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RestoreJobsAsync_MultiLegParentRelationship_ClearsSiblingDispatcher()
    {
        // Parent with a shared-dispatcher relationship type (5).
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = 10, UcjbNumber = "P", UcjbDate = TestDates.Now, JobRelationshipTypeId = 5
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        await SeedJobAsync(1, done: false, @void: false, dispId: 148, parentId: 10);
        await SeedJobAsync(2, done: false, @void: false, dispId: 148, parentId: 10);

        await CreateRepository().RestoreJobsAsync([1]);

        var sibling = await ReloadAsync(2);
        Assert.Null(sibling.UcjbDispId);
    }

    [Fact]
    public async Task ReDispatchSelectedJobsAsync_CompletedJob_IsRestoredAndClearsPod()
    {
        await SeedJobAsync(1, done: true, @void: false, courierId: 55, podName: "pod.jpg");

        await CreateRepository().ReDispatchSelectedJobsAsync([1]);

        var job = await ReloadAsync(1);
        Assert.False(job.UcjbJobDone);
        Assert.Equal((int)JobStatus.New, job.UcjbStatus);
        Assert.Null(job.UcjbCourierId);
        Assert.True(string.IsNullOrEmpty(job.UcjbPodname));
        await _procedures.Received(1)
            .UTL_stpJob_RestoreDeviceAsync(1, cancellationToken: Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RestoreJobsAsync_EmptyList_DoesNothing()
    {
        await CreateRepository().RestoreJobsAsync([]);

        await _procedures.DidNotReceiveWithAnyArgs()
            .UTL_stpJob_RestoreDeviceAsync(null, cancellationToken: TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task GetRestorePodDetailsAsync_ProjectsPodNameAndCompletionTime()
    {
        await SeedJobAsync(1, done: true, @void: false, podName: "J. Smith");
        await SeedJobAsync(2, done: false, @void: false);

        var details = await CreateRepository().GetRestorePodDetailsAsync([1, 2]);

        var first = Assert.Single(details, d => d.JobId == 1);
        Assert.Equal("J. Smith", first.PodName);
        Assert.Equal(TestDates.Now, first.CompletedTime);

        var second = Assert.Single(details, d => d.JobId == 2);
        Assert.Null(second.PodName);
        Assert.Null(second.CompletedTime);
    }

    [Fact]
    public async Task GetRestorePodDetailsAsync_UnknownAndEmptyIds_ReturnEmpty()
    {
        await SeedJobAsync(1, done: false, @void: false, podName: "J. Smith");
        var repository = CreateRepository();

        Assert.Empty(await repository.GetRestorePodDetailsAsync([]));
        Assert.Empty(await repository.GetRestorePodDetailsAsync([999]));
    }
}