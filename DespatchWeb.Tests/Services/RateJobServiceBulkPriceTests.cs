using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
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
    private readonly Mock<IPricingPermissionService> _pricingPermissionServiceMock = new();

    public RateJobServiceBulkPriceTests()
    {
        // By default, allow all job access in tests (internal user behavior)
        _pricingPermissionServiceMock
            .Setup(x => x.ValidateJobsAccessAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync([]); // Empty list = all jobs accessible
    }

    private RateJobService CreateService() => new(
        _jobRepositoryMock.Object,
        new HttpClient(),
        _tenantInfoServiceMock.Object,
        _httpContextAccessorMock.Object,
        _jobReportServiceMock.Object,
        _pricingPermissionServiceMock.Object
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

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
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

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
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

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
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
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_CallsUpdateManualPriceWithCorrectValues()
    {
        // Arrange
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, Amount = 150m, RawBaseAmount = 150m }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new()
                {
                    JobId = 1, JobNo = "JOB-001", Amount = 100m, RawBaseAmount = 100m, IsPrebook = false,
                    CourierPayment = 50m, CourierFuel = 5m, CourierBonus = 0m
                }
            });

        // GetTotalAmountFromBaseAsync calculates total including fuel
        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 150m))
            .ReturnsAsync(175m); // 150 base + 25 fuel = 175 total

        IReadOnlyList<JobManualPriceModel>? capturedModels = null;
        _jobRepositoryMock.Setup(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()))
            .Callback<IReadOnlyList<JobManualPriceModel>>(models => capturedModels = models)
            .Returns(Task.CompletedTask);

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert
        result.Rows.Should().HaveCount(1);
        result.Rows[0].OldAmount.Should().Be(100m);
        result.Rows[0].NewAmount.Should().Be(175m);

        // Verify UpdateManualPriceAsync was called with correct values
        _jobRepositoryMock.Verify(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()), Times.Once);

        capturedModels.Should().NotBeNull();
        capturedModels!.Should().HaveCount(1);
        var model = capturedModels[0];
        model.Id.Should().Be(1);
        model.Amount.Should().Be(175m);
        model.RawBaseAmount.Should().Be(150m);
        model.Fuel.Should().Be(25m); // 175 - 150 = 25
        model.Ppd.Should().Be(0m);
        model.CourierPayment.Should().Be(50m); // Preserved from existing
        model.CourierFuel.Should().Be(5m); // Preserved from existing
        model.CourierBonus.Should().Be(0m); // Preserved from existing

        // RepriceJobWithBaseAmountAsync should NOT be called for non-prebook jobs
        _jobRepositoryMock.Verify(x => x.RepriceJobWithBaseAmountAsync(It.IsAny<RepriceJobWithBaseAmountModel>()), Times.Never);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_HandlesCalculationFailure()
    {
        // Arrange
        var fileMock = CreateMockFile("test.xlsx", "");
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, RawBaseAmount = 150m }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new()
                {
                    JobId = 1, JobNo = "JOB-001", Amount = 100m, RawBaseAmount = 100m, IsPrebook = false,
                    CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m
                }
            });

        // Simulate calculation failure
        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 150m))
            .ThrowsAsync(new Exception("Database error"));

        var service = CreateService();

        // Act - should not throw, just log the error and fallback to base amount
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert - falls back to base amount (no fuel) when calculation fails
        result.Rows.Should().HaveCount(1);
        result.Rows[0].OldAmount.Should().Be(100m);
        result.Rows[0].NewAmount.Should().Be(150m); // Falls back to base amount
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_PrebookUsesRepriceMethod()
    {
        // Arrange - prebook jobs use the old method since TucJobBooking lacks RawBaseAmount field
        var fileMock = CreateMockFile("test.xlsx", "");
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, RawBaseAmount = 100m }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "BOOK-001", Amount = 50m, IsPrebook = true }
            });

        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 100m))
            .ReturnsAsync(120m);

        _jobRepositoryMock.Setup(x => x.RepriceJobWithBaseAmountAsync(It.IsAny<RepriceJobWithBaseAmountModel>()))
            .ReturnsAsync(120m);

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert - verify RepriceJobWithBaseAmountAsync was used for prebook
        _jobRepositoryMock.Verify(x => x.RepriceJobWithBaseAmountAsync(
            It.Is<RepriceJobWithBaseAmountModel>(m => m.IsPrebook == true && m.BaseAmount == 100m)), Times.Once);

        // UpdateManualPriceAsync should NOT be called for prebook-only updates
        _jobRepositoryMock.Verify(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()), Times.Never);

        result.Rows[0].NewAmount.Should().Be(120m);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_UpdatesCourierFieldsFromFile()
    {
        // Arrange - file contains courier payment data that should be used
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel
            {
                Id = 1, RawBaseAmount = 100m,
                CourierPayment = 75m, CourierFuel = 10m, CourierBonus = 5m
            }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new()
                {
                    JobId = 1, JobNo = "JOB-001", Amount = 100m, RawBaseAmount = 100m, IsPrebook = false,
                    CourierPayment = 50m, CourierFuel = 5m, CourierBonus = 0m // Existing values
                }
            });

        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 100m))
            .ReturnsAsync(115m);

        IReadOnlyList<JobManualPriceModel>? capturedModels = null;
        _jobRepositoryMock.Setup(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()))
            .Callback<IReadOnlyList<JobManualPriceModel>>(models => capturedModels = models)
            .Returns(Task.CompletedTask);

        var service = CreateService();

        // Act
        await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert - courier values from file should override existing values
        capturedModels.Should().NotBeNull();
        var model = capturedModels![0];
        model.CourierPayment.Should().Be(75m); // From file
        model.CourierFuel.Should().Be(10m); // From file
        model.CourierBonus.Should().Be(5m); // From file
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_MixedPrebookAndRegularJobs()
    {
        // Arrange - mix of prebook and regular jobs
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([
                new JobManualPriceModel { Id = 1, RawBaseAmount = 100m },
                new JobManualPriceModel { Id = 2, RawBaseAmount = 200m }
            ]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new()
                {
                    JobId = 1, JobNo = "JOB-001", Amount = 100m, IsPrebook = false,
                    CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m
                },
                [2] = new()
                {
                    JobId = 2, JobNo = "BOOK-002", Amount = 200m, IsPrebook = true,
                    CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m
                }
            });

        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 100m)).ReturnsAsync(115m);
        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(2, 200m)).ReturnsAsync(230m);
        _jobRepositoryMock.Setup(x => x.RepriceJobWithBaseAmountAsync(It.IsAny<RepriceJobWithBaseAmountModel>()))
            .ReturnsAsync(230m);

        IReadOnlyList<JobManualPriceModel>? capturedModels = null;
        _jobRepositoryMock.Setup(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()))
            .Callback<IReadOnlyList<JobManualPriceModel>>(models => capturedModels = models)
            .Returns(Task.CompletedTask);

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert
        result.Rows.Should().HaveCount(2);

        // UpdateManualPriceAsync should only contain the non-prebook job
        capturedModels.Should().NotBeNull();
        capturedModels!.Should().HaveCount(1);
        capturedModels[0].Id.Should().Be(1);

        // RepriceJobWithBaseAmountAsync should be called for prebook job
        _jobRepositoryMock.Verify(x => x.RepriceJobWithBaseAmountAsync(
            It.Is<RepriceJobWithBaseAmountModel>(m => m.JobId == 2 && m.IsPrebook == true)), Times.Once);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_NullRawBaseAmountTreatedAsZero()
    {
        // Arrange - RawBaseAmount is null, should be treated as 0
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, RawBaseAmount = null }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new()
                {
                    JobId = 1, JobNo = "JOB-001", Amount = 100m, IsPrebook = false,
                    CourierPayment = 0m, CourierFuel = 0m, CourierBonus = 0m
                }
            });

        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 0m))
            .ReturnsAsync(0m);

        IReadOnlyList<JobManualPriceModel>? capturedModels = null;
        _jobRepositoryMock.Setup(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()))
            .Callback<IReadOnlyList<JobManualPriceModel>>(models => capturedModels = models)
            .Returns(Task.CompletedTask);

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert
        result.Rows[0].NewAmount.Should().Be(0m);
        capturedModels.Should().NotBeNull();
        capturedModels![0].RawBaseAmount.Should().Be(0m);
        capturedModels[0].Amount.Should().Be(0m);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_MultipleRegularJobsBatched()
    {
        // Arrange - multiple regular jobs should all be in one UpdateManualPriceAsync call
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([
                new JobManualPriceModel { Id = 1, RawBaseAmount = 100m },
                new JobManualPriceModel { Id = 2, RawBaseAmount = 200m },
                new JobManualPriceModel { Id = 3, RawBaseAmount = 300m }
            ]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 100m, IsPrebook = false },
                [2] = new() { JobId = 2, JobNo = "JOB-002", Amount = 200m, IsPrebook = false },
                [3] = new() { JobId = 3, JobNo = "JOB-003", Amount = 300m, IsPrebook = false }
            });

        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 100m)).ReturnsAsync(115m);
        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(2, 200m)).ReturnsAsync(230m);
        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(3, 300m)).ReturnsAsync(345m);

        IReadOnlyList<JobManualPriceModel>? capturedModels = null;
        _jobRepositoryMock.Setup(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()))
            .Callback<IReadOnlyList<JobManualPriceModel>>(models => capturedModels = models)
            .Returns(Task.CompletedTask);

        var service = CreateService();

        // Act
        await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert - all 3 jobs should be batched in one call
        _jobRepositoryMock.Verify(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()), Times.Once);
        capturedModels.Should().NotBeNull();
        capturedModels!.Should().HaveCount(3);
        capturedModels.Select(m => m.Id).Should().BeEquivalentTo([1, 2, 3]);

        // Verify fuel calculations
        capturedModels.First(m => m.Id == 1).Fuel.Should().Be(15m); // 115 - 100
        capturedModels.First(m => m.Id == 2).Fuel.Should().Be(30m); // 230 - 200
        capturedModels.First(m => m.Id == 3).Fuel.Should().Be(45m); // 345 - 300
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_PartialCourierFieldsFromFile()
    {
        // Arrange - file has only CourierPayment, other courier fields should come from existing
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel
            {
                Id = 1, RawBaseAmount = 100m,
                CourierPayment = 80m, // Only this is provided
                CourierFuel = null,
                CourierBonus = null
            }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new()
                {
                    JobId = 1, JobNo = "JOB-001", Amount = 100m, IsPrebook = false,
                    CourierPayment = 50m, CourierFuel = 10m, CourierBonus = 5m // Existing values
                }
            });

        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 100m))
            .ReturnsAsync(115m);

        IReadOnlyList<JobManualPriceModel>? capturedModels = null;
        _jobRepositoryMock.Setup(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()))
            .Callback<IReadOnlyList<JobManualPriceModel>>(models => capturedModels = models)
            .Returns(Task.CompletedTask);

        var service = CreateService();

        // Act
        await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert - CourierPayment from file, others from existing
        capturedModels.Should().NotBeNull();
        var model = capturedModels![0];
        model.CourierPayment.Should().Be(80m); // From file
        model.CourierFuel.Should().Be(10m); // From existing
        model.CourierBonus.Should().Be(5m); // From existing
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_PrebookFailureHandled()
    {
        // Arrange - prebook reprice fails, should still complete without throwing
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, RawBaseAmount = 100m }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "BOOK-001", Amount = 50m, IsPrebook = true }
            });

        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 100m))
            .ReturnsAsync(120m);

        _jobRepositoryMock.Setup(x => x.RepriceJobWithBaseAmountAsync(It.IsAny<RepriceJobWithBaseAmountModel>()))
            .ThrowsAsync(new Exception("Prebook reprice failed"));

        var service = CreateService();

        // Act - should not throw
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert - row still returned with the calculated amount from before failure
        result.Rows.Should().HaveCount(1);
        result.Rows[0].NewAmount.Should().Be(120m); // From GetTotalAmountFromBaseAsync
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_PpdAlwaysZero()
    {
        // Arrange - verify Ppd is always set to 0 in base mode
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, RawBaseAmount = 100m, Ppd = 50m }]); // File has Ppd

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new()
                {
                    JobId = 1, JobNo = "JOB-001", Amount = 100m, IsPrebook = false, Ppd = 25m // Existing Ppd
                }
            });

        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 100m))
            .ReturnsAsync(115m);

        IReadOnlyList<JobManualPriceModel>? capturedModels = null;
        _jobRepositoryMock.Setup(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()))
            .Callback<IReadOnlyList<JobManualPriceModel>>(models => capturedModels = models)
            .Returns(Task.CompletedTask);

        var service = CreateService();

        // Act
        await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert - Ppd should be 0, not from file or existing
        capturedModels.Should().NotBeNull();
        capturedModels![0].Ppd.Should().Be(0m);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_CorrectTotalsCalculation()
    {
        // Arrange - verify totals are calculated correctly
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([
                new JobManualPriceModel { Id = 1, RawBaseAmount = 100m },
                new JobManualPriceModel { Id = 2, RawBaseAmount = 200m }
            ]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 80m, IsPrebook = false },
                [2] = new() { JobId = 2, JobNo = "JOB-002", Amount = 150m, IsPrebook = false }
            });

        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 100m)).ReturnsAsync(115m);
        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(2, 200m)).ReturnsAsync(230m);

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert
        result.TotalOldAmount.Should().Be(230m); // 80 + 150
        result.TotalNewAmount.Should().Be(345m); // 115 + 230
        result.TotalJobs.Should().Be(2);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_BaseMode_ZeroFuelWhenNoSurcharge()
    {
        // Arrange - when DB function returns same as base, fuel should be 0
        var fileMock = CreateMockFile("test.xlsx", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([new JobManualPriceModel { Id = 1, RawBaseAmount = 100m }]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 100m, IsPrebook = false }
            });

        // DB function returns same as base (no fuel surcharge for this job)
        _jobRepositoryMock.Setup(x => x.GetTotalAmountFromBaseAsync(1, 100m))
            .ReturnsAsync(100m);

        IReadOnlyList<JobManualPriceModel>? capturedModels = null;
        _jobRepositoryMock.Setup(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()))
            .Callback<IReadOnlyList<JobManualPriceModel>>(models => capturedModels = models)
            .Returns(Task.CompletedTask);

        var service = CreateService();

        // Act
        await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "base");

        // Assert
        capturedModels.Should().NotBeNull();
        capturedModels![0].Amount.Should().Be(100m);
        capturedModels[0].RawBaseAmount.Should().Be(100m);
        capturedModels[0].Fuel.Should().Be(0m); // No fuel surcharge
    }

    #endregion

    #region Recalculate Mode Tests

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_RecalculateMode_RecalculatesAndGetsNewAmount()
    {
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
        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
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

        // Set up job details with required fields - zero coordinates bypass HTTP calls
        _jobRepositoryMock.Setup(x => x.GetJobDetailsForRatingAsync(1))
            .ReturnsAsync(new JobRatingDetailsDto
            {
                JobId = 1,
                SpeedId = 1,
                ClientId = 1,
                SizeId = 1,
                // Zero coordinates make CalculateRoadDistance return 0 without HTTP calls
                PickupLat = 0,
                PickupLong = 0,
                DeliveryLat = 0,
                DeliveryLong = 0
            });

        // Mock the speed type lookup - non-flight type (GroupingId != 2)
        _jobRepositoryMock.Setup(x => x.GetJobTypeByIdAsync(1))
            .ReturnsAsync(new EntityClasses.TucJobType
            {
                UcjtId = 1,
                UcjtName = "Same Day",
                Grouping = new EntityClasses.TucJobTypeGrouping { GroupingId = 1, GroupingName = "Standard" }
            });

        // Mock the actual rate job call to succeed
        _jobRepositoryMock.Setup(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()))
            .Returns(Task.CompletedTask);

        var service = CreateService();

        // Act
        var result = await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "recalculate");

        // Assert
        result.Rows.Should().HaveCount(1);
        result.Rows[0].OldAmount.Should().Be(100m);
        result.Rows[0].NewAmount.Should().Be(180m);

        // Verify the rating method was called
        _jobRepositoryMock.Verify(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()), Times.Once);
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

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
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

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
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

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<IReadOnlyList<int>>()))
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
