using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Read paths whose child tables carry no NP query filter: a network partner must get nothing for
/// another agent's job, bulk job, note or courier, and still get its own.
/// </summary>
public class NetworkPartnerScopeLeakTests : IAsyncDisposable
{
    private const int OwnAgentId = 77;
    private const int OtherAgentId = 88;
    private const int OwnJobId = 100;
    private const int OtherJobId = 200;
    private const int OwnArchivedJobId = 300;
    private const int OtherArchivedJobId = 400;
    private const int OwnClientId = 10;
    private const int OtherClientId = 20;
    private const int OwnCourierId = 1;
    private const int OtherCourierId = 2;
    private const int CallerStaffId = 5;

    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _infoService = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public NetworkPartnerScopeLeakTests()
    {
        _infoService.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _infoService.GetStaffId().Returns(CallerStaffId);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private static ScopeContext NpScope() =>
        new(ClientTypeId: (int)ClientType.NetworkPartner, ClientId: null, NpAgentId: OwnAgentId);

    private static ScopeContext TenantScope() =>
        new(ClientTypeId: (int)ClientType.Tenant, ClientId: null, NpAgentId: null);

    private DespatchContext CreateContext(ScopeContext scope)
    {
        var provider = Substitute.For<IScopeProvider>();
        provider.Scope.Returns(scope);
        return new DespatchContext(_db.Options, provider);
    }

    private IDbContextFactory<DespatchContext> ScopedFactory(ScopeContext scope)
    {
        var factory = Substitute.For<IDbContextFactory<DespatchContext>>();
        factory.CreateDbContext().Returns(_ => CreateContext(scope));
        factory.CreateDbContextAsync(Arg.Any<CancellationToken>()).Returns(_ => CreateContext(scope));
        return factory;
    }

    private static TucCourier Courier(int id, int agentId) => new()
    {
        UccrId = id, Code = $"C{id}", UccrName = $"N{id}", UccrSurname = "S", UccrEmail = "c@t.com", UccrMobile = "1",
        Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T",
        NpAgentId = agentId
    };

    private static TucClient Client(int id, string code) => new()
    {
        UcclId = id, UcclCode = code, UcclName = code, UcclLegalName = code, Smsname = code, UcclActive = true,
        CreatedBy = "t", LastModifiedBy = "t"
    };

    private static TucNoteType NoteType() => new()
    {
        NoteTypeId = 1, NoteTypeName = "General", IsActive = true, IsPublic = false, IsSystemDefined = false
    };

    private async Task SeedJobsAsync()
    {
        await using var seed = _db.CreateContext();
        seed.TucJobs.AddRange(
            new TucJob { UcjbId = OwnJobId, UcjbNumber = "OWN", NpAgentId = OwnAgentId, UcjbClientId = OwnClientId },
            new TucJob
            {
                UcjbId = OtherJobId, UcjbNumber = "OTHER", NpAgentId = OtherAgentId, UcjbClientId = OtherClientId
            });
        seed.TucJobArchives.AddRange(
            new TucJobArchive { UcjbId = OwnArchivedJobId, UcjbNumber = "OWN-ARCH", NpAgentId = OwnAgentId },
            new TucJobArchive { UcjbId = OtherArchivedJobId, UcjbNumber = "OTHER-ARCH", NpAgentId = OtherAgentId });
        await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task IsJobVisibleAsync_Np_SeesOwnLiveAndArchivedJobsOnly()
    {
        await SeedJobsAsync();
        await using var context = CreateContext(NpScope());

        Assert.True(await context.IsJobVisibleAsync(OwnJobId));
        Assert.True(await context.IsJobVisibleAsync(OwnArchivedJobId));
        Assert.False(await context.IsJobVisibleAsync(OtherJobId));
        Assert.False(await context.IsJobVisibleAsync(OtherArchivedJobId));
    }

    [Fact]
    public async Task IsJobVisibleAsync_Tenant_SkipsTheLookup()
    {
        await using var context = CreateContext(TenantScope());

        Assert.True(await context.IsJobVisibleAsync(12345));
    }

    [Theory]
    [InlineData("JobAttachments/2026/11/100-638000.pdf", true)]
    [InlineData("DeliveryPhotos/2026/11/300-638000.jpg", true)]
    [InlineData("JobAttachments/2026/11/200-638000.pdf", false)]
    [InlineData("JobAttachments/somebody-elses-file.pdf", false)]
    [InlineData("", false)]
    public async Task IsMediaKeyVisibleAsync_Np_FollowsTheJobNamedInTheKey(string key, bool visible)
    {
        await SeedJobsAsync();
        await using var context = CreateContext(NpScope());

        Assert.Equal(visible, await context.IsMediaKeyVisibleAsync(key));
    }

    [Fact]
    public async Task IsMediaKeyVisibleAsync_Tenant_AcceptsAnyKeyIncludingLegacyNames()
    {
        await using var context = CreateContext(TenantScope());

        Assert.True(await context.IsMediaKeyVisibleAsync("Legacy/odd_name_without_job.jpg"));
    }

    [Fact]
    public async Task IsClientVisibleAsync_Np_SeesOnlyClientsOnItsOwnJobs()
    {
        await SeedJobsAsync();
        await using var context = CreateContext(NpScope());

        Assert.True(await context.IsClientVisibleAsync(OwnClientId));
        Assert.False(await context.IsClientVisibleAsync(OtherClientId));
    }

    [Fact]
    public async Task IsClientVisibleAsync_Customer_SeesItsOwnClientBeforeItHasAnyJobs()
    {
        await using var context = CreateContext(
            new ScopeContext(ClientTypeId: (int)ClientType.Customer, ClientId: 55, NpAgentId: null));

        Assert.True(await context.IsClientVisibleAsync(55));
        Assert.False(await context.IsClientVisibleAsync(OtherClientId));
    }

    [Fact]
    public async Task GetDeliveryJourneyForJobAsync_Np_ReturnsNothingForAnotherAgentsJob()
    {
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            seed.TucManualMessages.AddRange(
                new TucManualMessage { UcmmId = 1, JobId = OwnJobId, UcmmMessage = "own", UcmmDate = TestDates.Now },
                new TucManualMessage
                {
                    UcmmId = 2, JobId = OtherJobId, UcmmMessage = "other", UcmmDate = TestDates.Now
                });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var service = new DeliveryJourneyService(ScopedFactory(NpScope()), _infoService);

        Assert.Empty(await service.GetDeliveryJourneyForJobAsync(OtherJobId));
        Assert.NotEmpty(await service.GetDeliveryJourneyForJobAsync(OwnJobId));
    }

    [Fact]
    public async Task GetStatusHistoryForJobAsync_Np_ReturnsNothingForAnotherAgentsArchivedJob()
    {
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobStatuses.Add(new TucJobStatus { UcjsId = 6, UcjsName = "Completed" });
            seed.JobDeliveryJourneyArchives.AddRange(
                new JobDeliveryJourneyArchive
                {
                    JourneyId = 1, JobId = OwnArchivedJobId, ChangeType = nameof(DeliveryJourneyChangeType.JobStatus),
                    NewJobStatusId = 6, UpdatedByType = "Staff"
                },
                new JobDeliveryJourneyArchive
                {
                    JourneyId = 2, JobId = OtherArchivedJobId,
                    ChangeType = nameof(DeliveryJourneyChangeType.JobStatus), NewJobStatusId = 6, UpdatedByType = "Staff"
                });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var service = new DeliveryJourneyService(ScopedFactory(NpScope()), _infoService);

        Assert.Empty(await service.GetStatusHistoryForJobAsync(OtherArchivedJobId));
        Assert.Single(await service.GetStatusHistoryForJobAsync(OwnArchivedJobId));
    }

    [Fact]
    public async Task GetAppliedChargesAsync_Np_ReturnsNothingForAnotherAgentsJob()
    {
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            seed.AccessorialCharges.Add(new AccessorialCharge
            {
                AccessorialChargeId = 1, Name = "Tail lift", ChargeType = "Flat", Active = true
            });
            seed.JobAccessorialCharges.AddRange(
                new JobAccessorialCharge { JobAccessorialChargeId = 1, JobId = OwnJobId, AccessorialChargeId = 1, AddedAtStage = "Booking" },
                new JobAccessorialCharge { JobAccessorialChargeId = 2, JobId = OtherJobId, AccessorialChargeId = 1, AddedAtStage = "Booking" });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());
        var repository = new AccessorialChargeRepository(SqliteTestDatabase.CreateFactoryMock(context));

        Assert.Empty(await repository.GetAppliedChargesAsync(OtherJobId));
        Assert.Single(await repository.GetAppliedChargesAsync(OwnJobId));
    }

    [Fact]
    public async Task GetBulkJobNotesByBulkJobIdAsync_Np_ReturnsNothingForAnotherAgentsBulkJob()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TblBulkJobs.AddRange(
                new TblBulkJob { BulkJobId = 1, JobNumber = "BULK-OWN", NpAgentId = OwnAgentId },
                new TblBulkJob { BulkJobId = 2, JobNumber = "BULK-OTHER", NpAgentId = OtherAgentId });
            seed.TucNoteTypes.Add(NoteType());
            seed.TblBulkJobNotes.AddRange(
                new TblBulkJobNote { NoteId = 1, BulkJobId = 1, NoteTypeId = 1, NoteText = "own", CreatedDate = TestDates.Now },
                new TblBulkJobNote { NoteId = 2, BulkJobId = 2, NoteTypeId = 1, NoteText = "other", CreatedDate = TestDates.Now });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());
        var repository = new NoteRepository(SqliteTestDatabase.CreateFactoryMock(context), _infoService, _clock);

        Assert.Empty(await repository.GetBulkJobNotesByBulkJobIdAsync(2));
        Assert.Single(await repository.GetBulkJobNotesByBulkJobIdAsync(1));
    }

    [Fact]
    public async Task GetNoteHistoryAsync_Np_ReturnsNothingForAnotherAgentsNote()
    {
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            seed.TucNotes.AddRange(
                new TucNote { NoteId = 1, JobId = OwnJobId, NoteText = "own", NpAgentId = OwnAgentId },
                new TucNote { NoteId = 2, JobId = OtherJobId, NoteText = "other", NpAgentId = OtherAgentId });
            seed.TucStaffs.Add(new TucStaff
            {
                UcstId = CallerStaffId, UcstFirstName = "A", UcstLastName = "B", CreatedBy = "t", LastModifiedBy = "t"
            });
            seed.TucNoteHistories.AddRange(
                new TucNoteHistory { NoteHistoryId = 1, NoteId = 1, EditedBy = CallerStaffId, OldNoteText = "a", NewNoteText = "own" },
                new TucNoteHistory { NoteHistoryId = 2, NoteId = 2, EditedBy = CallerStaffId, OldNoteText = "b", NewNoteText = "other" });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());
        var repository = new NoteRepository(SqliteTestDatabase.CreateFactoryMock(context), _infoService, _clock);

        Assert.Empty(await repository.GetNoteHistoryAsync(2, NoteHistorySource.Note));
        Assert.Single(await repository.GetNoteHistoryAsync(1, NoteHistorySource.Note));
    }

    [Fact]
    public async Task ApplyScopeFilter_Np_KeepsOnlyTasksOnItsOwnJobs()
    {
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            seed.TucEvents.AddRange(
                new TucEvent { UcevId = 1, UcevJobId = OwnJobId },
                new TucEvent { UcevId = 2, UcevJobId = OtherJobId },
                new TucEvent { UcevId = 3, UcevJobId = OwnArchivedJobId },
                new TucEvent { UcevId = 4, UcevJobId = null });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());

        var ids = await TaskRepository.ApplyScopeFilter(context.TucEvents, context)
            .Select(e => e.UcevId)
            .OrderBy(id => id)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([1, 3], ids);
    }

    [Fact]
    public async Task ApplyScopeFilter_Tenant_KeepsEveryTask()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucEvents.AddRange(new TucEvent { UcevId = 1, UcevJobId = OtherJobId }, new TucEvent { UcevId = 2 });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(TenantScope());

        Assert.Equal(2, await TaskRepository.ApplyScopeFilter(context.TucEvents, context)
            .CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ActiveClientsAsync_Np_CanPickAnyActiveClientToBookFor()
    {
        // Product decision 2026-11-13: a network partner may quick-create a job for any active client.
        await SeedJobsAsync();
        await using (var seed = _db.CreateContext())
        {
            var inactive = Client(30, "OLD");
            inactive.UcclActive = false;
            seed.TucClients.AddRange(Client(OwnClientId, "OWN"), Client(OtherClientId, "OTH"), inactive);
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());
        var repository = new ClientRepository(SqliteTestDatabase.CreateFactoryMock(context));

        var clients = await repository.ActiveClientsAsync("");

        Assert.Equal([OwnClientId, OtherClientId], clients.Select(c => c.Id).Order());
    }

    [Fact]
    public async Task ActiveClientsAsync_Customer_SeesOnlyItsOwnClient()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucClients.AddRange(Client(OwnClientId, "OWN"), Client(OtherClientId, "OTH"));
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(
            new ScopeContext(ClientTypeId: (int)ClientType.Customer, ClientId: OwnClientId, NpAgentId: null));
        var repository = new ClientRepository(SqliteTestDatabase.CreateFactoryMock(context));

        Assert.Equal([OwnClientId], (await repository.ActiveClientsAsync("")).Select(c => c.Id));
    }

    [Fact]
    public async Task IsClientBookableAsync_Np_AnyActiveClientButNotAnInactiveOne()
    {
        await using (var seed = _db.CreateContext())
        {
            var inactive = Client(30, "OLD");
            inactive.UcclActive = false;
            seed.TucClients.AddRange(Client(OtherClientId, "OTH"), inactive);
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());

        Assert.True(await context.IsClientBookableAsync(OtherClientId));
        Assert.False(await context.IsClientBookableAsync(30));
        Assert.False(await context.IsClientBookableAsync(999));
    }

    [Fact]
    public async Task ActiveClientsAsync_Tenant_ReturnsEveryActiveClient()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucClients.AddRange(
                Client(OwnClientId, "OWN"),
                Client(OtherClientId, "OTH"));
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(TenantScope());
        var repository = new ClientRepository(SqliteTestDatabase.CreateFactoryMock(context));

        Assert.Equal(2, (await repository.ActiveClientsAsync("")).Count);
    }

    [Fact]
    public async Task GetMessagesByCourierIdAsync_Np_ReturnsNothingForAnotherAgentsCourierOrAnotherStaffMember()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucCouriers.AddRange(
                Courier(OwnCourierId, OwnAgentId),
                Courier(OtherCourierId, OtherAgentId));
            seed.TucManualMessages.AddRange(
                new TucManualMessage
                {
                    UcmmId = 1, UcmmSendFromStaffId = CallerStaffId, UcmmSendToCourierId = OwnCourierId,
                    UcmmMessage = "own", UcmmDate = TestDates.Now
                },
                new TucManualMessage
                {
                    UcmmId = 2, UcmmSendFromStaffId = CallerStaffId, UcmmSendToCourierId = OtherCourierId,
                    UcmmMessage = "other", UcmmDate = TestDates.Now
                },
                new TucManualMessage
                {
                    UcmmId = 3, UcmmSendFromStaffId = 99, UcmmSendToCourierId = OwnCourierId,
                    UcmmMessage = "someone else's chat", UcmmDate = TestDates.Now
                });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var context = CreateContext(NpScope());
        var repository = new MessageRepository(SqliteTestDatabase.CreateFactoryMock(context), _infoService, _clock,
            Substitute.For<IMessageHelperService>(), new MemoryCache(new MemoryCacheOptions()));

        Assert.Empty(await repository.GetMessagesByCourierIdAsync(OtherCourierId, CallerStaffId));
        Assert.Empty(await repository.GetMessagesByCourierIdAsync(OwnCourierId, 99));
        Assert.Single(await repository.GetMessagesByCourierIdAsync(OwnCourierId, CallerStaffId));
    }
}
