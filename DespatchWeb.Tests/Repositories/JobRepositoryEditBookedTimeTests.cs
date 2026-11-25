using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the BookedTime edit path in JobRepository.EditOperations.
/// Verifies that editing a job's booked date/time writes the date to UcjbDate and the time to UcjbTime
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
        _createJobServiceMock,
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
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

        Assert.Equal(newDateTime.Date, updatedJob.UcjbDate); // UcjbDate holds only the date (#1023)
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

        Assert.Equal(newDateTime.Date, updatedArchive.UcjbDate); // UcjbDate holds only the date (#1023)
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

    [Fact]
    public async Task UpdateJobAsync_BookedTime_TimeOnlyEditOfABookingPageJob_KeepsTheDateAndTheTimeAnchor()
    {
        // #1023: the booking page stores the time on 1899-12-30; a time-only edit must not touch UcjbDate.
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 5,
                UcjbNumber = "E893BIO",
                UcjbDate = new DateTime(2026, 11, 11),
                UcjbTime = new DateTime(1899, 12, 30, 14, 30, 0)
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await CreateRepository().UpdateJobAsync(5, JobProperty.BookedTime,
            new DateTimeOffset(2026, 11, 11, 15, 30, 0, TimeSpan.FromHours(-5)).ToString("O"));

        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 5, TestContext.Current.CancellationToken);
        Assert.Equal(new DateTime(2026, 11, 11), job.UcjbDate);
        Assert.Equal(new DateTime(1899, 12, 30, 15, 30, 0), job.UcjbTime);
    }

    [Fact]
    public async Task UpdateJobAsync_BookedTime_Unchanged_IsHandledWithoutAWrite()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 6,
                UcjbNumber = "JOB-006",
                UcjbDate = new DateTime(2026, 11, 11),
                UcjbTime = new DateTime(1899, 12, 30, 14, 30, 0)
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await CreateRepository().UpdateJobAsync(6, JobProperty.BookedTime,
            new DateTimeOffset(2026, 11, 11, 14, 30, 0, TimeSpan.Zero).ToString("O"));

        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 6, TestContext.Current.CancellationToken);
        Assert.Equal(new DateTime(1899, 12, 30, 14, 30, 0), job.UcjbTime);
    }

    [Fact]
    public async Task UpdateJobAsync_BookedTime_ArchivedBookingPageJob_KeepsTheDateAndTheTimeAnchor()
    {
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 7,
                UcjbNumber = "JOB-007",
                UcjbDate = new DateTime(2026, 11, 11),
                UcjbTime = new DateTime(1899, 12, 30, 14, 30, 0)
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await CreateRepository().UpdateJobAsync(7, JobProperty.BookedTime,
            new DateTimeOffset(2026, 11, 11, 15, 30, 0, TimeSpan.Zero).ToString("O"));

        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 7, TestContext.Current.CancellationToken);
        Assert.Equal(new DateTime(2026, 11, 11), job.UcjbDate);
        Assert.Equal(new DateTime(1899, 12, 30, 15, 30, 0), job.UcjbTime);
    }
}
