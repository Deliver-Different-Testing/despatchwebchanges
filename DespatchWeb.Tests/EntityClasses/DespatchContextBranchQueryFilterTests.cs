using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using DespatchWeb.Tests.Helpers;
using NSubstitute;

namespace DespatchWeb.Tests.EntityClasses;

/// <summary>
/// Branches programme (B2): the branch arm on the global query filters. Tenant staff with no branches see everything (as
/// before); tenant staff with branches see clients and couriers of their branches (NULL = the default branch) plus the
/// house accounts, and a job when ANY leg of its family has a client or courier of theirs, or a pickup or delivery
/// suburb on one of their branches' sites, and then the whole family. A visible job still shows its own client and
/// couriers. Notes follow their job.
/// </summary>
public class DespatchContextBranchQueryFilterTests : BranchScopedDbTest
{
    // The signed-in staff member: tenant staff (own client 1), limited to these branches.
    private static ScopeContext Staff(int[]? branchIds, bool defaultBranchInScope = false, int[]? siteIds = null, ClientType type = ClientType.Tenant) =>
        new(ClientTypeId: (int)type, ClientId: 1, NpAgentId: null,
            BranchIds: branchIds, DefaultBranchInScope: defaultBranchInScope, BranchSiteIds: siteIds ?? []);

    private static ScopeContext SydneyOnly(bool defaultInScope = true) => Staff([Sydney], defaultInScope, [SydneySite]);
    private static ScopeContext MelbourneOnly() => Staff([Melbourne], false, [MelbourneSite]);

    // The standard world: a Sydney client + courier, a Melbourne client + courier, and a house account.
    private Task SeedWorld() => Seed(
        Client(10, Sydney), Client(20, Melbourne), Client(30, null), Client(40, null, ClientType.Tenant),
        Courier(100, Sydney), Courier(200, Melbourne), Courier(300, null),
        Suburb(1, SydneySite), Suburb(2, MelbourneSite), Suburb(3, null));

    // ---- staff with no branches: unchanged ----

    [Fact]
    public async Task NoBranches_TenantStaffSeeEveryJobClientAndCourier()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10), Job(2, client: 20));
        var scope = Staff(null);

        await using var context = CreateContext(scope);
        Assert.Equal(new[] { 1, 2 }, await JobIds(scope));
        Assert.Equal(4, await context.TucClients.CountAsync(Ct));
        Assert.Equal(3, await context.TucCouriers.CountAsync(Ct));
    }

    [Theory]
    [InlineData(ClientType.DfrntAdmin)]
    [InlineData(ClientType.Internal)]
    public async Task DfAdminAndNoBranchInternal_StaySeeingEverything(ClientType type)
    {
        await SeedWorld();
        await Seed(Job(1, client: 10), Job(2, client: 20));

        // A DF Admin is never branch scoped even if the scope carries branches; Internal without branches bypasses.
        var scope = type == ClientType.DfrntAdmin ? Staff([Sydney], true, [SydneySite], type) : Staff(null, type: type);

        Assert.Equal(new[] { 1, 2 }, await JobIds(scope));
    }

    // ---- the job rule ----

    [Fact]
    public async Task Job_IsVisible_ByItsClientsBranch_AndNotOtherwise()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10), Job(2, client: 20));

        Assert.Equal(new[] { 1 }, await JobIds(SydneyOnly(defaultInScope: false)));
        Assert.Equal(new[] { 2 }, await JobIds(MelbourneOnly()));
    }

    [Fact]
    public async Task Job_IsVisible_ByItsCouriersHomeBranch()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10, courier: 200));   // Sydney client, driven by a Melbourne courier

        Assert.Equal(new[] { 1 }, await JobIds(MelbourneOnly()));
    }

    [Theory]
    [InlineData(true)]    // delivery suburb on a Melbourne site
    [InlineData(false)]   // pickup suburb on a Melbourne site
    public async Task Job_IsVisible_ByItsPickupOrDeliverySuburbsSite(bool delivery)
    {
        await SeedWorld();
        await Seed(delivery ? Job(1, client: 10, from: 1, to: 2) : Job(1, client: 10, from: 2, to: 1));

        Assert.Equal(new[] { 1 }, await JobIds(MelbourneOnly()));
    }

    [Fact]
    public async Task ASuburbWithNoSite_DoesNotMakeAJobVisible()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10, from: 3, to: 3));

        Assert.Empty(await JobIds(MelbourneOnly()));
    }

    [Fact]
    public async Task ABranchWithNoSite_ContributesNothingToAddressMatching()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10, from: 1, to: 2));

        var scope = Staff([Melbourne], false, siteIds: []);   // Melbourne has no site on file

        Assert.Empty(await JobIds(scope));
    }

    [Fact]
    public async Task Job_WithNothingOfTheUsers_IsNotVisible()
    {
        await SeedWorld();
        await Seed(Job(1, client: 20, courier: 200, from: 2, to: 2));

        Assert.Empty(await JobIds(SydneyOnly(defaultInScope: false)));
    }

    // ---- families: once one leg is visible, the whole family is ----

    [Fact]
    public async Task OneVisibleLeg_MakesTheParentThePickupAndEverySiblingVisible()
    {
        await SeedWorld();
        // Sydney client's parent, a Sydney pickup leg (P) and a Melbourne delivery leg (D), plus an unrelated Sydney job.
        await Seed(
            Job(1, client: 10),
            Job(2, client: 10, courier: 100, from: 1, to: 1, parent: 1, root: 1),
            Job(3, client: 10, courier: 200, from: 2, to: 2, parent: 1, root: 1),
            Job(9, client: 10));

        // Melbourne: the delivery leg's courier and suburb are theirs, so the whole family shows, but not the other job.
        Assert.Equal(new[] { 1, 2, 3 }, await JobIds(MelbourneOnly()));
        // Sydney sees all four through the client.
        Assert.Equal(new[] { 1, 2, 3, 9 }, await JobIds(SydneyOnly(defaultInScope: false)));
    }

    [Fact]
    public async Task AVisibleParent_ShowsItsChildren_AndAVisibleChildShowsItsParent()
    {
        await SeedWorld();
        await Seed(
            Job(1, client: 20),
            Job(2, client: 20, parent: 1, root: 1),
            Job(5, client: 10),
            Job(6, client: 20, courier: 200, parent: 5, root: 5));

        Assert.Equal(new[] { 1, 2, 5, 6 }, await JobIds(MelbourneOnly()));   // 5/6 family via the child's Melbourne client and courier
    }

    [Fact]
    public async Task ChildrenLinkedOnlyByParentId_AreStillInTheFamily()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10), Job(2, client: 20, parent: 1));   // no RootParentId set

        Assert.Equal(new[] { 1, 2 }, await JobIds(MelbourneOnly()));
    }

    [Fact]
    public async Task AnotherFamily_StaysHidden()
    {
        await SeedWorld();
        await Seed(Job(1, client: 20), Job(2, client: 20, parent: 1, root: 1), Job(7, client: 10), Job(8, client: 10, parent: 7, root: 7));

        Assert.Equal(new[] { 1, 2 }, await JobIds(MelbourneOnly()));
    }

    // ---- NULL branch = the default branch (D1) ----

    [Fact]
    public async Task ACourierWithNoHomeBranch_CountsAsTheDefaultBranch()
    {
        await SeedWorld();
        await Seed(Job(1, client: 20, courier: 300));

        Assert.Equal(new[] { 1 }, await JobIds(Staff([Sydney], defaultBranchInScope: true, siteIds: [SydneySite])));
        // A Sydney user who does not hold the default branch gets nothing from a NULL home branch (client 20 is Melbourne's).
        Assert.Empty(await JobIds(Staff([Sydney], defaultBranchInScope: false, siteIds: [SydneySite])));
    }

    [Fact]
    public async Task AClientWithNoBranch_CountsAsTheDefaultBranch_Too()
    {
        await SeedWorld();
        await Seed(Job(1, client: 30));

        Assert.Equal(new[] { 1 }, await JobIds(SydneyOnly(defaultInScope: true)));
        Assert.Empty(await JobIds(MelbourneOnly()));
    }

    // ---- house accounts, own client, fail closed ----

    [Fact]
    public async Task AJobOfAHouseAccount_IsVisibleToAllStaff()
    {
        await SeedWorld();
        await Seed(Job(1, client: 40));   // a Tenant-type client

        Assert.Equal(new[] { 1 }, await JobIds(MelbourneOnly()));
    }

    [Fact]
    public async Task AnEmptyBranchList_LimitsTheUserToNothingButHouseAccounts()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10), Job(2, client: 20), Job(3, client: 40));

        var scope = Staff([], false, []);

        Assert.Equal(new[] { 3 }, await JobIds(scope));
        await using var context = CreateContext(scope);
        Assert.Empty(await context.TucCouriers.ToListAsync(Ct));
    }

    // ---- the other job tables ----

    [Fact]
    public async Task ArchivedJobs_FollowTheSameRule()
    {
        await SeedWorld();
        await Seed(
            new TucJobArchive { UcjbId = 1, UcjbNumber = "A1", UcjbClientId = 20 },
            new TucJobArchive { UcjbId = 2, UcjbNumber = "A2", UcjbClientId = 10, UcjbCourierId = 200, ParentId = 1, RootParentId = 1 },
            new TucJobArchive { UcjbId = 3, UcjbNumber = "A3", UcjbClientId = 10 });

        await using var context = CreateContext(MelbourneOnly());
        Assert.Equal(new[] { 1, 2 }, await context.TucJobArchives.OrderBy(j => j.UcjbId).Select(j => j.UcjbId).ToArrayAsync(Ct));
    }

    [Fact]
    public async Task Prebooks_FollowTheSameRule()
    {
        await SeedWorld();
        await Seed(
            new TucJobBooking { UcbkId = 1, UcbkClientId = 20 },
            new TucJobBooking { UcbkId = 2, UcbkClientId = 10, CourierId = 200, BookingParentId = 1, BookingRootParentId = 1 },
            new TucJobBooking { UcbkId = 3, UcbkClientId = 10 });

        await using var context = CreateContext(MelbourneOnly());
        Assert.Equal(new[] { 1, 2 }, await context.TucJobBookings.OrderBy(j => j.UcbkId).Select(j => j.UcbkId).ToArrayAsync(Ct));
    }

    [Fact]
    public async Task BulkJobs_FollowTheSameRule()
    {
        await SeedWorld();
        await Seed(
            new TblBulkJob { BulkJobId = 1, ClientId = 20 },
            new TblBulkJob { BulkJobId = 2, ClientId = 10, CourierId = 200, BulkParentId = 1 },
            new TblBulkJob { BulkJobId = 3, ClientId = 10 });

        await using var context = CreateContext(MelbourneOnly());
        Assert.Equal(new[] { 1, 2 }, await context.TblBulkJobs.OrderBy(j => j.BulkJobId).Select(j => j.BulkJobId).ToArrayAsync(Ct));
    }

    // ---- client and courier lists ----

    [Fact]
    public async Task ClientList_ShowsTheUsersBranchesPlusHouseAccountsAndOwnClient()
    {
        await SeedWorld();
        await Seed(Client(1, Melbourne));   // the staff member's own client sits on another branch

        await using var context = CreateContext(MelbourneOnly());
        var ids = await context.TucClients.OrderBy(c => c.UcclId).Select(c => c.UcclId).ToArrayAsync(Ct);

        Assert.Equal([1, 20, 40], ids);   // 10 (Sydney) and 30 (default) are not theirs
    }

    [Fact]
    public async Task ClientList_IncludesNoBranchClients_ForAUserWhoHoldsTheDefaultBranch()
    {
        await SeedWorld();

        await using var context = CreateContext(SydneyOnly(defaultInScope: true));
        var ids = await context.TucClients.OrderBy(c => c.UcclId).Select(c => c.UcclId).ToArrayAsync(Ct);

        Assert.Equal([10, 30, 40], ids);
    }

    [Fact]
    public async Task CourierList_ShowsOnlyHomeBranchCouriers_PlusNoBranchOnesForTheDefaultBranchHolder()
    {
        await SeedWorld();

        await using var melbourne = CreateContext(MelbourneOnly());
        Assert.Equal(new[] { 200 }, await melbourne.TucCouriers.Select(c => c.UccrId).ToArrayAsync(Ct));

        await using var sydney = CreateContext(SydneyOnly(defaultInScope: true));
        Assert.Equal(new[] { 100, 300 }, await sydney.TucCouriers.OrderBy(c => c.UccrId).Select(c => c.UccrId).ToArrayAsync(Ct));
    }

    // ---- a visible job still shows its own client and courier (the job-rooted query interceptor) ----

    [Fact]
    public async Task AVisibleJob_LoadsItsClientAndCourier_EvenFromAnotherBranch()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10, courier: 100, from: 2, to: 2));   // Sydney client + courier, Melbourne address

        await using var context = CreateContext(MelbourneOnly());
        var row = await context.TucJobs
            .Select(j => new { j.UcjbId, Client = j.UcjbClient.UcclName, Courier = j.UcjbCourier.UccrName })
            .SingleAsync(Ct);

        Assert.Equal(1, row.UcjbId);
        Assert.Equal("Client 10", row.Client);
        Assert.Equal("Courier100", row.Courier);
    }

    [Fact]
    public async Task ClientAndCourierRootedQueries_StillApplyTheirListFilters()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10, courier: 100, from: 2, to: 2));

        await using var context = CreateContext(MelbourneOnly());
        var clients = await context.TucClients.Where(c => c.UcclId == 10).ToListAsync(Ct);
        var couriers = await context.TucCouriers.Where(c => c.UccrId == 100).ToListAsync(Ct);

        Assert.Empty(clients);    // reachable through the job, but not in the user's client list
        Assert.Empty(couriers);
    }

    // ---- notes follow their job ----

    [Fact]
    public async Task Notes_FollowTheirJob()
    {
        await SeedWorld();
        await Seed(
            Job(1, client: 20), Job(2, client: 10),
            new TucNote { NoteId = 1, JobId = 1, NoteText = "visible job" },
            new TucNote { NoteId = 2, JobId = 2, NoteText = "hidden job" });

        await using var context = CreateContext(MelbourneOnly());
        var text = await context.TucNotes.Select(n => n.NoteText).ToArrayAsync(Ct);

        Assert.Equal(new[] { "visible job" }, text);
    }

    [Fact]
    public async Task ArchivedNotes_FollowTheirArchivedJob()
    {
        await SeedWorld();
        await Seed(
            new TucJobArchive { UcjbId = 1, UcjbNumber = "A1", UcjbClientId = 20 },
            new TucJobArchive { UcjbId = 2, UcjbNumber = "A2", UcjbClientId = 10 },
            new TucNoteArchive { NoteId = 1, JobId = 1, NoteText = "visible" },
            new TucNoteArchive { NoteId = 2, JobId = 2, NoteText = "hidden" });

        await using var context = CreateContext(MelbourneOnly());
        Assert.Equal(new[] { "visible" }, await context.TucNoteArchives.Select(n => n.NoteText).ToArrayAsync(Ct));
    }

    // ---- entities that had no scope: events, the after-hours schedule and the three views ----

    private static TucEvent Event(int id, int? job = null, int? client = null, int? courier = null) => new()
    {
        UcevId = id, UcevJobId = job, UcevClientId = client, UcevCourierId = courier, UcevJobNumber = $"E{id}"
    };

    [Fact]
    public async Task Events_FollowTheirJob_ElseTheirClient_ElseTheirCourier_AndNoKeyMeansNotBranchData()
    {
        await SeedWorld();
        await Seed(
            Job(1, client: 20), Job(2, client: 10),
            Event(1, job: 1),                  // visible job
            Event(2, job: 2),                  // hidden job
            Event(3, client: 20),              // Melbourne client, no job
            Event(4, client: 10),              // Sydney client, no job
            Event(5, courier: 200),            // Melbourne courier, no job or client
            Event(6, courier: 100),            // Sydney courier
            Event(7));                         // about nothing

        await using var context = CreateContext(MelbourneOnly());
        var ids = await context.TucEvents.OrderBy(e => e.UcevId).Select(e => e.UcevId).ToArrayAsync(Ct);

        Assert.Equal(new[] { 1, 3, 5, 7 }, ids);
    }

    [Fact]
    public async Task Events_AreUnchanged_ForStaffWithNoBranches()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10), Event(1, job: 1), Event(2, client: 20));

        await using var context = CreateContext(Staff(null));

        Assert.Equal(2, await context.TucEvents.CountAsync(Ct));
    }

    [Fact]
    public async Task AfterHoursSchedule_ShowsOnlyCouriersInTheUsersList()
    {
        await SeedWorld();
        await Seed(
            new TblAfterhoursCourier { Id = 1, CourierId = 200, WeekDay = 1, StartTime = TestDates.Now, EndTime = TestDates.Now },
            new TblAfterhoursCourier { Id = 2, CourierId = 100, WeekDay = 1, StartTime = TestDates.Now, EndTime = TestDates.Now });

        await using var context = CreateContext(MelbourneOnly());

        Assert.Equal(new[] { 1 }, await context.TblAfterhoursCouriers.Select(a => a.Id).ToArrayAsync(Ct));
    }

    [Fact]
    public void TheThreeViews_CompileToSqlForABranchLimitedUser_FollowingTheFilteredTucTables()
    {
        // The views do not exist in a test database, so this checks the generated SQL rather than running it.
        using var context = CreateContext(MelbourneOnly());

        var jobs = context.TblJobs.ToQueryString();
        var clients = context.TblClients.ToQueryString();
        var couriers = context.TblCouriers.ToQueryString();

        // Word boundaries on purpose: a bare "tucJob" also matches "tucJobArchive", so a missing live-job arm would still pass.
        Assert.Matches(@"\btucJob\b", jobs);
        Assert.Matches(@"\btucJobArchive\b", jobs);
        Assert.Contains("tucClient", clients);
        Assert.Contains("tucCourier", couriers);
    }

    // ---- network partners and customers are untouched ----

    [Fact]
    public async Task NetworkPartner_StillSeesOnlyItsOwnJobs_NotTheBranchRule()
    {
        await SeedWorld();
        await Seed(
            new TucJob { UcjbId = 1, UcjbNumber = "OWN", UcjbClientId = 10, NpAgentId = 77 },
            new TucJob { UcjbId = 2, UcjbNumber = "OTHER", UcjbClientId = 10, NpAgentId = 88 });

        var np = new ScopeContext((int)ClientType.NetworkPartner, null, 77);

        Assert.Equal(new[] { 1 }, await JobIds(np));
    }

    [Fact]
    public async Task Customer_StillSeesOnlyItsOwnJobs()
    {
        await SeedWorld();
        await Seed(Job(1, client: 10), Job(2, client: 20));

        var customer = new ScopeContext((int)ClientType.Customer, 10, null);

        Assert.Equal(new[] { 1 }, await JobIds(customer));
    }
}
