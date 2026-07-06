using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the BookedTime edit path in JobRepository.EditOperations.
/// Verifies that editing a job's booked date/time updates both UcjbDate and UcjbTime
/// for live jobs (via ExecuteUpdateAsync) and archived jobs (via entity tracking).
/// </summary>
public class JobRepositoryEditBookedTimeTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryEditBookedTimeTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
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
        _createJobServiceMock
    );

    [Fact]
    public async Task UpdateJobAsync_BookedTime_LiveJob_UpdatesBothUcjbDateAndUcjbTime()
    {
        // Arrange
        var originalDate = new DateTime(2024, 3, 4, 6, 0, 0);
        var originalTime = new DateTime(2024, 3, 4, 6, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 1,
                UcjbNumber = "JOB-001",
                UcjbDate = originalDate,
                UcjbTime = originalTime
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var newDateTime = new DateTimeOffset(2024, 3, 3, 15, 20, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.BookedTime, newDateTime.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 1, cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(newDateTime.DateTime, updatedJob.UcjbDate); // UcjbDate should be updated to the new booked date/time
        Assert.Equal(newDateTime.DateTime, updatedJob.UcjbTime); // UcjbTime should also be updated to match the new booked date/time
    }

    [Fact]
    public async Task UpdateJobAsync_BookedTime_LiveJob_OverwritesPreviousTime()
    {
        // Arrange — simulates the original bug: date on 4th, time at 6am
        var originalDate = new DateTime(2024, 3, 4, 0, 0, 0);
        var originalTime = new DateTime(2024, 3, 4, 6, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 2,
                UcjbNumber = "JOB-002",
                UcjbDate = originalDate,
                UcjbTime = originalTime
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // User edits to 3rd March at 15:20
        var newDateTime = new DateTimeOffset(2024, 3, 3, 15, 20, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(2, JobProperty.BookedTime, newDateTime.ToString("O"));

        // Assert — the old 6am time must NOT survive
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 2, cancellationToken: TestContext.Current.CancellationToken);

        Assert.NotEqual(originalTime, updatedJob.UcjbTime); // the old UcjbTime (6am) should be overwritten, not preserved
        Assert.Equal(15, updatedJob.UcjbTime!.Value.Hour);
        Assert.Equal(20, updatedJob.UcjbTime!.Value.Minute);
    }

    [Fact]
    public async Task UpdateJobAsync_BookedTime_ArchivedJob_UpdatesBothUcjbDateAndUcjbTime()
    {
        // Arrange
        var originalDate = new DateTime(2024, 3, 4, 6, 0, 0);
        var originalTime = new DateTime(2024, 3, 4, 6, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 3,
                UcjbNumber = "JOB-003",
                UcjbDate = originalDate,
                UcjbTime = originalTime
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var newDateTime = new DateTimeOffset(2024, 3, 3, 15, 20, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(3, JobProperty.BookedTime, newDateTime.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedArchive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 3, cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(newDateTime.DateTime, updatedArchive.UcjbDate); // archived UcjbDate should be updated to the new booked date/time
        Assert.Equal(newDateTime.DateTime, updatedArchive.UcjbTime); // archived UcjbTime should also be updated to match the new booked date/time
    }

    [Fact]
    public async Task UpdateJobAsync_BookedTime_ArchivedJob_OverwritesPreviousTime()
    {
        // Arrange — same bug scenario but for archived jobs
        var originalDate = new DateTime(2024, 3, 4, 0, 0, 0);
        var originalTime = new DateTime(2024, 3, 4, 6, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 4,
                UcjbNumber = "JOB-004",
                UcjbDate = originalDate,
                UcjbTime = originalTime
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var newDateTime = new DateTimeOffset(2024, 3, 3, 15, 20, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(4, JobProperty.BookedTime, newDateTime.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedArchive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 4, cancellationToken: TestContext.Current.CancellationToken);

        Assert.NotEqual(originalTime, updatedArchive.UcjbTime); // the old archived UcjbTime (6am) should be overwritten
        Assert.Equal(15, updatedArchive.UcjbTime!.Value.Hour);
        Assert.Equal(20, updatedArchive.UcjbTime!.Value.Minute);
    }

}
