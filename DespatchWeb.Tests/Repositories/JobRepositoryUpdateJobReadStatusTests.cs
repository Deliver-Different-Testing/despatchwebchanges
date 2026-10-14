using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

public class JobRepositoryUpdateJobReadStatusTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryUpdateJobReadStatusTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffIdOrNull().Returns(42);
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
        _clock,
        Substitute.For<IClearListEnvelopeService>(),
        Substitute.For<ICreateJobService>(),
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
    );

    [Fact]
    public async Task UpdateJobReadStatusAsync_LiveJobNotYetTracked_InsertsTracker()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob { UcjbId = 1, UcjbNumber = "JOB-001" });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await CreateRepository().UpdateJobReadStatusAsync(1, true);

        await using var verifyContext = CreateContext();
        var tracker = await verifyContext.TucJobReadTrackers.SingleAsync(t => t.JobId == 1,
            TestContext.Current.CancellationToken);
        Assert.True(tracker.HasBeenRead);
        Assert.Equal(42, tracker.ReadByStaffId);
        Assert.Equal(TestDates.Now, tracker.ReadTimestamp);
    }

    [Fact]
    public async Task UpdateJobReadStatusAsync_AlreadyTracked_UpdatesExistingRow()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob { UcjbId = 2, UcjbNumber = "JOB-002" });
            context.TucJobReadTrackers.Add(new TucJobReadTracker
            {
                JobId = 2,
                HasBeenRead = true,
                ReadByStaffId = 7,
                ReadTimestamp = TestDates.Now.AddDays(-1)
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await CreateRepository().UpdateJobReadStatusAsync(2, false);

        await using var verifyContext = CreateContext();
        var tracker = await verifyContext.TucJobReadTrackers.SingleAsync(t => t.JobId == 2,
            TestContext.Current.CancellationToken);
        Assert.False(tracker.HasBeenRead);
        Assert.Equal(42, tracker.ReadByStaffId);
        Assert.Equal(TestDates.Now, tracker.ReadTimestamp);
    }

    [Fact]
    public async Task UpdateJobReadStatusAsync_NoStaffId_StoresNullStaff()
    {
        _tenantInfoServiceMock.GetStaffIdOrNull().Returns((int?)null);
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob { UcjbId = 4, UcjbNumber = "JOB-004" });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await CreateRepository().UpdateJobReadStatusAsync(4, true);

        await using var verifyContext = CreateContext();
        var tracker = await verifyContext.TucJobReadTrackers.SingleAsync(t => t.JobId == 4,
            TestContext.Current.CancellationToken);
        Assert.Null(tracker.ReadByStaffId);
    }

    [Fact]
    public async Task UpdateJobReadStatusAsync_JobNotInLiveTable_DoesNotInsertTracker()
    {
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive { UcjbId = 3, UcjbNumber = "JOB-003" });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await CreateRepository().UpdateJobReadStatusAsync(3, true);

        await using var verifyContext = CreateContext();
        Assert.False(await verifyContext.TucJobReadTrackers.AnyAsync(t => t.JobId == 3,
            TestContext.Current.CancellationToken));
    }
}
