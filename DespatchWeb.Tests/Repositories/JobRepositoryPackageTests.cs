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
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
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

    // ── Qty / weight sync onto the job row ───────────────────────────

    [Fact]
    public async Task UpdatePackagesForJobAsync_TenParcelsOfTen_SetsQty10AndWeight100()
    {
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(200, "JOB200"));
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var parcels = Enumerable.Range(1, 10)
            .Select(i => new ParcelDimensions { ItemName = "custom", Weight = 10 }).ToList();
        await CreateRepository().UpdatePackagesForJobAsync(200, parcels);

        await using var verify = CreateContext();
        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 200,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)10, job.UcjbQty);
        Assert.Equal(100d, job.UcjbWeight);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_ParentEdit_SyncsAllChildren()
    {
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(210, "JOB210"));
        var child = CreateJobWithParent(211, "JOB210a", 210);
        child.RootParentId = 210;
        var childWithOwn = CreateJobWithParent(212, "JOB210b", 210);
        childWithOwn.RootParentId = 210;
        childWithOwn.UcjbQty = 7;
        childWithOwn.UcjbWeight = 70;
        ctx.TucJobs.AddRange(child, childWithOwn);
        ctx.TucJobItems.Add(new TucJobItem
            { JobId = 210, ItemId = 1, ChildJobId = 212, Items = 7, Weight = 10 });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var parcels = new List<ParcelDimensions>
        {
            new() { ItemName = "A", Weight = 5 },
            new() { ItemName = "B", Weight = 5 }
        };
        await CreateRepository().UpdatePackagesForJobAsync(210, parcels);

        await using var verify = CreateContext();
        var jobs = await verify.TucJobs.Where(j => j.UcjbId >= 210 && j.UcjbId <= 212)
            .OrderBy(j => j.UcjbId).ToListAsync(TestContext.Current.CancellationToken);
        Assert.Equal(((short)2, 10d), (jobs[0].UcjbQty!.Value, jobs[0].UcjbWeight!.Value));
        Assert.Equal(((short)2, 10d), (jobs[1].UcjbQty!.Value, jobs[1].UcjbWeight!.Value));
        // A parent save also deletes children's own lines, so every child falls back to the parent
        Assert.Equal(((short)2, 10d), (jobs[2].UcjbQty!.Value, jobs[2].UcjbWeight!.Value));
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_StopJobEdit_TotalsOwnLinesOnly()
    {
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(220, "JOB220"));
        ctx.TucJobs.Add(CreateJobWithParent(221, "JOB220a", 220));
        ctx.TucJobItems.Add(new TucJobItem { JobId = 220, ItemId = 1, Items = 1, Weight = 50 });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForJobAsync(221,
            [new ParcelDimensions { ItemName = "own", Weight = 3 }]);

        await using var verify = CreateContext();
        var stop = await verify.TucJobs.FirstAsync(j => j.UcjbId == 221,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)1, stop.UcjbQty);
        Assert.Equal(3d, stop.UcjbWeight);
        var parent = await verify.TucJobs.FirstAsync(j => j.UcjbId == 220,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(parent.UcjbQty);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_StopJobEmptied_FallsBackToParentTotals()
    {
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(230, "JOB230"));
        ctx.TucJobs.Add(CreateJobWithParent(231, "JOB230a", 230));
        ctx.TucJobItems.AddRange(
            new TucJobItem { JobId = 230, ItemId = 1, Items = 1, Weight = 10 },
            new TucJobItem { JobId = 230, ItemId = 2, Items = 1, Weight = 10 },
            new TucJobItem { JobId = 230, ItemId = 3, ChildJobId = 231, Items = 1, Weight = 3 });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForJobAsync(231, []);

        await using var verify = CreateContext();
        var stop = await verify.TucJobs.FirstAsync(j => j.UcjbId == 231,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)2, stop.UcjbQty);
        Assert.Equal(20d, stop.UcjbWeight);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_ArchivedJob_SetsQtyAndWeightFromLines()
    {
        await using var ctx = CreateContext();
        ctx.TucJobArchives.Add(CreateArchiveJob(240, "ARC240"));
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForJobAsync(240,
        [
            new ParcelDimensions { ItemName = "A", Weight = 10 },
            new ParcelDimensions { ItemName = "B", Weight = 10 }
        ]);

        await using var verify = CreateContext();
        var archive = await verify.TucJobArchives.FirstAsync(j => j.UcjbId == 240,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)2, archive.UcjbQty);
        Assert.Equal(20d, archive.UcjbWeight);
    }

    [Fact]
    public async Task UpdatePackagesForBulkJobAsync_SetsQtyAndWeightFromLines()
    {
        await using var ctx = CreateContext();
        ctx.TblBulkJobs.Add(CreateBulkJob(250, "BULK250"));
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForBulkJobAsync(250,
        [
            new ParcelDimensions { ItemName = "A", Weight = 10 },
            new ParcelDimensions { ItemName = "B", Weight = 10 },
            new ParcelDimensions { ItemName = "C", Weight = 10 }
        ]);

        await using var verify = CreateContext();
        var bulk = await verify.TblBulkJobs.FirstAsync(j => j.BulkJobId == 250,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)3, bulk.Qty);
        Assert.Equal(30m, bulk.Weight);
    }

    [Fact]
    public async Task AddPackagesToJobAsync_StopJobLines_SyncsStopJobQtyAndWeight()
    {
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(260, "JOB260"));
        ctx.TucJobs.Add(CreateJobWithParent(261, "JOB260a", 260));
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var items = Enumerable.Range(1, 4)
            .Select(_ => new TucJobItem { JobId = 260, ChildJobId = 261, Items = 1, Weight = 11.25 }).ToList();
        await CreateRepository().AddPackagesToJobAsync(260, items);

        await using var verify = CreateContext();
        var stop = await verify.TucJobs.FirstAsync(j => j.UcjbId == 261,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)4, stop.UcjbQty);
        Assert.Equal(45d, stop.UcjbWeight);
        var parent = await verify.TucJobs.FirstAsync(j => j.UcjbId == 260,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(parent.UcjbQty);
    }

    [Fact]
    public async Task AddPackagesToJobAsync_ParentLines_SyncsParentAndChildrenWithoutOwnLines()
    {
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(270, "JOB270"));
        var plain = CreateJobWithParent(271, "JOB270a", 270);
        plain.RootParentId = 270;
        var own = CreateJobWithParent(272, "JOB270b", 270);
        own.RootParentId = 270;
        own.UcjbQty = 7;
        own.UcjbWeight = 70;
        ctx.TucJobs.AddRange(plain, own);
        ctx.TucJobItems.Add(new TucJobItem { JobId = 270, ItemId = 1, ChildJobId = 272, Items = 7, Weight = 10 });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().AddPackagesToJobAsync(270,
        [
            new TucJobItem { JobId = 270, Items = 1, Weight = 5 },
            new TucJobItem { JobId = 270, Items = 1, Weight = 5 }
        ]);

        await using var verify = CreateContext();
        var jobs = await verify.TucJobs.Where(j => j.UcjbId >= 270 && j.UcjbId <= 272)
            .OrderBy(j => j.UcjbId).ToListAsync(TestContext.Current.CancellationToken);
        Assert.Equal(((short)2, 10d), (jobs[0].UcjbQty!.Value, jobs[0].UcjbWeight!.Value));
        Assert.Equal(((short)2, 10d), (jobs[1].UcjbQty!.Value, jobs[1].UcjbWeight!.Value));
        Assert.Equal(((short)7, 70d), (jobs[2].UcjbQty!.Value, jobs[2].UcjbWeight!.Value));
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_StopJobEdit_LeavesParentAndSiblingsUntouched()
    {
        await using var ctx = CreateContext();
        var parent = CreateJob(280, "JOB280");
        parent.UcjbQty = 10;
        parent.UcjbWeight = 100;
        var sibling = CreateJobWithParent(282, "JOB280b", 280);
        sibling.RootParentId = 280;
        sibling.UcjbQty = 10;
        sibling.UcjbWeight = 100;
        var stop = CreateJobWithParent(281, "JOB280a", 280);
        stop.RootParentId = 280;
        ctx.TucJobs.AddRange(parent, stop, sibling);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForJobAsync(281,
            [new ParcelDimensions { ItemName = "own", Weight = 4 }]);

        await using var verify = CreateContext();
        var jobs = await verify.TucJobs.Where(j => j.UcjbId >= 280 && j.UcjbId <= 282)
            .OrderBy(j => j.UcjbId).ToListAsync(TestContext.Current.CancellationToken);
        Assert.Equal(((short)10, 100d), (jobs[0].UcjbQty!.Value, jobs[0].UcjbWeight!.Value));
        Assert.Equal(((short)1, 4d), (jobs[1].UcjbQty!.Value, jobs[1].UcjbWeight!.Value));
        Assert.Equal(((short)10, 100d), (jobs[2].UcjbQty!.Value, jobs[2].UcjbWeight!.Value));
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_StopJobEmptied_NoParentLines_ZeroesTotals()
    {
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(290, "JOB290"));
        var stop = CreateJobWithParent(291, "JOB290a", 290);
        stop.UcjbQty = 3;
        stop.UcjbWeight = 30;
        ctx.TucJobs.Add(stop);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForJobAsync(291, []);

        await using var verify = CreateContext();
        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 291,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(((short)0, 0d), (job.UcjbQty!.Value, job.UcjbWeight!.Value));
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_ArchivedStopJob_TotalsOwnLinesOnly()
    {
        await using var ctx = CreateContext();
        ctx.TucJobArchives.Add(CreateArchiveJob(300, "ARC300"));
        ctx.TucJobArchives.Add(CreateArchiveJobWithParent(301, "ARC300a", 300));
        ctx.TucJobItemsArchives.Add(new TucJobItemsArchive { JobId = 300, ItemId = 1, Items = 1, Weight = 50 });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForJobAsync(301,
        [
            new ParcelDimensions { ItemName = "A", Weight = 3 },
            new ParcelDimensions { ItemName = "B", Weight = 3 }
        ]);

        await using var verify = CreateContext();
        var stop = await verify.TucJobArchives.FirstAsync(j => j.UcjbId == 301,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(((short)2, 6d), (stop.UcjbQty!.Value, stop.UcjbWeight!.Value));
        var parent = await verify.TucJobArchives.FirstAsync(j => j.UcjbId == 300,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(parent.UcjbQty);
    }

    [Fact]
    public async Task UpdatePackagesForBulkJobAsync_ChildEdit_TotalsOwnLinesOnly()
    {
        await using var ctx = CreateContext();
        ctx.TblBulkJobs.Add(CreateBulkJob(310, "BULK310"));
        var child = CreateBulkJob(311, "BULK310a");
        child.BulkParentId = 310;
        ctx.TblBulkJobs.Add(child);
        ctx.TblBulkJobItems.Add(new TblBulkJobItem { JobId = 310, ItemId = 1, Items = 1, Weight = 50 });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForBulkJobAsync(311,
        [
            new ParcelDimensions { ItemName = "A", Weight = 2 },
            new ParcelDimensions { ItemName = "B", Weight = 2 }
        ]);

        await using var verify = CreateContext();
        var c = await verify.TblBulkJobs.FirstAsync(j => j.BulkJobId == 311,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(((short)2, 4m), (c.Qty!.Value, c.Weight!.Value));
        var p = await verify.TblBulkJobs.FirstAsync(j => j.BulkJobId == 310,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(p.Qty);
    }

    [Fact]
    public async Task UpdatePackagesForBulkJobAsync_ChildEmptied_FallsBackToParentTotals()
    {
        await using var ctx = CreateContext();
        ctx.TblBulkJobs.Add(CreateBulkJob(320, "BULK320"));
        var child = CreateBulkJob(321, "BULK320a");
        child.BulkParentId = 320;
        ctx.TblBulkJobs.Add(child);
        ctx.TblBulkJobItems.AddRange(
            new TblBulkJobItem { JobId = 320, ItemId = 1, Items = 1, Weight = 10 },
            new TblBulkJobItem { JobId = 320, ItemId = 2, Items = 1, Weight = 10 },
            new TblBulkJobItem { JobId = 320, ItemId = 3, ChildJobId = 321, Items = 1, Weight = 3 });
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForBulkJobAsync(321, []);

        await using var verify = CreateContext();
        var c = await verify.TblBulkJobs.FirstAsync(j => j.BulkJobId == 321,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(((short)2, 20m), (c.Qty!.Value, c.Weight!.Value));
    }

    [Theory]
    [InlineData(true, 2)]
    [InlineData(false, null)]
    [InlineData(null, 2)] // null leaves the existing value untouched
    public async Task UpdatePackagesForJobAsync_ParentEdit_DimensionsTypeAppliedToFamily(bool? flag, int? expected)
    {
        await using var ctx = CreateContext();
        var parent = CreateJob(330, "JOB330");
        parent.DimensionsType = 2;
        var child = CreateJobWithParent(331, "JOB330a", 330);
        child.RootParentId = 330;
        child.DimensionsType = 2;
        ctx.TucJobs.AddRange(parent, child);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForJobAsync(330,
            [new ParcelDimensions { ItemName = "A", Weight = 1 }], flag);

        await using var verify = CreateContext();
        var jobs = await verify.TucJobs.Where(j => j.UcjbId >= 330 && j.UcjbId <= 331)
            .ToListAsync(TestContext.Current.CancellationToken);
        Assert.All(jobs, j => Assert.Equal(expected, j.DimensionsType));
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_StopJobEdit_DimensionsTypeAppliedToThatJobOnly()
    {
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(340, "JOB340"));
        var stop = CreateJobWithParent(341, "JOB340a", 340);
        stop.RootParentId = 340;
        ctx.TucJobs.Add(stop);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await CreateRepository().UpdatePackagesForJobAsync(341,
            [new ParcelDimensions { ItemName = "A", Weight = 1 }], true);

        await using var verify = CreateContext();
        var parent = await verify.TucJobs.FirstAsync(j => j.UcjbId == 340,
            cancellationToken: TestContext.Current.CancellationToken);
        var stopRow = await verify.TucJobs.FirstAsync(j => j.UcjbId == 341,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(parent.DimensionsType);
        Assert.Equal(2, stopRow.DimensionsType);
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
