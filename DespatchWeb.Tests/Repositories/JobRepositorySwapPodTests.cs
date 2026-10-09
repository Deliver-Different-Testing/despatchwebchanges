using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the POD swap: state transfer/exchange, parent propagation, journey rows, eligibility
/// validation and the candidate search. SQLite-backed (live TucJobs only).
/// </summary>
public class JobRepositorySwapPodTests : IAsyncDisposable
{
    private static readonly DateTime CompletedAt = new(2026, 10, 9, 14, 30, 0);

    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public JobRepositorySwapPodTests()
    {
        _tenantInfoServiceMock.GetStaffIdOrNull().Returns(7);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _db.CreateFactoryMock(),
        _tenantInfoServiceMock,
        new FakeTenantClock(TestDates.Now),
        Substitute.For<IClearListEnvelopeService>(),
        Substitute.For<ICreateJobService>(),
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>());

    private async Task SeedAsync(params TucJob[] jobs)
    {
        await using var ctx = _db.CreateContext();
        ctx.TucJobs.AddRange(jobs);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static TucJob DoneJob(int id, string number, int? courierId = null) => new()
    {
        UcjbId = id,
        UcjbNumber = number,
        UcjbDate = CompletedAt.Date,
        UcjbStatus = (int)JobStatus.Completed,
        UcjbJobDone = true,
        UcjbPodname = $"Signer {number}",
        UcjbComplTime = CompletedAt,
        DeliverToLeaveId = 3,
        DeliverToPrivateBusiness = 1,
        DeliverySignature = [1, 2, 3],
        DeliveryPhoto = [.. "\t\t"u8],
        UcjbCourierId = courierId
    };

    private static TucJob OpenJob(int id, string number, int status = (int)JobStatus.New) => new()
    {
        UcjbId = id,
        UcjbNumber = number,
        UcjbDate = CompletedAt.Date,
        UcjbStatus = status
    };

    private async Task<TucJob> LoadAsync(int id)
    {
        await using var ctx = _db.CreateContext();
        return await ctx.TucJobs.SingleAsync(j => j.UcjbId == id, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task SwapPodStateAsync_OneSidedUndispatched_MovesPodToBAndRevertsAToNew()
    {
        await SeedAsync(DoneJob(1, "J001"), OpenJob(2, "J002"));

        await CreateRepository().SwapPodStateAsync(1, 2);

        var a = await LoadAsync(1);
        var b = await LoadAsync(2);
        Assert.Equal((int)JobStatus.New, a.UcjbStatus);
        Assert.False(a.UcjbJobDone);
        Assert.Null(a.UcjbPodname);
        Assert.Null(a.UcjbComplTime);
        Assert.Null(a.DeliverySignature);
        Assert.Null(a.DeliveryPhoto);
        Assert.Null(a.DeliverToLeaveId);
        Assert.Equal((int)JobStatus.Completed, b.UcjbStatus);
        Assert.True(b.UcjbJobDone);
        Assert.Equal("Signer J001", b.UcjbPodname);
        Assert.Equal(CompletedAt, b.UcjbComplTime);
        Assert.Equal(3, b.DeliverToLeaveId);
        Assert.Equal(1, b.DeliverToPrivateBusiness);
        Assert.Equal(new byte[] { 1, 2, 3 }, b.DeliverySignature);
        Assert.Equal("\t\t"u8.ToArray(), b.DeliveryPhoto);
        Assert.Equal((int)InternalJobStatus.Reprice, b.InternalStatus);
    }

    [Fact]
    public async Task SwapPodStateAsync_OneSidedDispatched_RevertsAToAccepted()
    {
        await SeedAsync(DoneJob(1, "J001", courierId: 55), OpenJob(2, "J002"));

        await CreateRepository().SwapPodStateAsync(1, 2);

        Assert.Equal((int)JobStatus.Accepted, (await LoadAsync(1)).UcjbStatus);
    }

    [Fact]
    public async Task SwapPodStateAsync_TwoSided_ExchangesPodsAndStatuses()
    {
        var b = DoneJob(2, "J002");
        b.UcjbStatus = (int)JobStatus.LateDelivery;
        b.UcjbPodname = "Other signer";
        b.UcjbComplTime = CompletedAt.AddHours(1);
        b.DeliverySignature = [7];
        await SeedAsync(DoneJob(1, "J001"), b);

        await CreateRepository().SwapPodStateAsync(1, 2);

        var a = await LoadAsync(1);
        var bAfter = await LoadAsync(2);
        Assert.Equal("Other signer", a.UcjbPodname);
        Assert.Equal(CompletedAt.AddHours(1), a.UcjbComplTime);
        Assert.Equal(new byte[] { 7 }, a.DeliverySignature);
        Assert.Equal((int)JobStatus.LateDelivery, a.UcjbStatus);
        Assert.True(a.UcjbJobDone);
        Assert.Equal("Signer J001", bAfter.UcjbPodname);
        Assert.Equal((int)JobStatus.Completed, bAfter.UcjbStatus);
        Assert.Equal(new byte[] { 1, 2, 3 }, bAfter.DeliverySignature);
    }

    [Fact]
    public async Task SwapPodStateAsync_LegEndingInTwoWithQualifyingParent_ParentTakesLegsNewState()
    {
        var parent = OpenJob(10, "J010", (int)JobStatus.Completed);
        parent.UcjbJobDone = true;
        parent.JobRelationshipTypeId = 2;
        var a = DoneJob(1, "J001");
        var b = OpenJob(2, "J002");
        b.ParentId = 10;
        await using (var ctx = _db.CreateContext())
        {
            ctx.TblJobRelationshipTypes.Add(new TblJobRelationshipType
            {
                JobRelationshipTypeId = 2, Name = "t", SystemName = "t", CreatedBy = "t", LastModifiedBy = "t"
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await SeedAsync(a, b, parent);

        await CreateRepository().SwapPodStateAsync(1, 2);

        var parentAfter = await LoadAsync(10);
        Assert.True(parentAfter.UcjbJobDone);
        Assert.Equal("Signer J001", parentAfter.UcjbPodname);
        Assert.Equal((int)JobStatus.Completed, parentAfter.UcjbStatus);
    }

    [Fact]
    public async Task SwapPodStateAsync_LegWithNonQualifyingParentType_LeavesParentAlone()
    {
        var parent = OpenJob(10, "J010", (int)JobStatus.Accepted);
        parent.JobRelationshipTypeId = 5;
        var b = OpenJob(2, "J002");
        b.ParentId = 10;
        await using (var ctx = _db.CreateContext())
        {
            ctx.TblJobRelationshipTypes.Add(new TblJobRelationshipType
            {
                JobRelationshipTypeId = 5, Name = "t5", SystemName = "t5", CreatedBy = "t", LastModifiedBy = "t"
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await SeedAsync(DoneJob(1, "J001"), b, parent);

        await CreateRepository().SwapPodStateAsync(1, 2);

        var parentAfter = await LoadAsync(10);
        Assert.False(parentAfter.UcjbJobDone);
        Assert.Equal((int)JobStatus.Accepted, parentAfter.UcjbStatus);
    }

    [Fact]
    public async Task SwapPodStateAsync_WritesPodSwapJourneyRowForEachJob()
    {
        await SeedAsync(DoneJob(1, "J001"), OpenJob(2, "J002"));

        await CreateRepository().SwapPodStateAsync(1, 2);

        await using var ctx = _db.CreateContext();
        var rows = await ctx.JobDeliveryJourneys
            .Where(j => j.FieldName == "PodSwap")
            .OrderBy(j => j.JobId)
            .ToListAsync(TestContext.Current.CancellationToken);
        Assert.Equal(2, rows.Count);
        Assert.Equal([nameof(DeliveryJourneyChangeType.JobUpdate)], rows.Select(r => r.ChangeType).Distinct());
        Assert.Equal([7], rows.Select(r => r.StaffId).Distinct());
        Assert.Equal(("J001", "J002", "POD swapped with J002"), (rows[0].OldValue, rows[0].NewValue, rows[0].Comments));
        Assert.Equal(("J002", "J001", "POD swapped with J001"), (rows[1].OldValue, rows[1].NewValue, rows[1].Comments));
    }

    [Fact]
    public async Task SwapPodStateAsync_IneligiblePair_ThrowsAndChangesNothing()
    {
        var voided = OpenJob(3, "J003");
        voided.UcjbVoid = true;
        await SeedAsync(DoneJob(1, "J001"), OpenJob(2, "J002"), voided);
        var repo = CreateRepository();

        await Assert.ThrowsAsync<SwapPodException>(() => repo.SwapPodStateAsync(1, 1));
        await Assert.ThrowsAsync<SwapPodException>(() => repo.SwapPodStateAsync(1, 3));
        await Assert.ThrowsAsync<SwapPodException>(() => repo.SwapPodStateAsync(1, 999));
        await Assert.ThrowsAsync<SwapPodException>(() => repo.SwapPodStateAsync(2, 1));

        Assert.True((await LoadAsync(1)).UcjbJobDone);
        await using var ctx = _db.CreateContext();
        Assert.False(await ctx.JobDeliveryJourneys.AnyAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ValidatePodSwapAsync_LiveNonVoidJob_TrueRegardlessOfBookingDate_FalseForVoidOrMissing()
    {
        var old = OpenJob(1, "J001");
        old.UcjbDate = new DateTime(2020, 1, 1);
        var voided = OpenJob(2, "J002");
        voided.UcjbVoid = true;
        await SeedAsync(old, voided);
        var repo = CreateRepository();

        Assert.True(await repo.ValidatePodSwapAsync("J001"));
        Assert.False(await repo.ValidatePodSwapAsync("J002"));
        Assert.False(await repo.ValidatePodSwapAsync("NOPE"));
    }

    [Fact]
    public async Task SearchSwapPodCandidatesAsync_AppliesFiltersExcludesVoidAndSelf_AndCapsAtTwenty()
    {
        var voided = OpenJob(100, "X-VOID");
        voided.UcjbVoid = true;
        var otherDay = OpenJob(101, "X-OLD");
        otherDay.UcjbDate = CompletedAt.Date.AddDays(-3);
        var dispatched = OpenJob(102, "X-DISP", (int)JobStatus.Accepted);
        var done = DoneJob(103, "X-DONE");
        await SeedAsync(voided, otherDay, dispatched, done, OpenJob(104, "X-SELF"));
        var repo = CreateRepository();

        var byTerm = await repo.SearchSwapPodCandidatesAsync("X-", null, null, null, "X-SELF");
        Assert.Equal(["X-DISP", "X-DONE", "X-OLD"], byTerm.Select(c => c.Number).Order().ToList());

        var byStatus = await repo.SearchSwapPodCandidatesAsync(null, (int)JobStatus.Accepted, null, null, null);
        Assert.Equal("X-DISP", Assert.Single(byStatus).Number);

        var byDate = await repo.SearchSwapPodCandidatesAsync("X-", null, null, CompletedAt.Date.AddDays(-3), null);
        Assert.Equal("X-OLD", Assert.Single(byDate).Number);

        var doneRow = Assert.Single(await repo.SearchSwapPodCandidatesAsync("X-DONE", null, null, null, null));
        Assert.True(doneRow.HasPod);
        Assert.Equal(103, doneRow.JobId);

        await SeedAsync([.. Enumerable.Range(200, 25).Select(i => OpenJob(i, $"BULK{i}"))]);
        Assert.Equal(20, (await repo.SearchSwapPodCandidatesAsync("BULK", null, null, null, null)).Count);
    }
}
