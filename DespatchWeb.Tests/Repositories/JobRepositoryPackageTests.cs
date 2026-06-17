using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for UpdatePackagesForJobAsync and UpdatePackagesForBulkJobAsync.
/// Both methods use a "delete all, re-insert" strategy: all existing items
/// for the scope are removed, then the incoming parcels are inserted with
/// fresh sequential ItemIds. This eliminates itemId round-trip bugs.
/// </summary>
public class JobRepositoryPackageTests : IAsyncDisposable
{
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock;
    private readonly Mock<ICreateJobService> _createJobServiceMock = new();
    private readonly SqliteTestDatabase _db = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();

    public JobRepositoryPackageTests()
    {
        _contextFactoryMock = _db.CreateMoqFactoryMock();

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DespatchContext CreateContext() => _db.CreateContext();

    private JobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        new FakeTenantClock(TestDates.Now),
        _clearListEnvelopeServiceMock.Object,
        _createJobServiceMock.Object
    );

    // ── UpdatePackagesForJobAsync ────────────────────────────────────

    [Fact]
    public async Task UpdatePackagesForJobAsync_ReplacesWithSubmittedParcels()
    {
        // Arrange — job with 3 existing parcels
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(1, "JOB001"));
        ctx.TucJobItems.AddRange(
            new TucJobItem { JobId = 1, ItemId = 1, Notes = "Parcel A" },
            new TucJobItem { JobId = 1, ItemId = 2, Notes = "Parcel B" },
            new TucJobItem { JobId = 1, ItemId = 3, Notes = "Parcel C" }
        );
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — submit only one parcel (the other two are effectively removed)
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemName = "Parcel B updated", Length = 10, Height = 5, Depth = 5 }
        };
        await repo.UpdatePackagesForJobAsync(1, parcels);

        // Assert — only the submitted parcel remains with a new sequential ItemId
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItems.Where(i => i.JobId == 1)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(remaining);
        Assert.Equal("Parcel B updated", remaining[0].Notes);
        Assert.Equal(10, remaining[0].Length);

        // UcjbQty should reflect the new count
        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 1,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)1, job.UcjbQty);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_AddsNewAndDeletesRemoved()
    {
        // Arrange — job with 2 existing parcels
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(2, "JOB002"));
        ctx.TucJobItems.AddRange(
            new TucJobItem { JobId = 2, ItemId = 1, Notes = "Keep" },
            new TucJobItem { JobId = 2, ItemId = 2, Notes = "Remove" }
        );
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — submit one existing parcel and one new one (replaces all)
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemName = "Keep", Length = 1, Height = 1, Depth = 1 },
            new() { ItemName = "Brand New", Length = 20, Height = 20, Depth = 20 }
        };
        await repo.UpdatePackagesForJobAsync(2, parcels);

        // Assert — 2 items with sequential ItemIds, order preserved
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItems
            .Where(i => i.JobId == 2)
            .OrderBy(i => i.ItemId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(2, remaining.Count);
        Assert.Equal("Keep", remaining[0].Notes);
        Assert.Equal("Brand New", remaining[1].Notes);
        Assert.Equal(remaining[0].ItemId + 1, remaining[1].ItemId);

        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 2,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)2, job.UcjbQty);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_EmptyList_DeletesAllParcels()
    {
        // Arrange — job with 2 parcels
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(3, "JOB003"));
        ctx.TucJobItems.AddRange(
            new TucJobItem { JobId = 3, ItemId = 1, Notes = "A" },
            new TucJobItem { JobId = 3, ItemId = 2, Notes = "B" }
        );
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — submit empty list
        await repo.UpdatePackagesForJobAsync(3, new List<ParcelDimensions>());

        // Assert — all parcels deleted, qty = 0
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItems.Where(i => i.JobId == 3)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Empty(remaining);

        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 3,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)0, job.UcjbQty);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_NullList_DeletesAllParcels()
    {
        // Arrange
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(4, "JOB004"));
        ctx.TucJobItems.Add(new TucJobItem { JobId = 4, ItemId = 1, Notes = "A" });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act
        await repo.UpdatePackagesForJobAsync(4, null!);

        // Assert — parcel deleted, qty = 0
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItems.Where(i => i.JobId == 4)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Empty(remaining);

        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 4,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)0, job.UcjbQty);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_StopJob_OnlyDeletesOwnItems()
    {
        // Arrange — parent job 10 with two stop jobs (11A, 12B)
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(10, "JOB010"));
        ctx.TucJobs.Add(CreateJobWithParent(11, "JOB010a", 10));
        ctx.TucJobs.Add(CreateJobWithParent(12, "JOB010b", 10));

        // Parent items (no ChildJobId)
        ctx.TucJobItems.Add(new TucJobItem { JobId = 10, ItemId = 1, Notes = "Parent item" });
        // Stop A items
        ctx.TucJobItems.Add(new TucJobItem { JobId = 10, ItemId = 2, ChildJobId = 11, Notes = "Stop A - keep" });
        ctx.TucJobItems.Add(new TucJobItem { JobId = 10, ItemId = 3, ChildJobId = 11, Notes = "Stop A - remove" });
        // Stop B items
        ctx.TucJobItems.Add(new TucJobItem { JobId = 10, ItemId = 4, ChildJobId = 12, Notes = "Stop B item" });

        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — update stop A (job 11), submitting only one parcel
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemName = "Stop A - keep", Length = 1, Height = 1, Depth = 1 }
        };
        await repo.UpdatePackagesForJobAsync(11, parcels);

        // Assert — stop A's old items are replaced, parent (1) and stop B (4) are untouched
        await using var verify = CreateContext();
        var allItems = await verify.TucJobItems
            .Where(i => i.JobId == 10)
            .OrderBy(i => i.ItemId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(3, allItems.Count);
        Assert.Equal(1, allItems[0].ItemId);  // parent item untouched
        Assert.Equal(4, allItems[1].ItemId);  // stop B untouched
        // Stop A re-inserted with new ItemId (5, since max across job was 4)
        Assert.Equal(5, allItems[2].ItemId);
        Assert.Equal("Stop A - keep", allItems[2].Notes);
        Assert.Equal(11, allItems[2].ChildJobId);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_PreservesDataWhenResubmitted()
    {
        // Arrange
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(5, "JOB005"));
        ctx.TucJobItems.AddRange(
            new TucJobItem { JobId = 5, ItemId = 1, Notes = "A", Length = 10, Height = 5, Depth = 5 },
            new TucJobItem { JobId = 5, ItemId = 2, Notes = "B", Length = 20, Height = 10, Depth = 10 }
        );
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — submit both parcels (content preserved, ItemIds re-assigned)
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemName = "A", Length = 10, Height = 5, Depth = 5 },
            new() { ItemName = "B", Length = 20, Height = 10, Depth = 10 }
        };
        await repo.UpdatePackagesForJobAsync(5, parcels);

        // Assert — both still exist with correct data
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItems
            .Where(i => i.JobId == 5)
            .OrderBy(i => i.ItemId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(2, remaining.Count);
        Assert.Equal("A", remaining[0].Notes);
        Assert.Equal(10, remaining[0].Length);
        Assert.Equal("B", remaining[1].Notes);
        Assert.Equal(20, remaining[1].Length);

        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 5,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)2, job.UcjbQty);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_ThreeParcelsSubmitted_AllInserted()
    {
        // Arrange — job with 2 existing parcels
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(6, "JOB006"));
        ctx.TucJobItems.AddRange(
            new TucJobItem { JobId = 6, ItemId = 1, Notes = "Existing A" },
            new TucJobItem { JobId = 6, ItemId = 2, Notes = "Existing B" }
        );
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — submit 3 parcels (all treated as fresh inserts)
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemName = "Existing A", Length = 1, Height = 1, Depth = 1 },
            new() { ItemName = "Existing B", Length = 2, Height = 2, Depth = 2 },
            new() { ItemName = "New parcel", Length = 5, Height = 5, Depth = 5 }
        };
        await repo.UpdatePackagesForJobAsync(6, parcels);

        // Assert — all 3 items exist with sequential ItemIds
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItems
            .Where(i => i.JobId == 6)
            .OrderBy(i => i.ItemId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(3, remaining.Count);
        Assert.Equal("Existing A", remaining[0].Notes);
        Assert.Equal("Existing B", remaining[1].Notes);
        Assert.Equal("New parcel", remaining[2].Notes);
        // Sequential IDs
        Assert.Equal(remaining[0].ItemId + 1, remaining[1].ItemId);
        Assert.Equal(remaining[1].ItemId + 1, remaining[2].ItemId);

        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 6,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)3, job.UcjbQty);
    }

    // ── UpdatePackagesForBulkJobAsync ───────────────────────────────

    [Fact]
    public async Task UpdatePackagesForBulkJobAsync_ReplacesWithSubmittedParcels()
    {
        // Arrange — bulk job with 3 parcels
        await using var ctx = CreateContext();
        ctx.TblBulkJobs.Add(CreateBulkJob(1, "BULK001"));
        ctx.TblBulkJobItems.AddRange(
            new TblBulkJobItem { JobId = 1, ItemId = 1, Notes = "A" },
            new TblBulkJobItem { JobId = 1, ItemId = 2, Notes = "B" },
            new TblBulkJobItem { JobId = 1, ItemId = 3, Notes = "C" }
        );
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — submit only one parcel
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemName = "A", Length = 1, Height = 1, Depth = 1 }
        };
        await repo.UpdatePackagesForBulkJobAsync(1, parcels);

        // Assert — only the submitted parcel remains
        await using var verify = CreateContext();
        var remaining = await verify.TblBulkJobItems.Where(i => i.JobId == 1)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(remaining);
        Assert.Equal("A", remaining[0].Notes);
    }

    [Fact]
    public async Task UpdatePackagesForBulkJobAsync_EmptyList_DeletesAllParcels()
    {
        // Arrange
        await using var ctx = CreateContext();
        ctx.TblBulkJobs.Add(CreateBulkJob(2, "BULK002"));
        ctx.TblBulkJobItems.AddRange(
            new TblBulkJobItem { JobId = 2, ItemId = 1, Notes = "A" },
            new TblBulkJobItem { JobId = 2, ItemId = 2, Notes = "B" }
        );
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act
        await repo.UpdatePackagesForBulkJobAsync(2, new List<ParcelDimensions>());

        // Assert
        await using var verify = CreateContext();
        var remaining = await verify.TblBulkJobItems.Where(i => i.JobId == 2)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Empty(remaining);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private static TucJob CreateJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

    private static TucJob CreateJobWithParent(int id, string jobNumber, int parentId) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        ParentId = parentId
    };

    private static TblBulkJob CreateBulkJob(int id, string jobNumber) => new()
    {
        BulkJobId = id,
        JobNumber = jobNumber
    };
}
