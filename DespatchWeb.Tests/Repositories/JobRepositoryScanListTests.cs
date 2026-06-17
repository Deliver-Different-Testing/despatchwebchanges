using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository.ScanList — verifies the server-side job-number
/// resolution (live tucJob, tucJobArchive fallback, tblBulkJob branch) and
/// the resulting tblBulkScan match.
/// </summary>
public class JobRepositoryScanListTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock;
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly Mock<ICreateJobService> _createJobServiceMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryScanListTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateMoqFactoryMock(_context);

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock,
        _clearListEnvelopeServiceMock.Object,
        _createJobServiceMock.Object
    );

    [Fact]
    public async Task ScanList_LiveJob_ResolvesNumberAndReturnsMatchingScans()
    {
        // Arrange
        const int jobId = 42;
        const string jobNumber = "URG-42";
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = jobNumber });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 1,
            ScanDateTime = TestDates.Now.AddHours(-1),
            Scan = jobNumber,
            ScanType = (int)ScanType.Pickup
        });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 2,
            ScanDateTime = TestDates.Now.AddMinutes(-30),
            Scan = "OTHER-JOB",
            ScanType = (int)ScanType.Pickup
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.ScanList(TestDates.Now, jobId, isBulkJob: false);

        // Assert — only the URG-42 scan, not the OTHER-JOB scan.
        Assert.Single(result);
        Assert.Equal(1, result[0].BulkScanId);
    }

    [Fact]
    public async Task ScanList_ArchivedJob_FallsBackToArchiveAndResolves()
    {
        // Arrange — job lives only in tucJobArchive (post-archive lookup).
        const int jobId = 99;
        const string jobNumber = "ARCH-99";
        _context.TucJobArchives.Add(new TucJobArchive { UcjbId = jobId, UcjbNumber = jobNumber });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 10,
            ScanDateTime = TestDates.Now.AddHours(-2),
            Scan = jobNumber,
            ScanType = (int)ScanType.Run
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.ScanList(TestDates.Now, jobId, isBulkJob: false);

        // Assert
        Assert.Single(result);
        Assert.Equal(10, result[0].BulkScanId);
    }

    [Fact]
    public async Task ScanList_BulkJob_ResolvesViaTblBulkJob()
    {
        // Arrange
        const int bulkJobId = 7;
        const string bulkJobNumber = "BULK-7";
        _context.TblBulkJobs.Add(new TblBulkJob { BulkJobId = bulkJobId, JobNumber = bulkJobNumber });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 20,
            ScanDateTime = TestDates.Now.AddHours(-3),
            Scan = bulkJobNumber,
            ScanType = (int)ScanType.Transit
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.ScanList(TestDates.Now, bulkJobId, isBulkJob: true);

        // Assert
        Assert.Single(result);
        Assert.Equal(20, result[0].BulkScanId);
    }

    [Fact]
    public async Task ScanList_UnknownJobId_ReturnsEmpty()
    {
        // Arrange — no job rows, but a scan exists.
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 30,
            ScanDateTime = TestDates.Now.AddHours(-1),
            Scan = "GHOST",
            ScanType = (int)ScanType.Run
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.ScanList(TestDates.Now, jobId: 9999, isBulkJob: false);

        // Assert — empty because the subquery yields no job numbers to match against.
        Assert.Empty(result);
    }

    [Fact]
    public async Task ScanList_ScansOlderThanCutoff_AreExcluded()
    {
        // Arrange
        const int jobId = 50;
        const string jobNumber = "OLD-50";
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = jobNumber });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 100,
            ScanDateTime = TestDates.Now.AddDays(-5), // older than 3-day cutoff
            Scan = jobNumber,
            ScanType = (int)ScanType.Pickup
        });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 101,
            ScanDateTime = TestDates.Now.AddDays(-1), // inside window
            Scan = jobNumber,
            ScanType = (int)ScanType.Run
        });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.ScanList(TestDates.Now, jobId, isBulkJob: false);

        // Assert — only the recent scan.
        Assert.Single(result);
        Assert.Equal(101, result[0].BulkScanId);
    }
}
