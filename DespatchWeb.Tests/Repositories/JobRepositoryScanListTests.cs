using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

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
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryScanListTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _createJobServiceMock
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
    public async Task ScanList_LiveJob_MatchesScanKeyedByItemBarcode()
    {
        // Arrange — depot scans are recorded against the item barcode, not the
        // job number. The job number alone would miss this scan.
        const int jobId = 60;
        const string jobNumber = "URG-60";
        const string barcode = "BC-60-1";
      
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = jobNumber });
        _context.TucJobItems.Add(new TucJobItem { JobId = jobId, ItemId = 1, Barcode = barcode });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 200,
            ScanDateTime = TestDates.Now.AddHours(-1),
            Scan = barcode,
            ScanType = (int)ScanType.Sort
        });
        
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.ScanList(TestDates.Now, jobId, isBulkJob: false);

        // Assert
        Assert.Single(result);
        Assert.Equal(200, result[0].BulkScanId);
    }

    [Fact]
    public async Task ScanList_BulkJobNotYetLive_MatchesScanKeyedByBulkItemBarcode()
    {
        // Arrange — bulk job not pushed live, items live in tblBulkJobItems.
        const int bulkJobId = 8;
        const string bulkJobNumber = "BULK-8";
        const string barcode = "BC-8-1";
      
        _context.TblBulkJobs.Add(new TblBulkJob { BulkJobId = bulkJobId, JobNumber = bulkJobNumber, Done = false });
        _context.TblBulkJobItems.Add(new TblBulkJobItem { JobId = bulkJobId, ItemId = 1, Barcode = barcode });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 210,
            ScanDateTime = TestDates.Now.AddHours(-2),
            Scan = barcode,
            ScanType = (int)ScanType.Run
        });
        
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.ScanList(TestDates.Now, bulkJobId, isBulkJob: true);

        // Assert
        Assert.Single(result);
        Assert.Equal(210, result[0].BulkScanId);
    }

    [Fact]
    public async Task ScanList_MatchesBothJobNumberAndItemBarcodeScans()
    {
        // Arrange — a Transfer scan keyed by job number AND a Sort scan keyed by
        // item barcode for the same job should both be returned.
        const int jobId = 61;
        const string jobNumber = "URG-61";
        const string barcode = "BC-61-1";
      
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = jobNumber });
        _context.TucJobItems.Add(new TucJobItem { JobId = jobId, ItemId = 1, Barcode = barcode });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 220,
            ScanDateTime = TestDates.Now.AddHours(-2),
            Scan = jobNumber,
            ScanType = (int)ScanType.Transfer
        });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 221,
            ScanDateTime = TestDates.Now.AddHours(-1),
            Scan = barcode,
            ScanType = (int)ScanType.Sort
        });
        
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.ScanList(TestDates.Now, jobId, isBulkJob: false);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, r => r.BulkScanId == 220);
        Assert.Contains(result, r => r.BulkScanId == 221);
    }

    [Fact]
    public async Task ScanList_ItemBarcodeOfDifferentJob_IsExcluded()
    {
        // Arrange — a scan keyed by an item barcode that belongs to another job
        // must not leak into this job's scan list.
        const int jobId = 62;
        const string jobNumber = "URG-62";
       
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = jobNumber });
        _context.TucJobItems.Add(new TucJobItem { JobId = jobId, ItemId = 1, Barcode = "BC-62-1" });
        // Item + scan belonging to a different job.
        _context.TucJobItems.Add(new TucJobItem { JobId = 999, ItemId = 1, Barcode = "BC-999-1" });
        _context.TblBulkScans.Add(new TblBulkScan
        {
            BulkScanId = 230,
            ScanDateTime = TestDates.Now.AddHours(-1),
            Scan = "BC-999-1",
            ScanType = (int)ScanType.Sort
        });
        
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.ScanList(TestDates.Now, jobId, isBulkJob: false);

        // Assert
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
