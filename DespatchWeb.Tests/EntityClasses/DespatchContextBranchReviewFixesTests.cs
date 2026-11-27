using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interceptors;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;
using DespatchWeb.Tests.Helpers;
using NSubstitute;

namespace DespatchWeb.Tests.EntityClasses;

/// <summary>
/// Branches programme (B2) review fixes at the filter level: the split parent's placeholder courier is not a branch courier,
/// prebooks follow the pickup / delivery suburb rule, job-rooted lookups keep their client and courier names, the by-id
/// visibility helpers, and job numbers stay unique across branches.
/// </summary>
public class DespatchContextBranchReviewFixesTests : BranchScopedDbTest
{
    /// <summary>tblSetting.ParentJobCourierId on the real system: the courier split parents are parked on, with no branch.</summary>
    private const int ParentsCourier = 4;

    private static ScopeContext Staff(int[]? branchIds, bool defaultBranchInScope = false, int[]? siteIds = null,
        int? parentJobCourierId = null) =>
        new(ClientTypeId: (int)ClientType.Tenant, ClientId: 1, NpAgentId: null,
            BranchIds: branchIds, DefaultBranchInScope: defaultBranchInScope, BranchSiteIds: siteIds ?? [],
            ParentJobCourierId: parentJobCourierId);

    // The default-branch holder: Sydney, with the default branch, and the real parent courier configured.
    private static ScopeContext SydneyDefault(int? parentCourier = ParentsCourier) =>
        Staff([Sydney], defaultBranchInScope: true, siteIds: [SydneySite], parentJobCourierId: parentCourier);

    private static ScopeContext MelbourneOnly(int? parentCourier = ParentsCourier) =>
        Staff([Melbourne], false, [MelbourneSite], parentCourier);

    // Sydney 1 + Melbourne 2 clients, the real placeholder courier 4 (no branch), a Sydney and a Melbourne courier.
    private Task SeedWorld() => Seed(
        Client(10, Sydney), Client(20, Melbourne),
        Courier(ParentsCourier, null), Courier(100, Sydney), Courier(200, Melbourne),
        Suburb(1, SydneySite), Suburb(2, MelbourneSite), Suburb(3, null));

    // ---- finding 4: the split parent's placeholder courier is not a branch courier ----

    [Fact]
    public async Task SplitFamilyEntirelyInAnotherBranch_IsHidden_FromTheDefaultBranchHolder_ByTheParentCourier()
    {
        await SeedWorld();
        // Parent parked on the placeholder courier 4 (NULL branch = default branch, which the Sydney user holds); both real
        // legs, the client and the suburbs are Melbourne's.
        await Seed(
            Job(1, client: 20, courier: ParentsCourier, from: 2, to: 2, root: 1),
            Job(2, client: 20, courier: 200, from: 2, to: 2, parent: 1, root: 1),
            Job(3, client: 20, courier: 200, from: 2, to: 2, parent: 1, root: 1));

        Assert.Empty(await JobIds(SydneyDefault()));
        Assert.Equal(new[] { 1, 2, 3 }, await JobIds(MelbourneOnly()));
    }

    [Fact]
    public async Task WithoutTheExclusion_TheParentCourierWouldExposeTheFamily_ProvingTheTestBites()
    {
        await SeedWorld();
        await Seed(
            Job(1, client: 20, courier: ParentsCourier, from: 2, to: 2, root: 1),
            Job(2, client: 20, courier: 200, from: 2, to: 2, parent: 1, root: 1));

        // Same data, parent courier not configured: the NULL-branch courier counts for the default-branch holder.
        Assert.Equal(new[] { 1, 2 }, await JobIds(SydneyDefault(parentCourier: null)));
    }

    [Fact]
    public async Task SplitFamily_StaysVisible_ThroughItsClient_ItsLegCourierAndItsSuburbs()
    {
        await SeedWorld();
        await Seed(
            // Family 1: client is Sydney's. Family 2: client is Melbourne's, legs are Sydney's. Family 3: suburb only.
            Job(1, client: 10, courier: ParentsCourier, root: 1),
            Job(2, client: 10, courier: 200, parent: 1, root: 1),
            Job(11, client: 20, courier: ParentsCourier, root: 11),
            Job(12, client: 20, courier: 100, parent: 11, root: 11),
            Job(21, client: 20, courier: ParentsCourier, from: 1, to: 2, root: 21),
            Job(22, client: 20, courier: 200, from: 2, to: 2, parent: 21, root: 21));

        // Sydney user: family 1 by client 10, family 2 by leg courier 100, family 3 by the Sydney suburb on the parent.
        Assert.Equal(new[] { 1, 2, 11, 12, 21, 22 }, await JobIds(SydneyDefault()));
        // Melbourne user: family 1 by leg courier 200, family 2 by client 20, family 3 by client 20.
        Assert.Equal(new[] { 1, 2, 11, 12, 21, 22 }, await JobIds(MelbourneOnly()));
    }

    [Fact]
    public async Task ParentCourierExclusion_AppliesToArchivedPrebookAndBulkFamiliesToo()
    {
        await SeedWorld();
        await Seed(
            new TucJobArchive { UcjbId = 1, UcjbNumber = "A1", UcjbClientId = 20, UcjbCourierId = ParentsCourier, RootParentId = 1 },
            new TucJobArchive { UcjbId = 2, UcjbNumber = "A2", UcjbClientId = 20, UcjbCourierId = 200, ParentId = 1, RootParentId = 1 },
            new TucJobBooking { UcbkId = 1, UcbkClientId = 20, CourierId = ParentsCourier },
            new TblBulkJob { BulkJobId = 1, ClientId = 20, CourierId = ParentsCourier },
            // Positive controls: same shape, but on a real Sydney courier (100), so the Sydney user sees them. If the arms
            // simply returned false the empty results above would pass vacuously; these would not.
            new TucJobArchive { UcjbId = 3, UcjbNumber = "A3", UcjbClientId = 20, UcjbCourierId = 100 },
            new TucJobBooking { UcbkId = 2, UcbkClientId = 20, CourierId = 100 },
            new TblBulkJob { BulkJobId = 2, ClientId = 20, CourierId = 100 });

        await using var context = CreateContext(SydneyDefault());

        Assert.Equal(new[] { 3 }, (await context.TucJobArchives.ToListAsync(Ct)).Select(j => j.UcjbId).OrderBy(i => i));
        Assert.Equal(new[] { 2 }, (await context.TucJobBookings.ToListAsync(Ct)).Select(j => j.UcbkId).OrderBy(i => i));
        Assert.Equal(new[] { 2 }, (await context.TblBulkJobs.ToListAsync(Ct)).Select(j => j.BulkJobId).OrderBy(i => i));
    }

    [Fact]
    public async Task AnOrdinaryJobOnAnotherNoBranchCourier_StillCountsAsTheDefaultBranch()
    {
        await SeedWorld();
        await Seed(Courier(300, null), Job(1, client: 20, courier: 300));

        Assert.Equal(new[] { 1 }, await JobIds(SydneyDefault()));
    }

    // ---- finding 7: a prebook follows the pickup / delivery suburb rule ----

    [Fact]
    public async Task Prebook_IsVisible_ByAPickupOrDeliverySuburbOnTheUsersBranchSite()
    {
        await SeedWorld();
        await Seed(
            new TucJobBooking { UcbkId = 1, UcbkClientId = 10, UcbkFrom = 2, UcbkTo = 1 },   // Sydney client, picks up in Melbourne
            new TucJobBooking { UcbkId = 2, UcbkClientId = 10, UcbkFrom = 1, UcbkTo = 1 },   // Sydney client, all Sydney
            new TucJobBooking { UcbkId = 3, UcbkClientId = 10, UcbkFrom = 1, UcbkTo = 2 });  // delivers in Melbourne

        await using var context = CreateContext(MelbourneOnly());
        var ids = await context.TucJobBookings.OrderBy(j => j.UcbkId).Select(j => j.UcbkId).ToArrayAsync(Ct);

        Assert.Equal(new[] { 1, 3 }, ids);
    }

    [Fact]
    public async Task PrebookFamily_IsVisible_WhenAnyLegHasASuburbOnTheUsersSite()
    {
        await SeedWorld();
        await Seed(
            new TucJobBooking { UcbkId = 1, UcbkClientId = 10, UcbkFrom = 1, UcbkTo = 1 },
            new TucJobBooking { UcbkId = 2, UcbkClientId = 10, UcbkFrom = 1, UcbkTo = 2, BookingParentId = 1, BookingRootParentId = 1 });

        await using var context = CreateContext(MelbourneOnly());

        Assert.Equal(new[] { 1, 2 }, await context.TucJobBookings.OrderBy(j => j.UcbkId).Select(j => j.UcbkId).ToArrayAsync(Ct));
    }

    // tucJobBooking has two pairs of family columns and the data does not say which one a prebook family uses: whichever pair is
    // populated, the family is whole. Leg 2 delivers in Melbourne (suburb 2), so the Melbourne user sees it by its suburb;
    // the parent (all Sydney, Sydney client) can only be seen through the family.
    [Theory]
    [InlineData("ParentID only")]
    [InlineData("RootParentID only")]
    [InlineData("BookingParentID only")]
    [InlineData("BookingRootParentID only")]
    [InlineData("both pairs")]
    public async Task PrebookFamily_IsWhole_WhicheverPairOfFamilyColumnsIsPopulated(string linkedBy)
    {
        await SeedWorld();
        var leg = new TucJobBooking { UcbkId = 2, UcbkClientId = 10, UcbkFrom = 1, UcbkTo = 2 };
        switch (linkedBy)
        {
            case "ParentID only": leg.ParentId = 1; break;
            case "RootParentID only": leg.RootParentId = 1; break;
            case "BookingParentID only": leg.BookingParentId = 1; break;
            case "BookingRootParentID only": leg.BookingRootParentId = 1; break;
            default: leg.ParentId = 1; leg.RootParentId = 1; leg.BookingParentId = 1; leg.BookingRootParentId = 1; break;
        }

        await Seed(
            new TucJobBooking { UcbkId = 1, UcbkClientId = 10, UcbkFrom = 1, UcbkTo = 1 },
            leg,
            new TucJobBooking { UcbkId = 9, UcbkClientId = 10, UcbkFrom = 1, UcbkTo = 1 });   // control: unrelated, all Sydney

        await using var context = CreateContext(MelbourneOnly());

        Assert.Equal(new[] { 1, 2 }, await context.TucJobBookings.OrderBy(j => j.UcbkId).Select(j => j.UcbkId).ToArrayAsync(Ct));
    }

    // ---- bulk families: tblBulkJob has both ParentID and BulkParentID (see Helpers/BulkJobFamily) ----

    // Leg 11 hangs off ParentID only, 12 off BulkParentID only, 13 off both. Every leg's courier is Melbourne's, the parent's
    // client is Sydney's and its courier is the placeholder, so the Melbourne user can only see the parent through the family.
    [Fact]
    public async Task BulkFamily_IsWhole_WhicheverParentColumnLinksTheLeg()
    {
        await SeedWorld();
        await Seed(
            new TblBulkJob { BulkJobId = 10, ClientId = 10, CourierId = ParentsCourier },
            new TblBulkJob { BulkJobId = 11, ClientId = 10, CourierId = 200, ParentId = 10 },
            new TblBulkJob { BulkJobId = 12, ClientId = 10, CourierId = 200, BulkParentId = 10 },
            new TblBulkJob { BulkJobId = 13, ClientId = 10, CourierId = 200, ParentId = 10, BulkParentId = 10 },
            new TblBulkJob { BulkJobId = 20, ClientId = 10, CourierId = 100 });   // control: an unrelated Sydney bulk job

        await using var melbourne = CreateContext(MelbourneOnly());
        await using var sydney = CreateContext(SydneyDefault());

        Assert.Equal(new[] { 10, 11, 12, 13 }, await melbourne.TblBulkJobs.OrderBy(b => b.BulkJobId).Select(b => b.BulkJobId).ToArrayAsync(Ct));
        Assert.Equal(new[] { 10, 11, 12, 13, 20 }, await sydney.TblBulkJobs.OrderBy(b => b.BulkJobId).Select(b => b.BulkJobId).ToArrayAsync(Ct));
    }

    [Fact]
    public async Task BulkFamily_ALegSeenOnlyThroughItsFamily_IsFoundFromTheParentToo()
    {
        await SeedWorld();
        // The parent is the Melbourne user's (client 20); the leg is linked by ParentID only and is a Sydney client's on a Sydney
        // courier, so only the family rule can show it.
        await Seed(
            new TblBulkJob { BulkJobId = 30, ClientId = 20, CourierId = 200 },
            new TblBulkJob { BulkJobId = 31, ClientId = 10, CourierId = 100, ParentId = 30 },
            new TblBulkJob { BulkJobId = 40, ClientId = 10, CourierId = 100 });   // control

        await using var melbourne = CreateContext(MelbourneOnly());

        Assert.Equal(new[] { 30, 31 }, await melbourne.TblBulkJobs.OrderBy(b => b.BulkJobId).Select(b => b.BulkJobId).ToArrayAsync(Ct));
    }

    // ---- the generated SQL carries the branch arms (the results above prove behaviour; this proves the arms are in the query) ----

    [Fact]
    public void GeneratedSql_ForABranchLimitedUser_CarriesEachFamilyArm_AndTheArmIsSwitchedOffForAnUnlimitedOne()
    {
        using var limited = CreateContext(MelbourneOnly());
        using var unlimited = CreateContext(Staff(null));

        var live = limited.TucJobs.ToQueryString();
        var prebook = limited.TucJobBookings.ToQueryString();
        var bulk = limited.TblBulkJobs.ToQueryString();

        // live job: the family root is RootParentID ?? ParentID ?? id, and every member column is matched against it
        Assert.Contains("COALESCE(\"t\".\"RootParentID\", \"t\".\"ParentID\", \"t\".\"ucjbID\")", live);
        Assert.Contains("\"t0\".\"ParentID\" = COALESCE(", live);
        Assert.Contains("\"t0\".\"RootParentID\" = COALESCE(", live);
        Assert.Contains("\"t0\".\"ucjbFrom\"", live);          // suburb arm: pickup and delivery
        Assert.Contains("\"t0\".\"ucjbTo\"", live);
        Assert.Contains("FROM \"tucSuburb\"", live);

        // prebook: BOTH pairs of family columns feed the root and are matched as members, plus the suburb arm
        Assert.Contains("COALESCE(\"t\".\"BookingRootParentID\", \"t\".\"BookingParentID\", \"t\".\"RootParentID\", \"t\".\"ParentID\", \"t\".\"ucbkID\")", prebook);
        foreach (var column in new[] { "ucbkID", "BookingParentID", "BookingRootParentID", "ParentID", "RootParentID" })
        {
            Assert.Contains($"\"t0\".\"{column}\" = COALESCE(", prebook);
        }
        Assert.Contains("\"t0\".\"ucbkFrom\"", prebook);
        Assert.Contains("\"t0\".\"ucbkTo\"", prebook);
        Assert.Contains("FROM \"tucSuburb\"", prebook);

        // bulk: ParentID and BulkParentID both feed the root and are matched as members
        Assert.Contains("COALESCE(\"t\".\"BulkParentID\", \"t\".\"ParentID\", \"t\".\"BulkJobID\")", bulk);
        foreach (var column in new[] { "BulkJobID", "ParentID", "BulkParentID" })
        {
            Assert.Contains($"\"t0\".\"{column}\" = COALESCE(", bulk);
        }

        // the placeholder courier is excluded from the courier arm of all three, by a parameter (not a hard-coded id)
        Assert.Contains("\"t0\".\"ucjbCourierID\" <> @ef_filter__CurrentParentJobCourierId", live);
        Assert.Contains("\"t0\".\"CourierID\" <> @ef_filter__CurrentParentJobCourierId", prebook);
        Assert.Contains("\"t0\".\"CourierID\" <> @ef_filter__CurrentParentJobCourierId", bulk);

        // the arm is switched on for the limited user and off for the unlimited one (and the bypass is the other way round)
        var limitedBulk = bulk;
        var unlimitedBulk = unlimited.TblBulkJobs.ToQueryString();
        Assert.Matches(@"@ef_filter__CurrentIsBranchScoped\d+ 1", limitedBulk);
        Assert.Matches(@"@ef_filter__CurrentBypassFilters\d+ 0", limitedBulk);
        Assert.Matches(@"@ef_filter__CurrentIsBranchScoped\d+ 0", unlimitedBulk);
        Assert.Matches(@"@ef_filter__CurrentBypassFilters\d+ 1", unlimitedBulk);
    }

    // The interceptor drops the client and courier list filters for a job-rooted query, so a job the user can see (here through a
    // Melbourne courier) still shows its Sydney client's name, while the same client looked up directly stays hidden.
    [Fact]
    public async Task AVisibleJob_StillLoadsItsOutOfBranchClient_ThroughAJobRootedQuery()
    {
        await SeedWorld();
        await Seed(Job(3, client: 10, courier: 200));   // Sydney client, Melbourne courier: visible to the Melbourne user

        await using var context = CreateContext(MelbourneOnly());

        var name = await context.TucJobs.Where(j => j.UcjbId == 3)
            .Select(j => context.TucClients.Where(c => c.UcclId == j.UcjbClientId).Select(c => c.UcclName).FirstOrDefault())
            .SingleAsync(Ct);
        var direct = await context.TucClients.Where(c => c.UcclId == 10).ToListAsync(Ct);

        Assert.Equal("Client 10", name);
        Assert.Empty(direct);
    }

    // ---- finding 6: job-rooted queries keep their client and courier names ----

    [Theory]
    [InlineData(typeof(TucJob), true)]
    [InlineData(typeof(TucJobArchive), true)]
    [InlineData(typeof(TucJobBooking), true)]
    [InlineData(typeof(TblBulkJob), true)]
    [InlineData(typeof(TblJob), true)]
    [InlineData(typeof(TucJobChangeRequest), true)]
    [InlineData(typeof(TucClient), false)]
    [InlineData(typeof(TucCourier), false)]
    public void TheInterceptor_DropsTheListFilters_OnlyForJobRootedQueries(Type rootType, bool dropped)
    {
        using var context = CreateContext(MelbourneOnly());
        var root = new EntityQueryRootExpression(context.Model.FindEntityType(rootType)!);

        var result = BranchJobContextInterceptor.Instance.QueryCompilationStarting(root, null!);

        Assert.Equal(dropped, result is MethodCallExpression { Method.Name: "IgnoreQueryFilters" });
    }

    [Fact]
    public async Task ArchivedSplitLegCourierNames_AndArchiveClientNames_ResolveForAVisibleJob()
    {
        await SeedWorld();
        await using var context = CreateContext(MelbourneOnly());

        // The lookups the archived split-leg and price-detail paths use: rooted at the courier / client sets, so the branch
        // list filter would hide a Sydney courier or client of a job the Melbourne user can see.
        var hiddenByList = await context.TucCouriers.Where(c => c.UccrId == 100).ToListAsync(Ct);
        var resolved = await context.TucCouriers.IgnoreQueryFilters([DespatchContext.BranchCouriersFilter])
            .Where(c => c.UccrId == 100).ToListAsync(Ct);
        var clientHidden = await context.TucClients.Where(c => c.UcclId == 10).ToListAsync(Ct);
        var clientResolved = await context.TucClients.IgnoreQueryFilters([DespatchContext.BranchClientsFilter])
            .Where(c => c.UcclId == 10).ToListAsync(Ct);

        Assert.Empty(hiddenByList);
        Assert.Single(resolved);
        Assert.Empty(clientHidden);
        Assert.Single(clientResolved);
    }

    // ---- the by-id visibility helpers behind the stored-procedure and S3 guards ----

    [Fact]
    public async Task AllJobsVisibleAsync_NeedsEveryIdVisible_LiveOrArchived_ForABranchLimitedUser()
    {
        await SeedWorld();
        await Seed(
            Job(1, client: 20), Job(2, client: 10),
            new TucJobArchive { UcjbId = 5, UcjbNumber = "A5", UcjbClientId = 20 },
            new TucJobArchive { UcjbId = 6, UcjbNumber = "A6", UcjbClientId = 10 });

        await using var context = CreateContext(MelbourneOnly());

        Assert.True(await context.AllJobsVisibleAsync([1, 5]));
        Assert.False(await context.AllJobsVisibleAsync([1, 2]));
        Assert.False(await context.AllJobsVisibleAsync([5, 6]));
        Assert.False(await context.AllJobsVisibleAsync([999]));
    }

    [Fact]
    public async Task VisibilityHelpers_AlwaysPass_ForAnyoneWhoIsNotBranchLimited()
    {
        await SeedWorld();
        await Seed(Job(2, client: 10));

        await using var context = CreateContext(Staff(null));

        Assert.True(await context.AllJobsVisibleAsync([2, 999]));
        Assert.True(await context.CourierVisibleAsync(100));
        Assert.True(await context.BulkJobVisibleAsync(999));
    }

    [Fact]
    public async Task CourierAndBulkJobVisibility_FollowTheUsersLists()
    {
        await SeedWorld();
        await Seed(new TblBulkJob { BulkJobId = 1, ClientId = 20 }, new TblBulkJob { BulkJobId = 2, ClientId = 10 });

        await using var context = CreateContext(MelbourneOnly());

        Assert.True(await context.CourierVisibleAsync(200));
        Assert.False(await context.CourierVisibleAsync(100));
        Assert.True(await context.BulkJobVisibleAsync(1));
        Assert.False(await context.BulkJobVisibleAsync(2));
    }

    // ---- finding 8: job numbers are unique across the whole tenant ----

    [Fact]
    public async Task JobNumberExists_SeesAJobOutsideTheUsersBranches()
    {
        await SeedWorld();
        await Seed(Job(2, client: 10));

        await using var context = CreateContext(MelbourneOnly());

        Assert.Empty(await context.TucJobs.Where(j => j.UcjbId == 2).ToListAsync(Ct));   // hidden from the list
        Assert.True(await context.JobNumberExistsAsync("J2"));                            // but the number is taken
    }

    // Keeps the parent-courier rule readable next to its tests: the marker the arms compare against.
    [Fact]
    public void CurrentParentJobCourierId_IsZero_WhenNotConfigured()
    {
        using var configured = CreateContext(SydneyDefault());
        using var none = CreateContext(SydneyDefault(parentCourier: null));

        Assert.Equal(ParentsCourier, configured.CurrentParentJobCourierId);
        Assert.Equal(0, none.CurrentParentJobCourierId);
    }
}
