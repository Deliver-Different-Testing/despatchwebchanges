using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// A job's status id, its done flag and its completion time have to move together. They did not:
/// un-ticking Done left the status on Completed with a completion time still set, and picking
/// "Completed" from the status list left the flags saying the job had never been delivered. Both
/// combinations render as one thing on the grid and another in job properties.
/// </summary>
public class JobRepositoryStatusCoherenceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryStatusCoherenceTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
        _tenantInfoServiceMock.GetCurrentTimeFromTimeZone(Arg.Any<TimeZone>()).Returns(TestDates.Now);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

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
    public async Task UpdateJobAsync_UnTickingDelivered_ClearsTheCompletedStatusAndTime()
    {
        // Arrange - a delivered job
        await using (var context = _db.CreateContext())
        {
            var job = CreateJob(1);
            job.UcjbJobDone = true;
            job.UcjbStatus = (int)JobStatus.Completed;
            job.UcjbComplTime = TestDates.Now;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.Delivered, "false");

        // Assert - leaving Completed behind is literally the "complete but not done" pair
        await using var assertContext = _db.CreateContext();
        var updated = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 1, TestContext.Current.CancellationToken);
        Assert.False(updated.UcjbJobDone);
        Assert.NotEqual((int)JobStatus.Completed, updated.UcjbStatus);
        Assert.Null(updated.UcjbComplTime);
    }

    [Fact]
    public async Task UpdateJobAsync_SettingStatusToCompleted_AlsoMarksTheJobDone()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateJob(1));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.Status, ((int)JobStatus.Completed).ToString());

        // Assert - mirrors the UndeliverableLocationID branch, which already writes all three
        await using var assertContext = _db.CreateContext();
        var updated = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 1, TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Completed, updated.UcjbStatus);
        Assert.True(updated.UcjbJobDone);
        Assert.NotNull(updated.UcjbComplTime);
    }

    [Fact]
    public async Task UpdateJobAsync_MovingStatusBackOffCompleted_ClearsTheDoneFlag()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            var job = CreateJob(1);
            job.UcjbJobDone = true;
            job.UcjbStatus = (int)JobStatus.Completed;
            job.UcjbComplTime = TestDates.Now;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.Status, ((int)JobStatus.InTransit).ToString());

        // Assert
        await using var assertContext = _db.CreateContext();
        var updated = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 1, TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.InTransit, updated.UcjbStatus);
        Assert.False(updated.UcjbJobDone);
        Assert.Null(updated.UcjbComplTime);
    }

    [Fact]
    public async Task UpdateJobAsync_SettingStatusToUndeliverable_KeepsThatOutcomeRatherThanCompleting()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.Add(CreateJob(1));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.Status, ((int)JobStatus.Undeliverable).ToString());

        // Assert - Undeliverable is a finished outcome, so it closes the job without becoming Completed
        await using var assertContext = _db.CreateContext();
        var updated = await assertContext.TucJobs.FirstAsync(j => j.UcjbId == 1, TestContext.Current.CancellationToken);
        Assert.Equal((int)JobStatus.Undeliverable, updated.UcjbStatus);
        Assert.True(updated.UcjbJobDone);
        Assert.NotNull(updated.UcjbComplTime);
    }

    private static TucJob CreateJob(int id) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = $"JOB-{id:D3}",
            UcjbDate = TestDates.Now.Date,
            UcjbTime = TestDates.Now.Date.AddHours(9),
            UcjbStatus = (int)JobStatus.New
        };
}
