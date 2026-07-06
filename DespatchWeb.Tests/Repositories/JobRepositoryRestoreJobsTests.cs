using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for restoring/re-dispatching jobs back onto the dispatch board.
/// </summary>
public class JobRepositoryRestoreJobsTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactory;
    private readonly ITenantInfoService _tenantInfoService = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeService = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobService = Substitute.For<ICreateJobService>();
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
        _createJobService
    );

    private Task<int> AssertRestoredBatch(string csv) =>
        _procedures.Received(1).uspRestoreJobsAsync(csv, false,
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());

    [Fact]
    public async Task RestoreJobsAsync_ForwardsAllIdsAsCsv_WithForceFalse()
    {
        await CreateRepository().RestoreJobsAsync([201, 202, 203]);

        await AssertRestoredBatch("201,202,203");
    }

    [Fact]
    public async Task RestoreJobsAsync_ForwardsCompletedIds_GuardIsProcSide()
    {
        // C# no longer pre-filters completed jobs; the whole selection is forwarded
        // and uspRestoreJobs skips genuinely-completed rows itself.
        await CreateRepository().RestoreJobsAsync([200, 201, 202]);

        await AssertRestoredBatch("200,201,202");
    }

    [Fact]
    public async Task ReDispatchSelectedJobsAsync_ForwardsAllIdsAsCsv_WithForceFalse()
    {
        await CreateRepository().ReDispatchSelectedJobsAsync([300, 301]);

        await AssertRestoredBatch("300,301");
    }

    [Fact]
    public async Task RestoreJobsAsync_EmptyList_CallsNothing()
    {
        await CreateRepository().RestoreJobsAsync([]);

        await _procedures.DidNotReceiveWithAnyArgs().uspRestoreJobsAsync(
            null, null, null, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task RestoreJobsAsync_LargeSelection_ChunksIntoMultipleCalls()
    {
        // 301 ids > the 300-per-call batch size, so it splits into a 300-id chunk
        // and a 1-id chunk rather than overflowing the nvarchar(4000) CSV.
        var jobIds = Enumerable.Range(1, 301).ToList();

        await CreateRepository().RestoreJobsAsync(jobIds);

        await _procedures.Received(2).uspRestoreJobsAsync(Arg.Any<string>(), false,
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
        await _procedures.Received(1).uspRestoreJobsAsync(
            Arg.Is<string>(csv => csv.Split(',').Length == 300), false,
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
        await _procedures.Received(1).uspRestoreJobsAsync("301", false,
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }
}
