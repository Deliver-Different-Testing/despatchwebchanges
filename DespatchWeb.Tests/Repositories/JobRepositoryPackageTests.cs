using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for UpdatePackagesForJobAsync and UpdatePackagesForBulkJobAsync.
/// Both methods use a "delete all, re-insert" strategy: all existing items
/// for the scope are removed, then the incoming parcels are inserted with
/// fresh sequential ItemIds. This eliminates itemId round-trip bugs.
/// </summary>
public class JobRepositoryPackageTests : IAsyncDisposable
{
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public JobRepositoryPackageTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DespatchContext CreateContext() => _db.CreateContext();

    private JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        new FakeTenantClock(TestDates.Now),
        _clearListEnvelopeServiceMock,
        _createJobServiceMock,
        Substitute.For<ICourierRepository>()
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

    // ── UpdatePackagesForJobAsync (archived jobs) ────────────────────

    [Fact]
    public async Task UpdatePackagesForJobAsync_ArchivedJob_ReplacesArchiveParcels()
    {
        // Arrange — an archived job (lives in tucJobArchive, not tucJob) with 3 parcels
        await using var ctx = CreateContext();
        ctx.TucJobArchives.Add(CreateArchiveJob(100, "ARC100"));
        ctx.TucJobItemsArchives.AddRange(
            new TucJobItemsArchive { JobId = 100, ItemId = 1, Notes = "A" },
            new TucJobItemsArchive { JobId = 100, ItemId = 2, Notes = "B" },
            new TucJobItemsArchive { JobId = 100, ItemId = 3, Notes = "C" }
        );
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — submit a single replacement parcel
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemName = "B updated", Length = 10, Height = 5, Depth = 5 }
        };
        await repo.UpdatePackagesForJobAsync(100, parcels);

        // Assert — the archive items table holds only the submitted parcel, and qty syncs
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItemsArchives.Where(i => i.JobId == 100)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(remaining);
        Assert.Equal("B updated", remaining[0].Notes);
        Assert.Equal(10, remaining[0].Length);

        var archive = await verify.TucJobArchives.FirstAsync(j => j.UcjbId == 100,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)1, archive.UcjbQty);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_ArchivedJob_AbsentFromLiveTable_DoesNotThrow()
    {
        // Regression: archived jobs are moved out of tucJob, so the old code path threw
        // ArgumentNullException (via IsStopJob's tucJob-only lookup) and the endpoint 500'd.
        await using var ctx = CreateContext();
        ctx.TucJobArchives.Add(CreateArchiveJob(101, "ARC101"));
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        var parcels = new List<ParcelDimensions>
        {
            new() { ItemName = "Only parcel", Length = 1, Height = 1, Depth = 1 }
        };

        // Act + Assert — completes without throwing and writes to the archive table
        await repo.UpdatePackagesForJobAsync(101, parcels);

        await using var verify = CreateContext();
        var remaining = await verify.TucJobItemsArchives.Where(i => i.JobId == 101)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(remaining);
        Assert.Empty(await verify.TucJobItems.Where(i => i.JobId == 101)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_ArchivedStopJob_OnlyDeletesOwnItems()
    {
        // Arrange — archived parent (110) with two archived stop jobs (111a, 112b)
        await using var ctx = CreateContext();
        ctx.TucJobArchives.Add(CreateArchiveJob(110, "ARC110"));
        ctx.TucJobArchives.Add(CreateArchiveJobWithParent(111, "ARC110a", 110));
        ctx.TucJobArchives.Add(CreateArchiveJobWithParent(112, "ARC110b", 110));

        ctx.TucJobItemsArchives.Add(new TucJobItemsArchive { JobId = 110, ItemId = 1, Notes = "Parent item" });
        ctx.TucJobItemsArchives.Add(new TucJobItemsArchive { JobId = 110, ItemId = 2, ChildJobId = 111, Notes = "Stop A - keep" });
        ctx.TucJobItemsArchives.Add(new TucJobItemsArchive { JobId = 110, ItemId = 3, ChildJobId = 111, Notes = "Stop A - remove" });
        ctx.TucJobItemsArchives.Add(new TucJobItemsArchive { JobId = 110, ItemId = 4, ChildJobId = 112, Notes = "Stop B item" });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — update stop A (job 111) with a single parcel
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemName = "Stop A - keep", Length = 1, Height = 1, Depth = 1 }
        };
        await repo.UpdatePackagesForJobAsync(111, parcels);

        // Assert — parent (1) and stop B (4) untouched; stop A re-inserted with a fresh ItemId
        await using var verify = CreateContext();
        var allItems = await verify.TucJobItemsArchives
            .Where(i => i.JobId == 110)
            .OrderBy(i => i.ItemId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(3, allItems.Count);
        Assert.Equal(1, allItems[0].ItemId);
        Assert.Equal(4, allItems[1].ItemId);
        Assert.Equal(5, allItems[2].ItemId);
        Assert.Equal("Stop A - keep", allItems[2].Notes);
        Assert.Equal(111, allItems[2].ChildJobId);
    }

    // ── UpdateJobWeightAsync ─────────────────────────────────────────

    [Fact]
    public async Task UpdateJobWeightAsync_LiveJob_UpdatesLiveWeight()
    {
        // Sanity guard: the archive routing must not break the live path.
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(200, "JOB200"));
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();
        await repo.UpdateJobWeightAsync(200, 12.5m);

        await using var verify = CreateContext();
        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 200,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(12.5, job.UcjbWeight);
    }

    [Fact]
    public async Task UpdateJobWeightAsync_ArchivedJob_UpdatesArchiveWeight()
    {
        // Arrange — an archived job; weight edits must land on tucJobArchive.
        await using var ctx = CreateContext();
        ctx.TucJobArchives.Add(CreateArchiveJob(210, "ARC210"));
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();
        await repo.UpdateJobWeightAsync(210, 7.25m);

        await using var verify = CreateContext();
        var archive = await verify.TucJobArchives.FirstAsync(j => j.UcjbId == 210,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(7.25, archive.UcjbWeight);
    }

    [Fact]
    public async Task UpdateJobWeightAsync_ArchivedJob_SyncsWeightAcrossChain()
    {
        // Arrange — archived parent (220) with a split child (221, RootParentId = 220).
        await using var ctx = CreateContext();
        var parent = CreateArchiveJob(220, "ARC220");
        var child = CreateArchiveJobWithParent(221, "ARC220A", 220);
        child.RootParentId = 220;
        ctx.TucJobArchives.AddRange(parent, child);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — update via the child id; weight should sync across the whole chain.
        await repo.UpdateJobWeightAsync(221, 9m);

        // Assert — both parent and child carry the new weight.
        await using var verify = CreateContext();
        var rows = await verify.TucJobArchives
            .Where(j => j.UcjbId == 220 || j.UcjbId == 221)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.All(rows, r => Assert.Equal(9, r.UcjbWeight));
    }

    [Fact]
    public async Task UpdateJobWeightAsync_ArchivedStopJob_OnlyUpdatesThatStop()
    {
        // Arrange — archived parent (230) with two archived stops (231a, 232b).
        await using var ctx = CreateContext();
        ctx.TucJobArchives.Add(CreateArchiveJob(230, "ARC230"));
        ctx.TucJobArchives.Add(CreateArchiveJobWithParent(231, "ARC230a", 230));
        ctx.TucJobArchives.Add(CreateArchiveJobWithParent(232, "ARC230b", 230));
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — set weight on stop A only.
        await repo.UpdateJobWeightAsync(231, 4m);

        // Assert — stop A updated; parent and stop B left untouched (null).
        await using var verify = CreateContext();
        var stopA = await verify.TucJobArchives.FirstAsync(j => j.UcjbId == 231,
            cancellationToken: TestContext.Current.CancellationToken);
        var parent = await verify.TucJobArchives.FirstAsync(j => j.UcjbId == 230,
            cancellationToken: TestContext.Current.CancellationToken);
        var stopB = await verify.TucJobArchives.FirstAsync(j => j.UcjbId == 232,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(4, stopA.UcjbWeight);
        Assert.Null(parent.UcjbWeight);
        Assert.Null(stopB.UcjbWeight);
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

    private static TucJobArchive CreateArchiveJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

    private static TucJobArchive CreateArchiveJobWithParent(int id, string jobNumber, int parentId) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        ParentId = parentId
    };
}
