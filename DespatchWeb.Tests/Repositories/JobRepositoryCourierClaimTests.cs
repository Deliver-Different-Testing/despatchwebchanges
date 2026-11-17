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

    private JobRepository CreateRepository() => new(
        _db.CreateFactoryMock(),
        Substitute.For<ITenantInfoService>(),
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
        { "status", (int)JobStatus.Missing }, { "completed", 0 }
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
        await _courierRepository.Received(1).ResetClearListAreaOrderAsync(CourierId, Arg.Any<DespatchContext>());
    }

    [Fact]
    public async Task Claim_TreatsANullStatusAsOpen()
    {
        await Seed(j => j.UcjbStatus = null);

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
    public async Task Claim_OnAMissingJob_IsNotFound() =>
        Assert.Equal(CourierClaimOutcome.NotFound,
            await CreateRepository().ClaimJobForCourierAsync(JobId, CourierId, StaffId, TestContext.Current.CancellationToken));

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
        _courierRepository.ResetClearListAreaOrderAsync(CourierId, Arg.Any<DespatchContext>()).Returns(async call =>
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
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task Claim_WhenTheCourierOrStaffIsNoLongerActive_ChangesNothing(bool courierActive, bool staffActive)
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

        Assert.Equal(CourierClaimOutcome.Unavailable, outcome);
        Assert.Null((await Reload()).UcjbCourierId);
        await _courierRepository.DidNotReceiveWithAnyArgs().ResetClearListAreaOrderAsync(default, default!);
    }

    [Fact]
    public async Task ActiveChecks_RequireAnActiveRow()
    {
        await using (var context = _db.CreateContext())
        {
            context.TucStaffs.AddRange(new TucStaff { UcstId = 1, UcstFirstName = "A", UcstLastName = "B", CreatedBy = "T", LastModifiedBy = "T", UcstActive = true }, new TucStaff { UcstId = 2, UcstFirstName = "C", UcstLastName = "D", CreatedBy = "T", LastModifiedBy = "T", UcstActive = false });
            context.TucCouriers.AddRange(new TucCourier { UccrId = 1, Code = "C1", UccrName = "A", UccrSurname = "B", UccrEmail = "a@t.com", UccrMobile = "1", Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T", Active = true }, new TucCourier { UccrId = 2, Code = "C2", UccrName = "B", UccrSurname = "B", UccrEmail = "b@t.com", UccrMobile = "2", Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T", Active = false });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();
        var ct = TestContext.Current.CancellationToken;
        Assert.True(await repository.IsActiveStaffAsync(1, ct));
        Assert.False(await repository.IsActiveStaffAsync(2, ct));
        Assert.False(await repository.IsActiveStaffAsync(3, ct));
        Assert.True(await repository.IsActiveCourierAsync(1, ct));
        Assert.False(await repository.IsActiveCourierAsync(2, ct));
        Assert.False(await repository.IsActiveCourierAsync(3, ct));
    }
}
