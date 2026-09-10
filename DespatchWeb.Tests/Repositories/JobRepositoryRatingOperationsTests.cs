using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the RatedManually guard in JobRepository.RatingOperations — a manually-priced job
/// must never be silently overwritten by an automatic re-rate, regardless of caller. The "not
/// manually rated" path isn't exercised here since it requires the SQL Server rating stored
/// procs, which aren't available against the SQLite test database; if the guard failed to skip,
/// these tests would instead throw when hitting that unavailable stored proc call.
/// </summary>
public class JobRepositoryRatingOperationsTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryRatingOperationsTests()
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
    public async Task RateJobUsAsync_JobIsRatedManually_SkipsUpdate()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 100, UcjbNumber = "JOB100", UcjbAmount = 50m, RatedManually = true
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // If the guard didn't fire, this would fall through to the rating stored proc, which
        // isn't available against SQLite and would throw.
        await repository.RateJobUsAsync(new RateJobUsDto { JobId = 100, IsPrebook = false });

        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal(50m, job!.UcjbAmount);
    }

    [Fact]
    public async Task RateJobUsAsync_PrebookJobIsRatedManually_SkipsUpdate()
    {
        await using (var context = CreateContext())
        {
            context.TucJobBookings.Add(new TucJobBooking
            {
                UcbkId = 200, UcbkJobNumber = "BK-200", UcbkAmount = 75m, RatedManually = true
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.RateJobUsAsync(new RateJobUsDto { JobId = 200, IsPrebook = true });

        await using var verifyContext = CreateContext();
        var booking = await verifyContext.TucJobBookings.FindAsync([200], TestContext.Current.CancellationToken);
        Assert.Equal(75m, booking!.UcbkAmount);
    }

    [Fact]
    public async Task UpdateUrgentJobRateAsync_ActiveJobRatedManually_SkipsUpdate()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 100, UcjbNumber = "JOB100", UcjbAmount = 50m, RatedManually = true
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateUrgentJobRateAsync(100, 999m, JobType.Active);

        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.Equal(50m, job!.UcjbAmount);
    }

    [Fact]
    public async Task UpdateUrgentJobRateAsync_RecurringJobRatedManually_SkipsUpdate()
    {
        await using (var context = CreateContext())
        {
            context.TucJobBookings.Add(new TucJobBooking
            {
                UcbkId = 200, UcbkJobNumber = "BK-200", UcbkAmount = 75m, RatedManually = true
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateUrgentJobRateAsync(200, 999m, JobType.Recurring);

        await using var verifyContext = CreateContext();
        var booking = await verifyContext.TucJobBookings.FindAsync([200], TestContext.Current.CancellationToken);
        Assert.Equal(75m, booking!.UcbkAmount);
    }

    [Fact]
    public async Task UpdateUrgentJobRateAsync_ArchivedJobRatedManually_SkipsUpdate()
    {
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 300, UcjbNumber = "ARCH300", UcjbAmount = 95m, RatedManually = true
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.UpdateUrgentJobRateAsync(300, 999m, JobType.Archived);

        await using var verifyContext = CreateContext();
        var archived = await verifyContext.TucJobArchives.FindAsync([300], TestContext.Current.CancellationToken);
        Assert.Equal(95m, archived!.UcjbAmount);
    }

    [Fact]
    public async Task SetJobRatedManuallyAsync_ActiveJob_SetsFlag()
    {
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 100, UcjbNumber = "JOB100", UcjbAmount = 50m, RatedManually = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.SetJobRatedManuallyAsync(100, isBooking: false, ratedManually: true);

        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.True(job!.RatedManually);
    }

    [Fact]
    public async Task SetJobRatedManuallyAsync_CanClearFlagBackToFalse()
    {
        // Used by the Recalculate button / bulk recalculate upload — a deliberate re-rate
        // clears the flag so the job is left as system-rated.
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 100, UcjbNumber = "JOB100", UcjbAmount = 50m, RatedManually = true
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.SetJobRatedManuallyAsync(100, isBooking: false, ratedManually: false);

        await using var verifyContext = CreateContext();
        var job = await verifyContext.TucJobs.FindAsync([100], TestContext.Current.CancellationToken);
        Assert.False(job!.RatedManually);
    }

    [Fact]
    public async Task SetJobRatedManuallyAsync_Booking_SetsFlagOnBookingTable()
    {
        await using (var context = CreateContext())
        {
            context.TucJobBookings.Add(new TucJobBooking
            {
                UcbkId = 200, UcbkJobNumber = "BK-200", UcbkAmount = 75m, RatedManually = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.SetJobRatedManuallyAsync(200, isBooking: true, ratedManually: true);

        await using var verifyContext = CreateContext();
        var booking = await verifyContext.TucJobBookings.FindAsync([200], TestContext.Current.CancellationToken);
        Assert.True(booking!.RatedManually);
    }

    [Fact]
    public async Task SetJobRatedManuallyAsync_NoLiveJob_FallsBackToArchive()
    {
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 300, UcjbNumber = "ARCH300", UcjbAmount = 95m, RatedManually = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        await repository.SetJobRatedManuallyAsync(300, isBooking: false, ratedManually: true);

        await using var verifyContext = CreateContext();
        var archived = await verifyContext.TucJobArchives.FindAsync([300], TestContext.Current.CancellationToken);
        Assert.True(archived!.RatedManually);
    }
}
