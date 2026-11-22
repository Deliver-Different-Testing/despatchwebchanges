using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// A scheduled booking's linehaul leg can go live while its parent is still parked in tblBulkJob.
/// The schedule procs write the bulk parent's id into the live leg's ParentId until the parent is
/// released, and bulk ids overlap tucJob ids. These tests seed exactly that collision: bulk family
/// E901BIO and an unrelated live family P3776 share ids 7782-7787.
/// </summary>
public class JobRepositoryBulkIdCollisionTests : IAsyncDisposable
{
    private const int BulkParentId = 7782;
    private const int LiveLeg = 9001;
    private static readonly int[] UnrelatedLiveFamily = [7782, 7783, 7784, 7785, 7786, 7787];
    private static readonly int[] BookingBulkRows = [7782, 7783, 7786, 7787];

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryBulkIdCollisionTests()
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
        Substitute.For<IClearListEnvelopeService>(),
        Substitute.For<ICreateJobService>(),
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
    );

    private async Task SeedCollisionAsync(int? releasedParentJobId = null)
    {
        await using var context = _db.CreateContext();

        context.TucJobs.AddRange(
            Job(7782, "P3776"),
            Job(7783, "P3776LHP", parentId: 7782),
            Job(7784, "P3776LH1", parentId: 7782),
            Job(7785, "P3776LH2", parentId: 7782),
            Job(7786, "P3776LH3", parentId: 7782),
            Job(7787, "P3776DEL", parentId: 7782));

        var leg = Job(LiveLeg, "E901BIOLH1", parentId: BulkParentId);
        leg.RootParentId = BulkParentId;
        leg.InformationParentId = BulkParentId;
        leg.BulkParentId = BulkParentId;
        context.TucJobs.Add(leg);

        if (releasedParentJobId is { } released)
        {
            context.TucJobs.Add(Job(released, "E901BIO"));
        }

        context.TblBulkJobs.AddRange(
            BulkJob(7782, "E901BIO", jobId: releasedParentJobId),
            BulkJob(7783, "E901BIOLHP", bulkParentId: BulkParentId),
            BulkJob(7786, "E901BIOLH2", bulkParentId: BulkParentId),
            BulkJob(7787, "E901BIODEL", bulkParentId: BulkParentId));

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectListAsync_LegWithParkedParent_ListsOnlyItsOwnBooking()
    {
        // Arrange
        await SeedCollisionAsync();

        // Act
        var related = await CreateRepository().GetRelatedJobsMultiSelectListAsync(LiveLeg, false);

        // Assert
        var live = related.Where(r => !r.IsBulkJob).Select(r => r.Text).Order();
        var bulk = related.Where(r => r.IsBulkJob).Select(r => r.Text).Order();
        Assert.Equal(["E901BIOLH1"], live);
        Assert.Equal(["E901BIO", "E901BIODEL", "E901BIOLH2", "E901BIOLHP"], bulk);
        Assert.Single(related, r => r.Selected);
        Assert.True(related.Single(r => r.Selected) is { Id: LiveLeg, IsBulkJob: false });
    }

    [Fact]
    public async Task GetJobParentIdAsync_LegWithParkedParent_HasNoLiveParent()
    {
        // Arrange
        await SeedCollisionAsync();

        // Act
        var parentId = await CreateRepository().GetJobParentIdAsync(LiveLeg);

        // Assert - 7782 is the bulk parent's id, not the live job P3776
        Assert.Null(parentId);
    }

    [Fact]
    public async Task GetJobParentIdAsync_LegWhoseParentWasReleasedButNotRepointed_ResolvesTheReleasedJob()
    {
        // Arrange
        await SeedCollisionAsync(releasedParentJobId: 9100);

        // Act
        var parentId = await CreateRepository().GetJobParentIdAsync(LiveLeg);

        // Assert
        Assert.Equal(9100, parentId);
    }

    [Fact]
    public async Task GetEffectiveJobIdAsync_LegWithParkedParent_IsItsOwnRoot()
    {
        // Arrange
        await SeedCollisionAsync();
        await using var context = _db.CreateContext();

        // Act
        var effectiveId = await context.GetEffectiveJobIdAsync(LiveLeg);

        // Assert
        Assert.Equal(LiveLeg, effectiveId);
    }

    [Fact]
    public async Task VoidJobAsync_SelectionOutsideTheBooking_IsRejectedAndNothingIsVoided()
    {
        // Arrange - the ticket's request: P3776's live ids sent as "related" from E901BIOLH1
        await SeedCollisionAsync();

        // Act
        var act = () => CreateRepository().VoidJobAsync(new VoidJobRequest
        {
            JobId = LiveLeg,
            VoidReason = "Booking cancelled",
            VoidSingleJobOnly = false,
            SelectedJobIds = [LiveLeg, .. UnrelatedLiveFamily]
        });

        // Assert
        await Assert.ThrowsAsync<VoidSelectionException>(act);
        await using var assertContext = _db.CreateContext();
        Assert.False(await assertContext.TucJobs.AnyAsync(j => j.UcjbVoid, TestContext.Current.CancellationToken));
        Assert.False(await assertContext.TblBulkJobs.AnyAsync(b => b.Void, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task VoidJobAsync_LegAndItsBulkRowsSelected_VoidsTheBookingAndLeavesTheCollidingJobsAlone()
    {
        // Arrange
        await SeedCollisionAsync();

        // Act
        await CreateRepository().VoidJobAsync(new VoidJobRequest
        {
            JobId = LiveLeg,
            VoidReason = "Booking cancelled",
            VoidSingleJobOnly = false,
            SelectedJobIds = [LiveLeg],
            SelectedBulkJobIds = [.. BookingBulkRows]
        });

        // Assert
        await using var assertContext = _db.CreateContext();
        var jobs = await assertContext.TucJobs.ToDictionaryAsync(j => j.UcjbId, TestContext.Current.CancellationToken);
        Assert.True(jobs[LiveLeg].UcjbVoid);
        Assert.All(UnrelatedLiveFamily, id => Assert.False(jobs[id].UcjbVoid));

        var bulkRows = await assertContext.TblBulkJobs.ToListAsync(TestContext.Current.CancellationToken);
        Assert.All(bulkRows, b => Assert.True(b.Void));
    }

    [Fact]
    public async Task VoidJobAsync_UnrelatedParentWithChildren_DoesNotSweepInALegPointingAtTheBulkId()
    {
        // Arrange
        await SeedCollisionAsync();

        // Act - void P3776 and its children
        await CreateRepository().VoidJobAsync(new VoidJobRequest
        {
            JobId = 7782,
            VoidReason = "Cancelled",
            VoidSingleJobOnly = true
        });

        // Assert
        await using var assertContext = _db.CreateContext();
        var jobs = await assertContext.TucJobs.ToDictionaryAsync(j => j.UcjbId, TestContext.Current.CancellationToken);
        Assert.All(UnrelatedLiveFamily, id => Assert.True(jobs[id].UcjbVoid));
        Assert.False(jobs[LiveLeg].UcjbVoid);
    }

    [Fact]
    public async Task VoidJobAsync_OrdinaryFamilySelection_StillVoidsTheSelectedMembers()
    {
        // Arrange
        await SeedCollisionAsync();

        // Act
        await CreateRepository().VoidJobAsync(new VoidJobRequest
        {
            JobId = 7782,
            VoidReason = "Cancelled",
            VoidSingleJobOnly = false,
            SelectedJobIds = [7782, 7787]
        });

        // Assert
        await using var assertContext = _db.CreateContext();
        var voided = await assertContext.TucJobs.Where(j => j.UcjbVoid).Select(j => j.UcjbId)
            .OrderBy(id => id).ToListAsync(TestContext.Current.CancellationToken);
        Assert.Equal([7782, 7787], voided);
    }

    [Fact]
    public async Task VoidBulkJobAsync_SelectionOutsideTheBulkFamily_IsRejectedAndNothingIsVoided()
    {
        // Arrange
        await SeedCollisionAsync();
        await using (var context = _db.CreateContext())
        {
            context.TblBulkJobs.Add(BulkJob(8000, "OTHER"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var act = () => CreateRepository().VoidBulkJobAsync(new VoidBulkJobRequest
        {
            BulkJobId = 7782,
            VoidReason = "Cancelled",
            VoidSingleJobOnly = false,
            SelectedJobIds = [7782, 8000]
        });

        // Assert
        await Assert.ThrowsAsync<VoidSelectionException>(act);
        await using var assertContext = _db.CreateContext();
        Assert.False(await assertContext.TblBulkJobs.AnyAsync(b => b.Void, TestContext.Current.CancellationToken));
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

    private static TblBulkJob BulkJob(int id, string jobNumber, int? bulkParentId = null, int? jobId = null) =>
        new()
        {
            BulkJobId = id,
            JobNumber = jobNumber,
            BookDate = TestDates.Now.Date,
            BookTime = TestDates.Now.Date.AddHours(9),
            JobStatus = (int)JobStatus.New,
            BulkParentId = bulkParentId,
            ParentId = bulkParentId,
            JobId = jobId
        };
}
