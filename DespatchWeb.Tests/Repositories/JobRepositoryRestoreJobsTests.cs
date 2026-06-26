using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for restoring/re-dispatching jobs back onto the dispatch board.
///
/// Regression cover for the GuardCompletedJobsAgainstSilentRestore migration: uspRestoreJob
/// now no-ops on a genuinely-completed job (ucjbJobDone = 1 AND ucjbVoid = 0), leaving its
/// POD/completion-time evidence in place, which the DESWEB_qryDespatch view filters out. So a
/// completed job restored via uspRestoreJob never reappears on dispatch. Completed jobs must be
/// re-opened via RVW_stpActivateJob instead, which clears that evidence.
/// </summary>
public class JobRepositoryRestoreJobsTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactory;
    private readonly ITenantInfoService _tenantInfoService = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeService = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobService = Substitute.For<ICreateJobService>();
    private readonly IJobApiClient _jobApiClient = Substitute.For<IJobApiClient>();
    private readonly IDespatchContextProcedures _procedures = Substitute.For<IDespatchContextProcedures>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

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
        _jobApiClient
    );

    private Task<int> AssertActivated(int jobId) =>
        _procedures.Received(1).RVW_stpActivateJobAsync(jobId, Arg.Any<string>(),
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());

    private Task<int> AssertNotActivated(int jobId) =>
        _procedures.DidNotReceive().RVW_stpActivateJobAsync(jobId, Arg.Any<string>(),
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());

    private Task<int> AssertRestored(int jobId) =>
        _procedures.Received(1).uspRestoreJobAsync(jobId,
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());

    private Task<int> AssertNotRestored(int jobId) =>
        _procedures.DidNotReceive().uspRestoreJobAsync(jobId,
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());

    [Fact]
    public async Task RestoreJobsAsync_CompletedJob_ActivatesInsteadOfRestore()
    {
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = 100, UcjbNumber = "JOB-100", UcjbJobDone = true, UcjbVoid = false
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().RestoreJobsAsync([100]);

        await AssertActivated(100);
        await AssertNotRestored(100);
    }

    [Fact]
    public async Task RestoreJobsAsync_VoidedJob_UsesRestore()
    {
        // A voided job is still restorable via uspRestoreJob (that path reverts the void).
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = 101, UcjbNumber = "JOB-101", UcjbJobDone = true, UcjbVoid = true
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().RestoreJobsAsync([101]);

        await AssertRestored(101);
        await AssertNotActivated(101);
    }

    [Fact]
    public async Task RestoreJobsAsync_ActiveNotDoneJob_UsesRestore()
    {
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = 102, UcjbNumber = "JOB-102", UcjbJobDone = false, UcjbVoid = false
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().RestoreJobsAsync([102]);

        await AssertRestored(102);
        await AssertNotActivated(102);
    }

    [Fact]
    public async Task RestoreJobsAsync_MixedJobs_RoutesEachToCorrectProcedure()
    {
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = 200, UcjbNumber = "DONE", UcjbJobDone = true, UcjbVoid = false },
            new TucJob { UcjbId = 201, UcjbNumber = "VOID", UcjbJobDone = true, UcjbVoid = true },
            new TucJob { UcjbId = 202, UcjbNumber = "ACTIVE", UcjbJobDone = false, UcjbVoid = false }
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().RestoreJobsAsync([200, 201, 202]);

        await AssertActivated(200);
        await AssertNotRestored(200);
        await AssertRestored(201);
        await AssertRestored(202);
    }

    [Fact]
    public async Task RestoreJobsAsync_EmptyList_CallsNothing()
    {
        await CreateRepository().RestoreJobsAsync([]);

        await _procedures.DidNotReceiveWithAnyArgs().RVW_stpActivateJobAsync(null, null, null, TestContext.Current.CancellationToken);
        await _procedures.DidNotReceiveWithAnyArgs().uspRestoreJobAsync(null, null, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task RestoreJobsAsync_CompletedJob_PassesStaffNameToActivate()
    {
        _tenantInfoService.GetStaffInfoAsync().Returns(new Suggestion { Id = 7, Text = "Jane Dispatcher" });
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = 400, UcjbNumber = "JOB-400", UcjbJobDone = true, UcjbVoid = false
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().RestoreJobsAsync([400]);

        await _procedures.Received(1).RVW_stpActivateJobAsync(400, "Jane Dispatcher",
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReDispatchSelectedJobsAsync_CompletedJob_ActivatesInsteadOfRestore()
    {
        _context.TucJobs.Add(new TucJob
        {
            UcjbId = 300, UcjbNumber = "JOB-300", UcjbJobDone = true, UcjbVoid = false
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().ReDispatchSelectedJobsAsync([300]);

        await AssertActivated(300);
        await AssertNotRestored(300);
    }
}
