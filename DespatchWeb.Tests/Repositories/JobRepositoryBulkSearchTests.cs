using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for BulkJobId filtering in the job search pipeline.
/// Uses controller-level tests because BulkSearchAsync joins on database views
/// that SQLite cannot create via EnsureCreated.
/// </summary>
public class JobRepositoryBulkSearchTests : IDisposable
{
    private readonly Mock<IAddStopJobService> _addStopJobServiceMock = new();
    private readonly Mock<IClientAccessValidatorService> _clientAccessValidatorMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private readonly Mock<IDeliveryJourneyService> _deliveryJourneyServiceMock = new();
    private readonly Mock<IDispatchJobService> _dispatchJobServiceMock = new();
    private readonly HttpClient _httpClient = new();
    private readonly Mock<IJobCommandRepository> _jobCommandRepositoryMock = new();
    private readonly Mock<IJobPhotoService> _jobPhotoServiceMock = new();
    private readonly Mock<IJobQueryRepository> _jobQueryRepositoryMock = new();
    private readonly Mock<IJobReportService> _jobReportServiceMock = new();
    private readonly Mock<IPodReportService> _podReportServiceMock = new();
    private readonly Mock<IPdfOverlayClient> _pdfOverlayClientMock = new();
    private readonly Mock<IPricingPermissionService> _pricingPermissionServiceMock = new();
    private readonly Mock<IRateJobService> _rateJobServiceMock = new();
    private readonly Mock<IRecurringJobRepository> _recurringJobRepositoryMock = new();
    private readonly Mock<ISplitJobService> _splitJobServiceMock = new();
    private readonly Mock<ITaskRepository> _taskRepositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<ISendToPartnerService> _sendToPartnerServiceMock = new();
    private readonly Mock<IPartnerJobGate> _partnerJobGateMock = new();

    public JobRepositoryBulkSearchTests()
    {
        _pricingPermissionServiceMock.Setup(x => x.CanModifyPricesAsync()).ReturnsAsync(true);
        _pricingPermissionServiceMock.Setup(x => x.CanBulkUpdatePricesAsync()).ReturnsAsync(true);
        _pricingPermissionServiceMock.Setup(x => x.CanModifyPriceBreakdownAsync()).ReturnsAsync(true);
        _pricingPermissionServiceMock.Setup(x => x.CanUsePricingModeAsync(It.IsAny<string>())).ReturnsAsync(true);
        _pricingPermissionServiceMock.Setup(x => x.ValidateJobAccessAsync(It.IsAny<int>())).Returns(Task.CompletedTask);
        _pricingPermissionServiceMock.Setup(x => x.ValidateJobsAccessAsync(It.IsAny<IReadOnlyList<int>>()))
            .ReturnsAsync([]);
    }

    public void Dispose()
    {
        _httpClient.Dispose();
        GC.SuppressFinalize(this);
    }

    private JobController CreateController() => new(
        _jobQueryRepositoryMock.Object,
        _jobCommandRepositoryMock.Object,
        _taskRepositoryMock.Object,
        _clientAccessValidatorMock.Object,
        _httpClient,
        _rateJobServiceMock.Object,
        _recurringJobRepositoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock,
        _addStopJobServiceMock.Object,
        _jobReportServiceMock.Object,
        _jobPhotoServiceMock.Object,
        _dispatchJobServiceMock.Object,
        _deliveryJourneyServiceMock.Object,
        _pricingPermissionServiceMock.Object,
        _podReportServiceMock.Object,
        _pdfOverlayClientMock.Object,
        _splitJobServiceMock.Object,
        _sendToPartnerServiceMock.Object,
        _partnerJobGateMock.Object);

    [Fact]
    public async Task BulkSearch_WithBulkJobId_IgnoresOtherFilters()
    {
        // All these extra filters should be ignored when BulkJobId is set
        var request = new PodSearchRequest
        {
            FromDate = TestDates.Today.AddDays(-30),
            ToDate = TestDates.Today,
            BulkJobId = 42,
            ClientIds = [999],
            CourierIds = [888],
            SpeedIds = [777],
            Job = "SHOULD-BE-IGNORED",
            Wild = "ignored-search"
        };
        var expectedResult = new JobSearchResult
        {
            Jobs = [new DispatchJobViewModel { Id = 42, JobNo = "BULK-001", IsBulkJob = true }],
            TotalCount = 1
        };

        _jobQueryRepositoryMock
            .Setup(x => x.BulkSearchAsync(
                It.Is<PodSearchRequest>(r => r.BulkJobId == 42),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();
        var result = await controller.BulkSearch(request);

        Assert.IsType<JsonResult>(result);
        var searchResult = ((JsonResult)result).Value as JobSearchResult;
        Assert.Equal(1, searchResult!.TotalCount);
        Assert.Equal("BULK-001", searchResult.Jobs[0].JobNo);
    }

    [Fact]
    public async Task BulkSearch_WithoutBulkJobId_PassesNullBulkJobIdToRepository()
    {
        var request = new PodSearchRequest
        {
            FromDate = TestDates.Today.AddDays(-30),
            ToDate = TestDates.Today
        };
        var expectedResult = new JobSearchResult
        {
            Jobs =
            [
                new DispatchJobViewModel { Id = 1, JobNo = "BULK-001", IsBulkJob = true },
                new DispatchJobViewModel { Id = 2, JobNo = "BULK-002", IsBulkJob = true }
            ],
            TotalCount = 2
        };

        _jobQueryRepositoryMock
            .Setup(x => x.BulkSearchAsync(
                It.Is<PodSearchRequest>(r => !r.BulkJobIdSet),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();
        var result = await controller.BulkSearch(request);

        var searchResult = ((JsonResult)result).Value as JobSearchResult;
        Assert.Equal(2, searchResult!.TotalCount);
    }

    [Fact]
    public async Task PodSearch_WithJobId_IgnoresOtherFilters()
    {
        // All these extra filters should be ignored when JobId is set
        var request = new PodSearchRequest
        {
            FromDate = TestDates.Today.AddDays(-30),
            ToDate = TestDates.Today,
            JobId = 123,
            ClientIds = [999],
            CourierIds = [888],
            SpeedIds = [777],
            Job = "SHOULD-BE-IGNORED",
            Wild = "ignored-search"
        };
        var expectedResult = new JobSearchResult
        {
            Jobs = [new DispatchJobViewModel { Id = 123, JobNo = "JOB-001" }],
            TotalCount = 1
        };

        _jobQueryRepositoryMock
            .Setup(x => x.PodSearchAsync(
                It.Is<PodSearchRequest>(r => r.JobId == 123),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();
        var result = await controller.PodSearch(request);

        Assert.IsType<JsonResult>(result);
        var searchResult = ((JsonResult)result).Value as JobSearchResult;
        Assert.Equal(1, searchResult!.TotalCount);
        Assert.Equal("JOB-001", searchResult.Jobs[0].JobNo);
    }

    [Fact]
    public void PodSearchRequest_BulkJobIdSet_ReturnsTrueWhenSet()
    {
        var request = new PodSearchRequest { BulkJobId = 123 };
        Assert.True(request.BulkJobIdSet);
    }

    [Fact]
    public void PodSearchRequest_BulkJobIdSet_ReturnsFalseWhenNull()
    {
        var request = new PodSearchRequest { BulkJobId = null };
        Assert.False(request.BulkJobIdSet);
    }

    [Fact]
    public void PodSearchRequest_BulkJobIdSet_ReturnsFalseByDefault()
    {
        var request = new PodSearchRequest();
        Assert.False(request.BulkJobIdSet);
    }
}