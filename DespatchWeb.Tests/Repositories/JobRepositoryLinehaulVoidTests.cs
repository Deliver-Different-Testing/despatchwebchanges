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
/// Voiding a linehaul leg is routine — the client dropped the freight off themselves, or it travelled
/// on another booked run. It must not take the parent and the other legs with it, which is what the
/// default whole-family void did whenever the caller did not pass an explicit selection.
/// </summary>
public class JobRepositoryLinehaulVoidTests : IAsyncDisposable
{
    private const int ParentId = 100;

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryLinehaulVoidTests()
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
        Substitute.For<ICourierRepository>()
    );

    [Fact]
    public async Task VoidJobAsync_LinehaulLeg_VoidsOnlyThatLegAndLeavesTheFamilyIntact()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.AddRange(
                Job(ParentId, "KT2103CRT"),
                Job(101, "KT2103CRTLHP", parentId: ParentId),
                Job(102, "KT2103CRTLH1", parentId: ParentId),
                Job(103, "KT2103CRTDEL", parentId: ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act - no explicit selection, so this used to void the whole family
        await CreateRepository().VoidJobAsync(new VoidJobRequest
        {
            JobId = 101,
            VoidReason = "Client dropped it at the depot",
            VoidSingleJobOnly = false
        });

        // Assert
        await using var assertContext = _db.CreateContext();
        var jobs = await assertContext.TucJobs.ToDictionaryAsync(j => j.UcjbId, TestContext.Current.CancellationToken);
        Assert.True(jobs[101].UcjbVoid);
        Assert.False(jobs[ParentId].UcjbVoid);
        Assert.False(jobs[102].UcjbVoid);
        Assert.False(jobs[103].UcjbVoid);
    }

    [Fact]
    public async Task VoidJobAsync_FinalMileLeg_VoidsOnlyThatLegWhenUpstreamFreightIsAlreadyMoving()
    {
        // Arrange - LHP already picked up, so the freight is in the network
        await using (var context = _db.CreateContext())
        {
            var pickedUp = Job(101, "KT2103CRTLHP", parentId: ParentId);
            pickedUp.PickUpTime = TestDates.Now;
            pickedUp.UcjbStatus = (int)JobStatus.InTransit;

            context.TucJobs.AddRange(
                Job(ParentId, "KT2103CRT"),
                pickedUp,
                Job(103, "KT2103CRTDEL", parentId: ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        await CreateRepository().VoidJobAsync(new VoidJobRequest
        {
            JobId = 103,
            VoidReason = "Delivery cancelled",
            VoidSingleJobOnly = false
        });

        // Assert - the upstream leg that already ran keeps its work and its revenue
        await using var assertContext = _db.CreateContext();
        var jobs = await assertContext.TucJobs.ToDictionaryAsync(j => j.UcjbId, TestContext.Current.CancellationToken);
        Assert.True(jobs[103].UcjbVoid);
        Assert.False(jobs[101].UcjbVoid);
        Assert.False(jobs[ParentId].UcjbVoid);
    }

    [Fact]
    public async Task VoidJobAsync_OrdinaryFamily_StillVoidsTheWholeFamily()
    {
        // Arrange - non-linehaul families keep the original behaviour
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.AddRange(
                Job(ParentId, "KT2103CRT"),
                Job(101, "KT2103CRTA", parentId: ParentId),
                Job(102, "KT2103CRTB", parentId: ParentId));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        await CreateRepository().VoidJobAsync(new VoidJobRequest
        {
            JobId = 101,
            VoidReason = "Cancelled",
            VoidSingleJobOnly = false
        });

        // Assert
        await using var assertContext = _db.CreateContext();
        var jobs = await assertContext.TucJobs.ToDictionaryAsync(j => j.UcjbId, TestContext.Current.CancellationToken);
        Assert.True(jobs[101].UcjbVoid);
        Assert.True(jobs[102].UcjbVoid);
    }

    private static TucJob Job(int id, string jobNumber, int? parentId = null) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = TestDates.Now.Date,
            UcjbTime = TestDates.Now.Date.AddHours(9),
            UcjbStatus = (int)JobStatus.New,
            ParentId = parentId ?? id
        };
}
