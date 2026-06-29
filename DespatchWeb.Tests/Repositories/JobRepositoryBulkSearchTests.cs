using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for BulkJobId filtering in the job search pipeline.
/// Uses controller-level tests because BulkSearchAsync joins on database views
/// that SQLite cannot create via EnsureCreated.
/// </summary>
public class JobRepositoryBulkSearchTests : IDisposable
{
    private readonly IAddStopJobService _addStopJobServiceMock = Substitute.For<IAddStopJobService>();
    private readonly IClientAccessValidatorService _clientAccessValidatorMock = Substitute.For<IClientAccessValidatorService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private readonly IDeliveryJourneyService _deliveryJourneyServiceMock = Substitute.For<IDeliveryJourneyService>();
    private readonly IDispatchJobService _dispatchJobServiceMock = Substitute.For<IDispatchJobService>();
    private readonly HttpClient _httpClient = new();
    private readonly IJobCommandRepository _jobCommandRepositoryMock = Substitute.For<IJobCommandRepository>();
    private readonly IJobPhotoService _jobPhotoServiceMock = Substitute.For<IJobPhotoService>();
    private readonly IJobQueryRepository _jobQueryRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly IJobReportService _jobReportServiceMock = Substitute.For<IJobReportService>();
    private readonly IPodReportService _podReportServiceMock = Substitute.For<IPodReportService>();
    private readonly IPdfOverlayClient _pdfOverlayClientMock = Substitute.For<IPdfOverlayClient>();
    private readonly IPricingPermissionService _pricingPermissionServiceMock = Substitute.For<IPricingPermissionService>();
    private readonly IRateJobService _rateJobServiceMock = Substitute.For<IRateJobService>();
    private readonly IRecurringJobRepository _recurringJobRepositoryMock = Substitute.For<IRecurringJobRepository>();
    private readonly ISplitJobService _splitJobServiceMock = Substitute.For<ISplitJobService>();
    private readonly ITaskRepository _taskRepositoryMock = Substitute.For<ITaskRepository>();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly ISendToPartnerService _sendToPartnerServiceMock = Substitute.For<ISendToPartnerService>();
    private readonly IPartnerJobGate _partnerJobGateMock = Substitute.For<IPartnerJobGate>();

    public JobRepositoryBulkSearchTests()
    {
        _pricingPermissionServiceMock.CanModifyPricesAsync().Returns(true);
        _pricingPermissionServiceMock.CanBulkUpdatePricesAsync().Returns(true);
        _pricingPermissionServiceMock.CanModifyPriceBreakdownAsync().Returns(true);
        _pricingPermissionServiceMock.CanUsePricingModeAsync(Arg.Any<string>()).Returns(true);
        _pricingPermissionServiceMock.ValidateJobAccessAsync(Arg.Any<int>()).Returns(Task.CompletedTask);
        _pricingPermissionServiceMock.ValidateJobsAccessAsync(Arg.Any<IReadOnlyList<int>>())
            .Returns([]);
    }

    public void Dispose()
    {
        _httpClient.Dispose();
        GC.SuppressFinalize(this);
    }

    private JobController CreateController() => new(
        _jobQueryRepositoryMock,
        _jobCommandRepositoryMock,
        _taskRepositoryMock,
        _clientAccessValidatorMock,
        _httpClient,
        _rateJobServiceMock,
        _recurringJobRepositoryMock,
        _tenantInfoServiceMock,
        _clock,
        _addStopJobServiceMock,
        _jobReportServiceMock,
        _jobPhotoServiceMock,
        _dispatchJobServiceMock,
        _deliveryJourneyServiceMock,
        _pricingPermissionServiceMock,
        _podReportServiceMock,
        _pdfOverlayClientMock,
        _splitJobServiceMock,
        _sendToPartnerServiceMock,
        _partnerJobGateMock);

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

        _jobQueryRepositoryMock.BulkSearchAsync(
                Arg.Is<PodSearchRequest>(r => r.BulkJobId == 42),
                Arg.Any<CancellationToken>())
            .Returns(expectedResult);

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

        _jobQueryRepositoryMock.BulkSearchAsync(
                Arg.Is<PodSearchRequest>(r => !r.BulkJobIdSet),
                Arg.Any<CancellationToken>())
            .Returns(expectedResult);

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

        _jobQueryRepositoryMock.PodSearchAsync(
                Arg.Is<PodSearchRequest>(r => r.JobId == 123),
                Arg.Any<CancellationToken>())
            .Returns(expectedResult);

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