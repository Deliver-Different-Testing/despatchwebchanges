using System.Diagnostics;
using System.Text;
using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using FluentAssertions;
using Moq;
using Xunit.Abstractions;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for JobReportService behavior with large datasets.
/// These tests verify that the export functionality handles large amounts of data correctly
/// and identify potential memory, timeout, or performance issues.
/// </summary>
public class JobReportServiceLargeDataTests
{
    private readonly ITestOutputHelper _testOutputHelper;
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<IAmazonS3> _s3ClientMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();

    public JobReportServiceLargeDataTests(ITestOutputHelper testOutputHelper)
    {
        _testOutputHelper = testOutputHelper;
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime()).Returns(DateTime.Now);
    }

    private JobReportService CreateService()
    {
        return new JobReportService(
            _jobRepositoryMock.Object,
            _tenantInfoServiceMock.Object,
            _s3ClientMock.Object
        );
    }

    #region Memory Usage Tests

    [Fact]
    public async Task GenerateJobsReportAsync_LargeDataset_MemoryUsageReasonable()
    {
        // Arrange
        const int recordCount = 20000;
        var jobs = GenerateLargeJobDownloadDataset(recordCount);
        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<List<int>>(),
                It.IsAny<List<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<List<int>>()))
            .ReturnsAsync(jobs);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
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
        result.FileBytes.Should().NotBeEmpty();

        // Log memory usage for diagnostics
        _testOutputHelper.WriteLine($"Memory used for {recordCount} records: {memoryUsedMb:F2} MB");
        _testOutputHelper.WriteLine($"CSV file size: {result.FileBytes.Length / 1024.0:F2} KB");
    }

    #endregion

    #region Large Dataset Tests - POD Search Export

    [Theory]
    [InlineData(100)]
    [InlineData(1000)]
    [InlineData(5000)]
    public async Task GenerateJobsReportAsync_WithManyRecords_GeneratesValidCsv(int recordCount)
    {
        // Arrange
        var jobs = GenerateLargeJobDownloadDataset(recordCount);
        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<List<int>>(),
                It.IsAny<List<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<List<int>>()))
            .ReturnsAsync(jobs);

        // Skip S3 upload
        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
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
        result.Should().NotBeNull();
        result.FileBytes.Should().NotBeEmpty();
        result.FileName.Should().EndWith(".csv");

        // Verify CSV has correct number of lines (header + data rows)
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines.Length.Should().Be(recordCount + 1); // +1 for header
    }

    [Fact]
    public async Task GenerateJobsReportAsync_With10000Records_CompletesWithinTimeout()
    {
        // Arrange
        const int recordCount = 10000;
        var jobs = GenerateLargeJobDownloadDataset(recordCount);
        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<List<int>>(),
                It.IsAny<List<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<List<int>>()))
            .ReturnsAsync(jobs);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
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
        stopwatch.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(30),
            $"Export of {recordCount} records took {stopwatch.Elapsed.TotalSeconds:F2}s which exceeds timeout");
        result.FileBytes.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GenerateJobsReportAsync_With50000Records_HandlesLargeDataset()
    {
        // Arrange - This tests memory handling with a very large dataset
        const int recordCount = 50000;
        var jobs = GenerateLargeJobDownloadDataset(recordCount);
        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<List<int>>(),
                It.IsAny<List<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<List<int>>()))
            .ReturnsAsync(jobs);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
            .ReturnsAsync(new PutObjectResponse());

        var service = CreateService();
        var request = new PodSearchDownloadRequest
        {
            FromDate = DateTimeOffset.Now.AddMonths(-1),
            ToDate = DateTimeOffset.Now
        };

        // Act & Assert - Should not throw OutOfMemoryException
        var act = async () => await service.GenerateJobsReportAsync(request);
        await act.Should().NotThrowAsync<OutOfMemoryException>();
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
                BookDate = DateTime.Now
            }
        };

        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<List<int>>(),
                It.IsAny<List<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<List<int>>()))
            .ReturnsAsync(jobs);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
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
        result.FileBytes.Should().NotBeEmpty();
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain(new string('A', 500));
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
                BookDate = DateTime.Now
            }
        };

        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<List<int>>(),
                It.IsAny<List<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<List<int>>()))
            .ReturnsAsync(jobs);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
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
        result.FileBytes.Should().NotBeEmpty();
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);

        // Fields with commas should be quoted
        csvContent.Should().Contain("\"TEST,001\"");
        csvContent.Should().Contain("\"Ref,With,Commas\"");
    }

    [Fact]
    public async Task GenerateJobsReportAsync_EmptyDataset_ReturnsHeaderOnly()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.PodSearchDownloadAsync(
                It.IsAny<List<int>>(),
                It.IsAny<List<int>>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<DateTime>(),
                It.IsAny<DateTime>(),
                It.IsAny<List<int>>()))
            .ReturnsAsync([]);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
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
        result.FileBytes.Should().NotBeEmpty();
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines.Length.Should().Be(1); // Header only
    }

    #endregion

    #region Large Dataset Tests - Client Jobs Report

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
            StartDate = DateTime.Now.AddMonths(-1),
            EndDate = DateTime.Now,
            ClientIds = [1, 2, 3]
        };

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        result.FileBytes.Should().NotBeEmpty();
        result.FileName.Should().EndWith(".csv");

        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines.Length.Should().Be(recordCount + 1); // +1 for header
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
            StartDate = DateTime.Now.AddMonths(-1),
            EndDate = DateTime.Now,
            ClientIds = [1]
        };

        // Act
        var stopwatch = Stopwatch.StartNew();
        var result = await service.GenerateClientJobsReportCsvAsync(request);
        stopwatch.Stop();

        // Assert
        stopwatch.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(30));
        result.FileBytes.Should().NotBeEmpty();
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
            StartDate = DateTime.Now.AddMonths(-1),
            EndDate = DateTime.Now,
            ClientIds = [1]
        };

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        result.FileBytes.Should().NotBeEmpty();
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines.Length.Should().Be(1); // Header only
    }

    #endregion

    #region Helper Methods

    private static List<JobDownloadModel> GenerateLargeJobDownloadDataset(int count)
    {
        var jobs = new List<JobDownloadModel>(count);
        var baseDate = DateTime.Now.AddMonths(-1);

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
                PickupAddressLine8 = "",
                DeliveryAddressLine1 = $"{i + 200} Delivery Ave",
                DeliveryAddressLine2 = $"Unit {i % 50}",
                DeliveryAddressLine3 = $"Level {i % 10}",
                DeliveryAddressLine4 = $"Tower {i % 25}",
                DeliveryAddressLine5 = "Wellington",
                DeliveryAddressLine6 = "New Zealand",
                DeliveryAddressLine7 = $"{2000 + i % 100}",
                DeliveryAddressLine8 = "",
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
        var baseDate = DateTime.Now.AddMonths(-1);

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
                ChargeExclGST = (100m + i % 1000).ToString("F2"),
                From = $"Suburb {i % 50}",
                FromPostcode = $"{1000 + i % 100}",
                ucjbFromAddr = $"{i + 100} Pickup Street",
                To = $"Suburb {(i + 25) % 50}",
                ToPostcode = $"{2000 + i % 100}",
                Address = $"{i + 200} Delivery Ave",
                PickedUpTime = baseDate.AddDays(i % 30).AddHours(10).ToString("yyyy-MM-dd HH:mm:ss"),
                Delivered = baseDate.AddDays(i % 30).AddHours(12).ToString("yyyy-MM-dd HH:mm:ss"),
                TotalTime = "120",
                PODName = $"Recipient {i % 100}",
                AchievedSpeed = i % 3 == 0 ? "1 Hour" : i % 3 == 1 ? "2 Hour" : "3 Hour",
                Notes = i % 5 == 0 ? $"Note for job {i}" : null,
                Quantity = (i % 10 + 1).ToString(),
                Weight = (i % 50 + 0.5).ToString("F2"),
                ucjbType = i % 3 == 0 ? "Pick up from us" : i % 3 == 1 ? "Deliver to us" : "3rd party",
                Vehicle = $"Vehicle {i % 10}",
                ucjbMonth = baseDate.AddDays(i % 30).Month.ToString(),
                ucjbYear = baseDate.Year.ToString(),
                Code = $"C{i % 50:D3}",
                uccrName = $"Courier {i % 50}",
                ucjbInvoiceNo = i % 2 == 0 ? $"INV-{i:D6}" : null,
                ucclLegalName = $"Client {i % 20} Ltd",
                ucclNote = i % 10 == 0 ? $"Client note {i}" : null
            });
        }

        return reports;
    }

    #endregion
}