using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Covers the dispatch-page Overview boxes' despatch-Views scoping, added so
/// GetJobsForOverviewPageAsync/GetOpenJobsAsync match the main Jobs List's
/// behaviour when no view is selected. The "views selected" branch runs a raw
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
    public async Task GetJobsForOverviewPageAsync_NonUsTenantWithNoViewsSelected_ReturnsEmpty()
    {
        // Arrange — matches the main list's DespatchQry: a non-US tenant with no
        // despatch view selected must see nothing, not "everything".
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
        Assert.Empty(result.Items);
        Assert.Equal(0, result.Total);
    }

    [Fact]
    public async Task GetOpenJobsAsync_NonUsTenantWithNoViewsSelected_ReturnsEmpty()
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
        Assert.Empty(result);
    }
}
