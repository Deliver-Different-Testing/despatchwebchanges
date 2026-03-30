using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for UpdatePackagesForJobAsync and UpdatePackagesForBulkJobAsync.
/// Verifies that parcels can be added, updated, and deleted (regression test for
/// the bug where deleting parcels did not persist).
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
        _contextFactoryMock = _db.CreateFactoryMock();

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
    public async Task UpdatePackagesForJobAsync_DeletesRemovedParcels()
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

        // Act — submit only parcel 2, removing parcels 1 and 3
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemId = 2, ItemName = "Parcel B updated", Length = 10, Height = 5, Depth = 5 }
        };
        await repo.UpdatePackagesForJobAsync(1, parcels);

        // Assert — only parcel 2 remains
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItems.Where(i => i.JobId == 1)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(remaining);
        Assert.Equal(2, remaining[0].ItemId);
        Assert.Equal("Parcel B updated", remaining[0].Notes);


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

        // Act — keep parcel 1, remove parcel 2, add a new one
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemId = 1, ItemName = "Keep", Length = 1, Height = 1, Depth = 1 },
            new() { ItemId = null, ItemName = "Brand New", Length = 20, Height = 20, Depth = 20 }
        };
        await repo.UpdatePackagesForJobAsync(2, parcels);

        // Assert — 2 items remain: the kept one and the new one
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItems
            .Where(i => i.JobId == 2)
            .OrderBy(i => i.ItemId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(2, remaining.Count);
        Assert.Equal(1, remaining[0].ItemId);
        Assert.Equal("Brand New", remaining[1].Notes);

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
        // Stop jobs have job numbers ending in a letter
        await using var ctx = CreateContext();
        ctx.TucJobs.Add(CreateJob(10, "JOB010"));
        ctx.TucJobs.Add(CreateJobWithParent(11, "JOB010A", 10));
        ctx.TucJobs.Add(CreateJobWithParent(12, "JOB010B", 10));

        // Parent items (no ChildJobId)
        ctx.TucJobItems.Add(new TucJobItem { JobId = 10, ItemId = 1, Notes = "Parent item" });
        // Stop A items
        ctx.TucJobItems.Add(new TucJobItem { JobId = 10, ItemId = 2, ChildJobId = 11, Notes = "Stop A - keep" });
        ctx.TucJobItems.Add(new TucJobItem { JobId = 10, ItemId = 3, ChildJobId = 11, Notes = "Stop A - remove" });
        // Stop B items
        ctx.TucJobItems.Add(new TucJobItem { JobId = 10, ItemId = 4, ChildJobId = 12, Notes = "Stop B item" });

        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repo = CreateRepository();

        // Act — update stop A (job 11), keeping only item 2
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemId = 2, ItemName = "Stop A - keep", Length = 1, Height = 1, Depth = 1 }
        };
        await repo.UpdatePackagesForJobAsync(11, parcels);

        // Assert — stop A's removed item (3) is gone, but parent item (1) and stop B item (4) are untouched
        await using var verify = CreateContext();
        var allItems = await verify.TucJobItems
            .Where(i => i.JobId == 10)
            .OrderBy(i => i.ItemId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(3, allItems.Count);
        Assert.Equal(1, allItems[0].ItemId); // parent item
        Assert.Equal(2, allItems[1].ItemId); // stop A kept
        Assert.Equal(4, allItems[2].ItemId); // stop B untouched
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_NoChanges_PreservesAllParcels()
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

        // Act — submit both parcels unchanged
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemId = 1, ItemName = "A", Length = 10, Height = 5, Depth = 5 },
            new() { ItemId = 2, ItemName = "B", Length = 20, Height = 10, Depth = 10 }
        };
        await repo.UpdatePackagesForJobAsync(5, parcels);

        // Assert — both still exist
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItems.Where(i => i.JobId == 5)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(2, remaining.Count);

        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 5,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)2, job.UcjbQty);
    }

    [Fact]
    public async Task UpdatePackagesForJobAsync_ItemIdZero_TreatedAsNewParcel()
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

        // Act — send both existing parcels plus one with ItemId=0 (should be treated as new)
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemId = 1, ItemName = "Existing A", Length = 1, Height = 1, Depth = 1 },
            new() { ItemId = 2, ItemName = "Existing B", Length = 2, Height = 2, Depth = 2 },
            new() { ItemId = 0, ItemName = "Zero ID parcel", Length = 5, Height = 5, Depth = 5 }
        };
        await repo.UpdatePackagesForJobAsync(6, parcels);

        // Assert — all 3 items exist: 2 original + 1 new (ItemId=0 treated as new, gets ItemId=3)
        await using var verify = CreateContext();
        var remaining = await verify.TucJobItems
            .Where(i => i.JobId == 6)
            .OrderBy(i => i.ItemId)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(3, remaining.Count);
        Assert.Equal(1, remaining[0].ItemId);
        Assert.Equal(2, remaining[1].ItemId);
        Assert.Equal(3, remaining[2].ItemId);
        Assert.Equal("Zero ID parcel", remaining[2].Notes);

        var job = await verify.TucJobs.FirstAsync(j => j.UcjbId == 6,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal((short)3, job.UcjbQty);
    }

    // ── UpdatePackagesForBulkJobAsync ───────────────────────────────

    [Fact]
    public async Task UpdatePackagesForBulkJobAsync_DeletesRemovedParcels()
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

        // Act — keep only parcel 1
        var parcels = new List<ParcelDimensions>
        {
            new() { ItemId = 1, ItemName = "A", Length = 1, Height = 1, Depth = 1 }
        };
        await repo.UpdatePackagesForBulkJobAsync(1, parcels);

        // Assert — only parcel 1 remains
        await using var verify = CreateContext();
        var remaining = await verify.TblBulkJobItems.Where(i => i.JobId == 1)
            .ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(remaining);
        Assert.Equal(1, remaining[0].ItemId);
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