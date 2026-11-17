using System.Reflection;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Accessorial;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Branches programme (B2) review fixes: actions that reach the database by id and bypass the EF filters (stored
/// procedures, raw edits, note history) must refuse a branch-limited caller for anything they cannot see, and must not
/// change anything for everyone else.
/// </summary>
public class BranchByIdGuardTests : IAsyncDisposable
{
    private const int Sydney = 1;
    private const int Melbourne = 2;
    private const int SydneySite = 43;
    private const int MelbourneSite = 44;

    private readonly SqliteTestDatabase _db = new();
    private readonly IDespatchContextProcedures _procedures = Substitute.For<IDespatchContextProcedures>();
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public BranchByIdGuardTests()
    {
        _tenantInfo.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfo.IsUsTenant().Returns(false);
        _tenantInfo.GetStaffId().Returns(1);
        _tenantInfo.GetStaffIdOrNull().Returns(1);
        _tenantInfo.ConvertUtcToTenantTimeZone(Arg.Any<DateTime>())
            .Returns(ci => new DateTimeOffset(ci.Arg<DateTime>(), TimeSpan.FromHours(12)));

        // The unsplit procedure reports back through output parameters, which only the data layer can set.
        _procedures.DES_stpJob_UnSplitAsync(Arg.Any<int?>(), Arg.Any<OutputParameter<string>>(), Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>())
            .Returns(ci =>
            {
                SetOutput(ci.ArgAt<OutputParameter<string>>(1), "unsplit");
                SetOutput(ci.ArgAt<OutputParameter<int>>(2), 0);
                return Task.FromResult(0);
            });
    }

    private static void SetOutput<T>(OutputParameter<T>? parameter, T value) =>
        typeof(OutputParameter<T>).GetMethod("SetValue", BindingFlags.NonPublic | BindingFlags.Instance)!
            .Invoke(parameter, [value]);

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static ScopeContext Staff(int[]? branchIds, bool defaultBranchInScope = false, int[]? siteIds = null) =>
        new(ClientTypeId: (int)ClientType.Tenant, ClientId: 1, NpAgentId: null,
            BranchIds: branchIds, DefaultBranchInScope: defaultBranchInScope, BranchSiteIds: siteIds ?? []);

    private static ScopeContext MelbourneOnly() => Staff([Melbourne], false, [MelbourneSite]);
    private static ScopeContext Unlimited() => Staff(null);

    private IDbContextFactory<DespatchContext> FactoryFor(ScopeContext scope)
    {
        var factory = Substitute.For<IDbContextFactory<DespatchContext>>();
        factory.CreateDbContext().Returns(_ => Create());
        factory.CreateDbContextAsync(Arg.Any<CancellationToken>()).Returns(_ => Create());
        return factory;

        DespatchContext Create()
        {
            var provider = Substitute.For<IScopeProvider>();
            provider.Scope.Returns(scope);
            return new DespatchContext(_db.Options, provider) { Procedures = _procedures };
        }
    }

    private JobRepository JobRepo(ScopeContext scope) => new(
        FactoryFor(scope), _tenantInfo, _clock,
        Substitute.For<IClearListEnvelopeService>(), Substitute.For<ICreateJobService>(),
        Substitute.For<ICourierRepository>(), Substitute.For<ISuburbResolver>());

    private NoteRepository NoteRepo(ScopeContext scope) => new(FactoryFor(scope), _tenantInfo, _clock);

    private async Task Seed(params object[] rows)
    {
        await using var seed = _db.CreateContext();
        seed.AddRange(rows);
        await seed.SaveChangesAsync(Ct);
    }

    private static TucClient Client(int id, int? branchId) => new()
    {
        UcclId = id, UcclName = $"Client {id}", UcclLegalName = "L", Smsname = "S", UcclCode = $"C{id}", UcclAddress = "1 St",
        UcclExtraAddress = "", UcclPostal = "", UcclPostCode = "0", UcclPhone = "", UcclPhone2 = "", UcclMobile = "", UcclFax = "",
        UcclType = "", Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T",
        ClientTypeId = (int)ClientType.Customer, BranchId = branchId
    };

    private static TucCourier Courier(int id, int? branchId) => new()
    {
        UccrId = id, Code = $"R{id}", UccrName = $"Courier{id}", UccrSurname = "X", UccrEmail = $"{id}@t.com", UccrMobile = "1",
        Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T", BranchId = branchId
    };

    private static TucJob Job(int id, int? client = null, int? courier = null) => new()
    {
        UcjbId = id, UcjbNumber = $"J{id}", UcjbClientId = client, UcjbCourierId = courier
    };

    // Client 10 / courier 100 are Sydney's, client 20 / courier 200 are Melbourne's; job 1 is Melbourne's, job 2 Sydney's.
    private Task SeedWorld() => Seed(
        Client(10, Sydney), Client(20, Melbourne), Courier(100, Sydney), Courier(200, Melbourne),
        Job(1, client: 20, courier: 200), Job(2, client: 10, courier: 100),
        // Note history and bulk notes join to the staff member and the note type.
        new TucStaff { UcstId = 1, UcstFirstName = "A", UcstLastName = "B", Created = TestDates.Now, CreatedBy = "t", LastModified = TestDates.Now, LastModifiedBy = "t" },
        new TucNoteType { NoteTypeId = 1, NoteTypeName = "Internal", IsActive = true, IsPublic = false, IsSystemDefined = true });

    // ---- finding 1: stored-procedure actions by id ----

    [Fact]
    public async Task ReSendSelected_RefusesAHiddenJob_AndRunsNothing()
    {
        await SeedWorld();

        await Assert.ThrowsAsync<JobNotFoundException>(() => JobRepo(MelbourneOnly()).ReSendSelectedJobsAsync([1, 2]));

        await _procedures.DidNotReceive().uspReDespatchJobAsync(Arg.Any<int?>(), Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReSendSelected_RunsForVisibleJobs()
    {
        await SeedWorld();

        await JobRepo(MelbourneOnly()).ReSendSelectedJobsAsync([1]);

        await _procedures.Received(1).uspReDespatchJobAsync(1, Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReAssignSelected_RefusesAMixedBatch_BeforeTouchingTheVisibleOne()
    {
        await SeedWorld();

        await Assert.ThrowsAsync<JobNotFoundException>(() => JobRepo(MelbourneOnly()).ReAssignSelectedJobsAsync([1, 2]));

        await _procedures.DidNotReceive().uspReassignJobAsync(Arg.Any<int?>(), Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetFirstJob_RefusesAHiddenJob_OrAHiddenCourier()
    {
        await SeedWorld();
        var repo = JobRepo(MelbourneOnly());

        await Assert.ThrowsAsync<JobNotFoundException>(() => repo.SetFirstJobAsync(2, 200));   // hidden job
        await Assert.ThrowsAsync<JobNotFoundException>(() => repo.SetFirstJobAsync(1, 100));   // hidden courier

        await _procedures.DidNotReceive().DES_stpJob_AutoDespatchSelectedJobs_FSCourierIDAsync(
            Arg.Any<int?>(), Arg.Any<int?>(), Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());

        await repo.SetFirstJobAsync(1, 200);
        await _procedures.Received(1).DES_stpJob_AutoDespatchSelectedJobs_FSCourierIDAsync(
            1, 200, Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReSendAll_RefusesACourierOutsideTheUsersList()
    {
        await SeedWorld();
        var repo = JobRepo(MelbourneOnly());

        await Assert.ThrowsAsync<JobNotFoundException>(() => repo.ReSendAllJobsAsync(100));
        await _procedures.DidNotReceive().uspReDespatchJobByCourierIDAsync(Arg.Any<int?>(), Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());

        await repo.ReSendAllJobsAsync(200);
        await _procedures.Received(1).uspReDespatchJobByCourierIDAsync(200, Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RestoreSplitJobs_RefusesAHiddenJob()
    {
        await SeedWorld();

        await Assert.ThrowsAsync<JobNotFoundException>(() => JobRepo(MelbourneOnly()).RestoreSplitJobsAsync([2]));

        await _procedures.DidNotReceive().DES_stpJob_SplitJobRestoreAsync(Arg.Any<int?>(), Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UnSplitJob_RefusesAHiddenJob_AndRunsForAVisibleOne()
    {
        await SeedWorld();
        var repo = JobRepo(MelbourneOnly());

        await Assert.ThrowsAsync<JobNotFoundException>(() => repo.UnSplitJobAsync(2));
        await _procedures.DidNotReceive().DES_stpJob_UnSplitAsync(
            Arg.Any<int?>(), Arg.Any<OutputParameter<string>>(), Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());

        await repo.UnSplitJobAsync(1);
        await _procedures.Received(1).DES_stpJob_UnSplitAsync(
            1, Arg.Any<OutputParameter<string>>(), Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ByIdActions_AreUnchanged_ForStaffWhoAreNotBranchLimited()
    {
        await SeedWorld();
        var repo = JobRepo(Unlimited());

        await repo.ReSendSelectedJobsAsync([1, 2]);
        await repo.ReAssignSelectedJobsAsync([1, 2]);
        await repo.SetFirstJobAsync(2, 100);
        await repo.ReSendAllJobsAsync(100);
        await repo.RestoreSplitJobsAsync([2]);
        await repo.UnSplitJobAsync(2);

        await _procedures.Received(2).uspReDespatchJobAsync(Arg.Any<int?>(), Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
        await _procedures.Received(2).uspReassignJobAsync(Arg.Any<int?>(), Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
        await _procedures.Received(1).uspReDespatchJobByCourierIDAsync(100, Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }

    // ---- finding 2: the visibility checks behind the photo and attachment endpoints ----

    [Fact]
    public async Task IsJobHidden_IsTrueOnlyForABranchLimitedCallerWhoCannotSeeTheJob()
    {
        await SeedWorld();

        Assert.False(await JobRepo(MelbourneOnly()).IsJobHiddenByBranchScopeAsync(1));
        Assert.True(await JobRepo(MelbourneOnly()).IsJobHiddenByBranchScopeAsync(2));
        Assert.True(await JobRepo(MelbourneOnly()).IsJobHiddenByBranchScopeAsync(999));
        Assert.False(await JobRepo(Unlimited()).IsJobHiddenByBranchScopeAsync(2));
    }

    [Theory]
    [InlineData("DeliveryPhotos/2026/11/1-20261116101500.jpg", false)]          // job 1: Melbourne's
    [InlineData("JobAttachments/2026/11/1-20261116101500.pdf", false)]
    [InlineData("JobAttachments/1-20230101120000", false)]                       // legacy flat key
    [InlineData("RestoredArchive/DeliveryPhotos/2026/11/1-2026.jpg", false)]
    [InlineData("DeliveryPhotos/2026/11/2-20261116101500.jpg", true)]            // job 2: Sydney's
    [InlineData("DeliverySignatures/2026/11/999-1.png", true)]                   // no such job
    [InlineData("something-without-a-job-id.txt", true)]                         // unreadable key fails closed
    [InlineData("", true)]
    public async Task IsJobMediaKeyHidden_FollowsTheJobInTheKey_AndFailsClosed(string key, bool hidden)
    {
        await SeedWorld();

        Assert.Equal(hidden, await JobRepo(MelbourneOnly()).IsJobMediaKeyHiddenByBranchScopeAsync(key));
    }

    [Fact]
    public async Task IsJobMediaKeyHidden_IsAlwaysFalse_ForStaffWhoAreNotBranchLimited()
    {
        await SeedWorld();

        Assert.False(await JobRepo(Unlimited()).IsJobMediaKeyHiddenByBranchScopeAsync("nothing-readable"));
    }

    [Theory]
    [InlineData("DeliveryPhotos/2024/01/12-20240101120000.jpg", 12)]
    [InlineData("JobAttachments/12-20230101120000", 12)]
    [InlineData("DeliveryScannedDocuments/2024/07/5-DeliveryScannedDocument-1", 5)]
    [InlineData("RestoredArchive/PickupPhotos/2024/01/7-x.jpg", 7)]
    [InlineData("PickupScannedDocuments/2024/07/3-PickupScannedDocument-1", 3)]
    [InlineData("PickupSignatures/2024/07/4-20240701.png", 4)]
    [InlineData("DeliverySignatures/2024/07/8-20240701.png", 8)]
    public void JobMediaKey_ReadsTheJobIdFromTheLastSegment(string key, int expected)
    {
        Assert.True(JobMediaKey.TryGetJobId(key, out var jobId));
        Assert.Equal(expected, jobId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("DeliveryPhotos/2024/01/notanumber-1.jpg")]
    [InlineData("DeliveryPhotos/2024/01/0-1.jpg")]
    [InlineData("DeliveryPhotos/2024/01/")]
    // Not a key we issued: a backslash (S3 keeps it literally, so the parsed id could differ from the owner), traversal,
    // empty segments, a leading slash, or a folder that is not one of ours.
    [InlineData(@"DeliveryPhotos\2024\01\9-x.jpg")]
    [InlineData(@"DeliveryPhotos/2024/01/1.x\2-a")]
    [InlineData("DeliveryPhotos/../JobAttachments/9-x.jpg")]
    [InlineData("DeliveryPhotos//9-x.jpg")]
    [InlineData("/DeliveryPhotos/2024/01/9-x.jpg")]
    [InlineData("Reports/2024/01/9-x.csv")]
    [InlineData("Jobs/2024/11/9-x.csv")]
    [InlineData("9-x.jpg")]
    [InlineData("RestoredArchive/9-x.jpg")]
    [InlineData("RestoredArchive/Reports/2024/01/9-x.csv")]
    [InlineData("RestoredArchive/RestoredArchive/DeliveryPhotos/2024/01/9-x.jpg")]
    [InlineData("deliveryphotos/2024/01/9-x.jpg")]
    public void JobMediaKey_RejectsKeysWithNoJobId_OrNotOurLayout(string? key)
    {
        Assert.False(JobMediaKey.TryGetJobId(key, out _));
    }

    [Theory]
    [InlineData("DeliveryPhotos/2024/01/9-x.jpg", true)]
    [InlineData("JobAttachments/9-20230101", true)]
    [InlineData("jobs/1/photo.png", true)]                      // structurally fine; the folder whitelist is a separate check
    [InlineData(@"DeliveryPhotos\2024\01\9-x.jpg", false)]
    [InlineData("a/../b", false)]
    [InlineData("a//b", false)]
    [InlineData("/a/b", false)]
    [InlineData("a/b/", false)]
    [InlineData("a/\u0000b", false)]
    [InlineData(" a/b", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void JobMediaKey_StructuralCheck_RefusesOnlyKeysWeNeverIssue(string? key, bool safe)
    {
        Assert.Equal(safe, JobMediaKey.IsStructurallySafe(key));
    }

    // Branch-limited users are held to our folders: a structurally clean key in another folder reads as hidden.
    [Fact]
    public async Task IsJobMediaKeyHidden_RefusesAKeyOutsideOurFolders_EvenWhenItNamesAVisibleJob()
    {
        await SeedWorld();
        var repo = JobRepo(MelbourneOnly());

        Assert.False(await repo.IsJobMediaKeyHiddenByBranchScopeAsync("DeliveryPhotos/2026/11/1-x.jpg"));   // job 1 is Melbourne's
        Assert.True(await repo.IsJobMediaKeyHiddenByBranchScopeAsync("Reports/2026/11/1-x.csv"));
        Assert.True(await repo.IsJobMediaKeyHiddenByBranchScopeAsync(@"DeliveryPhotos\2026\11\1-x.jpg"));
        Assert.True(await repo.IsJobMediaKeyHiddenByBranchScopeAsync("DeliveryPhotos/../DeliveryPhotos/2026/11/1-x.jpg"));
    }

    // ---- finding 3: notes and note history ----

    private static TucNoteHistory History(int id, int? noteId = null, int? bulkNoteId = null, int? archiveNoteId = null) => new()
    {
        NoteHistoryId = id, NoteId = noteId, BulkNoteId = bulkNoteId, ArchiveNoteId = archiveNoteId, EditedBy = 1,
        EditedAtUtc = TestDates.UtcNow, OldNoteText = "old", NewNoteText = "new"
    };

    [Fact]
    public async Task DeleteNote_OfAHiddenJobsNote_IsRefused_AndItsHistorySurvives()
    {
        await SeedWorld();
        await Seed(
            new TucNote { NoteId = 1, JobId = 1, NoteText = "mine" },
            new TucNote { NoteId = 2, JobId = 2, NoteText = "hidden" },
            History(1, noteId: 2));

        await Assert.ThrowsAsync<JobNotFoundException>(() => NoteRepo(MelbourneOnly()).DeleteNoteAsync(2));

        await using var verify = _db.CreateContext();
        Assert.Equal(1, await verify.TucNoteHistories.CountAsync(h => h.NoteId == 2, Ct));
        Assert.Equal(1, await verify.TucNotes.CountAsync(n => n.NoteId == 2, Ct));
    }

    [Fact]
    public async Task DeleteNote_OfAVisibleJobsNote_StillDeletesTheNoteAndItsHistory()
    {
        await SeedWorld();
        await Seed(new TucNote { NoteId = 1, JobId = 1, NoteText = "mine" }, History(1, noteId: 1));

        await NoteRepo(MelbourneOnly()).DeleteNoteAsync(1);

        await using var verify = _db.CreateContext();
        Assert.Equal(0, await verify.TucNotes.CountAsync(Ct));
        Assert.Equal(0, await verify.TucNoteHistories.CountAsync(Ct));
    }

    [Fact]
    public async Task GetNoteHistory_ForAHiddenNote_IsEmpty_ForAVisibleOne_Returned()
    {
        await SeedWorld();
        await Seed(
            new TucNote { NoteId = 1, JobId = 1, NoteText = "mine" },
            new TucNote { NoteId = 2, JobId = 2, NoteText = "hidden" },
            History(1, noteId: 1), History(2, noteId: 2));

        var repo = NoteRepo(MelbourneOnly());

        Assert.Single(await repo.GetNoteHistoryAsync(1, NoteHistorySource.Note));
        Assert.Empty(await repo.GetNoteHistoryAsync(2, NoteHistorySource.Note));
    }

    [Fact]
    public async Task GetNoteHistory_ForArchiveAndBulkNotes_FollowsTheirJob()
    {
        await SeedWorld();
        await Seed(
            new TucJobArchive { UcjbId = 5, UcjbNumber = "A5", UcjbClientId = 20 },
            new TucJobArchive { UcjbId = 6, UcjbNumber = "A6", UcjbClientId = 10 },
            new TucNoteArchive { NoteId = 1, JobId = 5, NoteText = "mine" },
            new TucNoteArchive { NoteId = 2, JobId = 6, NoteText = "hidden" },
            new TblBulkJob { BulkJobId = 1, ClientId = 20 }, new TblBulkJob { BulkJobId = 2, ClientId = 10 },
            new TblBulkJobNote { NoteId = 1, BulkJobId = 1, NoteText = "mine", NoteTypeId = 1, CreatedDate = TestDates.Now },
            new TblBulkJobNote { NoteId = 2, BulkJobId = 2, NoteText = "hidden", NoteTypeId = 1, CreatedDate = TestDates.Now },
            History(1, archiveNoteId: 1), History(2, archiveNoteId: 2), History(3, bulkNoteId: 1), History(4, bulkNoteId: 2));

        var repo = NoteRepo(MelbourneOnly());

        Assert.Single(await repo.GetNoteHistoryAsync(1, NoteHistorySource.Archive));
        Assert.Empty(await repo.GetNoteHistoryAsync(2, NoteHistorySource.Archive));
        Assert.Single(await repo.GetNoteHistoryAsync(1, NoteHistorySource.BulkNote));
        Assert.Empty(await repo.GetNoteHistoryAsync(2, NoteHistorySource.BulkNote));
    }

    [Fact]
    public async Task BulkNotes_OfAHiddenBulkJob_AreNotReadable_Editable_OrDeletable()
    {
        await SeedWorld();
        await Seed(
            new TblBulkJob { BulkJobId = 1, ClientId = 20 }, new TblBulkJob { BulkJobId = 2, ClientId = 10 },
            new TblBulkJobNote { NoteId = 1, BulkJobId = 1, NoteText = "mine", NoteTypeId = 1, CreatedDate = TestDates.Now },
            new TblBulkJobNote { NoteId = 2, BulkJobId = 2, NoteText = "hidden", NoteTypeId = 1, CreatedDate = TestDates.Now },
            History(1, bulkNoteId: 2));
        var repo = NoteRepo(MelbourneOnly());

        // Read
        Assert.Single(await repo.GetBulkJobNotesByBulkJobIdAsync(1));
        Assert.Empty(await repo.GetBulkJobNotesByBulkJobIdAsync(2));
        Assert.NotNull(await repo.GetBulkNoteByIdAsync(1));
        Assert.Null(await repo.GetBulkNoteByIdAsync(2));

        // Edit (FindAsync reads past every filter) and create
        await Assert.ThrowsAsync<JobNotFoundException>(() => repo.SaveBulkNoteAsync(
            new TucNoteViewModel { NoteId = 2, BulkJobId = 2, NoteText = "hacked", NoteTypeId = 1 }));
        await Assert.ThrowsAsync<JobNotFoundException>(() => repo.SaveBulkNoteAsync(
            new TucNoteViewModel { NoteId = 0, BulkJobId = 2, NoteText = "new", NoteTypeId = 1 }));

        // Delete
        await Assert.ThrowsAsync<JobNotFoundException>(() => repo.DeleteBulkNoteAsync(2));

        await using var verify = _db.CreateContext();
        Assert.Equal("hidden", (await verify.TblBulkJobNotes.SingleAsync(n => n.NoteId == 2, Ct)).NoteText);
        Assert.Equal(1, await verify.TucNoteHistories.CountAsync(h => h.BulkNoteId == 2, Ct));
        Assert.Equal(2, await verify.TblBulkJobNotes.CountAsync(Ct));
    }

    [Fact]
    public async Task BulkNotes_AreUnchanged_ForStaffWhoAreNotBranchLimited()
    {
        await SeedWorld();
        await Seed(
            new TblBulkJob { BulkJobId = 2, ClientId = 10 },
            new TblBulkJobNote { NoteId = 2, BulkJobId = 2, NoteText = "hidden", NoteTypeId = 1, CreatedDate = TestDates.Now });
        var repo = NoteRepo(Unlimited());

        Assert.Single(await repo.GetBulkJobNotesByBulkJobIdAsync(2));
        await repo.DeleteBulkNoteAsync(2);

        await using var verify = _db.CreateContext();
        Assert.Equal(0, await verify.TblBulkJobNotes.CountAsync(Ct));
    }

    // ---- finding 4: the configured parent courier still resolves for a branch-limited user ----

    [Fact]
    public async Task SplitParentCourier_Resolves_EvenWhenItIsOutsideTheUsersCourierList()
    {
        // Courier 4 'ParentJobs' sits on Sydney's default branch only by having no branch; this user has Melbourne alone.
        await Seed(Courier(4, Sydney), TestSettings.Minimal(parentJobCourierId: 4));
        var method = typeof(SplitJobService).GetMethod("GetParentJobCourierIdAsync", BindingFlags.NonPublic | BindingFlags.Static)!;

        await using var limited = new DespatchContext(_db.Options, ScopeProviderFor(MelbourneOnly()));
        await using var unlimited = new DespatchContext(_db.Options, ScopeProviderFor(Unlimited()));

        Assert.Equal(4, await (Task<int?>)method.Invoke(null, [limited, Ct])!);
        Assert.Equal(4, await (Task<int?>)method.Invoke(null, [unlimited, Ct])!);
    }

    [Fact]
    public async Task SplitParentCourier_IsNull_WhenTheConfiguredCourierDoesNotExist()
    {
        await Seed(TestSettings.Minimal(parentJobCourierId: 4));
        var method = typeof(SplitJobService).GetMethod("GetParentJobCourierIdAsync", BindingFlags.NonPublic | BindingFlags.Static)!;

        await using var limited = new DespatchContext(_db.Options, ScopeProviderFor(MelbourneOnly()));

        Assert.Null(await (Task<int?>)method.Invoke(null, [limited, Ct])!);
    }

    private static IScopeProvider ScopeProviderFor(ScopeContext scope)
    {
        var provider = Substitute.For<IScopeProvider>();
        provider.Scope.Returns(scope);
        return provider;
    }

    // ---- finding 5: a hidden client cannot be written onto a job ----

    [Fact]
    public async Task EditingTheClientOfABulkJob_ToAHiddenClient_IsRefused_AndNothingChanges()
    {
        await SeedWorld();
        await Seed(new TblBulkJob { BulkJobId = 1, ClientId = 20, ClientCode = "C20" });

        await Assert.ThrowsAsync<ClientNotFoundException>(() =>
            JobRepo(MelbourneOnly()).UpdateBulkJobAsync(1, JobProperty.ClientID, "10"));   // client 10 is Sydney's

        await using var verify = _db.CreateContext();
        var job = await verify.TblBulkJobs.SingleAsync(b => b.BulkJobId == 1, Ct);
        Assert.Equal(20, job.ClientId);
        Assert.Equal("C20", job.ClientCode);
    }

    [Fact]
    public async Task EditingTheClientOfABulkJob_ToAVisibleClient_WritesIdAndCode()
    {
        await SeedWorld();
        await Seed(Client(21, Melbourne), new TblBulkJob { BulkJobId = 1, ClientId = 20, ClientCode = "C20" });

        await JobRepo(MelbourneOnly()).UpdateBulkJobAsync(1, JobProperty.ClientID, "21");

        await using var verify = _db.CreateContext();
        var job = await verify.TblBulkJobs.SingleAsync(b => b.BulkJobId == 1, Ct);
        Assert.Equal(21, job.ClientId);
        Assert.Equal("C21", job.ClientCode);
    }

    [Fact]
    public async Task EditingTheClientOfALiveJob_ToAHiddenClient_IsRefused()
    {
        await SeedWorld();
        var method = typeof(JobRepository).GetMethod("UpdateTucJobWithEntityAsync", BindingFlags.NonPublic | BindingFlags.Instance)!;

        var ex = await Assert.ThrowsAsync<ClientNotFoundException>(async () =>
            await (Task)method.Invoke(JobRepo(MelbourneOnly()), [1, JobProperty.ClientID, "10"])!);

        Assert.Equal("Client 10 was not found.", ex.Message);
        await using var verify = _db.CreateContext();
        Assert.Equal(20, (await verify.TucJobs.SingleAsync(j => j.UcjbId == 1, Ct)).UcjbClientId);
    }

    [Fact]
    public async Task EditingTheClientOfAnArchivedJob_ToAHiddenClient_IsRefused()
    {
        await SeedWorld();
        await Seed(new TucJobArchive { UcjbId = 5, UcjbNumber = "A5", UcjbClientId = 20 });
        var method = typeof(JobRepository).GetMethod("UpdateTucJobArchiveAsync", BindingFlags.NonPublic | BindingFlags.Instance)!;

        await Assert.ThrowsAsync<ClientNotFoundException>(async () =>
            await (Task)method.Invoke(JobRepo(MelbourneOnly()), [5, JobProperty.ClientID, "10"])!);

        await using var verify = _db.CreateContext();
        Assert.Equal(20, (await verify.TucJobArchives.SingleAsync(j => j.UcjbId == 5, Ct)).UcjbClientId);
    }

    [Fact]
    public async Task EditingTheClientOfABulkJob_StillWorksForAnyClient_ForStaffWhoAreNotBranchLimited()
    {
        await SeedWorld();
        await Seed(new TblBulkJob { BulkJobId = 1, ClientId = 20, ClientCode = "C20" });

        await JobRepo(Unlimited()).UpdateBulkJobAsync(1, JobProperty.ClientID, "10");

        await using var verify = _db.CreateContext();
        Assert.Equal(10, (await verify.TblBulkJobs.SingleAsync(b => b.BulkJobId == 1, Ct)).ClientId);
    }

    // ---- final review 2: adding an accessorial charge by job id, and quick-create for a hidden client ----

    private AccessorialChargeRepository AccessorialRepo(ScopeContext scope) => new(FactoryFor(scope));

    private static JobAccessorialChargeCreateRequest Charge() => new() { AccessorialChargeId = 5, ItemCount = 1 };

    [Fact]
    public async Task AddAccessorialCharge_RefusesAHiddenJob_AndRunsNoProcedure()
    {
        await SeedWorld();

        await Assert.ThrowsAsync<JobNotFoundException>(() => AccessorialRepo(MelbourneOnly()).AddChargeAsync(2, Charge(), "u"));   // job 2 is Sydney's
        await Assert.ThrowsAsync<JobNotFoundException>(() => AccessorialRepo(MelbourneOnly()).AddChargeAsync(999, Charge(), "u"));

        await _procedures.DidNotReceiveWithAnyArgs().sp_AddJobAccessorialAsync(
            default, default, default, default, null!, null!, null!, null!, default, default);
    }

    [Fact]
    public async Task AddAccessorialCharge_RunsForAVisibleJob_AndForStaffWhoAreNotBranchLimited()
    {
        await SeedWorld();

        await AccessorialRepo(MelbourneOnly()).AddChargeAsync(1, Charge(), "u");     // job 1 is Melbourne's
        await AccessorialRepo(Unlimited()).AddChargeAsync(2, Charge(), "u");         // unlimited staff: any job

        await _procedures.Received(1).sp_AddJobAccessorialAsync(
            1, 5, Arg.Any<decimal?>(), 1, "dispatch", "u", Arg.Any<string>(), Arg.Any<OutputParameter<decimal?>>(),
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
        await _procedures.Received(1).sp_AddJobAccessorialAsync(
            2, 5, Arg.Any<decimal?>(), 1, "dispatch", "u", Arg.Any<string>(), Arg.Any<OutputParameter<decimal?>>(),
            Arg.Any<OutputParameter<int>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task QuickAddJob_RefusesAHiddenClient_BeforeAnythingIsGenerated()
    {
        await SeedWorld();
        var request = new JobCreateViewModel { ClientId = 10, SpeedId = 3 };   // client 10 is Sydney's

        var ex = await Assert.ThrowsAsync<ClientNotFoundException>(() => JobRepo(MelbourneOnly()).QuickAddJobAsync(request));

        Assert.Equal("Client 10 was not found.", ex.Message);
        await _tenantInfo.DidNotReceive().GetStaffInfoAsync();
    }

    [Fact]
    public async Task QuickAddJob_GetsPastTheClientCheck_ForAVisibleClient_AndForStaffWhoAreNotBranchLimited()
    {
        await SeedWorld();

        // The staff lookup is not stubbed, so the call stops there: past the client check, which is what is under test.
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            JobRepo(MelbourneOnly()).QuickAddJobAsync(new JobCreateViewModel { ClientId = 20, SpeedId = 3 }));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            JobRepo(Unlimited()).QuickAddJobAsync(new JobCreateViewModel { ClientId = 10, SpeedId = 3 }));
    }
}
