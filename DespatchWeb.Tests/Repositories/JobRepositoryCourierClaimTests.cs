using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Repositories;

public class JobRepositoryCourierClaimTests : IAsyncDisposable
{
    private const int JobId = 10;
    private const int CourierId = 7;
    private const int StaffId = 99;

    private readonly SqliteTestDatabase _db = new();
    private readonly ICourierRepository _courierRepository = Substitute.For<ICourierRepository>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();

    private JobRepository CreateRepository() => new(
        _db.CreateFactoryMock(),
        _tenantInfo,
        _clock,
        Substitute.For<IClearListEnvelopeService>(),
        Substitute.For<ICreateJobService>(),
        _courierRepository,
        Substitute.For<ISuburbResolver>());

    private async Task Seed(Action<TucJob>? configure = null, params TucJob[] others)
    {
        var job = new TucJob { UcjbId = JobId, UcjbNumber = "J10", UcjbStatus = (int)JobStatus.New };
        configure?.Invoke(job);
        await using var context = _db.CreateContext();
        if (!await context.TucCouriers.AnyAsync(c => c.UccrId == CourierId, TestContext.Current.CancellationToken))
        {
            context.TucCouriers.Add(new TucCourier { UccrId = CourierId, Code = "C9", UccrName = "Kunal", UccrSurname = "S", UccrEmail = "k@t.com", UccrMobile = "9", Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T", Active = true });
            context.TucStaffs.Add(new TucStaff { UcstId = StaffId, UcstFirstName = "Voice", UcstLastName = "Agent", CreatedBy = "T", LastModifiedBy = "T", UcstActive = true });
        }

        context.TucJobs.Add(job);
        context.TucJobs.AddRange(others);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<TucJob> Reload(int id = JobId)
    {
        await using var context = _db.CreateContext();
        return await context.TucJobs.AsNoTracking().SingleAsync(j => j.UcjbId == id, TestContext.Current.CancellationToken);
    }

    public static TheoryData<string, int> Blocked => new()
    {
        { "courier", 0 }, { "agent", 0 }, { "freight", 0 }, { "parent", 0 }, { "void", 0 }, { "done", 0 },
        { "status", (int)JobStatus.Preassigned }, { "status", 100 },
        { "status", (int)JobStatus.OutboundAgentAssigned }, { "status", (int)JobStatus.InboundAgentAssigned },
        { "status", (int)JobStatus.GroundAgentAssigned }, { "status", (int)JobStatus.Dispatched },
        { "status", (int)JobStatus.Accepted }, { "status", (int)JobStatus.PickedUp }, { "status", (int)JobStatus.InTransit },
        { "status", (int)JobStatus.Completed }, { "status", (int)JobStatus.Undeliverable }, { "status", (int)JobStatus.Void },
        { "status", (int)JobStatus.Missing }, { "status", (int)JobStatus.Acknowledge }, { "status", (int)JobStatus.LateDelivery },
        { "status", (int)JobStatus.AwaitingPod }, { "status", (int)JobStatus.AssumingCompleted },
        { "status", (int)JobStatus.OutForDelivery }, { "status", (int)JobStatus.ReadyForPacking },
        { "status", (int)JobStatus.ReadyToPickup }, { "status", (int)JobStatus.AwaitingProcessing },
        { "status", 19 }, { "completed", 0 }, { "partner", 0 }
    };

    private static void Block(TucJob job, string reason, int status)
    {
        switch (reason)
        {
            case "courier": job.UcjbCourierId = 55; break;
            case "agent": job.AgentId = 3; break;
            case "freight": job.FdcourierId = 4; break;
            case "parent": job.ParentId = 1234; break;
            case "void": job.UcjbVoid = true; break;
            case "done": job.UcjbJobDone = true; break;
            case "completed": job.UcjbComplTime = TestDates.Now; break;
            case "partner": job.PartnerJobGuid = Guid.NewGuid(); break;
            default: job.UcjbStatus = status; break;
        }
    }

    [Theory]
    [MemberData(nameof(Blocked))]
    public async Task Claim_OnAJobThatIsNotOpen_IsUnavailable_AndChangesNothing(string reason, int status)
    {
        await Seed(j => Block(j, reason, status));
        var before = await Reload();

        var outcome = await CreateRepository().ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken);

        Assert.Equal(CourierClaimOutcome.Unavailable, outcome);
        var after = await Reload();
        Assert.Equal(before.UcjbCourierId, after.UcjbCourierId);
        Assert.Equal(before.UcjbStatus, after.UcjbStatus);
        Assert.Equal(before.UcjbDispId, after.UcjbDispId);
        await _courierRepository.DidNotReceiveWithAnyArgs().ResetClearListAreaOrderAsync(default, default!);
    }

    [Fact]
    public async Task Claim_OnAnOpenJob_AssignsItLikeADispatcherWould_AndRunsTheResetOnTheSameContext()
    {
        await Seed(j => j.DesCheck = true);
        var repository = CreateRepository();

        var outcome = await repository.ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken);

        Assert.Equal(CourierClaimOutcome.Assigned, outcome);
        var job = await Reload();
        Assert.Equal(CourierId, job.UcjbCourierId);
        Assert.Equal(StaffId, job.UcjbDispId);
        Assert.Equal((int)JobStatus.Dispatched, job.UcjbStatus);
        Assert.Equal((int)InternalJobStatus.AwaitingPod, job.InternalStatus);
        Assert.False(job.DesCheck);
        Assert.Null(job.AgentId);
        Assert.Null(job.FdcourierId);
        Assert.Equal(TestDates.Now, job.UcjbDispDate);
        Assert.Equal(TestDates.Now, job.UcjbDispTime);
        await _courierRepository.Received(1).ResetClearListAreaOrderAsync(CourierId, Arg.Any<DespatchContext>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData((int)JobStatus.New)]
    [InlineData((int)JobStatus.Rejected)]
    [InlineData((int)JobStatus.LatePickup)]
    [InlineData((int)JobStatus.Warning)]
    public async Task Claim_OnAWaitingStatus_Assigns(int? status)
    {
        await Seed(j => j.UcjbStatus = status);

        Assert.Equal(CourierClaimOutcome.Assigned,
            await CreateRepository().ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Claim_WhenTheJobIsAlreadyThisCouriers_IsAlreadyYours()
    {
        await Seed(j => j.UcjbCourierId = CourierId);

        var outcome = await CreateRepository().ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken);

        Assert.Equal(CourierClaimOutcome.AlreadyYours, outcome);
        await _courierRepository.DidNotReceiveWithAnyArgs().ResetClearListAreaOrderAsync(default, default!);
    }

    [Fact]
    public async Task Claim_OnAMissingJob_IsNotFound()
    {
        await Seed(j => j.UcjbId = JobId + 1);

        Assert.Equal(CourierClaimOutcome.NotFound,
            await CreateRepository().ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Claim_ASecondTime_IsAlreadyYours_SoARetryAfterAnUnknownCommitIsSafe()
    {
        await Seed();
        var repository = CreateRepository();

        await repository.ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken);
        var retry = await repository.ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken);

        Assert.Equal(CourierClaimOutcome.AlreadyYours, retry);
    }

    [Fact]
    public async Task Claim_WhenALaterStepFails_RollsBackTheClaimAndAnythingTheStepWroteOnTheSameContext()
    {
        await Seed(null, new TucJob { UcjbId = 11, UcjbNumber = "J11", UcjbStatus = (int)JobStatus.New });
        _courierRepository.ResetClearListAreaOrderAsync(CourierId, Arg.Any<DespatchContext>(), Arg.Any<CancellationToken>()).Returns(async call =>
        {
            await call.Arg<DespatchContext>().TucJobs.Where(j => j.UcjbId == 11)
                .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcjbStatus, 77));
            throw new InvalidOperationException("cascade failed");
        });

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateRepository().ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken));

        var job = await Reload();
        Assert.Null(job.UcjbCourierId);
        Assert.Equal((int)JobStatus.New, job.UcjbStatus);
        Assert.Equal((int)JobStatus.New, (await Reload(11)).UcjbStatus);
    }

    [Fact]
    public async Task Claim_AfterALostClaim_RunsNoReset()
    {
        await Seed(j => j.UcjbCourierId = 55);
        _courierRepository.ResetClearListAreaOrderAsync(default, default!).ThrowsAsyncForAnyArgs(new InvalidOperationException());

        Assert.Equal(CourierClaimOutcome.Unavailable,
            await CreateRepository().ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData(true, false, CourierClaimOutcome.InvalidStaff)]
    [InlineData(false, true, CourierClaimOutcome.InvalidCourier)]
    public async Task Claim_WhenTheCourierOrStaffIsNoLongerActive_SaysWho_AndChangesNothing(bool courierActive,
        bool staffActive, CourierClaimOutcome expected)
    {
        await Seed();
        await using (var context = _db.CreateContext())
        {
            await context.TucCouriers.Where(c => c.UccrId == CourierId)
                .ExecuteUpdateAsync(u => u.SetProperty(c => c.Active, courierActive), TestContext.Current.CancellationToken);
            await context.TucStaffs.Where(st => st.UcstId == StaffId)
                .ExecuteUpdateAsync(u => u.SetProperty(st => st.UcstActive, staffActive), TestContext.Current.CancellationToken);
        }

        var outcome = await CreateRepository().ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken);

        Assert.Equal(expected, outcome);
        Assert.Null((await Reload()).UcjbCourierId);
        await _courierRepository.DidNotReceiveWithAnyArgs().ResetClearListAreaOrderAsync(default, default!);
    }

    // Both sides carry PartnerJobGuid while linked; the receiver's copy is booked under the pairing's client.
    [Theory]
    [InlineData(false, true, CourierClaimOutcome.Unavailable)] // sent out
    [InlineData(true, true, CourierClaimOutcome.Unavailable)] // received copy
    [InlineData(false, false, CourierClaimOutcome.Assigned)] // unlinked: an ordinary local job again
    public async Task Claim_OnAPartnerJob_DependsOnWhetherItIsStillLinked(bool inboundCopy, bool linked, CourierClaimOutcome expected)
    {
        _tenantInfo.GetCurrentTenantId().Returns("100");
        await using (var context = _db.CreateContext())
        {
            context.Set<IntMgrPartnerPairing>().Add(new IntMgrPartnerPairing
            {
                Id = 7, PartnerTenantId = "300", PartnerTenantName = "Acme Couriers", PartnerBaseUrl = "https://peer.example.com",
                Status = "Active", OwnerTenantId = "100", ClientId = 60, CreatedAtUtc = TestDates.Now, UpdatedAtUtc = TestDates.Now
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await Seed(j =>
        {
            j.PartnerPairingId = 7;
            j.PartnerJobGuid = linked ? Guid.NewGuid() : null;
            if (inboundCopy) j.UcjbClientId = 60;
        });

        var outcome = await CreateRepository().ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken);

        Assert.Equal(expected, outcome);
    }

    [Theory]
    [InlineData("void", 0)]
    [InlineData("done", 0)]
    [InlineData("completed", 0)]
    [InlineData("status", (int)JobStatus.Completed)]
    [InlineData("status", (int)JobStatus.Undeliverable)]
    [InlineData("status", (int)JobStatus.Void)]
    [InlineData("status", (int)JobStatus.Missing)]
    public async Task Claim_OnTheirOwnFinishedJob_IsUnavailable_NotAlreadyYours(string reason, int status)
    {
        await Seed(j =>
        {
            j.UcjbCourierId = CourierId;
            Block(j, reason, status);
        });

        Assert.Equal(CourierClaimOutcome.Unavailable,
            await CreateRepository().ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData(StaffId, StaffId)]
    [InlineData(0, null)]
    public async Task AssignCourierToJob_WritesTheDispatchStamps(int dispatcherStaffId, int? expectedDispId)
    {
        await Seed(j =>
        {
            j.DesCheck = true;
            j.AgentId = 3;
            j.FdcourierId = 4;
        });
        _tenantInfo.GetStaffId().Returns(dispatcherStaffId);

        await CreateRepository().AssignCourierToJobAsync([JobId], CourierId);

        var job = await Reload();
        Assert.Equal(CourierId, job.UcjbCourierId);
        Assert.Equal(expectedDispId, job.UcjbDispId);
        Assert.Equal((int)JobStatus.Dispatched, job.UcjbStatus);
        Assert.Equal((int)InternalJobStatus.AwaitingPod, job.InternalStatus);
        Assert.False(job.DesCheck);
        Assert.Null(job.AgentId);
        Assert.Null(job.FdcourierId);
        Assert.Equal(TestDates.Now, job.UcjbDispDate);
        Assert.Equal(TestDates.Now, job.UcjbDispTime);
    }
}
