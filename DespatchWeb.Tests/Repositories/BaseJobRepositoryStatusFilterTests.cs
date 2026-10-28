using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// The job list's category tabs filter in SQL, and must agree with the stats header that counts them —
/// a job the header calls Done has to be on the Done tab, and nowhere else.
/// </summary>
public class BaseJobRepositoryStatusFilterTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;

    public BaseJobRepositoryStatusFilterTests()
    {
        _context = _db.CreateContext();
        _context.TucJobs.AddRange(
            Job(1, JobStatus.Completed),
            Job(2, JobStatus.PickedUp, done: true),
            Job(3, JobStatus.Dispatched, completedTime: new DateTime(2024, 6, 15, 9, 0, 0)),
            Job(4, JobStatus.Undeliverable, done: true),
            Job(5, JobStatus.Completed, isVoid: true),
            Job(6, JobStatus.New));
        _context.SaveChanges();
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    [Fact]
    public async Task ApplyStatusFilter_Delivered_MatchesEveryJobTheHeaderCountsAsDone()
    {
        var ids = await FilteredIds("delivered");

        Assert.Equal([1, 2, 3], ids);
    }

    [Fact]
    public async Task ApplyStatusFilter_InProgress_IsEverythingDeliveredIsNot()
    {
        var ids = await FilteredIds("in-progress");

        Assert.Equal([4, 5, 6], ids);
    }

    [Theory]
    [InlineData(false, false, "DESWEB_qryDespatch")]
    [InlineData(false, true, "DESWEB_qryDespatchAll")]
    [InlineData(true, false, "DESWEB_qry_Despatch_Job_View_Filters")]
    [InlineData(true, true, "DESWEB_qry_Despatch_Job_View_FiltersAll")]
    public void DespatchViewName_PicksTheFinishedInclusiveViewOnlyWhenAsked(
        bool isUsTenant, bool includeFinished, string expected)
    {
        Assert.Equal(expected, BaseJobRepository.DespatchViewName(isUsTenant, includeFinished));
    }

    private async Task<List<int>> FilteredIds(string statusFilter) =>
        await BaseJobRepository.ApplyStatusFilter(_context.TucJobs, statusFilter)
            .Select(j => j.UcjbId)
            .OrderBy(id => id)
            .ToListAsync(TestContext.Current.CancellationToken);

    private static TucJob Job(int id, JobStatus status, bool done = false, bool isVoid = false,
        DateTime? completedTime = null) => new()
    {
        UcjbId = id,
        UcjbNumber = $"JOB{id:D3}",
        UcjbStatus = (int)status,
        UcjbJobDone = done,
        UcjbVoid = isVoid,
        UcjbComplTime = completedTime
    };
}
