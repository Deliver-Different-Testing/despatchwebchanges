using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.EntityClasses;

/// <summary>
/// Tests the global query filters applied to scoped entities in
/// <c>DespatchContext.OnModelCreatingPartial</c>. These filters are the
/// single point of enforcement for the spec's row-level data scope, so each
/// protected entity gets its own scenario across ClientType branches.
/// </summary>
public class DespatchContextNpQueryFilterTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DespatchContext CreateContext(ScopeContext scope)
    {
        var provider = Substitute.For<IScopeProvider>();
        provider.Scope.Returns(scope);
        return new DespatchContext(_db.Options, provider);
    }

    private static ScopeContext NpScope(int? npAgentId) =>
        new(ClientTypeId: (int)ClientType.NetworkPartner, ClientId: null, NpAgentId: npAgentId);

    private static ScopeContext CustomerScope(int? clientId) =>
        new(ClientTypeId: (int)ClientType.Customer, ClientId: clientId, NpAgentId: null);

    private static ScopeContext DfAdminScope() =>
        new(ClientTypeId: (int)ClientType.DfrntAdmin, ClientId: null, NpAgentId: null);

    private static ScopeContext TenantScope() =>
        new(ClientTypeId: (int)ClientType.Tenant, ClientId: null, NpAgentId: null);

    // ---- NetworkPartner branch --------------------------------------------------

    [Fact]
    public async Task TucJobs_NpWithAgent_ReturnsOnlyMatchingJobs()
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

        await using var context = CreateContext(NpScope(77));
        var ids = await context.TucJobs.Select(j => j.UcjbId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucJobs_NpWithoutAgent_ReturnsEmpty()
    {
        // Spec §3.2 — never fall back to "show everything" for an NP user
        // with no resolvable NpAgentId.
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "A", NpAgentId = 77 },
                new TucJob { UcjbId = 2, UcjbNumber = "B", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope(npAgentId: null));
        var ids = await context.TucJobs.ToListAsync(TestContext.Current.CancellationToken);

        Assert.Empty(ids);
    }

    [Fact]
    public async Task TucJobBookings_NpWithAgent_ReturnsOnlyMatchingBookings()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobBookings.AddRange(
                new TucJobBooking { UcbkId = 1, NpAgentId = 77 },
                new TucJobBooking { UcbkId = 2, NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope(77));
        var ids = await context.TucJobBookings.Select(j => j.UcbkId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucJobArchives_NpWithAgent_ReturnsOnlyMatchingArchives()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobArchives.AddRange(
                new TucJobArchive { UcjbId = 1, UcjbNumber = "ARCH-OWN", NpAgentId = 77 },
                new TucJobArchive { UcjbId = 2, UcjbNumber = "ARCH-OTHER", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope(77));
        var ids = await context.TucJobArchives.Select(j => j.UcjbId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TblBulkJobs_NpWithAgent_ReturnsOnlyMatchingBulkJobs()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TblBulkJobs.AddRange(
                new TblBulkJob { BulkJobId = 1, JobNumber = "BULK-OWN", NpAgentId = 77 },
                new TblBulkJob { BulkJobId = 2, JobNumber = "BULK-OTHER", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope(77));
        var ids = await context.TblBulkJobs.Select(j => j.BulkJobId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucCouriers_NpWithAgent_ReturnsOnlyMatchingCouriers()
    {
        // Spec §2 — TucCourier is the 4th NP-scoped table. Filter added in this commit.
        await using (var seed = _db.CreateContext())
        {
            seed.TucCouriers.AddRange(
                new TucCourier
                {
                    UccrId = 1, Code = "C1", UccrName = "A", UccrSurname = "X",
                    UccrEmail = "a@t.com", UccrMobile = "1",
                    Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T",
                    NpAgentId = 77
                },
                new TucCourier
                {
                    UccrId = 2, Code = "C2", UccrName = "B", UccrSurname = "Y",
                    UccrEmail = "b@t.com", UccrMobile = "2",
                    Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T",
                    NpAgentId = 88
                }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope(77));
        var ids = await context.TucCouriers.Select(c => c.UccrId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucNotes_NpWithAgent_ReturnsOnlyMatchingNotes()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucNotes.AddRange(
                new TucNote { NoteId = 1, NoteText = "own", NpAgentId = 77 },
                new TucNote { NoteId = 2, NoteText = "other", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope(77));
        var ids = await context.TucNotes.Select(n => n.NoteId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucNoteArchives_NpWithAgent_ReturnsOnlyMatchingNotes()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucNoteArchives.AddRange(
                new TucNoteArchive { NoteId = 1, NoteText = "own", NpAgentId = 77 },
                new TucNoteArchive { NoteId = 2, NoteText = "other", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope(77));
        var ids = await context.TucNoteArchives.Select(n => n.NoteId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    // ---- Customer branch (UcjbClientId / UcbkClientId / ClientId) ---------------

    [Fact]
    public async Task TucJobs_CustomerScope_FiltersByUcjbClientId()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "MINE", UcjbClientId = 7 },
                new TucJob { UcjbId = 2, UcjbNumber = "OTHER", UcjbClientId = 99 },
                new TucJob { UcjbId = 3, UcjbNumber = "NULL-CLIENT", UcjbClientId = null }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(CustomerScope(clientId: 7));
        var ids = await context.TucJobs.Select(j => j.UcjbId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucJobBookings_CustomerScope_FiltersByUcbkClientId()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobBookings.AddRange(
                new TucJobBooking { UcbkId = 1, UcbkClientId = 7 },
                new TucJobBooking { UcbkId = 2, UcbkClientId = 99 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(CustomerScope(clientId: 7));
        var ids = await context.TucJobBookings.Select(j => j.UcbkId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TblBulkJobs_CustomerScope_FiltersByClientId()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TblBulkJobs.AddRange(
                new TblBulkJob { BulkJobId = 1, JobNumber = "M", ClientId = 7 },
                new TblBulkJob { BulkJobId = 2, JobNumber = "O", ClientId = 99 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(CustomerScope(clientId: 7));
        var ids = await context.TblBulkJobs.Select(j => j.BulkJobId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1], ids);
    }

    [Fact]
    public async Task TucCouriers_CustomerScope_ReturnsEmpty()
    {
        // Couriers have no customer-side column. Customers see no rows by default
        // (DespatchWeb is not customer-facing).
        await using (var seed = _db.CreateContext())
        {
            seed.TucCouriers.AddRange(
                new TucCourier
                {
                    UccrId = 1, Code = "C1", UccrName = "A", UccrSurname = "X",
                    UccrEmail = "a@t.com", UccrMobile = "1",
                    Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T",
                    NpAgentId = 77
                },
                new TucCourier
                {
                    UccrId = 2, Code = "C2", UccrName = "B", UccrSurname = "Y",
                    UccrEmail = "b@t.com", UccrMobile = "2",
                    Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T",
                    NpAgentId = 88
                }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(CustomerScope(clientId: 7));
        var ids = await context.TucCouriers.ToListAsync(TestContext.Current.CancellationToken);

        Assert.Empty(ids);
    }

    // ---- DfrntAdmin / Tenant / background — bypass ------------------------------

    [Fact]
    public async Task TucJobs_DfrntAdmin_ReturnsAllRows()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "A", NpAgentId = 77 },
                new TucJob { UcjbId = 2, UcjbNumber = "B", NpAgentId = 88 },
                new TucJob { UcjbId = 3, UcjbNumber = "C", UcjbClientId = 7 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(DfAdminScope());
        var count = await context.TucJobs.CountAsync(TestContext.Current.CancellationToken);

        Assert.Equal(3, count);
    }

    [Fact]
    public async Task TucJobs_Tenant_ReturnsAllRows()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "A", NpAgentId = 77 },
                new TucJob { UcjbId = 2, UcjbNumber = "B", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(TenantScope());
        var count = await context.TucJobs.CountAsync(TestContext.Current.CancellationToken);

        Assert.Equal(2, count);
    }

    [Fact]
    public async Task TucJobs_BackgroundContext_ReturnsAllRows()
    {
        // Options-only ctor (scaffolding / background workers): no scope provider
        // means filters short-circuit. Equivalent to BackgroundContext.
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "A", NpAgentId = 77 },
                new TucJob { UcjbId = 2, UcjbNumber = "B", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = _db.CreateContext();
        var count = await context.TucJobs.CountAsync(TestContext.Current.CancellationToken);

        Assert.Equal(2, count);
    }

    [Fact]
    public async Task IgnoreQueryFilters_NpScope_ReturnsAllRows()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "OWN", NpAgentId = 77 },
                new TucJob { UcjbId = 2, UcjbNumber = "OTHER", NpAgentId = 88 }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope(77));
        var count = await context.TucJobs.IgnoreQueryFilters()
            .CountAsync(TestContext.Current.CancellationToken);

        Assert.Equal(2, count);
    }
}
