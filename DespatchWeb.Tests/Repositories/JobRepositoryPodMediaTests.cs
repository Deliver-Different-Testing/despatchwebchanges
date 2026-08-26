using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// POD media is keyed in S3 by the id of the leg the courier completed, so resolving it for the
/// parent — the number the client actually holds — has to sweep the family. A leg keeps returning
/// only itself so the per-leg tabs stay honest about what happened on that leg.
/// </summary>
public class JobRepositoryPodMediaTests : IAsyncDisposable
{
    private const int ParentId = 200;

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock =
        Substitute.For<IClearListEnvelopeService>();

    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryPodMediaTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetCurrentTimeFromTimeZone(Arg.Any<TimeZone>()).Returns(TestDates.Now);
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

    [Fact]
    public async Task GetPodMediaLegsAsync_ParentOfALinehaulFamily_ReturnsItselfAndEveryLeg()
    {
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.AddRange(
                Job(ParentId, "E4672MD"),
                Job(201, "E4672MDLHP", ParentId),
                Job(202, "E4672MDLH1", ParentId),
                Job(203, "E4672MDDEL", ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var legs = await CreateRepository().GetPodMediaLegsAsync(ParentId);

        Assert.Equal([200, 201, 202, 203], legs.Select(l => l.JobId).Order());
        Assert.Equal("E4672MDDEL", legs.Single(l => l.JobId == 203).JobNumber);
        Assert.True(legs.Single(l => l.JobId == ParentId).IsRequestedJob);
        Assert.All(legs.Where(l => l.JobId != ParentId), l => Assert.False(l.IsRequestedJob));
    }

    [Fact]
    public async Task GetPodMediaLegsAsync_ArchivedLegs_StillAssembleAcrossBothTables()
    {
        // The reported job had an archived parent and archived legs, and a leg can be archived
        // independently of its parent, so neither table alone sees the whole family.
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(Job(ParentId, "E4672MD"));
            context.TucJobArchives.AddRange(
                ArchivedJob(201, "E4672MDLHP", ParentId),
                ArchivedJob(203, "E4672MDDEL", ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var legs = await CreateRepository().GetPodMediaLegsAsync(ParentId);

        Assert.Equal([200, 201, 203], legs.Select(l => l.JobId).Order());
    }

    [Fact]
    public async Task GetPodMediaLegsAsync_ArchivedParent_IsFoundAndSweepsItsLegs()
    {
        await using (var context = _db.CreateContext())
        {
            context.TucJobArchives.AddRange(
                ArchivedJob(ParentId, "E4672MD"),
                ArchivedJob(203, "E4672MDDEL", ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var legs = await CreateRepository().GetPodMediaLegsAsync(ParentId);

        Assert.Equal([200, 203], legs.Select(l => l.JobId).Order());
    }

    [Fact]
    public async Task GetPodMediaLegsAsync_LegJob_ReturnsOnlyItself()
    {
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.AddRange(
                Job(ParentId, "E4672MD"),
                Job(201, "E4672MDLHP", ParentId),
                Job(203, "E4672MDDEL", ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var legs = await CreateRepository().GetPodMediaLegsAsync(203);

        var leg = Assert.Single(legs);
        Assert.Equal(203, leg.JobId);
        Assert.True(leg.IsRequestedJob);
    }

    [Fact]
    public async Task GetPodMediaLegsAsync_VoidLegsAndOtherFamilies_AreExcluded()
    {
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.AddRange(
                Job(ParentId, "E4672MD"),
                Job(201, "E4672MDLHP", ParentId, isVoid: true),
                Job(203, "E4672MDDEL", ParentId),
                Job(300, "AB1234XX"),
                Job(301, "AB1234XXDEL", 300));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var legs = await CreateRepository().GetPodMediaLegsAsync(ParentId);

        Assert.Equal([200, 203], legs.Select(l => l.JobId).Order());
    }

    [Fact]
    public async Task GetPodMediaLegsAsync_CarriesTheTimestampsThatKeyTheS3MonthFolder()
    {
        var completed = new DateTime(2026, 8, 7, 8, 35, 0);
        var pickedUp = new DateTime(2026, 8, 6, 17, 43, 0);

        await using (var context = _db.CreateContext())
        {
            var parent = Job(ParentId, "E4672MD");
            parent.UcjbComplTime = completed;

            var del = Job(203, "E4672MDDEL", ParentId);
            del.UcjbComplTime = completed;
            del.PickUpTime = pickedUp;
            del.UcjbDispDate = new DateTime(2026, 8, 6);
            del.UcjbDispTime = new DateTime(2026, 8, 6, 16, 5, 0);

            context.TucJobs.AddRange(parent, del);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var legs = await CreateRepository().GetPodMediaLegsAsync(ParentId);

        var delLeg = legs.Single(l => l.JobId == 203);
        Assert.Equal(completed, delLeg.CompletedTime);
        Assert.Equal(pickedUp, delLeg.PickUpTime);
        Assert.Equal(new DateTime(2026, 8, 6, 16, 5, 0), delLeg.DispatchedTime);
    }

    [Fact]
    public async Task GetPodMediaLegsAsync_UnknownJob_ReturnsNothing()
    {
        var legs = await CreateRepository().GetPodMediaLegsAsync(999);

        Assert.Empty(legs);
    }

    private static TucJob Job(int id, string jobNumber, int? parentId = null, bool isVoid = false) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = TestDates.Now.Date,
            UcjbTime = TestDates.Now.Date.AddHours(9),
            UcjbStatus = (int)JobStatus.Completed,
            UcjbVoid = isVoid,
            ParentId = parentId ?? id
        };

    private static TucJobArchive ArchivedJob(int id, string jobNumber, int? parentId = null) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = TestDates.Now.Date,
            UcjbTime = TestDates.Now.Date.AddHours(9),
            UcjbStatus = (int)JobStatus.Completed,
            ParentId = parentId ?? id
        };
}
