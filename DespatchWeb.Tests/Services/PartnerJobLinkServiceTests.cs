using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class PartnerJobLinkServiceTests : IAsyncDisposable
{
    private const int PairingId = 6;
    private const int OtherPairingId = 7;
    private const int PairingClientId = 60;
    private const int CustomerClientId = 50;

    private readonly SqliteTestDatabase _db = new();
    private readonly IJobCommandRepository _commands = Substitute.For<IJobCommandRepository>();
    private readonly IJobQueryRepository _queries = Substitute.For<IJobQueryRepository>();
    private readonly IRateJobService _rating = Substitute.For<IRateJobService>();
    private readonly ITaskRepository _tasks = Substitute.For<ITaskRepository>();
    private readonly ITenantInfoService _tenant = Substitute.For<ITenantInfoService>();

    public PartnerJobLinkServiceTests()
    {
        _tenant.IsUsTenant().Returns(true);
        _queries.GetJobDetailsForRatingAsync(Arg.Any<int>()).Returns(new JobRatingDetailsDto { IsManuallyRated = false });
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private PartnerJobLinkService Service() => new(_db.CreateFactoryMock(), _commands, _queries, _rating, _tasks, _tenant);

    private async Task SeedPairingsAsync()
    {
        await using var ctx = _db.CreateContext();
        foreach (var id in new[] { PairingId, OtherPairingId })
        {
            ctx.IntMgrPartnerPairings.Add(new IntMgrPartnerPairing
            {
                Id = id, PartnerTenantId = $"{id}00", PartnerTenantName = "OTG Cargo", PartnerBaseUrl = "https://peer.example.com",
                Status = "Active", OwnerTenantId = "100", ClientId = PairingClientId,
                CreatedAtUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow
            });
        }

        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Guid> SeedJobAsync(int id, bool inboundCopy, int pairingId = PairingId,
        JobStatus status = JobStatus.Dispatched, bool done = false)
    {
        var guid = Guid.NewGuid();
        await using var ctx = _db.CreateContext();
        ctx.TucJobs.Add(new TucJob
        {
            UcjbId = id,
            UcjbNumber = $"JOB-{id}",
            UcjbDate = DateTime.UtcNow,
            UcjbClientId = inboundCopy ? PairingClientId : CustomerClientId,
            UcjbStatus = (int)status,
            UcjbJobDone = done,
            PartnerJobGuid = guid,
            PartnerPairingId = pairingId,
            PartnerAgreedRate = 42m
        });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        return guid;
    }

    private async Task<TucJob> JobAsync(int id)
    {
        await using var ctx = _db.CreateContext();
        return await ctx.TucJobs.SingleAsync(j => j.UcjbId == id, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Unlink_ReturnsASentJobToDispatch_KeepingThePairingAsAudit()
    {
        await SeedPairingsAsync();
        var guid = await SeedJobAsync(1, inboundCopy: false);

        var outcome = await Service().UnlinkAsync(guid, PartnerUnlinkReason.PartnerVoided, "OTG Cargo", TestContext.Current.CancellationToken);

        Assert.Equal(PartnerUnlinkOutcome.Unlinked, outcome);
        var job = await JobAsync(1);
        Assert.Null(job.PartnerJobGuid);
        Assert.Null(job.PartnerAgreedRate);
        Assert.Equal(PairingId, job.PartnerPairingId);
        Assert.Equal((int)JobStatus.Dispatched, job.UcjbStatus);
        Assert.False(job.UcjbVoid);
        await using var ctx = _db.CreateContext();
        var journey = await ctx.JobDeliveryJourneys.SingleAsync(j => j.JobId == 1, TestContext.Current.CancellationToken);
        Assert.Equal(nameof(DeliveryJourneyChangeType.JobUpdate), journey.ChangeType);
        Assert.Contains("OTG Cargo", journey.Comments);
        await _tasks.Received(1).AddEventAsync(1, Arg.Is<string>(n => n.Contains("OTG Cargo") && n.Contains("JOB-1")), (int)EventType.Other);
    }

    [Fact]
    public async Task Unlink_ReRatesTheJob_UnlessItWasManuallyRated()
    {
        await SeedPairingsAsync();
        var rated = await SeedJobAsync(1, inboundCopy: false);
        var manual = await SeedJobAsync(2, inboundCopy: false);
        _queries.GetJobDetailsForRatingAsync(2).Returns(new JobRatingDetailsDto { IsManuallyRated = true });

        await Service().UnlinkAsync(rated, PartnerUnlinkReason.RecallApplied, null, TestContext.Current.CancellationToken);
        await Service().UnlinkAsync(manual, PartnerUnlinkReason.RecallApplied, null, TestContext.Current.CancellationToken);

        await _rating.Received(1).RateJobUsAsync(Arg.Any<JobRatingDetailsDto>());
    }

    [Fact]
    public async Task Unlink_IsIdempotent_SoASecondChannelRaisesNoSecondTask()
    {
        await SeedPairingsAsync();
        var guid = await SeedJobAsync(1, inboundCopy: false);

        await Service().UnlinkAsync(guid, PartnerUnlinkReason.PartnerVoided, null, TestContext.Current.CancellationToken);
        var second = await Service().UnlinkAsync(guid, PartnerUnlinkReason.RecallApplied, null, TestContext.Current.CancellationToken);

        Assert.Equal(PartnerUnlinkOutcome.NotFound, second);
        await _tasks.Received(1).AddEventAsync(Arg.Any<int>(), Arg.Any<string>(), Arg.Any<int>());
    }

    [Fact]
    public async Task Unlink_NeverTouchesAReceivedCopy()
    {
        await SeedPairingsAsync();
        var guid = await SeedJobAsync(1, inboundCopy: true);

        var outcome = await Service().UnlinkAsync(guid, PartnerUnlinkReason.PartnerVoided, null, TestContext.Current.CancellationToken);

        Assert.Equal(PartnerUnlinkOutcome.NotFound, outcome);
        Assert.Equal(guid, (await JobAsync(1)).PartnerJobGuid);
    }

    [Fact]
    public async Task ReleaseOutbound_UnlinksOnlyThisPairingsSentJobs()
    {
        await SeedPairingsAsync();
        await SeedJobAsync(1, inboundCopy: false);
        await SeedJobAsync(2, inboundCopy: false);
        await SeedJobAsync(3, inboundCopy: false, pairingId: OtherPairingId);
        await SeedJobAsync(4, inboundCopy: true);
        await SeedJobAsync(5, inboundCopy: false, status: JobStatus.Completed, done: true);

        var result = await Service().ReleaseAsync(PairingId, PartnerReleaseScope.Outbound, "OTG Cargo", TestContext.Current.CancellationToken);

        Assert.Equal(new PartnerReleaseResult(Unlinked: 2, Voided: 0, VoidedAfterPickup: 0, SkippedCompleted: 1), result);
        Assert.Null((await JobAsync(1)).PartnerJobGuid);
        Assert.Null((await JobAsync(2)).PartnerJobGuid);
        Assert.NotNull((await JobAsync(3)).PartnerJobGuid);
        Assert.NotNull((await JobAsync(4)).PartnerJobGuid);
        Assert.NotNull((await JobAsync(5)).PartnerJobGuid);
        await _commands.DidNotReceiveWithAnyArgs().VoidJobAsync(default!);
    }

    [Fact]
    public async Task ReleaseInbound_VoidsOpenCopies_WithATaskForOnesAlreadyPickedUp()
    {
        await SeedPairingsAsync();
        await SeedJobAsync(1, inboundCopy: true, status: JobStatus.Dispatched);
        await SeedJobAsync(2, inboundCopy: true, status: JobStatus.PickedUp);
        await SeedJobAsync(3, inboundCopy: true, status: JobStatus.Completed, done: true);
        await SeedJobAsync(4, inboundCopy: false);
        await SeedJobAsync(5, inboundCopy: true, pairingId: OtherPairingId);

        var result = await Service().ReleaseAsync(PairingId, PartnerReleaseScope.Inbound, "Medical", TestContext.Current.CancellationToken);

        Assert.Equal(new PartnerReleaseResult(Unlinked: 0, Voided: 2, VoidedAfterPickup: 1, SkippedCompleted: 1), result);
        await _commands.Received(1).VoidJobAsync(Arg.Is<VoidJobRequest>(r => r.JobId == 1));
        await _commands.Received(1).VoidJobAsync(Arg.Is<VoidJobRequest>(r => r.JobId == 2));
        await _commands.Received(2).VoidJobAsync(Arg.Any<VoidJobRequest>());
        await _tasks.Received(1).AddEventAsync(2, Arg.Is<string>(n => n.Contains("Medical") && n.Contains("picked up")), (int)EventType.Other);
        await _tasks.DidNotReceive().AddEventAsync(1, Arg.Any<string>(), Arg.Any<int>());
        Assert.False((await JobAsync(4)).UcjbVoid);
        Assert.False((await JobAsync(5)).UcjbVoid);
    }

    [Fact]
    public async Task ReleaseInbound_IsIdempotent()
    {
        await SeedPairingsAsync();
        await SeedJobAsync(1, inboundCopy: true);

        await Service().ReleaseAsync(PairingId, PartnerReleaseScope.Inbound, null, TestContext.Current.CancellationToken);
        var second = await Service().ReleaseAsync(PairingId, PartnerReleaseScope.Inbound, null, TestContext.Current.CancellationToken);

        Assert.Equal(new PartnerReleaseResult(0, 0, 0, 0), second);
        await _commands.Received(1).VoidJobAsync(Arg.Any<VoidJobRequest>());
    }
}
