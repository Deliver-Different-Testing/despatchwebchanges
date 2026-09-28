using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// The job list's stats header describes the whole result set, not the rows loaded so far, so the
/// counts are aggregated in the database alongside the first page. These tests pin that the counts
/// span live and archived matches and every page, and that the bucket predicates survive the trip
/// through SQL.
/// </summary>
public class JobRepositoryPodSearchStatusCountsTests : IAsyncDisposable
{
    private const int PageSize = 50;

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryPodSearchStatusCountsTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        using var context = _db.CreateContext();
        context.TblEcoSettings.Add(new TblEcoSetting
        {
            SettingId = 1,
            EconomyDeliveryTime = new DateTime(2024, 1, 1, 17, 0, 0)
        });
        context.SaveChanges();
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

    private static PodSearchRequest Request(int page = 0) => new()
    {
        FromDate = new DateTimeOffset(2024, 1, 1, 0, 0, 0, TimeSpan.Zero),
        ToDate = new DateTimeOffset(2024, 1, 31, 0, 0, 0, TimeSpan.Zero),
        CourierIds = [],
        ClientIds = [],
        SpeedIds = [],
        Job = string.Empty,
        Wild = string.Empty,
        PageSize = PageSize,
        Page = page
    };

    [Fact]
    public async Task PodSearchAsync_FirstPage_CountsEveryMatchAcrossBothTablesAndAllPages()
    {
        // Arrange - 120 rows, so the first page of 50 sees well under half of them
        await using (var context = _db.CreateContext())
        {
            for (var i = 1; i <= 60; i++)
            {
                context.TucJobs.Add(CreateLiveJob(i, $"LIVE-{i:D4}", Bucket(i)));
                context.TucJobArchives.Add(CreateArchivedJob(1000 + i, $"ARCH-{i:D4}", Bucket(i)));
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var result = await CreateRepository()
            .PodSearchAsync(Request(), TestContext.Current.CancellationToken);

        // Assert - 20 of each bucket per table
        Assert.Equal(50, result.Jobs.Count);
        Assert.NotNull(result.StatusCounts);
        Assert.Equal(120, result.StatusCounts.Total);
        Assert.Equal(40, result.StatusCounts.Active);
        Assert.Equal(40, result.StatusCounts.Transit);
        Assert.Equal(40, result.StatusCounts.Done);
    }

    [Fact]
    public async Task PodSearchAsync_StatusFieldsThatDisagree_AreResolvedTheSameWayInSql()
    {
        // The status fields disagree routinely; the header has to read the resolved answer, not
        // ucjbStatus alone.
        await using (var context = _db.CreateContext())
        {
            var flaggedDone = CreateLiveJob(1, "LIVE-0001", JobStatus.New);
            flaggedDone.UcjbJobDone = true;

            var voided = CreateLiveJob(2, "LIVE-0002", JobStatus.Completed);
            voided.UcjbVoid = true;

            // No status at all — SQL's three-valued logic must not lose it out of every bucket.
            var statusless = CreateLiveJob(3, "LIVE-0003", JobStatus.New);
            statusless.UcjbStatus = null;

            context.TucJobs.AddRange(flaggedDone, voided, statusless);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var result = await CreateRepository()
            .PodSearchAsync(Request(), TestContext.Current.CancellationToken);

        Assert.NotNull(result.StatusCounts);
        Assert.Equal(3, result.StatusCounts.Total);
        Assert.Equal(1, result.StatusCounts.Done);
        Assert.Equal(1, result.StatusCounts.Active);
        // The voided job belongs to no bucket
        Assert.Equal(0, result.StatusCounts.Transit);
    }

    [Fact]
    public async Task PodSearchAsync_LaterPage_OmitsTheCountsTheFirstPageAlreadyAnswered()
    {
        await using (var context = _db.CreateContext())
        {
            for (var i = 1; i <= 60; i++)
            {
                context.TucJobs.Add(CreateLiveJob(i, $"LIVE-{i:D4}", Bucket(i)));
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var result = await CreateRepository()
            .PodSearchAsync(Request(page: 1), TestContext.Current.CancellationToken);

        Assert.Equal(10, result.Jobs.Count);
        Assert.Null(result.StatusCounts);
    }

    /// <summary>One job in each bucket, cycling.</summary>
    private static JobStatus Bucket(int i) => (i % 3) switch
    {
        0 => JobStatus.New,
        1 => JobStatus.InTransit,
        _ => JobStatus.Completed
    };

    private static TucJob CreateLiveJob(int id, string jobNumber, JobStatus status) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 9, 0, 0),
            UcjbStatus = (int)status,
            UcjbCourierId = status == JobStatus.InTransit ? 7 : null
        };

    private static TucJobArchive CreateArchivedJob(int id, string jobNumber, JobStatus status) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 9, 0, 0),
            UcjbStatus = (int)status,
            UcjbCourierId = status == JobStatus.InTransit ? 7 : null
        };
}
