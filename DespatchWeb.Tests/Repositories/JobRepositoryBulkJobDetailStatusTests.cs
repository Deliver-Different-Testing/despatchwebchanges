using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// tblBulkJob.Done records that a row has been pushed to live dispatch, not that the freight was
/// delivered. Projecting it onto the shared view model's Done — which every other surface reads as
/// "delivered" — made a released bulk row render as complete while the grid still showed its real
/// status. These tests pin the two meanings apart.
/// </summary>
public class JobRepositoryBulkJobDetailStatusTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryBulkJobDetailStatusTests()
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
        Substitute.For<ICourierRepository>()
    );

    [Fact]
    public async Task GetBulkJobDetailAsync_ReleasedButUndelivered_ReportsReleasedAndNotDone()
    {
        // Arrange - pushed live (Done + JobId set by the release proc), freight not yet delivered
        await using (var context = _db.CreateContext())
        {
            SeedLookups(context);
            context.TucJobs.Add(CreateLiveJob(100, isDone: false));
            context.TblBulkJobs.Add(CreateBulkJob(1, (int)JobStatus.New, released: true, liveJobId: 100));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkJobDetailAsync(1);

        // Assert
        Assert.NotNull(result.Job);
        Assert.True(result.Job.Released);
        Assert.False(result.Job.Done);
        Assert.Equal((int)JobStatus.New, result.Job.ResolvedStatusId);
        Assert.False(result.Job.ResolvedIsComplete);
    }

    [Fact]
    public async Task GetBulkJobDetailAsync_ReleasedAndDelivered_ReportsDoneFromTheLiveJob()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            SeedLookups(context);
            context.TucJobs.Add(CreateLiveJob(100, isDone: true));
            context.TblBulkJobs.Add(CreateBulkJob(1, (int)JobStatus.New, released: true, liveJobId: 100));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkJobDetailAsync(1);

        // Assert - the live job is the authority on delivery once the row has been released
        Assert.NotNull(result.Job);
        Assert.True(result.Job.Released);
        Assert.True(result.Job.Done);
        Assert.Equal((int)JobStatus.Completed, result.Job.ResolvedStatusId);
        Assert.True(result.Job.ResolvedIsComplete);

        // Id is a BulkJobId, which matches no S3 key — POD media is keyed by the live job id, so the
        // link has to reach the client or the panel looks up a prefix that cannot exist.
        Assert.Equal(1, result.Job.Id);
        Assert.Equal(100, result.Job.LinkedJobId);
    }

    [Fact]
    public async Task GetBulkJobDetailAsync_NotYetReleased_IsNeitherReleasedNorDone()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            SeedLookups(context);
            context.TblBulkJobs.Add(CreateBulkJob(1, (int)JobStatus.New));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkJobDetailAsync(1);

        // Assert
        Assert.NotNull(result.Job);
        Assert.False(result.Job.Released);
        Assert.False(result.Job.Done);
        Assert.Equal((int)JobStatus.New, result.Job.ResolvedStatusId);
    }

    [Fact]
    public async Task GetBulkJobDetailAsync_VoidedRowWhoseStatusWasMovedOff_ResolvesAsVoid()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            SeedLookups(context);
            var bulkJob = CreateBulkJob(1, (int)JobStatus.New);
            bulkJob.Void = true;
            context.TblBulkJobs.Add(bulkJob);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetBulkJobDetailAsync(1);

        // Assert
        Assert.NotNull(result.Job);
        Assert.Equal((int)JobStatus.Void, result.Job.ResolvedStatusId);
        Assert.True(result.Job.ResolvedIsVoid);
    }

    private const int ClientId = 1;
    private const int SpeedId = 1;

    /// <summary>
    /// The bulk projection reaches through required navigations (client, speed, status), which EF
    /// inner-joins — without these rows the bulk job is filtered out of its own query.
    /// </summary>
    private static void SeedLookups(DespatchContext context)
    {
        context.TucClients.Add(new TucClient
        {
            UcclId = ClientId,
            UcclCode = "TST",
            UcclName = "Test Client",
            UcclLegalName = "Test Client Ltd",
            Smsname = "TST",
            CreatedBy = "tests",
            LastModifiedBy = "tests"
        });
        context.TucJobTypes.Add(new TucJobType
        {
            UcjtId = SpeedId,
            UcjtName = "Standard",
            ShortName = "STD",
            CreatedBy = "tests",
            LastModifiedBy = "tests"
        });
        context.SaveChanges();

        // Seeded through SQL because JobStatus.New is 0 — the CLR default — so EF treats the id as
        // unset and lets SQLite generate one, which breaks the projection's inner join on the status.
        context.Database.ExecuteSqlRaw(
            "INSERT INTO tucJobStatus (ucjsID, ucjsName, ucjsCode) VALUES ({0}, 'New', 'N'), ({1}, 'Completed', 'C'), ({2}, 'Void', 'V')",
            (int)JobStatus.New, (int)JobStatus.Completed, (int)JobStatus.Void);
    }

    private static TucJob CreateLiveJob(int id, bool isDone) =>
        new()
        {
            UcjbId = id,
            UcjbNumber = $"JOB-{id:D3}",
            UcjbDate = TestDates.Now.Date,
            UcjbTime = TestDates.Now.Date.AddHours(9),
            UcjbStatus = isDone ? (int)JobStatus.Completed : (int)JobStatus.New,
            UcjbJobDone = isDone
        };

    private static TblBulkJob CreateBulkJob(
        int id,
        int status,
        bool released = false,
        int? liveJobId = null) =>
        new()
        {
            BulkJobId = id,
            JobNumber = $"BULK-{id:D3}",
            BookDate = TestDates.Now.Date,
            BookTime = TestDates.Now.Date.AddHours(9),
            JobStatus = status,
            PickUpLatitude = "-36.85",
            PickUpLongitude = "174.76",
            DeliveryLatitude = "-41.29",
            DeliveryLongitude = "174.78",
            ClientId = ClientId,
            ClientCode = "TST",
            Speed = SpeedId,
            Done = released,
            JobId = liveJobId
        };
}
