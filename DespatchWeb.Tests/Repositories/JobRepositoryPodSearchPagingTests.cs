using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// PodSearchAsync counts the live and archived matches without a cap but used to materialise only
/// pageSize * 3 rows from each source before merging and slicing, so a search could report far more
/// jobs than the grid could ever page to (574 counted, 161 reachable) and could only order rows
/// within that arbitrary pool. These tests page the whole result set and assert that every counted
/// row is reachable in the requested order.
/// </summary>
public class JobRepositoryPodSearchPagingTests : IAsyncDisposable
{
    private const int PageSize = 50;

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryPodSearchPagingTests()
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
        Substitute.For<ICourierRepository>()
    );

    private static PodSearchRequest Request(string? sortColumn = null, string? sortDirection = null, int page = 0) => new()
    {
        FromDate = new DateTimeOffset(2024, 1, 1, 0, 0, 0, TimeSpan.Zero),
        ToDate = new DateTimeOffset(2024, 1, 31, 0, 0, 0, TimeSpan.Zero),
        CourierIds = [],
        ClientIds = [],
        SpeedIds = [],
        Job = string.Empty,
        Wild = string.Empty,
        PageSize = PageSize,
        Page = page,
        SortColumn = sortColumn,
        SortDirection = sortDirection
    };

    /// <summary>
    /// Walks every page the repository will serve, mirroring the grid's infinite scroll.
    /// </summary>
    private async Task<(List<DispatchJobViewModel> Jobs, int TotalCount)> PageThroughAsync(
        string? sortColumn = null,
        string? sortDirection = null)
    {
        var repository = CreateRepository();
        var jobs = new List<DispatchJobViewModel>();
        var totalCount = 0;

        for (var page = 0; page < 100; page++)
        {
            var result = await repository.PodSearchAsync(
                Request(sortColumn, sortDirection, page), TestContext.Current.CancellationToken);
            totalCount = result.TotalCount;
            jobs.AddRange(result.Jobs);

            if (!result.HasMore)
            {
                return (jobs, totalCount);
            }
        }

        Assert.Fail("Paging did not terminate within 100 pages.");
        return (jobs, totalCount);
    }

    [Fact]
    public async Task PodSearchAsync_MoreRowsThanFetchCeiling_EveryCountedRowIsReachableByPaging()
    {
        // Arrange - 400 rows, comfortably past the old pageSize * 3 per-source ceiling
        await using (var context = _db.CreateContext())
        {
            for (var i = 1; i <= 200; i++)
            {
                context.TucJobs.Add(CreateLiveJob(i, $"LIVE-{i:D4}"));
                context.TucJobArchives.Add(CreateArchivedJob(1000 + i, $"ARCH-{i:D4}"));
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var (jobs, totalCount) = await PageThroughAsync();

        // Assert
        Assert.Equal(400, totalCount);
        Assert.Equal(400, jobs.Count);
        Assert.Equal(400, jobs.Select(j => j.Id).Distinct().Count());
        Assert.Equal(200, jobs.Count(j => j.IsArchived));
    }

    [Fact]
    public async Task PodSearchAsync_DuplicateAcrossTables_CountedOnceAndPagedOnce()
    {
        // Arrange - 50 of the archived rows share an id with a live row
        await using (var context = _db.CreateContext())
        {
            for (var i = 1; i <= 200; i++)
            {
                context.TucJobs.Add(CreateLiveJob(i, $"LIVE-{i:D4}"));
                var archivedId = i <= 50 ? i : 1000 + i;
                context.TucJobArchives.Add(CreateArchivedJob(archivedId, $"ARCH-{i:D4}"));
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var (jobs, totalCount) = await PageThroughAsync();

        // Assert
        Assert.Equal(350, totalCount);
        Assert.Equal(350, jobs.Count);
        Assert.Equal(350, jobs.Select(j => j.Id).Distinct().Count());
        // The live row wins for every colliding id
        Assert.All(jobs.Where(j => j.Id <= 50), j => Assert.False(j.IsArchived));
    }

    [Fact]
    public async Task PodSearchAsync_SortedByJobNumberDescending_IsGloballyOrderedAcrossPages()
    {
        // Arrange - job numbers interleave across the two tables, so a correct sort must cross them
        await using (var context = _db.CreateContext())
        {
            for (var i = 1; i <= 200; i++)
            {
                context.TucJobs.Add(CreateLiveJob(i, $"JOB-{i * 2:D4}"));
                context.TucJobArchives.Add(CreateArchivedJob(1000 + i, $"JOB-{i * 2 - 1:D4}"));
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var (jobs, _) = await PageThroughAsync("jobNo", "desc");

        // Assert
        Assert.Equal(400, jobs.Count);
        Assert.Equal(
            jobs.Select(j => j.JobNo).OrderByDescending(n => n, StringComparer.Ordinal).ToList(),
            jobs.Select(j => j.JobNo).ToList());
    }

    [Fact]
    public async Task PodSearchAsync_SortedByDeliveryAddress_IsHonouredAcrossPages()
    {
        // Arrange - delivery addresses interleave across the two tables
        await using (var context = _db.CreateContext())
        {
            for (var i = 1; i <= 200; i++)
            {
                var live = CreateLiveJob(i, $"LIVE-{i:D4}");
                live.UcjbToAddr = $"ADDR-{i * 2:D4}";
                context.TucJobs.Add(live);

                var archived = CreateArchivedJob(1000 + i, $"ARCH-{i:D4}");
                archived.UcjbToAddr = $"ADDR-{i * 2 - 1:D4}";
                context.TucJobArchives.Add(archived);
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var (jobs, _) = await PageThroughAsync("delivery");

        // Assert
        Assert.Equal(400, jobs.Count);
        Assert.Equal(
            jobs.Select(j => j.ToAddress).OrderBy(a => a, StringComparer.Ordinal).ToList(),
            jobs.Select(j => j.ToAddress).ToList());
    }

    [Fact]
    public async Task PodSearchAsync_SortedByPickupSuburb_IsHonouredAcrossPages()
    {
        // Arrange - the pickup sort key lives behind a navigation, so it has to survive the union
        await using (var context = _db.CreateContext())
        {
            for (var i = 1; i <= 400; i++)
            {
                context.TucSuburbs.Add(CreateSuburb(i, $"SUB-{i:D4}"));
            }

            for (var i = 1; i <= 200; i++)
            {
                var live = CreateLiveJob(i, $"LIVE-{i:D4}");
                live.UcjbFrom = i * 2;
                context.TucJobs.Add(live);

                var archived = CreateArchivedJob(1000 + i, $"ARCH-{i:D4}");
                archived.UcjbFrom = i * 2 - 1;
                context.TucJobArchives.Add(archived);
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var (jobs, _) = await PageThroughAsync("pickup");

        // Assert
        Assert.Equal(400, jobs.Count);
        Assert.Equal(
            jobs.Select(j => j.From).OrderBy(f => f, StringComparer.Ordinal).ToList(),
            jobs.Select(j => j.From).ToList());
    }

    [Fact]
    public async Task PodSearchAsync_ExactMultipleOfPageSize_TerminatesWithoutDuplicates()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            for (var i = 1; i <= 100; i++)
            {
                context.TucJobs.Add(CreateLiveJob(i, $"LIVE-{i:D4}"));
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var (jobs, totalCount) = await PageThroughAsync();

        // Assert
        Assert.Equal(100, totalCount);
        Assert.Equal(100, jobs.Count);
        Assert.Equal(100, jobs.Select(j => j.Id).Distinct().Count());
    }

    [Fact]
    public async Task PodSearchAsync_PageBeyondEnd_ReturnsEmptyWithHasMoreFalse()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateLiveJob(1, "LIVE-0001"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.PodSearchAsync(
            Request(page: 5), TestContext.Current.CancellationToken);

        // Assert
        Assert.Empty(result.Jobs);
        Assert.False(result.HasMore);
        Assert.Equal(1, result.TotalCount);
    }

    [Fact]
    public async Task PodSearchAsync_UnrecognisedSortColumnDescending_SortsDateDescending()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            for (var i = 1; i <= 5; i++)
            {
                var live = CreateLiveJob(i, $"LIVE-{i:D4}");
                live.UcjbDate = new DateTime(2024, 1, 10).AddDays(i);
                context.TucJobs.Add(live);
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.PodSearchAsync(
            Request("remaining", "desc"), TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal([5, 4, 3, 2, 1], result.Jobs.Select(j => j.Id).ToList());
    }

    [Theory]
    [InlineData("date")]
    [InlineData("time")]
    [InlineData("jobNo")]
    [InlineData("client")]
    [InlineData("refA")]
    [InlineData("status")]
    [InlineData("speed")]
    [InlineData("courier")]
    [InlineData("pickup")]
    [InlineData("delivery")]
    [InlineData("vehicle")]
    public async Task PodSearchAsync_SortColumn_IsHonouredServerSideInBothDirections(string sortColumn)
    {
        // Arrange - every sort key populated on both sources so nothing falls back to a default
        await using (var context = _db.CreateContext())
        {
            for (var i = 1; i <= 12; i++)
            {
                context.TucSuburbs.Add(CreateSuburb(i, $"SUB-{i:D2}"));
                context.VehicleSizes.Add(CreateVehicleSize(i, $"VEH-{i:D2}"));
                context.TucJobStatuses.Add(CreateJobStatus(i, $"ST{i:D2}"));
                context.TucJobTypes.Add(CreateJobType(i, $"SPD-{i:D2}"));
                context.TucCouriers.Add(CreateCourier(i, $"CUR-{i:D2}"));
            }

            for (var i = 1; i <= 6; i++)
            {
                var live = CreateLiveJob(i, $"JOB-{i * 2:D4}");
                ApplySortKeys(live, i * 2);
                context.TucJobs.Add(live);

                var archived = CreateArchivedJob(1000 + i, $"JOB-{i * 2 - 1:D4}");
                ApplyArchivedSortKeys(archived, i * 2 - 1);
                context.TucJobArchives.Add(archived);
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var (ascending, _) = await PageThroughAsync(sortColumn);
        var (descending, _) = await PageThroughAsync(sortColumn, "desc");

        // Assert - every seeded row comes back, and the two directions are exact mirrors
        Assert.Equal(12, ascending.Count);
        Assert.Equal(12, descending.Count);
        Assert.Equal(ascending.Select(j => j.Id).Reverse().ToList(), descending.Select(j => j.Id).ToList());
    }

    private static void ApplySortKeys(TucJob job, int seed)
    {
        job.UcjbDate = new DateTime(2024, 1, 2).AddDays(seed);
        job.UcjbTime = new DateTime(2024, 1, 2).AddMinutes(seed);
        job.UcjbClientCode = $"CLI-{seed:D2}";
        job.UcjbClientRefa = $"REF-{seed:D2}";
        job.UcjbStatus = seed;
        job.UcjbSpeed = seed;
        job.UcjbCourierId = seed;
        job.UcjbFrom = seed;
        job.UcjbToAddr = $"ADDR-{seed:D2}";
        job.UcjbSize = seed;
    }

    private static void ApplyArchivedSortKeys(TucJobArchive job, int seed)
    {
        job.UcjbDate = new DateTime(2024, 1, 2).AddDays(seed);
        job.UcjbTime = new DateTime(2024, 1, 2).AddMinutes(seed);
        job.UcjbClientCode = $"CLI-{seed:D2}";
        job.UcjbClientRefa = $"REF-{seed:D2}";
        job.UcjbStatus = seed;
        job.UcjbSpeed = seed;
        job.UcjbCourierId = seed;
        job.UcjbFrom = seed;
        job.UcjbToAddr = $"ADDR-{seed:D2}";
        job.UcjbSize = seed;
    }

    private static TucSuburb CreateSuburb(int id, string name) =>
        new()
        {
            UcsuId = id,
            UcsuName = name,
            UcsuArea = 0,
            UcsuBaseRegion = 0,
            Smsname = name,
            PostCode = "0000",
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        };

    private static VehicleSize CreateVehicleSize(int id, string name) =>
        new()
        {
            VehicleSizeId = id,
            VehicleName = name,
            CreatedBy = "Test",
            LastModifiedBy = "Test"
        };

    private static TucJobStatus CreateJobStatus(int id, string code) =>
        new()
        {
            UcjsId = id,
            UcjsCode = code,
            UcjsName = code,
            UcjsReplyCode = code
        };

    private static TucJobType CreateJobType(int id, string shortName) =>
        new()
        {
            UcjtId = id,
            ShortName = shortName,
            UcjtName = shortName,
            UcjtCode = shortName,
            UcjtDescription = shortName,
            JobLetter = "J",
            Notes = string.Empty,
            SystemName = shortName,
            ExtraName = shortName,
            Alias = shortName,
            ServiceType = shortName,
            ServiceDescription = shortName,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        };

    private static TucCourier CreateCourier(int id, string code) =>
        new()
        {
            UccrId = id,
            Code = code,
            UccrName = code,
            UccrSurname = code,
            UccrEmail = $"{code}@test.com",
            UccrMobile = "1",
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        };

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
