using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Job-number searches resolve in tiers (exact on any date, then prefix inside the window, then contains)
/// so the common case is an index seek; wildcard searches evaluate once, capped.
/// </summary>
public class JobRepositoryPodSearchJobNumberTests : IAsyncDisposable
{
    private static readonly DateTime InWindow = new(2024, 1, 15);
    private static readonly DateTime OutOfWindow = new(2023, 6, 1);

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactory;
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();

    public JobRepositoryPodSearchJobNumberTests()
    {
        _contextFactory = _db.CreateFactoryMock();
        _tenantInfo.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfo.IsUsTenant().Returns(false);

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

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private JobRepository CreateRepository() => new(
        _contextFactory,
        _tenantInfo,
        new FakeTenantClock(TestDates.Now),
        Substitute.For<IClearListEnvelopeService>(),
        Substitute.For<ICreateJobService>(),
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>());

    private static PodSearchRequest Request(string job = "", string wild = "", bool forceContains = false,
        List<int> clientIds = null) => new()
    {
        FromDate = new DateTimeOffset(2024, 1, 1, 0, 0, 0, TimeSpan.Zero),
        ToDate = new DateTimeOffset(2024, 1, 31, 0, 0, 0, TimeSpan.Zero),
        CourierIds = [],
        ClientIds = clientIds ?? [],
        SpeedIds = [],
        Job = job,
        Wild = wild,
        ForceContains = forceContains
    };

    private async Task SeedAsync(params object[] jobs)
    {
        await using var context = _db.CreateContext();
        foreach (var job in jobs)
        {
            context.Add(job);
        }

        await context.SaveChangesAsync(Ct);
    }

    private static TucJob Live(int id, string number, DateTime? date = null, int? clientId = null, string toAddr = null) => new()
    {
        UcjbId = id,
        UcjbNumber = number,
        UcjbDate = date ?? InWindow,
        UcjbTime = (date ?? InWindow).AddHours(9),
        UcjbClientId = clientId,
        UcjbToAddr = toAddr
    };

    private static TucJobArchive Archived(int id, string number, DateTime? date = null) => new()
    {
        UcjbId = id,
        UcjbNumber = number,
        UcjbDate = date ?? InWindow,
        UcjbTime = (date ?? InWindow).AddHours(9)
    };

    [Fact]
    public async Task ExactNumber_OutsideTheWindow_IsReturnedAndFlagged()
    {
        await SeedAsync(Live(1, "E3739FHS", OutOfWindow), Live(2, "E9999FHS"));

        var result = await CreateRepository().PodSearchAsync(Request(job: "E3739FHS"), Ct);

        var job = Assert.Single(result.Jobs);
        Assert.Equal(1, job.Id);
        Assert.True(job.OutsideDateRange);
        Assert.Equal("exact", result.MatchMode);
        Assert.Equal(1, result.TotalCount);
    }

    [Fact]
    public async Task ExactNumberOnAnOldJob_DoesNotHideInWindowNumbersStartingWithIt()
    {
        await SeedAsync(
            Live(1, "1001", OutOfWindow),
            Live(2, "10012"),
            Archived(3, "10013"),
            Live(4, "10014", OutOfWindow),
            Live(5, "X1001"));

        var result = await CreateRepository().PodSearchAsync(Request(job: "1001"), Ct);

        Assert.Equal("exact", result.MatchMode);
        Assert.Equal([1, 2, 3], result.Jobs.Select(j => j.Id).Order());
        Assert.Equal(3, result.StatusCounts.Total);
        Assert.True(result.Jobs.Single(j => j.Id == 1).OutsideDateRange);
        Assert.All(result.Jobs.Where(j => j.Id != 1), j => Assert.False(j.OutsideDateRange));
    }

    [Fact]
    public async Task ExactNumber_InsideTheWindow_IsNotFlagged()
    {
        await SeedAsync(Archived(5, "E3739FHS"));

        var result = await CreateRepository().PodSearchAsync(Request(job: "E3739FHS"), Ct);

        var job = Assert.Single(result.Jobs);
        Assert.True(job.IsArchived);
        Assert.False(job.OutsideDateRange);
    }

    [Fact]
    public async Task ExactNumber_StillHonoursTheClientFilter()
    {
        await SeedAsync(Live(1, "E3739FHS", OutOfWindow, clientId: 7), Live(2, "E3739FHSX", clientId: 9));

        var result = await CreateRepository().PodSearchAsync(Request(job: "E3739FHS", clientIds: [9]), Ct);

        // The exact match belongs to another client, so the search falls through to the prefix tier.
        Assert.Equal(2, Assert.Single(result.Jobs).Id);
        Assert.Equal("prefix", result.MatchMode);
    }

    [Fact]
    public async Task Prefix_IsWindowed_AndExcludesContainsOnlyMatches()
    {
        await SeedAsync(
            Live(1, "E3739FHS"),
            Live(2, "E3739NDP", OutOfWindow),
            Live(3, "XE3739AA"),
            Archived(4, "E3739MD"));

        var result = await CreateRepository().PodSearchAsync(Request(job: "E3739"), Ct);

        Assert.Equal("prefix", result.MatchMode);
        Assert.Equal([1, 4], result.Jobs.Select(j => j.Id).Order());
        Assert.Equal(2, result.StatusCounts.Total);
        Assert.All(result.Jobs, j => Assert.False(j.OutsideDateRange));
    }

    [Fact]
    public async Task NoExactOrPrefixHit_FallsBackToContains()
    {
        await SeedAsync(Live(1, "E35088FHS"), Live(2, "E99999FHS"));

        var result = await CreateRepository().PodSearchAsync(Request(job: "35088"), Ct);

        Assert.Equal("contains", result.MatchMode);
        Assert.Equal(1, Assert.Single(result.Jobs).Id);
    }

    [Fact]
    public async Task ForceContains_SkipsTheTiers()
    {
        await SeedAsync(Live(1, "E3739FHS"), Live(2, "XE3739AA"));

        var result = await CreateRepository().PodSearchAsync(Request(job: "E3739", forceContains: true), Ct);

        Assert.Equal("contains", result.MatchMode);
        Assert.Equal([1, 2], result.Jobs.Select(j => j.Id).Order());
    }

    [Fact]
    public async Task EmptyWindowedSearch_ReportsMatchesOutsideTheWindowWithTheirDateSpan()
    {
        await SeedAsync(
            Live(1, "E3739FHS", OutOfWindow),
            Archived(2, "E3739NDP", new DateTime(2024, 3, 9, 14, 0, 0)));

        var result = await CreateRepository().PodSearchAsync(Request(job: "E3739"), Ct);

        Assert.Empty(result.Jobs);
        Assert.Equal(2, result.OutsideWindowCount);
        Assert.Equal(OutOfWindow, result.OutsideWindowFrom);
        Assert.Equal(new DateTime(2024, 3, 9), result.OutsideWindowTo);
    }

    [Fact]
    public async Task OutsideWindowCount_HonoursTheClientFilter()
    {
        // In the window but for another client, and outside the window for the searched client.
        await SeedAsync(Live(1, "E3739FHS", clientId: 9), Live(2, "E3739NDP", OutOfWindow, clientId: 7));

        var result = await CreateRepository().PodSearchAsync(Request(job: "E3739", clientIds: [7]), Ct);

        Assert.Empty(result.Jobs);
        Assert.Equal(1, result.OutsideWindowCount);
        Assert.Equal(OutOfWindow, result.OutsideWindowFrom);
    }

    [Fact]
    public async Task OutsideWindowMatchesOverTheCap_ReportNoDateSpan()
    {
        await SeedAsync(Enumerable.Range(1, JobRepository.OutsideWindowCountCap + 3)
            .Select(i => (object)Live(i, $"E3739{i:000}", OutOfWindow.AddDays(-i))).ToArray());

        var result = await CreateRepository().PodSearchAsync(Request(job: "E3739"), Ct);

        Assert.Equal(JobRepository.OutsideWindowCountCap + 1, result.OutsideWindowCount);
        Assert.Null(result.OutsideWindowFrom);
        Assert.Null(result.OutsideWindowTo);
    }

    [Fact]
    public async Task EmptySearchWithNothingAnywhere_ReportsZeroOutside()
    {
        await SeedAsync(Live(1, "E1111FHS"));

        var result = await CreateRepository().PodSearchAsync(Request(job: "E3739"), Ct);

        Assert.Equal(0, result.OutsideWindowCount);
        Assert.Null(result.OutsideWindowFrom);
    }

    [Fact]
    public void IsCommandTimeout_RecognisesOnlyTimeouts()
    {
        Assert.False(JobRepository.IsCommandTimeout(new InvalidOperationException()));
        Assert.False(JobRepository.IsCommandTimeout(
            new Microsoft.EntityFrameworkCore.Storage.RetryLimitExceededException("x", new InvalidOperationException())));
    }

    [Fact]
    public async Task ExactMatchInBothTables_IsReturnedOnce()
    {
        await SeedAsync(Live(1, "E3739FHS"), Archived(1, "E3739FHS"));

        var result = await CreateRepository().PodSearchAsync(Request(job: "E3739FHS"), Ct);

        Assert.False(Assert.Single(result.Jobs).IsArchived);
    }

    [Fact]
    public async Task PrefixResults_PageAcrossRequests()
    {
        await SeedAsync(Enumerable.Range(1, 5).Select(i => (object)Live(i, $"E3739{i:00}")).ToArray());

        var first = await CreateRepository().PodSearchAsync(
            new PodSearchRequest { FromDate = Request().FromDate, ToDate = Request().ToDate, Job = "E3739", PageSize = 3 }, Ct);
        var second = await CreateRepository().PodSearchAsync(
            new PodSearchRequest { FromDate = Request().FromDate, ToDate = Request().ToDate, Job = "E3739", PageSize = 3, Page = 1 }, Ct);

        Assert.True(first.HasMore);
        Assert.False(second.HasMore);
        Assert.Equal(5, second.TotalCount);
        Assert.Equal(5, first.Jobs.Concat(second.Jobs).Select(j => j.Id).Distinct().Count());
    }

    [Fact]
    public async Task Wildcard_ShorterThanTheMinimum_IsTooBroad()
    {
        await SeedAsync(Live(1, "E1", toAddr: "ab street"));

        var result = await CreateRepository().PodSearchAsync(Request(wild: "ab"), Ct);

        Assert.True(result.SearchTooBroad);
        Assert.Empty(result.Jobs);
    }

    [Fact]
    public async Task Wildcard_ReturnsMatchesWithTalliesInOnePass()
    {
        await SeedAsync(
            Live(1, "E1", toAddr: "12 Soanes Road"),
            Archived(2, "E2"),
            Live(3, "E3", toAddr: "Elsewhere"));
        await using (var context = _db.CreateContext())
        {
            (await context.TucJobArchives.SingleAsync(j => j.UcjbId == 2, Ct)).UcjbToAddr = "Soanes Lane";
            await context.SaveChangesAsync(Ct);
        }

        var result = await CreateRepository().PodSearchAsync(Request(wild: "soanes"), Ct);

        Assert.Equal([1, 2], result.Jobs.Select(j => j.Id).Order());
        Assert.Equal(2, result.TotalCount);
        Assert.Equal(2, result.StatusCounts.Total);
        Assert.False(result.TotalIsCapped);
        Assert.False(result.SearchTooBroad);
    }

    [Fact]
    public async Task Wildcard_BeyondTheCap_ReportsACappedTotal()
    {
        await SeedAsync(Enumerable.Range(1, JobRepository.WildcardMatchCap + 5)
            .Select(i => (object)Live(i, $"E{i}", toAddr: "Soanes Road")).ToArray());

        var result = await CreateRepository().PodSearchAsync(Request(wild: "soanes"), Ct);

        Assert.True(result.TotalIsCapped);
        Assert.Equal(JobRepository.WildcardMatchCap, result.TotalCount);
        Assert.Equal(JobRepository.WildcardMatchCap, result.StatusCounts.Total);
        Assert.True(result.HasMore);
        Assert.Equal(50, result.Jobs.Count);
    }
}
