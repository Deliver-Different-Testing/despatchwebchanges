using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Covers the dispatch-page Overview boxes' despatch-Views scoping (ScopeToDespatchViews
/// = true), added so GetJobsForOverviewPageAsync/GetOpenJobsAsync match the main Jobs
/// List's behaviour when no view is selected, and the standalone Overview page's opt-out
/// (ScopeToDespatchViews = false, the default), which has no view selector and must keep
/// seeing all jobs regardless of DespatchViewIds. The "views selected" branch runs a raw
/// SQL query against a SQL-Server-only view (DESWEB_qry_Despatch_Job_View_Filters /
/// DESWEB_qryDespatch) that SQLite cannot host, so — same as the pre-existing gap
/// for the main list's own DespatchQry/BuildBaseQueryAsync — it isn't covered here.
/// </summary>
public class JobRepositoryOverviewViewsScopingTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryOverviewViewsScopingTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
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
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
    );

    [Fact]
    public async Task GetJobsForOverviewPageAsync_ScopedNonUsTenantWithNoViewsSelected_ReturnsEmpty()
    {
        // Arrange — matches the main list's DespatchQry: a non-US tenant with no
        // despatch view selected must see nothing, not "everything", when the
        // caller (a Dispatch panel) opts into view scoping.
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        await using var context = _db.CreateContext();
        context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "JOB100", UcjbStatus = (int)JobStatus.Dispatched });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobsForOverviewPageAsync(
            JobStatusGroup.Active,
            new OverviewJobsRequest { ScopeToDespatchViews = true, DespatchViewIds = [] },
            TestContext.Current.CancellationToken);

        // Assert
        Assert.Empty(result.Items);
        Assert.Equal(0, result.Total);
    }

    [Fact]
    public async Task GetOpenJobsAsync_ScopedNonUsTenantWithNoViewsSelected_ReturnsEmpty()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        await using var context = _db.CreateContext();
        context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "JOB100", UcjbStatus = (int)JobStatus.Dispatched });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetOpenJobsAsync(
            new OpenJobsRequest { ScopeToDespatchViews = true, DespatchViewIds = [] });

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetJobsForOverviewPageAsync_UnscopedNonUsTenantWithNoViewsSelected_ReturnsAllJobs()
    {
        // Arrange — the standalone Overview page has no view selector at all and never
        // opts into scoping, so it must keep seeing every job regardless of DespatchViewIds.
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        await using var context = _db.CreateContext();
        context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "JOB100", UcjbStatus = (int)JobStatus.Dispatched });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobsForOverviewPageAsync(
            JobStatusGroup.Active,
            new OverviewJobsRequest { DespatchViewIds = [] },
            TestContext.Current.CancellationToken);

        // Assert
        var item = Assert.Single(result.Items);
        Assert.Equal(1, result.Total);
        Assert.Equal("JOB100", item.JobName);
    }

    [Fact]
    public async Task GetOpenJobsAsync_UnscopedNonUsTenantWithNoViewsSelected_ReturnsAllJobs()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        await using var context = _db.CreateContext();
        context.TucJobs.Add(new TucJob { UcjbId = 100, UcjbNumber = "JOB100", UcjbStatus = (int)JobStatus.Dispatched });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetOpenJobsAsync(new OpenJobsRequest { DespatchViewIds = [] });

        // Assert
        Assert.Single(result);
        Assert.Equal("JOB100", result[0].Reference);
    }
}
