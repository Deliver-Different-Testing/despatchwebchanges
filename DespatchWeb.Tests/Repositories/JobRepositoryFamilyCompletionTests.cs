using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// A linehaul family finishes when the final-mile DEL leg is delivered, not when whichever leg
/// happens to complete last does. LHP and LH legs legitimately complete days before DEL is even
/// live, and completing the parent then both misreports the family and — because the POD message is
/// raised off the parent in the SQL layer — texts the customer before their freight has arrived.
/// </summary>
public class JobRepositoryFamilyCompletionTests : IAsyncDisposable
{
    private const int ParentId = 100;

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryFamilyCompletionTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
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
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
    );

    [Fact]
    public async Task UpdatePodDetailsAsync_LastLinehaulLegDelivered_LeavesTheParentOpenUntilDel()
    {
        // Arrange - LHP already delivered, LH1 delivering now, DEL still to run
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.AddRange(
                Job(ParentId, "KT2103CRT"),
                Job(101, "KT2103CRTLHP", parentId: ParentId, done: true),
                Job(102, "KT2103CRTLH1", parentId: ParentId),
                Job(103, "KT2103CRTDEL", parentId: ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act - complete the last linehaul leg
        await CreateRepository().UpdatePodDetailsAsync(PodFor(102));

        // Assert
        await using var assertContext = _db.CreateContext();
        var parent = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == ParentId, TestContext.Current.CancellationToken);
        Assert.False(parent.UcjbJobDone);
        Assert.Null(parent.UcjbComplTime);
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_FinalMileDelivered_CompletesTheParent()
    {
        // Arrange - everything upstream is done and DEL is delivering now
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.AddRange(
                Job(ParentId, "KT2103CRT"),
                Job(101, "KT2103CRTLHP", parentId: ParentId, done: true),
                Job(102, "KT2103CRTLH1", parentId: ParentId, done: true),
                Job(103, "KT2103CRTDEL", parentId: ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        await CreateRepository().UpdatePodDetailsAsync(PodFor(103));

        // Assert
        await using var assertContext = _db.CreateContext();
        var parent = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == ParentId, TestContext.Current.CancellationToken);
        Assert.True(parent.UcjbJobDone);
        Assert.NotNull(parent.UcjbComplTime);
        Assert.Equal((int)JobStatus.Completed, parent.UcjbStatus);
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_LinehaulFamilyWithNoDelLegYet_LeavesTheParentOpen()
    {
        // Arrange - DEL has not been created yet, so "no uncompleted siblings" was true and the
        // parent completed early
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.AddRange(
                Job(ParentId, "KT2103CRT"),
                Job(101, "KT2103CRTLHP", parentId: ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        await CreateRepository().UpdatePodDetailsAsync(PodFor(101));

        // Assert
        await using var assertContext = _db.CreateContext();
        var parent = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == ParentId, TestContext.Current.CancellationToken);
        Assert.False(parent.UcjbJobDone);
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_OrdinaryFamilyWithNoLinehaulLegs_StillCompletesOnTheLastLeg()
    {
        // Arrange - a plain multi-drop family keeps the original behaviour
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.AddRange(
                Job(ParentId, "KT2103CRT"),
                Job(101, "KT2103CRTA", parentId: ParentId, done: true),
                Job(102, "KT2103CRTB", parentId: ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        await CreateRepository().UpdatePodDetailsAsync(PodFor(102));

        // Assert
        await using var assertContext = _db.CreateContext();
        var parent = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == ParentId, TestContext.Current.CancellationToken);
        Assert.True(parent.UcjbJobDone);
    }

    private static UpdatePodDetailsRequest PodFor(int jobId) =>
        new()
        {
            JobId = jobId,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Recipient",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

    private static TucJob Job(int id, string jobNumber, int? parentId = null, bool done = false) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = TestDates.Now.Date,
            UcjbTime = TestDates.Now.Date.AddHours(9),
            UcjbStatus = done ? (int)JobStatus.Completed : (int)JobStatus.PickedUp,
            UcjbJobDone = done,
            ParentId = parentId ?? id
        };
}
