using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for RateJobService.ApplyBulkPriceUpdateAsync - the bulk job reprice feature.
/// </summary>
public class RateJobServiceBulkPriceTests
{
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock = new();
    private readonly Mock<IJobReportService> _jobReportServiceMock = new();

    private RateJobService CreateService() => new(
        _jobRepositoryMock.Object,
        new HttpClient(),
        _tenantInfoServiceMock.Object,
        _httpContextAccessorMock.Object,
        _jobReportServiceMock.Object
    );

    #region Empty/No Data Tests

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_EmptyFile_ReturnsEmptyResponse()
    {
        // Arrange
        var fileMock = CreateMockFile("test.csv", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "recalculate");

        // Assert
        result.Should().NotBeNull();
        result.Rows.Should().BeEmpty();
        result.TotalJobs.Should().Be(0);
        result.TotalOldAmount.Should().Be(0);
        result.TotalNewAmount.Should().Be(0);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_JobsNotFoundInDatabase_SkipsThoseJobs()
    {
        // Arrange
        var fileMock = CreateMockFile("test.csv", "id,amount\n999,100");
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 999, Amount = 100m }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>()); // Empty - job not found

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert
        result.Rows.Should().BeEmpty();
        result.TotalJobs.Should().Be(0);
    }

    #endregion

    #region Gross Mode Tests

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_GrossMode_UpdatesAmountDirectly()
    {
        // Arrange
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        var parsedData = new List<JobManualPriceModel>
        {
            new() { Id = 1, Amount = 200m },
            new() { Id = 2, Amount = 300m }
        };

        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync(parsedData);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 100m, IsPrebook = false },
                [2] = new() { JobId = 2, JobNo = "JOB-002", Amount = 150m, IsPrebook = false }
            });

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert
        result.Rows.Should().HaveCount(2);
        result.TotalJobs.Should().Be(2);
        result.TotalOldAmount.Should().Be(250m); // 100 + 150
        result.TotalNewAmount.Should().Be(500m); // 200 + 300

        // Verify UpdateManualPriceAsync was called for gross mode
        _jobRepositoryMock.Verify(x => x.UpdateManualPriceAsync(parsedData), Times.Once);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_GrossMode_RetainsOldAmountWhenNewIsNull()
    {
        // Arrange
        var fileMock = CreateMockFile("test.csv", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, Amount = null }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 100m, IsPrebook = false }
            });

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert
        result.Rows.Should().HaveCount(1);
        result.Rows[0].OldAmount.Should().Be(100m);
        result.Rows[0].NewAmount.Should().Be(100m); // Falls back to old amount
    }

    #endregion

    #region Base Mode Tests

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_CallsRepriceWithBaseAmount()
    {
        // Arrange
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, Amount = 150m, RawBaseAmount = 150m }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 100m, RawBaseAmount = 100m, IsPrebook = false }
            });

        _jobRepositoryMock.Setup(x => x.RepriceJobWithBaseAmountAsync(It.IsAny<RepriceJobWithBaseAmountModel>()))
            .ReturnsAsync(175m); // Returns calculated amount with fuel surcharge

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert
        result.Rows.Should().HaveCount(1);
        result.Rows[0].OldAmount.Should().Be(100m);
        result.Rows[0].NewAmount.Should().Be(175m); // From RepriceJobWithBaseAmountAsync

        _jobRepositoryMock.Verify(x => x.RepriceJobWithBaseAmountAsync(
            It.Is<RepriceJobWithBaseAmountModel>(m => m.JobId == 1 && m.BaseAmount == 150m)), Times.Once);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_HandlesRepriceFailure()
    {
        // Arrange
        var fileMock = CreateMockFile("test.xlsx", "");
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, RawBaseAmount = 150m }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 100m, RawBaseAmount = 100m, IsPrebook = false }
            });

        _jobRepositoryMock.Setup(x => x.RepriceJobWithBaseAmountAsync(It.IsAny<RepriceJobWithBaseAmountModel>()))
            .ThrowsAsync(new Exception("Database error"));

        var service = CreateService();

        // Act - should not throw, just log the error
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert - still returns row with old amount as new amount (fallback when RawBaseAmount is null)
        result.Rows.Should().HaveCount(1);
        result.Rows[0].OldAmount.Should().Be(100m);
        result.Rows[0].NewAmount.Should().Be(100m); // Falls back to old amount when reprice fails
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_PassesPrebookFlag()
    {
        // Arrange
        var fileMock = CreateMockFile("test.xlsx", "");
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, Amount = 100m }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "BOOK-001", Amount = 50m, IsPrebook = true }
            });

        _jobRepositoryMock.Setup(x => x.RepriceJobWithBaseAmountAsync(It.IsAny<RepriceJobWithBaseAmountModel>()))
            .ReturnsAsync(120m);

        var service = CreateService();

        // Act
        await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert - verify IsPrebook flag is passed
        _jobRepositoryMock.Verify(x => x.RepriceJobWithBaseAmountAsync(
            It.Is<RepriceJobWithBaseAmountModel>(m => m.IsPrebook == true)), Times.Once);
    }

    #endregion

    #region Recalculate Mode Tests

    [Fact(Skip = "RecalculateJobRateInternalAsync has complex dependencies (RateJobUsAsync/RateJobNzAsync) that require integration testing")]
    public async Task ApplyBulkPriceUpdateAsync_RecalculateMode_RecalculatesAndGetsNewAmount()
    {
        // Note: This test requires a full integration test setup because RecalculateJobRateInternalAsync
        // calls RateJobUsAsync or RateJobNzAsync which have many external dependencies (HTTP clients,
        // HERE Maps API, DFRNT API, etc.) that cannot be easily mocked.
        // The recalculate mode flow is:
        // 1. Get current amounts for all jobs
        // 2. For each job, call RecalculateJobRateInternalAsync (which rates the job)
        // 3. Get the updated amount after recalculation
        // 4. Return before/after comparison

        // Arrange
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1 }]);

        var callCount = 0;
        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                // First call returns old amount, second call (after recalc) returns new amount
                return new Dictionary<int, JobCurrentAmountInfo>
                {
                    [1] = new()
                    {
                        JobId = 1,
                        JobNo = "JOB-001",
                        Amount = callCount == 1 ? 100m : 180m,
                        IsPrebook = false
                    }
                };
            });

        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(x => x.GetJobDetailsForRatingAsync(1))
            .ReturnsAsync(new DespatchWeb.Models.Dto.JobRatingDetailsDto());

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "recalculate");

        // Assert
        result.Rows.Should().HaveCount(1);
        result.Rows[0].OldAmount.Should().Be(100m);
        result.Rows[0].NewAmount.Should().Be(180m);
    }

    #endregion

    #region Multiple Jobs Tests

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_MultipleJobs_CalculatesTotalsCorrectly()
    {
        // Arrange
        var fileMock = CreateMockFile("test.csv", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([
                new JobManualPriceModel { Id = 1, Amount = 100m },
                new JobManualPriceModel { Id = 2, Amount = 200m },
                new JobManualPriceModel { Id = 3, Amount = 300m }
            ]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 50m },
                [2] = new() { JobId = 2, JobNo = "JOB-002", Amount = 100m },
                [3] = new() { JobId = 3, JobNo = "JOB-003", Amount = 150m }
            });

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert
        result.TotalJobs.Should().Be(3);
        result.TotalOldAmount.Should().Be(300m); // 50 + 100 + 150
        result.TotalNewAmount.Should().Be(600m); // 100 + 200 + 300
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_DuplicateJobIds_ProcessesEachOccurrence()
    {
        // Arrange - same job ID appears twice in file
        var fileMock = CreateMockFile("test.csv", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([
                new JobManualPriceModel { Id = 1, Amount = 100m },
                new JobManualPriceModel { Id = 1, Amount = 200m }
            ]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 50m }
            });

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert - processes each row separately
        result.Rows.Should().HaveCount(2);
    }

    #endregion

    #region Response Structure Tests

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_ResponseContainsCorrectJobInfo()
    {
        // Arrange
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 42, Amount = 500m }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [42] = new() { JobId = 42, JobNo = "TEST-042", Amount = 250m, IsPrebook = true }
            });

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert
        var row = result.Rows.Single();
        row.JobId.Should().Be(42);
        row.JobNo.Should().Be("TEST-042");
        row.Field.Should().Be("Amount");
        row.OldAmount.Should().Be(250m);
        row.NewAmount.Should().Be(500m);
        row.IsPrebook.Should().BeTrue();
    }

    #endregion

    #region Helper Methods

    private static Mock<IFormFile> CreateMockFile(string fileName, string content)
    {
        var fileMock = new Mock<IFormFile>();
        var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(content));

        fileMock.Setup(f => f.FileName).Returns(fileName);
        fileMock.Setup(f => f.Length).Returns(stream.Length);
        fileMock.Setup(f => f.OpenReadStream()).Returns(stream);
        fileMock.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .Callback<Stream, CancellationToken>((s, _) => stream.CopyTo(s))
            .Returns(Task.CompletedTask);

        return fileMock;
    }

    #endregion
}
