using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.EntityClasses;

/// <summary>
/// Tests the global query filters applied to NP-bearing entities in
/// <c>DespatchContext.OnModelCreatingPartial</c>. These filters are the
/// single point of enforcement for Phase 1 NP isolation, so each protected
/// entity gets its own scenario.
/// </summary>
public class DespatchContextNpQueryFilterTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DespatchContext CreateContext(int? npAgentId)
    {
        var scope = Substitute.For<INpScopeProvider>();
        scope.NpAgentId.Returns(npAgentId);
        return new DespatchContext(_db.Options, scope);
    }

    [Fact]
    public async Task TucJobs_WhenNpScopeSet_ReturnsOnlyMatchingJobs()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "OWN", NpAgentId = 77 },
                new TucJob { UcjbId = 2, UcjbNumber = "OTHER", NpAgentId = 88 },
                new TucJob { UcjbId = 3, UcjbNumber = "UNROUTED", NpAgentId = null }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(npAgentId: 77);
        var ids = await context.TucJobs.Select(j => j.UcjbId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucJobs_WhenNpScopeNull_ReturnsAllRows()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "A", NpAgentId = 77 },
                new TucJob { UcjbId = 2, UcjbNumber = "B", NpAgentId = 88 },
                new TucJob { UcjbId = 3, UcjbNumber = "C", NpAgentId = null }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(npAgentId: null);
        var count = await context.TucJobs.CountAsync(TestContext.Current.CancellationToken);

        Assert.Equal(3, count);
    }

    [Fact]
    public async Task TucJobBookings_WhenNpScopeSet_ReturnsOnlyMatchingBookings()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobBookings.AddRange(
                new TucJobBooking { UcbkId = 1, NpAgentId = 77 },
                new TucJobBooking { UcbkId = 2, NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(npAgentId: 77);
        var ids = await context.TucJobBookings.Select(j => j.UcbkId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucJobArchives_WhenNpScopeSet_ReturnsOnlyMatchingArchives()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobArchives.AddRange(
                new TucJobArchive { UcjbId = 1, UcjbNumber = "ARCH-OWN", NpAgentId = 77 },
                new TucJobArchive { UcjbId = 2, UcjbNumber = "ARCH-OTHER", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(npAgentId: 77);
        var ids = await context.TucJobArchives.Select(j => j.UcjbId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TblBulkJobs_WhenNpScopeSet_ReturnsOnlyMatchingBulkJobs()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TblBulkJobs.AddRange(
                new TblBulkJob { BulkJobId = 1, JobNumber = "BULK-OWN", NpAgentId = 77 },
                new TblBulkJob { BulkJobId = 2, JobNumber = "BULK-OTHER", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(npAgentId: 77);
        var ids = await context.TblBulkJobs.Select(j => j.BulkJobId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucNotes_WhenNpScopeSet_ReturnsOnlyMatchingNotes()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucNotes.AddRange(
                new TucNote { NoteId = 1, NoteText = "own", NpAgentId = 77 },
                new TucNote { NoteId = 2, NoteText = "other", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(npAgentId: 77);
        var ids = await context.TucNotes.Select(n => n.NoteId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucNoteArchives_WhenNpScopeSet_ReturnsOnlyMatchingNotes()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucNoteArchives.AddRange(
                new TucNoteArchive { NoteId = 1, NoteText = "own", NpAgentId = 77 },
                new TucNoteArchive { NoteId = 2, NoteText = "other", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(npAgentId: 77);
        var ids = await context.TucNoteArchives.Select(n => n.NoteId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task IgnoreQueryFilters_WhenNpScopeSet_ReturnsAllRows()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "OWN", NpAgentId = 77 },
                new TucJob { UcjbId = 2, UcjbNumber = "OTHER", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(npAgentId: 77);
        var count = await context.TucJobs.IgnoreQueryFilters()
            .CountAsync(TestContext.Current.CancellationToken);

        Assert.Equal(2, count);
    }
}
