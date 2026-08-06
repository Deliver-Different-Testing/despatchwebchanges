using System.Reflection;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// The job search "General Search" box is a free-text wildcard over the job tables. Users reported
/// it missing jobs because only a subset of the text columns were being matched, so these tests
/// enumerate every mapped string column on tucJob / tucJobArchives / tblBulkJob from the EF model
/// and assert each one is reachable. A column added to the table in a future scaffold therefore
/// fails these tests until it is either wired into the search or added to
/// <see cref="NotSearchedColumns"/> with a reason.
/// </summary>
public class JobRepositoryWildcardSearchTests : IAsyncDisposable
{
    private const string Token = "ZQFIND";

    /// <summary>
    /// Columns deliberately left out of the wildcard search. Coordinates are numeric blobs whose
    /// digits would match almost any numeric search term, the tracking URL is derived from a
    /// connote that is already searched, and the settlement mode is an internal flag value.
    /// </summary>
    private static readonly string[] NotSearchedColumns =
    [
        nameof(TucJob.PickupGps),
        nameof(TucJob.DeliveryGps),
        nameof(TucJob.GssTrackingUrl),
        nameof(TucJob.MasterSubSettlementMode),
        nameof(TblBulkJob.PickUpLatitude),
        nameof(TblBulkJob.PickUpLongitude),
        nameof(TblBulkJob.DeliveryLatitude),
        nameof(TblBulkJob.DeliveryLongitude)
    ];

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryWildcardSearchTests()
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

    private static PodSearchRequest Request(string wild) => new()
    {
        FromDate = new DateTimeOffset(2024, 1, 1, 0, 0, 0, TimeSpan.Zero),
        ToDate = new DateTimeOffset(2024, 1, 31, 0, 0, 0, TimeSpan.Zero),
        CourierIds = [],
        ClientIds = [],
        SpeedIds = [],
        Job = string.Empty,
        Wild = wild,
        PageSize = 500
    };

    /// <summary>
    /// Every mapped string column on the entity, in a stable order, excluding the ones the search
    /// deliberately ignores. Reading the model (rather than the CLR type) keeps unmapped helper
    /// properties out of the expectation.
    /// </summary>
    private IReadOnlyList<PropertyInfo> SearchableColumns<T>()
    {
        using var context = _db.CreateContext();
        return
        [
            .. context.Model.FindEntityType(typeof(T))!
                .GetProperties()
                .Select(p => p.PropertyInfo)
                .Where(p => p is not null && p.PropertyType == typeof(string))
                .Select(p => p!)
                .Where(p => !NotSearchedColumns.Contains(p.Name))
                .OrderBy(p => p.Name, StringComparer.Ordinal)
        ];
    }

    /// <summary>
    /// Seeds one row per column with the search token in that column alone, so a row comes back
    /// from the search if and only if its column is covered by the wildcard predicate.
    /// </summary>
    private static void SeedOneRowPerColumn<T>(
        IReadOnlyList<PropertyInfo> columns,
        Func<int, T> createRow,
        Action<T> add)
    {
        for (var i = 0; i < columns.Count; i++)
        {
            var row = createRow(i + 1);
            columns[i].SetValue(row, Token + i);
            add(row);
        }
    }

    private static string[] MissingColumns(
        IReadOnlyList<PropertyInfo> columns,
        IReadOnlyCollection<int> foundIds) =>
    [
        .. columns
            .Select((p, i) => (Name: p.Name, Id: i + 1))
            .Where(c => !foundIds.Contains(c.Id))
            .Select(c => c.Name)
    ];

    [Fact]
    public async Task PodSearchAsync_Wildcard_MatchesEveryTextColumnOnLiveJobs()
    {
        var columns = SearchableColumns<TucJob>();

        await using (var context = _db.CreateContext())
        {
            SeedOneRowPerColumn(columns, CreateLiveJob, j => context.TucJobs.Add(j));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var result = await CreateRepository().PodSearchAsync(Request(Token), TestContext.Current.CancellationToken);

        var missing = MissingColumns(columns, [.. result.Jobs.Select(j => j.Id)]);
        Assert.Empty(missing);
        Assert.Equal(columns.Count, result.TotalCount);
    }

    [Fact]
    public async Task PodSearchAsync_Wildcard_MatchesEveryTextColumnOnArchivedJobs()
    {
        var columns = SearchableColumns<TucJobArchive>();

        await using (var context = _db.CreateContext())
        {
            SeedOneRowPerColumn(columns, CreateArchivedJob, j => context.TucJobArchives.Add(j));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var result = await CreateRepository().PodSearchAsync(Request(Token), TestContext.Current.CancellationToken);

        var missing = MissingColumns(columns, [.. result.Jobs.Select(j => j.Id)]);
        Assert.Empty(missing);
        Assert.Equal(columns.Count, result.TotalCount);
    }

    [Fact]
    public async Task PodSearchDownloadAsync_Wildcard_MatchesTheSameColumnsAsTheSearch()
    {
        var liveColumns = SearchableColumns<TucJob>();

        await using (var context = _db.CreateContext())
        {
            SeedOneRowPerColumn(liveColumns, CreateLiveJob, j => context.TucJobs.Add(j));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var result = await CreateRepository().PodSearchDownloadAsync(
            courierIds: [],
            speedIds: [],
            wild: Token,
            job: string.Empty,
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            clientIds: []);

        var missing = MissingColumns(liveColumns, [.. result.Select(j => j.Id)]);
        Assert.Empty(missing);
    }

    /// <summary>
    /// BulkSearchAsync itself joins views SQLite cannot create, so the bulk half of the search is
    /// covered by running its wildcard predicate against tblBulkJob directly.
    /// </summary>
    [Fact]
    public async Task BulkJobWildcard_MatchesEveryTextColumn()
    {
        var columns = SearchableColumns<TblBulkJob>();

        await using var context = _db.CreateContext();
        SeedOneRowPerColumn(columns, CreateBulkJob, j => context.TblBulkJobs.Add(j));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var matched = await context.TblBulkJobs
            .Where(JobWildcardSearch.BulkJobMatches($"%{Token}%"))
            .Select(j => j.BulkJobId)
            .ToListAsync(TestContext.Current.CancellationToken);

        var missing = MissingColumns(columns, [.. matched]);
        Assert.Empty(missing);
    }

    /// <summary>
    /// Suburb names live on tucSuburb rather than the job row, and the archived branch of the
    /// search used to skip them entirely.
    /// </summary>
    [Fact]
    public async Task PodSearchAsync_Wildcard_MatchesPickupAndDeliverySuburbNames()
    {
        await using (var context = _db.CreateContext())
        {
            context.TucSuburbs.AddRange(CreateSuburb(1, "PICKUP"), CreateSuburb(2, "DELIVERY"));

            var liveFrom = CreateLiveJob(1);
            liveFrom.UcjbFrom = 1;
            var liveTo = CreateLiveJob(2);
            liveTo.UcjbTo = 2;
            var archivedFrom = CreateArchivedJob(3);
            archivedFrom.UcjbFrom = 1;
            var archivedTo = CreateArchivedJob(4);
            archivedTo.UcjbTo = 2;

            context.TucJobs.AddRange(liveFrom, liveTo);
            context.TucJobArchives.AddRange(archivedFrom, archivedTo);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var result = await CreateRepository().PodSearchAsync(Request(Token), TestContext.Current.CancellationToken);

        Assert.Equal([1, 2, 3, 4], result.Jobs.Select(j => j.Id).Order());
    }

    /// <summary>
    /// Flight details hang off tucJobNationwide. Live jobs already matched them; archived jobs did not.
    /// </summary>
    [Fact]
    public async Task PodSearchAsync_Wildcard_MatchesFlightDetailsOnLiveAndArchivedJobs()
    {
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateLiveJob(1));
            context.TucJobArchives.Add(CreateArchivedJob(2));
            context.TucJobNationwides.AddRange(
                new TucJobNationwide { UcnwId = 1, UcnwJobId = 1, UcnwFlightNo = Token + "-101" },
                new TucJobNationwide { UcnwId = 2, UcnwJobId = 2, UcnwFlightNo = Token + "-202" });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var result = await CreateRepository().PodSearchAsync(Request(Token), TestContext.Current.CancellationToken);

        Assert.Equal([1, 2], result.Jobs.Select(j => j.Id).Order());
    }

    /// <summary>
    /// Coordinates are excluded on purpose: a search for "123" must not drag in every job whose
    /// latitude happens to contain those digits.
    /// </summary>
    [Fact]
    public async Task PodSearchAsync_Wildcard_DoesNotMatchCoordinateColumns()
    {
        await using (var context = _db.CreateContext())
        {
            var job = CreateLiveJob(1);
            job.PickupGps = "-36.8485,174.7633";
            job.DeliveryGps = "-36.8485,174.7633";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var result = await CreateRepository().PodSearchAsync(Request("174.76"), TestContext.Current.CancellationToken);

        Assert.Empty(result.Jobs);
    }

    private static TucJob CreateLiveJob(int id) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = $"JOB-{id}",
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 9, 0, 0)
        };

    private static TucJobArchive CreateArchivedJob(int id) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = $"ARCH-{id}",
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbTime = new DateTime(2024, 1, 15, 9, 0, 0)
        };

    private static TucSuburb CreateSuburb(int id, string label) =>
        new()
        {
            UcsuId = id,
            UcsuName = $"{Token}-{label}-SUBURB",
            UcsuArea = 0,
            UcsuBaseRegion = 0,
            Smsname = label,
            PostCode = "00000",
            Created = TestDates.Now,
            CreatedBy = "test",
            LastModified = TestDates.Now,
            LastModifiedBy = "test"
        };

    private static TblBulkJob CreateBulkJob(int id) =>
        new()
        {
            BulkJobId = id,
            JobId = id,
            JobNumber = $"BULK-{id}",
            Barcode = $"BC-{id}",
            BookDate = new DateTime(2024, 1, 15),
            BookTime = new DateTime(2024, 1, 15, 9, 0, 0)
        };
}
