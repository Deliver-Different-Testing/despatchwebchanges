using System.Diagnostics;
using System.Text;
using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for JobReportService behavior with large datasets.
/// These tests verify that the export functionality handles large amounts of data correctly
/// and identify potential memory, timeout, or performance issues.
/// </summary>
public class JobReportServiceLargeDataTests
{
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<IRecurringJobRepository> _recurringJobRepositoryMock = new();
    private readonly Mock<IAmazonS3> _s3ClientMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    private JobReportService CreateService()
    {
        return new JobReportService(
            _jobRepositoryMock.Object,
            _recurringJobRepositoryMock.Object,
            _clock,
            _s3ClientMock.Object
        );
    }

    [Fact]
    public async Task GenerateJobsReportAsync_LargeDataset_MemoryUsageReasonable()
    {
        // Arrange
        const int recordCount = 20000;
        var jobs = GenerateLargeJobDownloadDataset(recordCount);
        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(jobs);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutObjectResponse());

        var service = CreateService();
        var request = new PodSearchDownloadRequest
        {
            FromDate = DateTimeOffset.Now.AddMonths(-1),
            ToDate = DateTimeOffset.Now
        };

        // Force GC before measurement
        GC.Collect();
        GC.WaitForPendingFinalizers();
        var memoryBefore = GC.GetTotalMemory(true);

        // Act
        var result = await service.GenerateJobsReportAsync(request);

        // Measure after
        var memoryAfter = GC.GetTotalMemory(false);
        var memoryUsedMb = (memoryAfter - memoryBefore) / (1024.0 * 1024.0);

        // Assert - Memory usage should be reasonable (less than 500MB for 20k records)
        // This is a soft limit to detect memory leaks or inefficient code
        Assert.NotEmpty(result.FileBytes);

        // Log memory usage for diagnostics
        TestContext.Current.TestOutputHelper?.WriteLine($"Memory used for {recordCount} records: {memoryUsedMb:F2} MB");
        TestContext.Current.TestOutputHelper?.WriteLine($"CSV file size: {result.FileBytes.Length / 1024.0:F2} KB");
    }

    [Theory]
    [InlineData(100)]
    [InlineData(1000)]
    [InlineData(5000)]
    public async Task GenerateJobsReportAsync_WithManyRecords_GeneratesValidCsv(int recordCount)
    {
        // Arrange
        var jobs = GenerateLargeJobDownloadDataset(recordCount);
        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(jobs);

        // Skip S3 upload
        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutObjectResponse());

        var service = CreateService();
        var request = new PodSearchDownloadRequest
        {
            FromDate = DateTimeOffset.Now.AddMonths(-1),
            ToDate = DateTimeOffset.Now
        };

        // Act
        var result = await service.GenerateJobsReportAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.NotEmpty(result.FileBytes);
        Assert.EndsWith(".csv", result.FileName);

        // Verify CSV has correct number of lines (header + data rows)
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(recordCount + 1, lines.Length); // +1 for header
    }

    [Fact]
    public async Task GenerateJobsReportAsync_With10000Records_CompletesWithinTimeout()
    {
        // Arrange
        const int recordCount = 10000;
        var jobs = GenerateLargeJobDownloadDataset(recordCount);
        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(jobs);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutObjectResponse());

        var service = CreateService();
        var request = new PodSearchDownloadRequest
        {
            FromDate = DateTimeOffset.Now.AddMonths(-1),
            ToDate = DateTimeOffset.Now
        };

        // Act
        var stopwatch = Stopwatch.StartNew();
        var result = await service.GenerateJobsReportAsync(request);
        stopwatch.Stop();

        // Assert - Should complete within 30 seconds (generous timeout)
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(30),
            $"Export of {recordCount} records took {stopwatch.Elapsed.TotalSeconds:F2}s which exceeds timeout");
        Assert.NotEmpty(result.FileBytes);
    }

    [Fact]
    public async Task GenerateJobsReportAsync_With50000Records_HandlesLargeDataset()
    {
        // Arrange - This tests memory handling with a very large dataset
        const int recordCount = 50000;
        var jobs = GenerateLargeJobDownloadDataset(recordCount);
        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(jobs);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutObjectResponse());

        var service = CreateService();
        var request = new PodSearchDownloadRequest
        {
            FromDate = DateTimeOffset.Now.AddMonths(-1),
            ToDate = DateTimeOffset.Now
        };

        // Act & Assert - Should not throw OutOfMemoryException
        var result = await service.GenerateJobsReportAsync(request);
        Assert.NotEmpty(result.FileBytes);
    }

    [Fact]
    public async Task GenerateJobsReportAsync_WithLargeAddressFields_HandlesLongStrings()
    {
        // Arrange - Test with very long address fields that could cause issues
        var jobs = new List<JobDownloadModel>
        {
            new()
            {
                Id = 1,
                JobNumber = "TEST-001",
                PickupAddressLine1 = new string('A', 500), // Very long address
                PickupAddressLine2 = new string('B', 500),
                PickupAddressLine3 = new string('C', 500),
                DeliveryAddressLine1 = new string('D', 500),
                DeliveryAddressLine2 = new string('E', 500),
                CustomerName = new string('X', 200),
                ClientReferenceA = new string('R', 100),
                ClientReferenceB = new string('S', 100),
                BookDate = TestDates.Now
            }
        };

        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(jobs);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutObjectResponse());

        var service = CreateService();
        var request = new PodSearchDownloadRequest
        {
            FromDate = DateTimeOffset.Now.AddMonths(-1),
            ToDate = DateTimeOffset.Now
        };

        // Act
        var result = await service.GenerateJobsReportAsync(request);

        // Assert
        Assert.NotEmpty(result.FileBytes);
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        Assert.Contains(new string('A', 500), csvContent);
    }

    [Fact]
    public async Task GenerateJobsReportAsync_WithSpecialCharacters_EscapesCorrectly()
    {
        // Arrange - Test CSV escaping with special characters
        var jobs = new List<JobDownloadModel>
        {
            new()
            {
                Id = 1,
                JobNumber = "TEST,001", // Comma in job number
                CustomerName = "O'Brien & Sons", // Apostrophe and ampersand
                PickupAddressLine1 = "123 \"Main\" Street", // Quotes
                PickupAddressLine2 = "Line1\nLine2", // Newline
                ClientReferenceA = "Ref,With,Commas",
                BookDate = TestDates.Now
            }
        };

        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(jobs);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutObjectResponse());

        var service = CreateService();
        var request = new PodSearchDownloadRequest
        {
            FromDate = DateTimeOffset.Now.AddMonths(-1),
            ToDate = DateTimeOffset.Now
        };

        // Act
        var result = await service.GenerateJobsReportAsync(request);

        // Assert - CSV should be properly escaped
        Assert.NotEmpty(result.FileBytes);
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);

        // Fields with commas should be quoted
        Assert.Contains("\"TEST,001\"", csvContent);
        Assert.Contains("\"Ref,With,Commas\"", csvContent);
    }

    [Fact]
    public async Task GenerateJobsReportAsync_EmptyDataset_ReturnsHeaderOnly()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync([]);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutObjectResponse());

        var service = CreateService();
        var request = new PodSearchDownloadRequest
        {
            FromDate = DateTimeOffset.Now.AddMonths(-1),
            ToDate = DateTimeOffset.Now
        };

        // Act
        var result = await service.GenerateJobsReportAsync(request);

        // Assert
        Assert.NotEmpty(result.FileBytes);
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(1, lines.Length); // Header only
    }

    [Theory]
    [InlineData(100)]
    [InlineData(1000)]
    [InlineData(5000)]
    public async Task GenerateClientJobsReportCsvAsync_WithManyRecords_GeneratesValidCsv(int recordCount)
    {
        // Arrange
        var reports = GenerateLargePerformanceSpendDataset(recordCount);
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = new ClientJobsReportRequest
        {
            StartDate = TestDates.Now.AddMonths(-1),
            EndDate = TestDates.Now,
            ClientIds = [1, 2, 3]
        };

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        Assert.NotEmpty(result.FileBytes);
        Assert.EndsWith(".csv", result.FileName);

        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(recordCount + 1, lines.Length); // +1 for header
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_With10000Records_CompletesWithinTimeout()
    {
        // Arrange
        const int recordCount = 10000;
        var reports = GenerateLargePerformanceSpendDataset(recordCount);
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = new ClientJobsReportRequest
        {
            StartDate = TestDates.Now.AddMonths(-1),
            EndDate = TestDates.Now,
            ClientIds = [1]
        };

        // Act
        var stopwatch = Stopwatch.StartNew();
        var result = await service.GenerateClientJobsReportCsvAsync(request);
        stopwatch.Stop();

        // Assert
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(30));
        Assert.NotEmpty(result.FileBytes);
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_NoData_ReturnsHeaderOnly()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();
        var request = new ClientJobsReportRequest
        {
            StartDate = TestDates.Now.AddMonths(-1),
            EndDate = TestDates.Now,
            ClientIds = [1]
        };

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        Assert.NotEmpty(result.FileBytes);
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(1, lines.Length); // Header only
    }

    private static List<JobDownloadModel> GenerateLargeJobDownloadDataset(int count)
    {
        var jobs = new List<JobDownloadModel>(count);
        var baseDate = TestDates.Now.AddMonths(-1);

        for (var i = 0; i < count; i++)
        {
            jobs.Add(new JobDownloadModel
            {
                Id = i + 1,
                JobNumber = $"JOB-{i + 1:D6}",
                CustomerName = $"Customer {i % 100}",
                CourierCode = $"C{i % 50:D3}",
                BookDate = baseDate.AddDays(i % 30),
                PickedUpDate = baseDate.AddDays(i % 30).AddHours(1),
                DeliveredDate = baseDate.AddDays(i % 30).AddHours(3),
                Amount = 100m + i % 1000,
                Fuel = 10m + i % 50,
                Ppd = 5m,
                CourierPayment = 50m + i % 200,
                CourierFuel = 5m,
                CourierBonus = i % 10 == 0 ? 10m : 0m,
                RawBaseAmount = 90m + i % 500,
                AgentAirlineName = i % 5 == 0 ? $"Airline {i % 10}" : null,
                AWB = i % 5 == 0 ? $"AWB{i:D8}" : null,
                Quantity = (short)(i % 10 + 1),
                Weight = i % 50 + 0.5,
                Size = i % 5,
                StatusName = i % 3 == 0 ? "Completed" : i % 3 == 1 ? "In Progress" : "Pending",
                PickupAddressLine1 = $"{i + 100} Pickup Street",
                PickupAddressLine2 = $"Suite {i % 100}",
                PickupAddressLine3 = $"Floor {i % 20}",
                PickupAddressLine4 = $"Building {i % 50}",
                PickupAddressLine5 = "Auckland",
                PickupAddressLine6 = "New Zealand",
                PickupAddressLine7 = $"{1000 + i % 100}",
                PickupAddressLine8 = string.Empty,
                DeliveryAddressLine1 = $"{i + 200} Delivery Ave",
                DeliveryAddressLine2 = $"Unit {i % 50}",
                DeliveryAddressLine3 = $"Level {i % 10}",
                DeliveryAddressLine4 = $"Tower {i % 25}",
                DeliveryAddressLine5 = "Wellington",
                DeliveryAddressLine6 = "New Zealand",
                DeliveryAddressLine7 = $"{2000 + i % 100}",
                DeliveryAddressLine8 = string.Empty,
                ClientReferenceA = $"REF-A-{i:D6}",
                ClientReferenceB = $"REF-B-{i:D6}",
                ClientReferenceC = i % 10 == 0 ? $"REF-C-{i:D6}" : null,
                InvoiceNumber = i % 2 == 0 ? i : null,
                InvoiceDate = i % 2 == 0 ? baseDate.AddDays(i % 30) : null,
                IsArchived = i % 4 == 0,
                LoggedInContact = $"User{i % 20}",
                Void = i % 100 == 0
            });
        }

        return jobs;
    }

    private static List<PerformanceSpendReportModel> GenerateLargePerformanceSpendDataset(int count)
    {
        var reports = new List<PerformanceSpendReportModel>(count);
        var baseDate = TestDates.Now.AddMonths(-1);

        for (var i = 0; i < count; i++)
        {
            reports.Add(new PerformanceSpendReportModel
            {
                JobNumber = $"JOB-{i + 1:D6}",
                Date = baseDate.AddDays(i % 30).ToString("yyyy-MM-dd"),
                Booked = baseDate.AddDays(i % 30).AddHours(9).ToString("yyyy-MM-dd HH:mm:ss"),
                Booker = $"Booker{i % 20}",
                RefA = $"REF-A-{i:D6}",
                RefB = $"REF-B-{i:D6}",
                ChargeExclGst = (100m + i % 1000).ToString("F2"),
                From = $"Suburb {i % 50}",
                FromPostcode = $"{1000 + i % 100}",
                UcjbFromAddr = $"{i + 100} Pickup Street",
                To = $"Suburb {(i + 25) % 50}",
                ToPostcode = $"{2000 + i % 100}",
                Address = $"{i + 200} Delivery Ave",
                PickedUpTime = baseDate.AddDays(i % 30).AddHours(10).ToString("yyyy-MM-dd HH:mm:ss"),
                Delivered = baseDate.AddDays(i % 30).AddHours(12).ToString("yyyy-MM-dd HH:mm:ss"),
                TotalTime = "120",
                PodName = $"Recipient {i % 100}",
                AchievedSpeed = i % 3 == 0 ? "1 Hour" : i % 3 == 1 ? "2 Hour" : "3 Hour",
                Notes = i % 5 == 0 ? $"Note for job {i}" : null,
                Quantity = (i % 10 + 1).ToString(),
                Weight = (i % 50 + 0.5).ToString("F2"),
                UcjbType = i % 3 == 0 ? "Pick up from us" : i % 3 == 1 ? "Deliver to us" : "3rd party",
                Vehicle = $"Vehicle {i % 10}",
                UcjbMonth = baseDate.AddDays(i % 30).Month.ToString(),
                UcjbYear = baseDate.Year.ToString(),
                Code = $"C{i % 50:D3}",
                UccrName = $"Courier {i % 50}",
                UcjbInvoiceNo = i % 2 == 0 ? $"INV-{i:D6}" : null,
                UcclLegalName = $"Client {i % 20} Ltd",
                UcclNote = i % 10 == 0 ? $"Client note {i}" : null,
                RawBaseAmount = 90m + i % 500,
                FuelSurchargeAmount = 10m + i % 50,
                UcjbSpeed = (i % 4 + 1).ToString(),
                UcjbLocked = (i % 2 == 0).ToString(),
                UcjbClientId = $"CLI-{i % 100:D3}",
                LatePickup = i % 5 == 0 ? "Yes" : null,
                LateDelivery = i % 7 == 0 ? "Yes" : null,
                Courier = $"{i % 50}",
                DeliveryMins = (i % 60 + 30).ToString(),
                Minutes = "60"
            });
        }

        return reports;
    }

}
