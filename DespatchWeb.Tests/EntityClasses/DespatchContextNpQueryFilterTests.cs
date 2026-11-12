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

    // Internal is treated as bypass while the Phase 1.3 reparent of DFRNT staff
    // to DFRNTAdmin (5) is pending. ClientId is populated to prove the customer-side
    // predicate is NOT applied to Internal — they get the full row set.
    private static ScopeContext InternalScope(int? clientId = 7) =>
        new(ClientTypeId: (int)ClientType.Internal, ClientId: clientId, NpAgentId: null);

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
    public async Task TucJobs_Internal_ReturnsAllRows()
    {
        // Internal staff (ClientTypeId = 1) are bypassed transitionally — they
        // must see every job regardless of UcjbClientId / NpAgentId so the
        // dispatch flow keeps working until Phase 1.3 reparents them to
        // DFRNTAdmin (5). Mixing rows across NP / customer / unscoped proves
        // the bypass is total, not just one branch.
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "NP", NpAgentId = 77 },
                new TucJob { UcjbId = 2, UcjbNumber = "CUST", UcjbClientId = 7 },
                new TucJob { UcjbId = 3, UcjbNumber = "FOREIGN", UcjbClientId = 99 },
                new TucJob { UcjbId = 4, UcjbNumber = "BARE" }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(InternalScope());
        var count = await context.TucJobs.CountAsync(TestContext.Current.CancellationToken);

        Assert.Equal(4, count);
    }

    [Fact]
    public async Task TucCouriers_Internal_ReturnsAllRows()
    {
        // Regression guard for the original dispatch bug: Internal users must
        // see every courier (NpAgentId set or not) so the Dispatch dialog
        // dropdown populates.
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
                    NpAgentId = null
                }
            );
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(InternalScope());
        var ids = await context.TucCouriers.Select(c => c.UccrId)
            .OrderBy(id => id)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1, 2], ids);
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

    // ---- Branches (B2): branch arm beside the NP arm ----------------------------

    private const int Syd = 1;
    private const int Mel = 2;
    private const int SydClient = 10;
    private const int MelClient = 20;
    private const int TenantHouseClient = 30;
    private const int InternalClient = 40;
    private const int NoBranchCustomer = 50;

    private static ScopeContext BranchTenantScope(int[] branchIds, bool defaultBranchInScope = false,
        bool jobsViaCourier = false, int? clientId = TenantHouseClient) =>
        new(ClientTypeId: (int)ClientType.Tenant, ClientId: clientId, NpAgentId: null,
            BranchIds: branchIds, DefaultBranchInScope: defaultBranchInScope,
            BranchJobsIncludeCourier: jobsViaCourier);

    private static TucClient Client(int id, int? branchId, ClientType type = ClientType.Customer) => new()
    {
        UcclId = id,
        UcclName = $"Client {id}",
        UcclLegalName = $"Client {id}",
        Smsname = "T",
        UcclCode = $"C{id}",
        UcclAddress = "1 St",
        UcclExtraAddress = "",
        UcclPostal = "",
        UcclPostCode = "0",
        UcclPhone = "",
        UcclPhone2 = "",
        UcclMobile = "",
        UcclFax = "",
        UcclType = "",
        Created = TestDates.Now,
        CreatedBy = "T",
        LastModified = TestDates.Now,
        LastModifiedBy = "T",
        ClientTypeId = (int)type,
        BranchId = branchId
    };

    private static TucCourier Courier(int id, int? branchId, int? npAgentId = null) => new()
    {
        UccrId = id, Code = $"C{id}", UccrName = $"Courier{id}", UccrSurname = "X",
        UccrEmail = $"c{id}@t.com", UccrMobile = $"{id}",
        Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T",
        BranchId = branchId,
        NpAgentId = npAgentId
    };

    private async Task SeedBranchClientsAsync(DespatchContext seed)
    {
        seed.TucClients.AddRange(
            Client(SydClient, Syd),
            Client(MelClient, Mel),
            Client(TenantHouseClient, null, ClientType.Tenant),
            Client(InternalClient, null, ClientType.Internal),
            Client(NoBranchCustomer, null));
        await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Branches_TenantWithNoBranches_SeesEverything()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "SYD", UcjbClientId = SydClient },
                new TucJob { UcjbId = 2, UcjbNumber = "MEL", UcjbClientId = MelClient });
            seed.TucCouriers.AddRange(Courier(1, Syd), Courier(2, Mel), Courier(3, null));
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(TenantScope());

        Assert.Equal(2, await context.TucJobs.CountAsync(TestContext.Current.CancellationToken));
        Assert.Equal(5, await context.TucClients.CountAsync(TestContext.Current.CancellationToken));
        Assert.Equal(3, await context.TucCouriers.CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Branches_SydOnly_SeesSydClientJobsNotMel_OnEveryJobTable()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "SYD", UcjbClientId = SydClient },
                new TucJob { UcjbId = 2, UcjbNumber = "MEL", UcjbClientId = MelClient },
                new TucJob { UcjbId = 3, UcjbNumber = "NO-CLIENT", UcjbClientId = null });
            seed.TucJobArchives.AddRange(
                new TucJobArchive { UcjbId = 11, UcjbNumber = "A-SYD", UcjbClientId = SydClient },
                new TucJobArchive { UcjbId = 12, UcjbNumber = "A-MEL", UcjbClientId = MelClient });
            seed.TucJobBookings.AddRange(
                new TucJobBooking { UcbkId = 21, UcbkClientId = SydClient },
                new TucJobBooking { UcbkId = 22, UcbkClientId = MelClient });
            seed.TblBulkJobs.AddRange(
                new TblBulkJob { BulkJobId = 31, JobNumber = "B-SYD", ClientId = SydClient },
                new TblBulkJob { BulkJobId = 32, JobNumber = "B-MEL", ClientId = MelClient });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(BranchTenantScope([Syd]));
        var ct = TestContext.Current.CancellationToken;

        Assert.Equal([1], await context.TucJobs.Select(j => j.UcjbId).ToListAsync(ct));
        Assert.Equal([11], await context.TucJobArchives.Select(j => j.UcjbId).ToListAsync(ct));
        Assert.Equal([21], await context.TucJobBookings.Select(j => j.UcbkId).ToListAsync(ct));
        Assert.Equal([31], await context.TblBulkJobs.Select(j => j.BulkJobId).ToListAsync(ct));
    }

    [Fact]
    public async Task Branches_SydOnly_Clients_OwnBranchPlusHouseAccounts()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
        }

        await using var context = CreateContext(BranchTenantScope([Syd]));
        var ids = await context.TucClients.Select(c => c.UcclId).OrderBy(id => id)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([SydClient, TenantHouseClient, InternalClient], ids);
    }

    [Fact]
    public async Task Branches_SydOnly_JobsOfTenantAndInternalClientsStayVisible()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "HOUSE", UcjbClientId = TenantHouseClient },
                new TucJob { UcjbId = 2, UcjbNumber = "INTERNAL", UcjbClientId = InternalClient },
                new TucJob { UcjbId = 3, UcjbNumber = "NO-BRANCH", UcjbClientId = NoBranchCustomer });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(BranchTenantScope([Syd]));
        var ids = await context.TucJobs.Select(j => j.UcjbId).OrderBy(id => id)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1, 2], ids);
    }

    [Fact]
    public async Task Branches_SydAndMel_SeesBoth()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "SYD", UcjbClientId = SydClient },
                new TucJob { UcjbId = 2, UcjbNumber = "MEL", UcjbClientId = MelClient });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(BranchTenantScope([Syd, Mel]));

        Assert.Equal(2, await context.TucJobs.CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Branches_Couriers_HomeBranch_AndNullBranchFollowsDefault()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucCouriers.AddRange(Courier(1, Syd), Courier(2, Mel), Courier(3, null));
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var ct = TestContext.Current.CancellationToken;

        await using (var defaultIsSyd = CreateContext(BranchTenantScope([Syd], defaultBranchInScope: true)))
        {
            Assert.Equal([1, 3], await defaultIsSyd.TucCouriers.Select(c => c.UccrId).OrderBy(id => id).ToListAsync(ct));
        }

        await using var defaultElsewhere = CreateContext(BranchTenantScope([Syd], defaultBranchInScope: false));
        Assert.Equal([1], await defaultElsewhere.TucCouriers.Select(c => c.UccrId).ToListAsync(ct));
    }

    [Fact]
    public async Task Branches_OptionB_Switch_ShowsMelJobWithSydCourierOnlyWhenOn()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucCouriers.AddRange(Courier(1, Syd), Courier(2, Mel));
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "MEL-BY-SYD", UcjbClientId = MelClient, UcjbCourierId = 1 },
                new TucJob { UcjbId = 2, UcjbNumber = "MEL-BY-MEL", UcjbClientId = MelClient, UcjbCourierId = 2 },
                new TucJob { UcjbId = 3, UcjbNumber = "MEL-NO-COURIER", UcjbClientId = MelClient });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var ct = TestContext.Current.CancellationToken;

        await using (var optionA = CreateContext(BranchTenantScope([Syd])))
        {
            Assert.Empty(await optionA.TucJobs.ToListAsync(ct));
        }

        await using var optionB = CreateContext(BranchTenantScope([Syd], jobsViaCourier: true));
        Assert.Equal([1], await optionB.TucJobs.Select(j => j.UcjbId).ToListAsync(ct));
    }

    [Fact]
    public async Task Branches_Notes_FollowTheirJob()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "SYD", UcjbClientId = SydClient },
                new TucJob { UcjbId = 2, UcjbNumber = "MEL", UcjbClientId = MelClient });
            seed.TucJobBookings.AddRange(
                new TucJobBooking { UcbkId = 21, UcbkClientId = SydClient },
                new TucJobBooking { UcbkId = 22, UcbkClientId = MelClient });
            seed.TucNotes.AddRange(
                new TucNote { NoteId = 1, NoteText = "syd job", JobId = 1 },
                new TucNote { NoteId = 2, NoteText = "mel job", JobId = 2 },
                new TucNote { NoteId = 3, NoteText = "syd prebook", JobBookingId = 21 },
                new TucNote { NoteId = 4, NoteText = "mel prebook", JobBookingId = 22 },
                new TucNote { NoteId = 5, NoteText = "no job" });
            seed.TucJobArchives.AddRange(
                new TucJobArchive { UcjbId = 11, UcjbNumber = "A-SYD", UcjbClientId = SydClient },
                new TucJobArchive { UcjbId = 12, UcjbNumber = "A-MEL", UcjbClientId = MelClient });
            seed.TucNoteArchives.AddRange(
                new TucNoteArchive { NoteId = 1, NoteText = "syd archive", JobId = 11 },
                new TucNoteArchive { NoteId = 2, NoteText = "mel archive", JobId = 12 });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(BranchTenantScope([Syd]));
        var ct = TestContext.Current.CancellationToken;

        Assert.Equal([1, 3, 5], await context.TucNotes.Select(n => n.NoteId).OrderBy(id => id).ToListAsync(ct));
        Assert.Equal([1], await context.TucNoteArchives.Select(n => n.NoteId).ToListAsync(ct));
    }

    [Fact]
    public async Task Branches_EmptyBranchList_FailsClosed_HouseAccountsOnly()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "SYD", UcjbClientId = SydClient },
                new TucJob { UcjbId = 2, UcjbNumber = "HOUSE", UcjbClientId = TenantHouseClient });
            seed.TucCouriers.AddRange(Courier(1, Syd), Courier(2, null));
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(BranchTenantScope([]));
        var ct = TestContext.Current.CancellationToken;

        Assert.Equal([2], await context.TucJobs.Select(j => j.UcjbId).ToListAsync(ct));
        Assert.Empty(await context.TucCouriers.ToListAsync(ct));
    }

    [Fact]
    public async Task Branches_InternalStaffWithBranches_AreBranchLimited()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "SYD", UcjbClientId = SydClient },
                new TucJob { UcjbId = 2, UcjbNumber = "MEL", UcjbClientId = MelClient });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(
            new ScopeContext((int)ClientType.Internal, InternalClient, null, BranchIds: [Syd]));

        Assert.Equal([1], await context.TucJobs.Select(j => j.UcjbId)
            .ToListAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Branches_NpUserWithBranchIds_StillOnlyNpArm()
    {
        // ScopeProvider never hands branches to an NP user; this proves the filters ignore
        // them anyway: NP rows by NpAgentId, every client, couriers by NpAgentId.
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "NP-MEL", UcjbClientId = MelClient, NpAgentId = 77 },
                new TucJob { UcjbId = 2, UcjbNumber = "SYD", UcjbClientId = SydClient });
            seed.TucCouriers.AddRange(Courier(1, Syd), Courier(2, Mel, npAgentId: 77));
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(
            new ScopeContext((int)ClientType.NetworkPartner, null, 77, BranchIds: [Syd]));
        var ct = TestContext.Current.CancellationToken;

        Assert.Equal([1], await context.TucJobs.Select(j => j.UcjbId).ToListAsync(ct));
        Assert.Equal(5, await context.TucClients.CountAsync(ct));
        Assert.Equal([2], await context.TucCouriers.Select(c => c.UccrId).ToListAsync(ct));
    }

    [Fact]
    public async Task Branches_CustomerAndDfAdminWithBranchIds_Unchanged()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "SYD", UcjbClientId = SydClient },
                new TucJob { UcjbId = 2, UcjbNumber = "MEL", UcjbClientId = MelClient });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var ct = TestContext.Current.CancellationToken;

        await using (var customer = CreateContext(
                         new ScopeContext((int)ClientType.Customer, MelClient, null, BranchIds: [Syd])))
        {
            Assert.Equal([2], await customer.TucJobs.Select(j => j.UcjbId).ToListAsync(ct));
            Assert.Equal(5, await customer.TucClients.CountAsync(ct));
        }

        await using var dfAdmin = CreateContext(
            new ScopeContext((int)ClientType.DfrntAdmin, null, null, BranchIds: [Syd]));
        Assert.Equal(2, await dfAdmin.TucJobs.CountAsync(ct));
        Assert.Equal(5, await dfAdmin.TucClients.CountAsync(ct));
    }

    [Fact]
    public async Task Branches_BackgroundContext_Bypasses()
    {
        await using (var seed = _db.CreateContext())
        {
            await SeedBranchClientsAsync(seed);
            seed.TucJobs.AddRange(
                new TucJob { UcjbId = 1, UcjbNumber = "SYD", UcjbClientId = SydClient },
                new TucJob { UcjbId = 2, UcjbNumber = "MEL", UcjbClientId = MelClient });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(ScopeContext.BackgroundContext with { BranchIds = [Syd] });

        Assert.Equal(2, await context.TucJobs.CountAsync(TestContext.Current.CancellationToken));
    }
}
