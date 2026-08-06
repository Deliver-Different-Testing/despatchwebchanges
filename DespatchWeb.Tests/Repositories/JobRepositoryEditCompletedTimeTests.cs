using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the CompletedTime, PickUpTime, and FollowupTime write paths in JobRepository.EditOperations.
///
/// CompletedTime can be set in two ways:
/// 1. Direct edit (JobProperty.CompletedTime) — stores DateTimeOffset.Parse(value).DateTime
/// 2. Auto-set via Delivered=true or UndeliverableLocationID — calls
///    _infoService.GetCurrentTimeFromTimeZone(job.DeliverByTimeZone) which returns wall-clock
///    time in the delivery location's timezone.
///
/// PickUpTime is auto-set when Status changes to PickedUp, using the pickup timezone.
/// </summary>
public class JobRepositoryEditCompletedTimeTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    // Timezone records seeded in the database
    private const int PstTimezoneId = 1;
    private const string PstTimezoneName = "Pacific Standard Time";
    private const int EstTimezoneId = 2;
    private const string EstTimezoneName = "Eastern Standard Time";

    public JobRepositoryEditCompletedTimeTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();

        // Seed timezone records for entity-based tests
        using var context = _db.CreateContext();
        context.TimeZones.AddRange(
            new TimeZone { Id = PstTimezoneId, Name = PstTimezoneName, DisplayName = "Pacific Time", Code = "PST", OffsetHours = -8, OffsetString = "-08:00" },
            new TimeZone { Id = EstTimezoneId, Name = EstTimezoneName, DisplayName = "Eastern Time", Code = "EST", OffsetHours = -5, OffsetString = "-05:00" }
        );
        context.SaveChanges();

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);

        // Mock GetCurrentTimeFromTimeZone for specific timezones
        _tenantInfoServiceMock.GetCurrentTimeFromTimeZone(
                Arg.Is<TimeZone>(tz => tz!.Name == PstTimezoneName))
            .Returns(new DateTime(2024, 6, 15, 9, 37, 0));

        _tenantInfoServiceMock.GetCurrentTimeFromTimeZone(
                Arg.Is<TimeZone>(tz => tz!.Name == EstTimezoneName))
            .Returns(new DateTime(2024, 6, 15, 12, 37, 0));

        // Null timezone falls back to tenant time
        _tenantInfoServiceMock.GetCurrentTimeFromTimeZone(null!)
            .Returns(TestDates.Now);
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
        Substitute.For<ICourierRepository>()
    );

    [Fact]
    public async Task UpdateJobAsync_CompletedTime_DirectEdit_StoresWallClockTime()
    {
        // Arrange — direct edit uses ExecuteUpdateAsync with DateTimeOffset.Parse(value).DateTime
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 1,
                UcjbNumber = "JOB-001",
                UcjbComplTime = null
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // 09:37 PDT (-07:00) — wall-clock time in delivery timezone
        var newCompleted = new DateTimeOffset(2024, 6, 15, 9, 37, 0, TimeSpan.FromHours(-7));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.CompletedTime, newCompleted.ToString("O"));

        // Assert — .DateTime strips the offset, storing the wall-clock time
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 1,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(newCompleted.DateTime, updatedJob.UcjbComplTime); // CompletedTime should store the wall-clock time (09:37) from the DateTimeOffset
        Assert.Equal(9, updatedJob.UcjbComplTime!.Value.Hour);
        Assert.Equal(37, updatedJob.UcjbComplTime!.Value.Minute);
    }

    [Fact]
    public async Task UpdateJobAsync_CompletedTime_DirectEdit_ArchivedJob_StoresWallClockTime()
    {
        // Arrange — archived job uses entity-based update
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 2,
                UcjbNumber = "JOB-002",
                UcjbComplTime = null
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var newCompleted = new DateTimeOffset(2024, 6, 15, 12, 37, 0, TimeSpan.FromHours(-4));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(2, JobProperty.CompletedTime, newCompleted.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedArchive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 2,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(newCompleted.DateTime, updatedArchive.UcjbComplTime); // archived CompletedTime should store wall-clock time from DateTimeOffset
        Assert.Equal(12, updatedArchive.UcjbComplTime!.Value.Hour);
        Assert.Equal(37, updatedArchive.UcjbComplTime!.Value.Minute);
    }

    [Fact]
    public async Task UpdateJobAsync_CompletedTime_EmptyValue_LiveJob_ClearsCompletedTime()
    {
        // Arrange — a completed live job with an existing POD time
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 10,
                UcjbNumber = "JOB-010",
                UcjbComplTime = new DateTime(2024, 6, 15, 9, 37, 0)
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act — an empty value clears the POD time
        await repository.UpdateJobAsync(10, JobProperty.CompletedTime, string.Empty);

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 10,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Null(updatedJob.UcjbComplTime); // empty value should null the POD time
    }

    [Fact]
    public async Task UpdateJobAsync_CompletedTime_EmptyValue_ArchivedJob_ClearsCompletedTime()
    {
        // Arrange — a completed archived job with an existing POD time
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 11,
                UcjbNumber = "JOB-011",
                UcjbComplTime = new DateTime(2024, 6, 15, 12, 37, 0)
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act — clearing must also work on archived jobs
        await repository.UpdateJobAsync(11, JobProperty.CompletedTime, string.Empty);

        // Assert
        await using var verifyContext = CreateContext();
        var updatedArchive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 11,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Null(updatedArchive.UcjbComplTime); // empty value should null the archived POD time
    }

    [Fact]
    public async Task UpdateJobAsync_Delivered_LiveJob_SetsCompletedTimeViaInfoService()
    {
        // Arrange — Delivered=true uses entity-based update with DeliverByTimeZone include
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 3,
                UcjbNumber = "JOB-003",
                UcjbJobDone = false,
                UcjbStatus = (int)JobStatus.Dispatched,
                UcjbComplTime = null,
                DeliverByTimeZoneId = PstTimezoneId
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(3, JobProperty.Delivered, "true");

        // Assert — should have called GetCurrentTimeFromTimeZone with the PST timezone
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 3,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.True(updatedJob.UcjbJobDone);
        Assert.Equal((int)JobStatus.Completed, updatedJob.UcjbStatus);
        Assert.Equal(new DateTime(2024, 6, 15, 9, 37, 0), updatedJob.UcjbComplTime); // CompletedTime should be the wall-clock time from GetCurrentTimeFromTimeZone(PST)

        _tenantInfoServiceMock.Received(1)
            .GetCurrentTimeFromTimeZone(Arg.Is<TimeZone>(tz => tz!.Name == PstTimezoneName));
    }

    [Fact]
    public async Task UpdateJobAsync_UndeliverableLocation_LiveJob_SetsCompletedTimeViaInfoService()
    {
        // Arrange — UndeliverableLocationID uses entity-based update with DeliverByTimeZone include
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 4,
                UcjbNumber = "JOB-004",
                UcjbJobDone = false,
                UcjbStatus = (int)JobStatus.Dispatched,
                UcjbComplTime = null,
                DeliverByTimeZoneId = EstTimezoneId
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act — setting UndeliverableLocationID marks as undeliverable and sets CompletedTime
        await repository.UpdateJobAsync(4, JobProperty.UndeliverableLocationID, "99");

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 4,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.True(updatedJob.UcjbJobDone);
        Assert.Equal((int)JobStatus.Undeliverable, updatedJob.UcjbStatus);
        Assert.Equal(new DateTime(2024, 6, 15, 12, 37, 0), updatedJob.UcjbComplTime); // CompletedTime should be the wall-clock time from GetCurrentTimeFromTimeZone(EST)

        _tenantInfoServiceMock.Received(1)
            .GetCurrentTimeFromTimeZone(Arg.Is<TimeZone>(tz => tz!.Name == EstTimezoneName));
    }

    [Fact]
    public async Task UpdateJobAsync_StatusPickedUp_SetsPickUpTimeViaPickupTimezone()
    {
        // Arrange — Status=PickedUp uses entity-based update with PickupTimeZone include
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 5,
                UcjbNumber = "JOB-005",
                UcjbStatus = (int)JobStatus.Dispatched,
                PickUpTime = null,
                PickupTimeZoneId = PstTimezoneId
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(5, JobProperty.Status, ((int)JobStatus.PickedUp).ToString());

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 5,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal((int)JobStatus.PickedUp, updatedJob.UcjbStatus);
        Assert.Equal(new DateTime(2024, 6, 15, 9, 37, 0), updatedJob.PickUpTime); // PickUpTime should be the wall-clock time from GetCurrentTimeFromTimeZone(PST)

        _tenantInfoServiceMock.Received(1)
            .GetCurrentTimeFromTimeZone(Arg.Is<TimeZone>(tz => tz!.Name == PstTimezoneName));
    }

    [Fact]
    public async Task UpdateJobAsync_StatusPickedUp_NullPickupTimezone_FallsBackToTenantTime()
    {
        // Arrange — no pickup timezone set, should fall back to tenant time
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 6,
                UcjbNumber = "JOB-006",
                UcjbStatus = (int)JobStatus.Dispatched,
                PickUpTime = null,
                PickupTimeZoneId = null // No timezone set
            });
            
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(6, JobProperty.Status, ((int)JobStatus.PickedUp).ToString());

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 6,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal((int)JobStatus.PickedUp, updatedJob.UcjbStatus);
        Assert.Equal(TestDates.Now, updatedJob.PickUpTime); // with null pickup timezone, GetCurrentTimeFromTimeZone(null) should return tenant time

        _tenantInfoServiceMock.Received(1)
            .GetCurrentTimeFromTimeZone(Arg.Is<TimeZone>(tz => tz == null));
    }

    [Fact]
    public async Task UpdateJobAsync_FollowupTime_DirectEdit_StoresWallClockTime()
    {
        // Arrange — FollowupTime direct edit uses ExecuteUpdateAsync
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 7,
                UcjbNumber = "JOB-007",
                FollowupTime = null
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // FollowupTime is a tenant-local field, so it uses tenant TZ offset
        var newFollowup = new DateTimeOffset(2024, 6, 15, 14, 30, 0, TimeSpan.FromHours(12));
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(7, JobProperty.FollowupTime, newFollowup.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 7,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(newFollowup.DateTime, updatedJob.FollowupTime); // FollowupTime should store the wall-clock time from DateTimeOffset
        Assert.Equal(14, updatedJob.FollowupTime!.Value.Hour);
        Assert.Equal(30, updatedJob.FollowupTime!.Value.Minute);
    }

    [Fact]
    public async Task UpdateJobAsync_PodName_EmptyValue_ClearsName()
    {
        // Arrange — an active job that already has a POD name
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 10,
                UcjbNumber = "JOB-010",
                UcjbPodname = "Jane Doe"
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act — an empty value clears the POD name
        await repository.UpdateJobAsync(10, JobProperty.PodName, "");

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 10,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(string.Empty, updatedJob.UcjbPodname);
    }

    [Fact]
    public async Task UpdateJobAsync_PodName_EmptyValue_ArchivedJob_ClearsName()
    {
        // Arrange — an archived job that already has a POD name
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 11,
                UcjbNumber = "JOB-011",
                UcjbPodname = "John Smith"
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(11, JobProperty.PodName, "");

        // Assert
        await using var verifyContext = CreateContext();
        var updatedArchive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 11,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(string.Empty, updatedArchive.UcjbPodname);
    }
}
