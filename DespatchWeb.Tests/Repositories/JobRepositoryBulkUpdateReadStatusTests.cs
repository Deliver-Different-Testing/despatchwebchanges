using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

public class JobRepositoryBulkUpdateReadStatusTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryBulkUpdateReadStatusTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(42);
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
        _clearListEnvelopeServiceMock,
        _createJobServiceMock,
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
    );

    [Fact]
    public async Task BulkUpdateReadStatusAsync_MixOfTrackedAndUntrackedJobs_UpdatesAndInsertsTrackers()
    {
        var originalTimestamp = TestDates.Now.AddDays(-1);
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob { UcjbId = 1, UcjbNumber = "JOB-001" });
            context.TucJobs.Add(new TucJob { UcjbId = 2, UcjbNumber = "JOB-002" });
            context.TucJobReadTrackers.Add(new TucJobReadTracker
            {
                JobId = 1,
                HasBeenRead = false,
                ReadByStaffId = 7,
                ReadTimestamp = originalTimestamp
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.BulkUpdateReadStatusAsync(new BulkReadUpdateRequestModel
        {
            JobIds = [1, 2],
            ShouldMarkAsRead = true
        });

        await using var verifyContext = CreateContext();

        var trackerOne = await verifyContext.TucJobReadTrackers.FirstAsync(t => t.JobId == 1, TestContext.Current.CancellationToken);
        Assert.True(trackerOne.HasBeenRead);
        Assert.Equal(42, trackerOne.ReadByStaffId);
        Assert.Equal(TestDates.Now, trackerOne.ReadTimestamp);

        var trackerTwo = await verifyContext.TucJobReadTrackers.FirstAsync(t => t.JobId == 2, TestContext.Current.CancellationToken);
        Assert.True(trackerTwo.HasBeenRead);
        Assert.Equal(42, trackerTwo.ReadByStaffId);
        Assert.Equal(TestDates.Now, trackerTwo.ReadTimestamp);
    }

    [Fact]
    public async Task BulkUpdateReadStatusAsync_JobNotInLiveTable_DoesNotInsertTracker()
    {
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive { UcjbId = 3, UcjbNumber = "JOB-003" });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.BulkUpdateReadStatusAsync(new BulkReadUpdateRequestModel
        {
            JobIds = [3],
            ShouldMarkAsRead = true
        });

        await using var verifyContext = CreateContext();
        var trackerExists = await verifyContext.TucJobReadTrackers.AnyAsync(t => t.JobId == 3, TestContext.Current.CancellationToken);

        Assert.False(trackerExists);
    }

    [Fact]
    public async Task BulkUpdateReadStatusAsync_MarkAsUnread_UpdatesExistingTracker()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob { UcjbId = 4, UcjbNumber = "JOB-004" });
            context.TucJobReadTrackers.Add(new TucJobReadTracker
            {
                JobId = 4,
                HasBeenRead = true,
                ReadByStaffId = 7,
                ReadTimestamp = TestDates.Now.AddDays(-1)
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.BulkUpdateReadStatusAsync(new BulkReadUpdateRequestModel
        {
            JobIds = [4],
            ShouldMarkAsRead = false
        });

        await using var verifyContext = CreateContext();
        var tracker = await verifyContext.TucJobReadTrackers.FirstAsync(t => t.JobId == 4, TestContext.Current.CancellationToken);

        Assert.False(tracker.HasBeenRead);
        Assert.Equal(42, tracker.ReadByStaffId);
        Assert.Equal(TestDates.Now, tracker.ReadTimestamp);
    }

    [Fact]
    public async Task BulkUpdateReadStatusAsync_EmptyJobIds_DoesNothing()
    {
        var repository = CreateRepository();

        await repository.BulkUpdateReadStatusAsync(new BulkReadUpdateRequestModel
        {
            JobIds = [],
            ShouldMarkAsRead = true
        });

        await using var verifyContext = CreateContext();
        Assert.False(await verifyContext.TucJobReadTrackers.AnyAsync(TestContext.Current.CancellationToken));
    }
}
