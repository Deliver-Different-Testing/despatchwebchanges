using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Archiving is performed by legacy SQL outside this codebase, so nothing stops a job id from
/// existing in TucJobs and TucJobArchives at the same time. PodSearchAsync queries both tables and
/// used to return the job twice and count it twice, inflating both the result list and the total.
/// </summary>
public class JobRepositoryPodSearchDedupeTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryPodSearchDedupeTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        // PodSearchAsync stamps a remaining-time on every row, which requires the eco settings row
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
        Substitute.For<ICourierRepository>()
    );

    private static PodSearchRequest Request() => new()
    {
        FromDate = new DateTimeOffset(2024, 1, 1, 0, 0, 0, TimeSpan.Zero),
        ToDate = new DateTimeOffset(2024, 1, 31, 0, 0, 0, TimeSpan.Zero),
        CourierIds = [],
        ClientIds = [],
        SpeedIds = [],
        Job = string.Empty,
        Wild = string.Empty
    };

    [Fact]
    public async Task PodSearchAsync_JobInBothTables_ReturnsAndCountsItOnce()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateLiveJob(1, "DUPE-001"));
            context.TucJobArchives.Add(CreateArchivedJob(1, "DUPE-001"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.PodSearchAsync(Request(), TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(1, result.TotalCount);
        Assert.Single(result.Jobs);
    }

    [Fact]
    public async Task PodSearchAsync_ArchiveOnlyJob_IsStillReturned()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateLiveJob(1, "LIVE-001"));
            context.TucJobArchives.Add(CreateArchivedJob(2, "ARCH-001"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.PodSearchAsync(Request(), TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(2, result.TotalCount);
        Assert.Contains(result.Jobs, j => j.JobNo == "LIVE-001");
        Assert.Contains(result.Jobs, j => j.JobNo == "ARCH-001");
    }

    [Fact]
    public async Task PodSearchAsync_JobIdSearchOnDuplicate_ReturnsSingleLiveRow()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateLiveJob(1, "DUPE-001"));
            context.TucJobArchives.Add(CreateArchivedJob(1, "DUPE-001"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();
        var request = new PodSearchRequest
        {
            JobId = 1,
            CourierIds = [],
            ClientIds = [],
            SpeedIds = [],
            Job = string.Empty,
            Wild = string.Empty
        };

        // Act
        var result = await repository.PodSearchAsync(request, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(1, result.TotalCount);
        var job = Assert.Single(result.Jobs);
        Assert.False(job.IsArchived);
    }

    private static TucJob CreateLiveJob(int id, string jobNumber) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 9, 0, 0)
        };

    private static TucJobArchive CreateArchivedJob(int id, string jobNumber) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 9, 0, 0)
        };
}
