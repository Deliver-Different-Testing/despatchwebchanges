using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

public class JobRepositoryMarkJobAsReadTests : JobRepositoryTestBase
{

    public JobRepositoryMarkJobAsReadTests()
    {
        _tenantInfoServiceMock.GetStaffId().Returns(42);
        _tenantInfoServiceMock.GetStaffIdOrNull().Returns(42);
    }

    [Fact]
    public async Task MarkJobAsReadAsync_LiveJobNotYetTracked_InsertsReadTracker()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob { UcjbId = 1, UcjbNumber = "JOB-001" });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.MarkJobAsReadAsync(1);

        await using var verifyContext = CreateContext();
        var tracker = await verifyContext.TucJobReadTrackers.FirstAsync(t => t.JobId == 1, TestContext.Current.CancellationToken);

        Assert.True(tracker.HasBeenRead);
        Assert.Equal(42, tracker.ReadByStaffId);
        Assert.Equal(TestDates.Now, tracker.ReadTimestamp);
    }

    [Fact]
    public async Task MarkJobAsReadAsync_AlreadyTracked_LeavesExistingRowUnchanged()
    {
        var originalTimestamp = TestDates.Now.AddDays(-1);
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob { UcjbId = 2, UcjbNumber = "JOB-002" });
            context.TucJobReadTrackers.Add(new TucJobReadTracker
            {
                JobId = 2,
                HasBeenRead = true,
                ReadByStaffId = 7,
                ReadTimestamp = originalTimestamp
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.MarkJobAsReadAsync(2);

        await using var verifyContext = CreateContext();
        var tracker = await verifyContext.TucJobReadTrackers.FirstAsync(t => t.JobId == 2, TestContext.Current.CancellationToken);

        Assert.Equal(7, tracker.ReadByStaffId);
        Assert.Equal(originalTimestamp, tracker.ReadTimestamp);
    }

    [Fact]
    public async Task MarkJobAsReadAsync_JobNotInLiveTable_DoesNotInsertTracker()
    {
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive { UcjbId = 3, UcjbNumber = "JOB-003" });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.MarkJobAsReadAsync(3);

        await using var verifyContext = CreateContext();
        var trackerExists = await verifyContext.TucJobReadTrackers.AnyAsync(t => t.JobId == 3, TestContext.Current.CancellationToken);

        Assert.False(trackerExists);
    }
}
