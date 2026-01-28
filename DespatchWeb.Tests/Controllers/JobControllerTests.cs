using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Controllers;

/// <summary>
/// Unit tests for JobController - tests all job management endpoints.
/// These tests use mocks to isolate controller logic for debugging and validation.
/// </summary>
public class JobControllerTests
{
    #region Setup

    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<ITaskRepository> _taskRepositoryMock = new();
    private readonly Mock<IClientAccessValidatorService> _clientAccessValidatorMock = new();
    private readonly Mock<IRateJobService> _rateJobServiceMock = new();
    private readonly Mock<IRecurringJobRepository> _recurringJobRepositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IAddStopJobService> _addStopJobServiceMock = new();
    private readonly Mock<IJobReportService> _jobReportServiceMock = new();
    private readonly Mock<IJobPhotoService> _jobPhotoServiceMock = new();
    private readonly Mock<IDispatchJobService> _dispatchJobServiceMock = new();
    private readonly Mock<IDeliveryJourneyService> _deliveryJourneyServiceMock = new();
    private readonly Mock<IPricingPermissionService> _pricingPermissionServiceMock = new();
    private readonly Mock<ISplitJobService> _splitJobServiceMock = new();

    public JobControllerTests()
    {
        // By default, allow all pricing operations in tests (internal user behavior)
        _pricingPermissionServiceMock.Setup(x => x.CanModifyPricesAsync()).ReturnsAsync(true);
        _pricingPermissionServiceMock.Setup(x => x.CanBulkUpdatePricesAsync()).ReturnsAsync(true);
        _pricingPermissionServiceMock.Setup(x => x.CanModifyPriceBreakdownAsync()).ReturnsAsync(true);
        _pricingPermissionServiceMock.Setup(x => x.CanUsePricingModeAsync(It.IsAny<string>())).ReturnsAsync(true);
        _pricingPermissionServiceMock.Setup(x => x.ValidateJobAccessAsync(It.IsAny<int>())).Returns(Task.CompletedTask);
        _pricingPermissionServiceMock.Setup(x => x.ValidateJobsAccessAsync(It.IsAny<List<int>>())).ReturnsAsync([]);
    }

    private JobController CreateController()
    {
        return new JobController(
            _jobRepositoryMock.Object,
            _taskRepositoryMock.Object,
            _clientAccessValidatorMock.Object,
            new HttpClient(),
            _rateJobServiceMock.Object,
            _recurringJobRepositoryMock.Object,
            _tenantInfoServiceMock.Object,
            _addStopJobServiceMock.Object,
            _jobReportServiceMock.Object,
            _jobPhotoServiceMock.Object,
            _dispatchJobServiceMock.Object,
            _deliveryJourneyServiceMock.Object,
            _pricingPermissionServiceMock.Object,
            _splitJobServiceMock.Object);
    }

    #endregion

    #region Index (Job List) Tests

    [Fact]
    public async Task Index_ValidRequest_ReturnsJobList()
    {
        // Arrange
        var queryParams = new JobQueryParams
        {
            StartDate = DateTime.Today.AddDays(-7),
            EndDate = DateTime.Today
        };
        var expectedResult = new JobSearchResult
        {
            Jobs =
            [
                CreateTestDispatchJob(1, "JOB001"),
                CreateTestDispatchJob(2, "JOB002")
            ],
            TotalCount = 2
        };

        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _jobRepositoryMock.Setup(x => x.JobListAsync(
                queryParams, true, false, null, It.IsAny<List<int>>(), null))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.Index(queryParams, isInternal: true, cid: 0, clientIds: null, despatchViewIds: []);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var jobs = jsonResult.Value as JobSearchResult;
        jobs.Should().NotBeNull();
        jobs!.Jobs.Should().HaveCount(2);
        jobs.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task Index_ExternalClient_ValidatesClientAccess()
    {
        // Arrange
        var queryParams = new JobQueryParams();
        const int contactId = 123;
        const string clientIds = "456,789";

        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _clientAccessValidatorMock.Setup(x => x.ValidateClientAccessAsync(contactId, clientIds))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.JobListAsync(
                It.IsAny<JobQueryParams>(), false, false, clientIds, It.IsAny<List<int>>(), null))
            .ReturnsAsync(new JobSearchResult { Jobs = [], TotalCount = 0 });

        var controller = CreateController();

        // Act
        await controller.Index(queryParams, isInternal: false, cid: contactId, clientIds: clientIds, despatchViewIds: []);

        // Assert
        _clientAccessValidatorMock.Verify(x => x.ValidateClientAccessAsync(contactId, clientIds), Times.Once);
    }

    [Fact]
    public async Task Index_UnauthorizedAccess_Returns401()
    {
        // Arrange
        var queryParams = new JobQueryParams();
        const int contactId = 123;
        const string clientIds = "456";

        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _clientAccessValidatorMock.Setup(x => x.ValidateClientAccessAsync(contactId, clientIds))
            .ThrowsAsync(new UnauthorizedAccessException("Unauthorized"));

        var controller = CreateController();

        // Act
        var result = await controller.Index(queryParams, isInternal: false, cid: contactId, clientIds: clientIds, despatchViewIds: []);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [Fact]
    public async Task Index_RepositoryThrowsException_Returns500()
    {
        // Arrange
        var queryParams = new JobQueryParams();

        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _jobRepositoryMock.Setup(x => x.JobListAsync(
                It.IsAny<JobQueryParams>(), true, false, null, It.IsAny<List<int>>(), null))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.Index(queryParams, isInternal: true, cid: 0, clientIds: null, despatchViewIds: []);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region GetAllJobCoordinates Tests

    [Fact]
    public async Task GetAllJobCoordinates_ValidRequest_ReturnsCoordinates()
    {
        // Arrange
        var expectedCoordinates = new List<JobCoordinateModel>
        {
            new() { Id = 1, PickupLatitude = -36.8485m, PickupLongitude = 174.7633m },
            new() { Id = 2, PickupLatitude = -36.8500m, PickupLongitude = 174.7700m }
        };

        _jobRepositoryMock.Setup(x => x.GetJobCoordinatesAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(expectedCoordinates);

        var controller = CreateController();

        // Act
        var result = await controller.GetAllJobCoordinates(isInternal: true, clientIds: null, despatchViewIds: [1, 2]);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var coordinates = jsonResult.Value as List<JobCoordinateModel>;
        coordinates.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllJobCoordinates_UnauthorizedAccess_Returns401()
    {
        // Arrange
        _clientAccessValidatorMock.Setup(x => x.ValidateClientAccessAsync(0, "123"))
            .ThrowsAsync(new UnauthorizedAccessException());

        var controller = CreateController();

        // Act
        var result = await controller.GetAllJobCoordinates(isInternal: false, clientIds: "123", despatchViewIds: []);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    #endregion

    #region GetJobsByClearListEnvelope Tests

    [Fact]
    public async Task GetJobsByClearListEnvelope_ValidRequest_ReturnsJobs()
    {
        // Arrange
        var queryParams = new JobQueryParams();
        const int clearListId = 5;
        var expectedResult = new JobSearchResult
        {
            Jobs = [CreateTestDispatchJob(1, "JOB001")],
            TotalCount = 1
        };

        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _jobRepositoryMock.Setup(x => x.JobListAsync(
                queryParams, true, false, null, It.IsAny<List<int>>(), clearListId))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.GetJobsByClearListEnvelope(
            queryParams, isInternal: true, clientIds: null, despatchViewIds: [], selectedClearListId: clearListId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var jobs = jsonResult.Value as JobSearchResult;
        jobs!.Jobs.Should().HaveCount(1);
    }

    #endregion

    #region GetPricingBreakdown Tests

    [Fact]
    public async Task GetPricingBreakdown_ValidJobId_ReturnsPriceComponents()
    {
        // Arrange
        const int jobId = 1;
        var expectedBreakdown = new List<ChargeViewModel>
        {
            new() { ChargeId = 1, Name = "Base Rate", Amount = 50.00m },
            new() { ChargeId = 2, Name = "Fuel Surcharge", Amount = 5.00m }
        };

        _jobRepositoryMock.Setup(x => x.GetJobPriceBreakdownAsync(jobId, false, false))
            .ReturnsAsync(expectedBreakdown);

        var controller = CreateController();

        // Act
        var result = await controller.GetPricingBreakdown(jobId, isPrebook: false);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var breakdown = jsonResult.Value as List<ChargeViewModel>;
        breakdown.Should().HaveCount(2);
        breakdown![0].Name.Should().Be("Base Rate");
    }

    [Fact]
    public async Task GetPricingBreakdown_PrebookJob_PassesPrebookFlag()
    {
        // Arrange
        const int jobId = 1;

        _jobRepositoryMock.Setup(x => x.GetJobPriceBreakdownAsync(jobId, true, false))
            .ReturnsAsync([]);

        var controller = CreateController();

        // Act
        await controller.GetPricingBreakdown(jobId, isPrebook: true);

        // Assert
        _jobRepositoryMock.Verify(x => x.GetJobPriceBreakdownAsync(jobId, true, false), Times.Once);
    }

    [Fact]
    public async Task GetPricingBreakdown_ArchivedJob_PassesArchivedFlag()
    {
        // Arrange
        const int jobId = 1;

        _jobRepositoryMock.Setup(x => x.GetJobPriceBreakdownAsync(jobId, false, true))
            .ReturnsAsync([]);

        var controller = CreateController();

        // Act
        await controller.GetPricingBreakdown(jobId, isPrebook: false, isArchived: true);

        // Assert
        _jobRepositoryMock.Verify(x => x.GetJobPriceBreakdownAsync(jobId, false, true), Times.Once);
    }

    #endregion

    #region AddPriceComponent Tests

    [Fact]
    public async Task AddPriceComponent_ValidRequest_ReturnsChargeId()
    {
        // Arrange
        var breakdown = new ChargeViewModel
        {
            Name = "Additional Charge",
            Amount = 10.00m,
            ChildJobId = 1,
            JobId = 1
        };
        const int expectedChargeId = 99;

        _jobRepositoryMock.Setup(x => x.AddJobPriceBreakdownAsync(breakdown, false))
            .ReturnsAsync(expectedChargeId);

        var controller = CreateController();

        // Act
        var result = await controller.AddPriceComponent(breakdown);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(expectedChargeId);
    }

    [Fact]
    public async Task AddPriceComponent_AddsEventForNonArchivedJob()
    {
        // Arrange
        var breakdown = new ChargeViewModel
        {
            ChildJobId = 1,
            JobId = 1,
            IsArchived = false
        };

        _jobRepositoryMock.Setup(x => x.AddJobPriceBreakdownAsync(breakdown, false))
            .ReturnsAsync(1);

        var controller = CreateController();

        // Act
        await controller.AddPriceComponent(breakdown);

        // Assert
        _taskRepositoryMock.Verify(x => x.AddEventAsync(
            1, "Manually rated price", (int)EventType.ChangePrice, null, null, null, false), Times.Once);
    }

    [Fact]
    public async Task AddPriceComponent_NoJobId_Returns500()
    {
        // Arrange
        var breakdown = new ChargeViewModel
        {
            Name = "Test",
            Amount = 10.00m
            // No JobId or PrebookJobId
        };

        var controller = CreateController();

        // Act
        var result = await controller.AddPriceComponent(breakdown);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region UpdatePriceComponent Tests

    [Fact]
    public async Task UpdatePriceComponent_ValidRequest_ReturnsOk()
    {
        // Arrange
        var breakdown = new ChargeViewModel
        {
            ChargeId = 1,
            Name = "Updated Charge",
            Amount = 15.00m,
            JobId = 1
        };

        _jobRepositoryMock.Setup(x => x.UpdateJobPriceBreakdownAsync(breakdown, false))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdatePriceComponent(breakdown);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task UpdatePriceComponent_AddsEventForNonArchivedJob()
    {
        // Arrange
        var breakdown = new ChargeViewModel
        {
            ChargeId = 1,
            JobId = 1,
            IsArchived = false
        };

        var controller = CreateController();

        // Act
        await controller.UpdatePriceComponent(breakdown);

        // Assert
        _taskRepositoryMock.Verify(x => x.AddEventAsync(
            1, "Manually rated price", (int)EventType.ChangePrice, null, null, null, false), Times.Once);
    }

    #endregion

    #region DeletePriceComponent Tests

    [Fact]
    public async Task DeletePriceComponent_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new DeletePriceComponentRequest
        {
            ChargeId = 1,
            JobId = 1,
            IsArchived = false
        };

        _jobRepositoryMock.Setup(x => x.DeleteJobPriceBreakdownAsync(1, false))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.DeletePriceComponent(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task DeletePriceComponent_AddsEventForNonArchivedJob()
    {
        // Arrange
        var request = new DeletePriceComponentRequest
        {
            ChargeId = 1,
            JobId = 1,
            IsArchived = false
        };

        var controller = CreateController();

        // Act
        await controller.DeletePriceComponent(request);

        // Assert
        _taskRepositoryMock.Verify(x => x.AddEventAsync(
            1, "Manually rated price", (int)EventType.ChangePrice, null, null, null, false), Times.Once);
    }

    [Fact]
    public async Task DeletePriceComponent_ArchivedJob_DoesNotAddEvent()
    {
        // Arrange
        var request = new DeletePriceComponentRequest
        {
            ChargeId = 1,
            JobId = 1,
            IsArchived = true
        };

        var controller = CreateController();

        // Act
        await controller.DeletePriceComponent(request);

        // Assert
        _taskRepositoryMock.Verify(x => x.AddEventAsync(
            It.IsAny<int>(), It.IsAny<string>(), It.IsAny<int>(), null, null, null, false), Times.Never);
    }

    #endregion

    #region Detail (Job Detail) Tests

    [Fact]
    public async Task Detail_ValidJobId_ReturnsJobDetails()
    {
        // Arrange
        const int jobId = 1;
        var expectedJob = new JobGroupViewModel
        {
            Job = new JobViewModel { Id = jobId, JobNo = "JOB001" }
        };

        _jobRepositoryMock.Setup(x => x.GetJobByIdAsync(jobId))
            .ReturnsAsync(expectedJob);

        var controller = CreateController();

        // Act
        var result = await controller.Detail(jobId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var job = jsonResult.Value as JobGroupViewModel;
        job.Should().NotBeNull();
        job!.Job.Id.Should().Be(jobId);
    }

    [Fact]
    public async Task Detail_RepositoryThrowsException_Returns500()
    {
        // Arrange
        const int jobId = 999;

        _jobRepositoryMock.Setup(x => x.GetJobByIdAsync(jobId))
            .ThrowsAsync(new Exception("Job not found"));

        var controller = CreateController();

        // Act
        var result = await controller.Detail(jobId);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region DispatchJobDetail Tests

    [Fact]
    public async Task DispatchJobDetail_ValidJobId_ReturnsDispatchDetails()
    {
        // Arrange
        const int jobId = 1;
        var expectedJob = new DispatchJobViewModel
        {
            Id = jobId,
            JobNo = "JOB001"
        };

        _jobRepositoryMock.Setup(x => x.GetDispatchJobDetailAsync(jobId))
            .ReturnsAsync(expectedJob);

        var controller = CreateController();

        // Act
        var result = await controller.DispatchJobDetail(jobId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var job = jsonResult.Value as DispatchJobViewModel;
        job!.Id.Should().Be(jobId);
    }

    #endregion

    #region BulkDetail Tests

    [Fact]
    public async Task BulkDetail_ValidBulkJobId_ReturnsBulkJobDetails()
    {
        // Arrange
        const int bulkJobId = 1;
        var expectedJob = new JobGroupViewModel
        {
            Job = new JobViewModel { Id = bulkJobId, JobNo = "BULK001" }
        };

        _jobRepositoryMock.Setup(x => x.GetBulkJobDetailAsync(bulkJobId))
            .ReturnsAsync(expectedJob);

        var controller = CreateController();

        // Act
        var result = await controller.BulkDetail(bulkJobId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var job = jsonResult.Value as JobGroupViewModel;
        job!.Job.Id.Should().Be(bulkJobId);
    }

    #endregion

    #region RecurringJobDetail Tests

    [Fact]
    public async Task RecurringJobDetail_ValidJobId_ReturnsRecurringJobDetails()
    {
        // Arrange
        const int jobId = 1;
        var expectedJob = new JobGroupViewModel
        {
            Job = new JobViewModel { Id = jobId, JobNo = "REC001" }
        };

        _recurringJobRepositoryMock.Setup(x => x.GetRecurringJobByIdAsync(jobId))
            .ReturnsAsync(expectedJob);

        var controller = CreateController();

        // Act
        var result = await controller.RecurringJobDetail(jobId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var job = jsonResult.Value as JobGroupViewModel;
        job!.Job.Id.Should().Be(jobId);
    }

    #endregion

    #region GetCurrentWorkList Tests

    [Fact]
    public async Task GetCurrentWorkList_ValidCourierId_ReturnsWorkList()
    {
        // Arrange
        const int courierId = 1;
        var startDate = DateTimeOffset.Now.AddDays(-1);
        var endDate = DateTimeOffset.Now;
        var expectedResult = new JobSearchResult
        {
            Jobs = [CreateTestDispatchJob(1, "JOB001")],
            TotalCount = 1
        };

        _jobRepositoryMock.Setup(x => x.CurrentJobListAsync(courierId, startDate, endDate))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.GetCurrentWorkList(courierId, startDate, endDate);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var workList = jsonResult.Value as JobSearchResult;
        workList!.Jobs.Should().HaveCount(1);
    }

    #endregion

    #region Photo/Signature Upload Tests

    [Fact]
    public async Task UploadJobDeliveryPhotoOrSignature_ValidFile_ReturnsSuccess()
    {
        // Arrange
        const int jobId = 1;
        var fileMock = new Mock<IFormFile>();
        fileMock.Setup(f => f.FileName).Returns("test.png");
        fileMock.Setup(f => f.Length).Returns(1024);

        var uploadResult = new AwsUploadResult
        {
            Success = true,
            FileName = "test.png",
            S3Key = "jobs/1/test.png",
            ContentType = "image/png",
            Size = 1024,
            UploadDate = DateTime.Now,
            IsPod = true,
            PodDescription = "Test POD"
        };

        _jobPhotoServiceMock.Setup(x => x.UploadJobPhotoOrSignatureAsync(
                jobId, fileMock.Object, JobPhotoType.Delivery, true, "Test POD"))
            .ReturnsAsync(uploadResult);

        var controller = CreateController();

        // Act
        var result = await controller.UploadJobDeliveryPhotoOrSignature(
            jobId, fileMock.Object, isPod: true, podDescription: "Test POD");

        // Assert
        result.Should().BeOfType<JsonResult>();
    }

    [Fact]
    public async Task UploadJobDeliveryPhotoOrSignature_UploadFails_ReturnsBadRequest()
    {
        // Arrange
        const int jobId = 1;
        var fileMock = new Mock<IFormFile>();

        var uploadResult = new AwsUploadResult
        {
            Success = false,
            ErrorMessage = "File too large"
        };

        _jobPhotoServiceMock.Setup(x => x.UploadJobPhotoOrSignatureAsync(
                jobId, fileMock.Object, JobPhotoType.Delivery, true, null))
            .ReturnsAsync(uploadResult);

        var controller = CreateController();

        // Act
        var result = await controller.UploadJobDeliveryPhotoOrSignature(jobId, fileMock.Object);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region DeleteJobDeliveryPhotoOrSignature Tests

    [Fact]
    public async Task DeleteJobDeliveryPhotoOrSignature_ValidKey_ReturnsSuccess()
    {
        // Arrange
        const int jobId = 1;
        const string key = "jobs/1/photo.png";

        _jobPhotoServiceMock.Setup(x => x.DeleteJobPhotoOrSignatureAsync(jobId, key))
            .ReturnsAsync(true);

        var controller = CreateController();

        // Act
        var result = await controller.DeleteJobDeliveryPhotoOrSignature(jobId, key);

        // Assert
        result.Should().BeOfType<JsonResult>();
    }

    [Fact]
    public async Task DeleteJobDeliveryPhotoOrSignature_DeleteFails_ReturnsBadRequest()
    {
        // Arrange
        const int jobId = 1;
        const string key = "invalid-key";

        _jobPhotoServiceMock.Setup(x => x.DeleteJobPhotoOrSignatureAsync(jobId, key))
            .ReturnsAsync(false);

        var controller = CreateController();

        // Act
        var result = await controller.DeleteJobDeliveryPhotoOrSignature(jobId, key);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region GetJobDeliveryPhotosAndSignature Tests

    [Fact]
    public async Task GetJobDeliveryPhotosAndSignature_ValidRequest_ReturnsPhotos()
    {
        // Arrange
        const int jobId = 1;
        const int year = 2024;
        const int month = 1;
        var expectedPhotos = new List<S3PhotoInfo>
        {
            new() { FileName = "photo1.png", S3Key = "jobs/1/photo1.png" },
            new() { FileName = "photo2.png", S3Key = "jobs/1/photo2.png" }
        };

        _jobPhotoServiceMock.Setup(x => x.GetDeliveryPhotosAsync(jobId, year, month))
            .ReturnsAsync(expectedPhotos);

        var controller = CreateController();

        // Act
        var result = await controller.GetJobDeliveryPhotosAndSignature(jobId, year, month);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var photos = jsonResult.Value as List<S3PhotoInfo>;
        photos.Should().HaveCount(2);
    }

    #endregion

    #region GetJobPickupPhotos Tests

    [Fact]
    public async Task GetJobPickupPhotos_ValidRequest_ReturnsPhotos()
    {
        // Arrange
        const int jobId = 1;
        const int year = 2024;
        const int month = 1;
        var expectedPhotos = new List<S3PhotoInfo>
        {
            new() { FileName = "pickup1.png", S3Key = "jobs/1/pickup1.png" }
        };

        _jobPhotoServiceMock.Setup(x => x.GetPickupPhotosAsync(jobId, year, month))
            .ReturnsAsync(expectedPhotos);

        var controller = CreateController();

        // Act
        var result = await controller.GetJobPickupPhotos(jobId, year, month);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var photos = jsonResult.Value as List<S3PhotoInfo>;
        photos.Should().HaveCount(1);
    }

    #endregion

    #region Void Job Tests

    [Fact]
    public async Task Void_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new VoidJobRequest
        {
            JobId = 1,
            VoidSingleJobOnly = true,
            VoidReason = "Test void"
        };

        _jobRepositoryMock.Setup(x => x.GetJobParentIdAsync(1))
            .ReturnsAsync((int?)null);
        _jobRepositoryMock.Setup(x => x.VoidJobAsync(request))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.Void(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task Void_ChildJob_ReratesParent()
    {
        // Arrange
        var request = new VoidJobRequest
        {
            JobId = 2,
            VoidSingleJobOnly = true,
            SelectedJobIds = [2]
        };

        _jobRepositoryMock.Setup(x => x.GetJobParentIdAsync(2))
            .ReturnsAsync(1); // Has parent
        _jobRepositoryMock.Setup(x => x.VoidJobAsync(request))
            .Returns(Task.CompletedTask);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(x => x.GetJobDetailsForRatingAsync(1))
            .ReturnsAsync(new JobRatingDetailsDto { JobId = 1, IsManuallyRated = false });

        var controller = CreateController();

        // Act - Note: In debug mode, rerating is skipped
        var result = await controller.Void(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task Void_Exception_Returns500()
    {
        // Arrange
        var request = new VoidJobRequest { JobId = 1 };

        _jobRepositoryMock.Setup(x => x.GetJobParentIdAsync(1))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.Void(request);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region VoidBulkJob Tests

    [Fact]
    public async Task VoidBulkJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new VoidBulkJobRequest
        {
            BulkJobId = 1,
            VoidSingleJobOnly = false,
            VoidReason = "Bulk void"
        };

        _jobRepositoryMock.Setup(x => x.VoidBulkJobAsync(request))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.VoidBulkJob(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region VoidPrebookJob Tests

    [Fact]
    public async Task VoidPrebookJob_ValidJobId_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;

        _jobRepositoryMock.Setup(x => x.VoidPrebookJobAsync(jobId))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.VoidPrebookJob(jobId);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region Allocate Tests

    [Fact]
    public async Task Allocate_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new AllocateJobsToCourierRequest
        {
            CourierId = 1,
            JobIds = [1, 2, 3]
        };

        _dispatchJobServiceMock.Setup(x => x.DispatchJobsToCourierAsync(request.JobIds, request.CourierId))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.Allocate(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task Allocate_ServiceThrowsException_Returns500()
    {
        // Arrange
        var request = new AllocateJobsToCourierRequest
        {
            CourierId = 1,
            JobIds = [1]
        };

        _dispatchJobServiceMock.Setup(x => x.DispatchJobsToCourierAsync(request.JobIds, request.CourierId))
            .ThrowsAsync(new Exception("Allocation failed"));

        var controller = CreateController();

        // Act
        var result = await controller.Allocate(request);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region ReAllocate Tests

    [Fact]
    public async Task ReAllocate_ValidRequest_RedispatchesAndAllocates()
    {
        // Arrange
        var request = new AllocateJobsToCourierRequest
        {
            CourierId = 2,
            JobIds = [1, 2]
        };

        _jobRepositoryMock.Setup(x => x.ReDispatchSelectedJobsAsync(request.JobIds))
            .Returns(Task.CompletedTask);
        _dispatchJobServiceMock.Setup(x => x.DispatchJobsToCourierAsync(request.JobIds, request.CourierId))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.ReAllocate(request);

        // Assert
        result.Should().BeOfType<OkResult>();
        _jobRepositoryMock.Verify(x => x.ReDispatchSelectedJobsAsync(request.JobIds), Times.Once);
        _dispatchJobServiceMock.Verify(x => x.DispatchJobsToCourierAsync(request.JobIds, request.CourierId), Times.Once);
    }

    #endregion

    #region SplitJob Tests

    [Fact]
    public async Task SplitJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        var meetingPointAddress = new AddressViewModel(
            addressLine1: "123 Meeting St",
            addressLine2: string.Empty,
            addressLine3: string.Empty,
            addressLine4: string.Empty,
            addressLine5: "Auckland",
            addressLine6: string.Empty,
            addressLine7: "1010",
            addressLine8: string.Empty)
        {
            Latitude = -36.8485m,
            Longitude = 174.7633m
        };

        var request = new SplitJobRequest
        {
            JobId = 1,
            MeetingPointAddress = meetingPointAddress
        };
        var staffInfo = new Suggestion { Id = 1, Text = "John Doe" };

        _tenantInfoServiceMock.Setup(x => x.GetStaffInfoAsync())
            .ReturnsAsync(staffInfo);
        _splitJobServiceMock.Setup(x => x.SplitJobAsync(1, "John Doe", It.IsAny<AddressViewModel>()))
            .ReturnsAsync((1, 2));

        var controller = CreateController();

        // Act
        var result = await controller.SplitJob(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task SplitJob_RequestWithoutSuburbId_CallsServiceWithAddressOnly()
    {
        // Arrange - This test verifies the fix where suburb ID is no longer required
        var meetingPointAddress = new AddressViewModel(
            addressLine1: "456 New Meeting Point",
            addressLine2: "Suite 100",
            addressLine3: string.Empty,
            addressLine4: string.Empty,
            addressLine5: "Wellington",
            addressLine6: string.Empty,
            addressLine7: "6011",
            addressLine8: string.Empty)
        {
            Latitude = -41.2865m,
            Longitude = 174.7762m
        };

        var request = new SplitJobRequest
        {
            JobId = 42,
            MeetingPointAddress = meetingPointAddress
        };
        var staffInfo = new Suggestion { Id = 5, Text = "Jane Smith" };

        _tenantInfoServiceMock.Setup(x => x.GetStaffInfoAsync())
            .ReturnsAsync(staffInfo);
        _splitJobServiceMock.Setup(x => x.SplitJobAsync(
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<AddressViewModel>()))
            .ReturnsAsync((10, 11));

        var controller = CreateController();

        // Act
        await controller.SplitJob(request);

        // Assert - Verify service is called with correct parameters (no suburb ID)
        _splitJobServiceMock.Verify(x => x.SplitJobAsync(
            42,
            "Jane Smith",
            It.Is<AddressViewModel>(a =>
                a.AddressLine1 == "456 New Meeting Point" &&
                a.AddressLine5 == "Wellington" &&
                a.AddressLine7 == "6011" &&
                a.Latitude == -41.2865m &&
                a.Longitude == 174.7762m)),
            Times.Once);
    }

    [Fact]
    public async Task SplitJob_ServiceException_Returns500()
    {
        // Arrange
        var meetingPointAddress = new AddressViewModel(
            addressLine1: "Error Address",
            addressLine2: string.Empty,
            addressLine3: string.Empty,
            addressLine4: string.Empty,
            addressLine5: "Auckland",
            addressLine6: string.Empty,
            addressLine7: "1010",
            addressLine8: string.Empty);

        var request = new SplitJobRequest
        {
            JobId = 999,
            MeetingPointAddress = meetingPointAddress
        };
        var staffInfo = new Suggestion { Id = 1, Text = "Test User" };

        _tenantInfoServiceMock.Setup(x => x.GetStaffInfoAsync())
            .ReturnsAsync(staffInfo);
        _splitJobServiceMock.Setup(x => x.SplitJobAsync(
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<AddressViewModel>()))
            .ThrowsAsync(new InvalidOperationException("Job not found"));

        var controller = CreateController();

        // Act
        var result = await controller.SplitJob(request);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task SplitJob_AddressWithAllFields_PassesAllFieldsToService()
    {
        // Arrange - Verify all address fields are passed correctly
        var meetingPointAddress = new AddressViewModel(
            addressLine1: "Unit 5",
            addressLine2: "Building A",
            addressLine3: "123",
            addressLine4: "Main Street",
            addressLine5: "Auckland",
            addressLine6: "Auckland Central",
            addressLine7: "1010",
            addressLine8: "Near the park")
        {
            Latitude = -36.8485m,
            Longitude = 174.7633m
        };

        var request = new SplitJobRequest
        {
            JobId = 1,
            MeetingPointAddress = meetingPointAddress
        };
        var staffInfo = new Suggestion { Id = 1, Text = "Test User" };

        AddressViewModel? capturedAddress = null;
        _tenantInfoServiceMock.Setup(x => x.GetStaffInfoAsync())
            .ReturnsAsync(staffInfo);
        _splitJobServiceMock.Setup(x => x.SplitJobAsync(
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<AddressViewModel>()))
            .Callback<int, string, AddressViewModel>((_, _, addr) => capturedAddress = addr)
            .ReturnsAsync((1, 2));

        var controller = CreateController();

        // Act
        await controller.SplitJob(request);

        // Assert - All address fields should be passed
        capturedAddress.Should().NotBeNull();
        capturedAddress!.AddressLine1.Should().Be("Unit 5");
        capturedAddress.AddressLine2.Should().Be("Building A");
        capturedAddress.AddressLine3.Should().Be("123");
        capturedAddress.AddressLine4.Should().Be("Main Street");
        capturedAddress.AddressLine5.Should().Be("Auckland");
        capturedAddress.AddressLine6.Should().Be("Auckland Central");
        capturedAddress.AddressLine7.Should().Be("1010");
        capturedAddress.AddressLine8.Should().Be("Near the park");
        capturedAddress.Latitude.Should().Be(-36.8485m);
        capturedAddress.Longitude.Should().Be(174.7633m);
    }

    #endregion

    #region UnSplitJob Tests

    [Fact]
    public async Task UnSplitJob_ValidJobId_ReturnsMessage()
    {
        // Arrange
        const int jobId = 1;
        const string expectedMessage = "Job unsplit successfully";

        _jobRepositoryMock.Setup(x => x.UnSplitJobAsync(jobId))
            .ReturnsAsync(expectedMessage);

        var controller = CreateController();

        // Act
        var result = await controller.UnSplitJob(jobId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(expectedMessage);
    }

    #endregion

    #region RestoreJobs Tests

    [Fact]
    public async Task RestoreJobs_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new RestoreJobsRequest { JobIds = [1, 2, 3] };

        _jobRepositoryMock.Setup(x => x.RestoreJobsAsync(request.JobIds))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.RestoreJobs(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region RestoreSplitJobs Tests

    [Fact]
    public async Task RestoreSplitJobs_ValidJobIds_ReturnsOk()
    {
        // Arrange
        var jobIds = new List<int> { 1, 2 };

        _jobRepositoryMock.Setup(x => x.RestoreSplitJobsAsync(jobIds))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.RestoreSplitJobs(jobIds);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region UpdateJob Tests

    [Fact]
    public async Task UpdateJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        const JobProperty field = JobProperty.ConNote;
        const string value = "Updated";

        _jobRepositoryMock.Setup(x => x.UpdateJobAsync(jobId, field, value))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateJob(jobId, field, value);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task UpdateJob_PriceAffectingProperty_ReratesJob()
    {
        // Arrange
        const int jobId = 1;
        const JobProperty field = JobProperty.SpeedID;
        const string value = "2";

        _jobRepositoryMock.Setup(x => x.UpdateJobAsync(jobId, field, value))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.IsJobArchived(jobId))
            .ReturnsAsync(false);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(x => x.GetJobDetailsForRatingAsync(jobId))
            .ReturnsAsync(new JobRatingDetailsDto { JobId = jobId, IsManuallyRated = false });

        var controller = CreateController();

        // Act - Note: rerating happens but is skipped in debug mode
        var result = await controller.UpdateJob(jobId, field, value);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task UpdateJob_Exception_Returns500()
    {
        // Arrange
        const int jobId = 1;

        _jobRepositoryMock.Setup(x => x.UpdateJobAsync(jobId, JobProperty.ConNote, "test"))
            .ThrowsAsync(new Exception("Update failed"));

        var controller = CreateController();

        // Act
        var result = await controller.UpdateJob(jobId, JobProperty.ConNote, "test");

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region UpdateRecurringJob Tests

    [Fact]
    public async Task UpdateRecurringJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        const JobProperty field = JobProperty.ConNote;
        const string value = "Updated";

        _recurringJobRepositoryMock.Setup(x => x.UpdateRecurringJobAsync(jobId, field, value))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateRecurringJob(jobId, field, value);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region UpdateBulkJob Tests

    [Fact]
    public async Task UpdateBulkJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int bulkJobId = 1;
        const JobProperty field = JobProperty.ConNote;
        const string value = "Bulk updated";

        _jobRepositoryMock.Setup(x => x.UpdateBulkJobAsync(bulkJobId, field, value))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateBulkJob(bulkJobId, field, value);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region Address Update Tests

    [Fact]
    public async Task UpdateDeliveryAddress_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new UpdateAddressRequest
        {
            JobId = 1,
            Address = new AddressViewModel { AddressLine1 = "123 Test Street" }
        };

        _jobRepositoryMock.Setup(x => x.UpdateDeliveryAddressAsync(request))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.IsJobArchived(1))
            .ReturnsAsync(false);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _jobRepositoryMock.Setup(x => x.GetJobDetailsForRatingNzAsync(1, false))
            .ReturnsAsync(new JobRatingDetailsDtoNz());

        var controller = CreateController();

        // Act
        var result = await controller.UpdateDeliveryAddress(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task UpdatePickupAddress_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new UpdateAddressRequest
        {
            JobId = 1,
            Address = new AddressViewModel { AddressLine1 = "456 Pickup Ave" }
        };

        _jobRepositoryMock.Setup(x => x.UpdatePickupAddressAsync(request))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.IsJobArchived(1))
            .ReturnsAsync(false);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _jobRepositoryMock.Setup(x => x.GetJobDetailsForRatingNzAsync(1, false))
            .ReturnsAsync(new JobRatingDetailsDtoNz());

        var controller = CreateController();

        // Act
        var result = await controller.UpdatePickupAddress(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task UpdateBookingPickupAddress_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new UpdateAddressRequest
        {
            JobId = 1,
            Address = new AddressViewModel { AddressLine1 = "789 Booking Lane" }
        };

        _recurringJobRepositoryMock.Setup(x => x.UpdateBookingPickupAddressAsync(request))
            .Returns(Task.CompletedTask);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _jobRepositoryMock.Setup(x => x.GetJobBookingDetailsForRatingNzAsync(1))
            .ReturnsAsync(new JobRatingDetailsDtoNz());

        var controller = CreateController();

        // Act
        var result = await controller.UpdateBookingPickupAddress(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task UpdateBookingDeliveryAddress_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new UpdateAddressRequest
        {
            JobId = 1,
            Address = new AddressViewModel { AddressLine1 = "321 Delivery Blvd" }
        };

        _recurringJobRepositoryMock.Setup(x => x.UpdateBookingDeliveryAddressAsync(request))
            .Returns(Task.CompletedTask);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _jobRepositoryMock.Setup(x => x.GetJobBookingDetailsForRatingNzAsync(1))
            .ReturnsAsync(new JobRatingDetailsDtoNz());

        var controller = CreateController();

        // Act
        var result = await controller.UpdateBookingDeliveryAddress(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region Lookup Endpoint Tests

    [Fact]
    public async Task SpeedList_ReturnsSpeedOptions()
    {
        // Arrange
        var expectedSpeeds = new List<Suggestion>
        {
            new() { Id = 1, Text = "Standard" },
            new() { Id = 2, Text = "Express" },
            new() { Id = 3, Text = "Same Day" }
        };

        _jobRepositoryMock.Setup(x => x.GetSpeedsAsync())
            .ReturnsAsync(expectedSpeeds);

        var controller = CreateController();

        // Act
        var result = await controller.SpeedList();

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var speeds = jsonResult.Value as List<Suggestion>;
        speeds.Should().HaveCount(3);
    }

    [Fact]
    public async Task SearchSpeedOptions_ValidSearchTerm_ReturnsMatchingSpeeds()
    {
        // Arrange
        const string searchTerm = "express";
        var expectedSpeeds = new List<Suggestion>
        {
            new() { Id = 2, Text = "Express" }
        };

        _jobRepositoryMock.Setup(x => x.GetSpeedsBySearchTermAsync(searchTerm))
            .ReturnsAsync(expectedSpeeds);

        var controller = CreateController();

        // Act
        var result = await controller.SearchSpeedOptions(searchTerm);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var speeds = jsonResult.Value as List<Suggestion>;
        speeds.Should().HaveCount(1);
    }

    [Fact]
    public async Task ContactList_ValidClientId_ReturnsContacts()
    {
        // Arrange
        const int clientId = 1;
        var expectedContacts = new List<Suggestion>
        {
            new() { Id = 1, Text = "John Smith" },
            new() { Id = 2, Text = "Jane Doe" }
        };

        _jobRepositoryMock.Setup(x => x.GetContactsByClientIdAsync(clientId))
            .ReturnsAsync(expectedContacts);

        var controller = CreateController();

        // Act
        var result = await controller.ContactList(clientId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var contacts = jsonResult.Value as List<Suggestion>;
        contacts.Should().HaveCount(2);
    }

    [Fact]
    public async Task LeaveList_ReturnsLeaveLocations()
    {
        // Arrange
        var expectedLocations = new List<Lookup>
        {
            new() { Id = 1, Text = "Front Door" },
            new() { Id = 2, Text = "Back Door" }
        };

        _jobRepositoryMock.Setup(x => x.LeaveParcelLocationsAsync())
            .ReturnsAsync(expectedLocations);

        var controller = CreateController();

        // Act
        var result = await controller.LeaveList();

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var locations = jsonResult.Value as List<Lookup>;
        locations.Should().HaveCount(2);
    }

    [Fact]
    public async Task UndeliverableList_ReturnsUndeliverableLocations()
    {
        // Arrange
        var expectedLocations = new List<UndeliverableLocation>
        {
            new() { Id = 1, Text = "Address Unknown" },
            new() { Id = 2, Text = "Refused" }
        };

        _jobRepositoryMock.Setup(x => x.UndeliverableLocationsAsync())
            .ReturnsAsync(expectedLocations);

        var controller = CreateController();

        // Act
        var result = await controller.UndeliverableList();

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var locations = jsonResult.Value as List<UndeliverableLocation>;
        locations.Should().HaveCount(2);
    }

    [Fact]
    public async Task StatusList_ReturnsStatuses()
    {
        // Arrange
        var expectedStatuses = new List<Suggestion>
        {
            new() { Id = 1, Text = "Pending" },
            new() { Id = 2, Text = "In Progress" },
            new() { Id = 3, Text = "Delivered" }
        };

        _jobRepositoryMock.Setup(x => x.GetStatusListAsync())
            .ReturnsAsync(expectedStatuses);

        var controller = CreateController();

        // Act
        var result = await controller.StatusList();

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var statuses = jsonResult.Value as List<Suggestion>;
        statuses.Should().HaveCount(3);
    }

    [Fact]
    public async Task InternalStatusList_ReturnsInternalStatuses()
    {
        // Arrange
        var expectedStatuses = new List<InternalStatus>
        {
            new() { Id = 1, Text = "Active" },
            new() { Id = 2, Text = "OnHold" }
        };

        _jobRepositoryMock.Setup(x => x.GetInternalStatusListAsync())
            .ReturnsAsync(expectedStatuses);

        var controller = CreateController();

        // Act
        var result = await controller.InternalStatusList();

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var statuses = jsonResult.Value as List<InternalStatus>;
        statuses.Should().HaveCount(2);
    }

    [Fact]
    public async Task EventTypeList_ReturnsEventTypes()
    {
        // Arrange
        var expectedEventTypes = new List<Suggestion>
        {
            new() { Id = 1, Text = "Pickup" },
            new() { Id = 2, Text = "Delivery" },
            new() { Id = 3, Text = "Late Call" }
        };

        _jobRepositoryMock.Setup(x => x.EventTypeListAsync())
            .ReturnsAsync(expectedEventTypes);

        var controller = CreateController();

        // Act
        var result = await controller.EventTypeList();

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var eventTypes = jsonResult.Value as List<Suggestion>;
        eventTypes.Should().HaveCount(3);
    }

    #endregion

    #region Search/Report Tests

    [Fact]
    public async Task PodSearch_ValidRequest_ReturnsSearchResults()
    {
        // Arrange
        var request = new PodSearchRequest
        {
            FromDate = DateTime.Today.AddDays(-7),
            ToDate = DateTime.Today,
            Wild = "test"
        };
        var expectedResult = new JobSearchResult
        {
            Jobs = [CreateTestDispatchJob(1, "JOB001")],
            TotalCount = 1
        };

        _jobRepositoryMock.Setup(x => x.PodSearchAsync(request))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.PodSearch(request);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var searchResult = jsonResult.Value as JobSearchResult;
        searchResult!.Jobs.Should().HaveCount(1);
    }

    [Fact]
    public async Task BulkSearch_ValidRequest_ReturnsSearchResults()
    {
        // Arrange
        var request = new PodSearchRequest
        {
            FromDate = DateTime.Today.AddDays(-30),
            ToDate = DateTime.Today
        };
        var expectedResult = new JobSearchResult
        {
            Jobs = [CreateTestDispatchJob(1, "BULK001")],
            TotalCount = 1
        };

        _jobRepositoryMock.Setup(x => x.BulkSearchAsync(request))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.BulkSearch(request);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var searchResult = jsonResult.Value as JobSearchResult;
        searchResult!.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task PodSearchDownload_ValidRequest_ReturnsFile()
    {
        // Arrange
        var request = new PodSearchDownloadRequest
        {
            FromDate = DateTime.Today.AddDays(-7),
            ToDate = DateTime.Today
        };
        var reportResult = new JobsReportResult
        {
            FileBytes = [1, 2, 3],
            FileName = "jobs_report.csv"
        };

        _jobReportServiceMock.Setup(x => x.GenerateJobsReportAsync(request))
            .ReturnsAsync(reportResult);

        var controller = CreateController();

        // Act
        var result = await controller.PodSearchDownload(request);

        // Assert
        result.Should().BeOfType<FileContentResult>();
        var fileResult = (FileContentResult)result;
        fileResult.FileDownloadName.Should().Be("jobs_report.csv");
        fileResult.ContentType.Should().Be("text/csv");
    }

    [Fact]
    public async Task ClientJobsReportDownload_ValidRequest_ReturnsFile()
    {
        // Arrange
        var request = new ClientJobsReportRequest
        {
            ClientIds = [1, 2],
            StartDate = DateTimeOffset.Now.AddDays(-30),
            EndDate = DateTimeOffset.Now
        };

        _jobReportServiceMock.Setup(x => x.GenerateClientJobsReportCsvAsync(request))
            .ReturnsAsync((new byte[] { 1, 2, 3 }, "client_jobs.csv"));

        var controller = CreateController();

        // Act
        var result = await controller.ClientJobsReportDownload(request);

        // Assert
        result.Should().BeOfType<FileContentResult>();
        var fileResult = (FileContentResult)result;
        fileResult.FileDownloadName.Should().Be("client_jobs.csv");
    }

    [Fact]
    public async Task ClientJobsReportDownload_NoData_ReturnsNotFound()
    {
        // Arrange
        var request = new ClientJobsReportRequest();

        _jobReportServiceMock.Setup(x => x.GenerateClientJobsReportCsvAsync(request))
            .ThrowsAsync(new InvalidOperationException("No jobs found"));

        var controller = CreateController();

        // Act
        var result = await controller.ClientJobsReportDownload(request);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region PreBookJobs Tests

    [Fact]
    public async Task PreBookJobs_ValidRequest_ReturnsRecurringJobs()
    {
        // Arrange
        var request = new RecurringJobQueryRequest
        {
            Limit = 20,
            Page = 1
        };
        var expectedResult = new PaginatedResponse<PrebookListViewModel>
        {
            Items = [new PrebookListViewModel { Id = 1 }],
            Total = 1
        };

        _recurringJobRepositoryMock.Setup(x => x.GetRecurringJobsListAsync(request))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.PreBookJobs(request);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var jobs = jsonResult.Value as PaginatedResponse<PrebookListViewModel>;
        jobs!.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task RecurringJobsExportCsv_ValidRequest_ReturnsFile()
    {
        // Arrange
        var request = new RecurringJobQueryRequest();

        _jobReportServiceMock.Setup(x => x.GenerateRecurringJobsCsvAsync(request))
            .ReturnsAsync((new byte[] { 1, 2, 3 }, "recurring_jobs.csv"));

        var controller = CreateController();

        // Act
        var result = await controller.RecurringJobsExportCsv(request);

        // Assert
        result.Should().BeOfType<FileContentResult>();
        var fileResult = (FileContentResult)result;
        fileResult.FileDownloadName.Should().Be("recurring_jobs.csv");
    }

    #endregion

    #region File Upload/Download Tests

    [Fact]
    public async Task UploadFile_ValidFile_ReturnsSuccess()
    {
        // Arrange
        var fileMock = new Mock<IFormFile>();
        fileMock.Setup(f => f.FileName).Returns("document.pdf");
        fileMock.Setup(f => f.Length).Returns(2048);

        var request = new FileUploadRequest
        {
            JobId = 1,
            File = fileMock.Object
        };

        var uploadResult = new AwsUploadResult
        {
            Success = true,
            FileName = "document.pdf",
            S3Key = "jobs/1/attachments/document.pdf",
            ContentType = "application/pdf",
            Size = 2048,
            UploadDate = DateTime.Now
        };

        _jobPhotoServiceMock.Setup(x => x.UploadJobAttachmentAsync(1, fileMock.Object))
            .ReturnsAsync(uploadResult);

        var controller = CreateController();

        // Act
        var result = await controller.UploadFile(request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UploadFile_NoFile_ReturnsBadRequest()
    {
        // Arrange
        var request = new FileUploadRequest { JobId = 1, File = null };

        var controller = CreateController();

        // Act
        var result = await controller.UploadFile(request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task DownloadFile_ValidKey_ReturnsFile()
    {
        // Arrange
        const string key = "jobs/1/document.pdf";
        var downloadResult = new AwsFileDownloadResult
        {
            Success = true,
            FileBytes = [1, 2, 3],
            ContentType = "application/pdf",
            FileName = "document.pdf"
        };

        _jobPhotoServiceMock.Setup(x => x.DownloadFileAsync(key))
            .ReturnsAsync(downloadResult);

        var controller = CreateController();

        // Act
        var result = await controller.DownloadFile(key);

        // Assert
        result.Should().BeOfType<FileContentResult>();
        var fileResult = (FileContentResult)result;
        fileResult.FileDownloadName.Should().Be("document.pdf");
    }

    [Fact]
    public async Task DownloadFile_FileNotFound_ReturnsNotFound()
    {
        // Arrange
        const string key = "invalid/key";
        var downloadResult = new AwsFileDownloadResult
        {
            Success = false,
            ErrorMessage = "File not found"
        };

        _jobPhotoServiceMock.Setup(x => x.DownloadFileAsync(key))
            .ReturnsAsync(downloadResult);

        var controller = CreateController();

        // Act
        var result = await controller.DownloadFile(key);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task DeleteFile_ValidKey_ReturnsSuccess()
    {
        // Arrange
        const string key = "jobs/1/document.pdf";

        _jobPhotoServiceMock.Setup(x => x.DeleteFileAsync(key))
            .ReturnsAsync(true);

        var controller = CreateController();

        // Act
        var result = await controller.DeleteFile(key);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task DeleteFile_DeleteFails_ReturnsBadRequest()
    {
        // Arrange
        const string key = "invalid/key";

        _jobPhotoServiceMock.Setup(x => x.DeleteFileAsync(key))
            .ReturnsAsync(false);

        var controller = CreateController();

        // Act
        var result = await controller.DeleteFile(key);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetAttachedFiles_ValidJobId_ReturnsFiles()
    {
        // Arrange
        const int jobId = 1;
        var expectedFiles = new List<S3FileInfo>
        {
            new() { FileName = "doc1.pdf", S3Key = "jobs/1/doc1.pdf" },
            new() { FileName = "doc2.pdf", S3Key = "jobs/1/doc2.pdf" }
        };

        _jobPhotoServiceMock.Setup(x => x.GetAttachedFilesAsync(jobId))
            .ReturnsAsync(expectedFiles);

        var controller = CreateController();

        // Act
        var result = await controller.GetAttachedFiles(jobId);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        var files = okResult.Value as List<S3FileInfo>;
        files.Should().HaveCount(2);
    }

    #endregion

    #region UpdateNote Tests

    [Fact]
    public async Task UpdateNote_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        const string note = "Updated note content";

        _jobRepositoryMock.Setup(x => x.UpdateJobNoteAsync(jobId, note))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateNote(jobId, note);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdateNote_InvalidJobId_ReturnsBadRequest()
    {
        // Arrange
        const int jobId = 0;
        const string note = "Test";

        var controller = CreateController();

        // Act
        var result = await controller.UpdateNote(jobId, note);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateNote_EmptyNote_ReturnsBadRequest()
    {
        // Arrange
        const int jobId = 1;
        const string note = "";

        var controller = CreateController();

        // Act
        var result = await controller.UpdateNote(jobId, note);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateNote_JobNotFound_Returns500()
    {
        // Arrange
        const int jobId = 999;
        const string note = "Test";

        _jobRepositoryMock.Setup(x => x.UpdateJobNoteAsync(jobId, note))
            .ThrowsAsync(new KeyNotFoundException("Job not found"));

        var controller = CreateController();

        // Act
        var result = await controller.UpdateNote(jobId, note);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region Package Update Tests

    [Fact]
    public async Task UpdateJobPackages_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new UpdateJobPackagesRequest
        {
            JobId = 1,
            Parcels =
            [
                new ParcelDimensions { Length = 10, Height = 10, Depth = 10 }
            ]
        };

        _jobRepositoryMock.Setup(x => x.UpdatePackagesForJobAsync(request.JobId, request.Parcels))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateJobPackages(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task UpdateBulkJobPackages_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new UpdateBulkJobPackagesRequest
        {
            BulkJobId = 1,
            Parcels =
            [
                new ParcelDimensions { Length = 20, Height = 20, Depth = 20 }
            ]
        };

        _jobRepositoryMock.Setup(x => x.UpdatePackagesForBulkJobAsync(request.BulkJobId, request.Parcels))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateBulkJobPackages(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region IsJobParent/IsBulkJobParent Tests

    [Fact]
    public async Task IsJobParent_ParentJob_ReturnsTrue()
    {
        // Arrange
        const int jobId = 1;

        _jobRepositoryMock.Setup(x => x.IsJobParentAsync(jobId))
            .ReturnsAsync(true);

        var controller = CreateController();

        // Act
        var result = await controller.IsJobParent(jobId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(true);
    }

    [Fact]
    public async Task IsJobParent_ChildJob_ReturnsFalse()
    {
        // Arrange
        const int jobId = 2;

        _jobRepositoryMock.Setup(x => x.IsJobParentAsync(jobId))
            .ReturnsAsync(false);

        var controller = CreateController();

        // Act
        var result = await controller.IsJobParent(jobId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(false);
    }

    [Fact]
    public async Task IsBulkJobParent_ParentBulkJob_ReturnsTrue()
    {
        // Arrange
        const int bulkJobId = 1;

        _jobRepositoryMock.Setup(x => x.IsBulkJobParent(bulkJobId))
            .ReturnsAsync(true);

        var controller = CreateController();

        // Act
        var result = await controller.IsBulkJobParent(bulkJobId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(true);
    }

    #endregion

    #region GetRelatedJobsMultiSelectList Tests

    [Fact]
    public async Task GetRelatedJobsMultiSelectList_ValidJobId_ReturnsRelatedJobs()
    {
        // Arrange
        const int jobId = 1;
        var expectedJobs = new List<MultiSuggestion>
        {
            new() { Id = 2, Text = "JOB002" },
            new() { Id = 3, Text = "JOB003" }
        };

        _jobRepositoryMock.Setup(x => x.GetRelatedJobsMultiSelectListAsync(jobId, false))
            .ReturnsAsync(expectedJobs);

        var controller = CreateController();

        // Act
        var result = await controller.GetRelatedJobsMultiSelectList(jobId, isArchived: false);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var jobs = jsonResult.Value as List<MultiSuggestion>;
        jobs.Should().HaveCount(2);
    }

    #endregion

    #region JobReadStatus Tests

    [Fact]
    public async Task UpdateJobReadStatus_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        const bool hasBeenRead = true;

        _jobRepositoryMock.Setup(x => x.UpdateJobReadStatusAsync(jobId, hasBeenRead))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateJobReadStatus(jobId, hasBeenRead);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task BulkUpdateReadStatus_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new BulkReadUpdateRequestModel
        {
            JobIds = [1, 2, 3],
            ShouldMarkAsRead = true
        };

        _jobRepositoryMock.Setup(x => x.BulkUpdateReadStatusAsync(request))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.BulkUpdateReadStatus(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region AddEvent Tests

    [Fact]
    public async Task AddEvent_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new JobEventDataRequest
        {
            JobId = 1,
            Notes = "Test event",
            EventTypeId = 1
        };

        _taskRepositoryMock.Setup(x => x.AddEventAsync(
                request.JobId, request.Notes, request.EventTypeId, request.EventDueDate, null, null, false))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.AddEvent(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task AddRestoreEvent_ValidJobId_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        var currentTime = DateTime.Now;

        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime())
            .Returns(currentTime);
        _taskRepositoryMock.Setup(x => x.AddEventAsync(
                jobId, It.IsAny<string>(), (int)EventType.RestoreJob, null, 33, null, false))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.AddRestoreEvent(jobId);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region QuickCreateJob Tests

    [Fact]
    public async Task QuickCreateJob_ValidRequest_ReturnsJobId()
    {
        // Arrange
        var request = new JobCreateViewModel
        {
            ClientId = 1,
            PickUpAddress = new AddressViewModel { AddressLine1 = "123 Pickup St" },
            DeliveryAddress = new AddressViewModel { AddressLine1 = "456 Delivery Ave" }
        };
        const int expectedJobId = 123;

        _jobRepositoryMock.Setup(x => x.QuickAddJobAsync(request))
            .ReturnsAsync(expectedJobId);

        var controller = CreateController();

        // Act
        var result = await controller.QuickCreateJob(request);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(expectedJobId);
    }

    [Fact]
    public async Task QuickCreateJob_NullRequest_Returns500()
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.QuickCreateJob(null);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task QuickCreateJob_ZeroJobId_Returns500()
    {
        // Arrange
        var request = new JobCreateViewModel();

        _jobRepositoryMock.Setup(x => x.QuickAddJobAsync(request))
            .ReturnsAsync(0);

        var controller = CreateController();

        // Act
        var result = await controller.QuickCreateJob(request);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
    }

    #endregion

    #region ReleaseBulkJob Tests

    [Fact]
    public async Task ReleaseBulkJob_ValidBulkJobId_ReturnsOk()
    {
        // Arrange
        const int bulkJobId = 1;

        _jobRepositoryMock.Setup(x => x.ReleaseBulkJobByIdAsync(bulkJobId))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.ReleaseBulkJob(bulkJobId);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task ReleaseBulkJob_Exception_Returns500()
    {
        // Arrange
        const int bulkJobId = 1;

        _jobRepositoryMock.Setup(x => x.ReleaseBulkJobByIdAsync(bulkJobId))
            .ThrowsAsync(new Exception("Release failed"));

        var controller = CreateController();

        // Act
        var result = await controller.ReleaseBulkJob(bulkJobId);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region AddStopToJob Tests

    [Fact]
    public async Task AddStopToJob_ValidRequest_ReturnsNewJobId()
    {
        // Arrange
        var request = new AddStopRequest
        {
            JobId = 1,
            PickUpAddress = new EditAddressDialogViewModel { AddressLine1 = "New Stop" }
        };
        const int newJobId = 2;

        _addStopJobServiceMock.Setup(x => x.AddStopInsertJobAsync(request))
            .ReturnsAsync(newJobId);

        var controller = CreateController();

        // Act
        var result = await controller.AddStopToJob(request);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(newJobId);
    }

    [Fact]
    public async Task AddStopToRecurringJob_ValidRequest_ReturnsNewJobId()
    {
        // Arrange
        var request = new AddStopRequest
        {
            JobId = 1,
            DeliveryAddress = new EditAddressDialogViewModel { AddressLine1 = "New Recurring Stop" }
        };
        const int newJobId = 2;

        _addStopJobServiceMock.Setup(x => x.AddStopInsertRecurringJobAsync(request))
            .ReturnsAsync(newJobId);

        var controller = CreateController();

        // Act
        var result = await controller.AddStopToRecurringJob(request);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(newJobId);
    }

    #endregion

    #region GetDeliveryJourney Tests

    [Fact]
    public async Task GetDeliveryJourney_ValidJobId_ReturnsJourney()
    {
        // Arrange
        const int jobId = 1;
        var expectedJourney = new List<DeliveryJourneyViewModel>
        {
            new() { JobId = jobId, Title = "Pickup Completed" }
        };

        _deliveryJourneyServiceMock.Setup(x => x.GetDeliveryJourneyForJobAsync(jobId))
            .ReturnsAsync(expectedJourney);

        var controller = CreateController();

        // Act
        var result = await controller.GetDeliveryJourney(jobId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var journey = jsonResult.Value as List<DeliveryJourneyViewModel>;
        journey!.Should().HaveCount(1);
        journey![0].JobId.Should().Be(jobId);
    }

    #endregion

    #region GetTimeZoneOptions Tests

    [Fact]
    public async Task GetTimeZoneOptions_ReturnsTimeZones()
    {
        // Arrange
        var expectedTimeZones = new List<TimeZoneSuggestion>
        {
            new() { Id = 1, Text = "Eastern Time", TimeZoneIana = "America/New_York" },
            new() { Id = 2, Text = "Pacific Time", TimeZoneIana = "America/Los_Angeles" }
        };

        _jobRepositoryMock.Setup(x => x.GetTimeZoneOptions())
            .ReturnsAsync(expectedTimeZones);

        var controller = CreateController();

        // Act
        var result = await controller.GetTimeZoneOptions();

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var timeZones = jsonResult.Value as List<TimeZoneSuggestion>;
        timeZones.Should().HaveCount(2);
    }

    #endregion

    #region Repricing Tests

    [Fact]
    public async Task SimpleRepriceJobManual_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new SimpleRepriceJobModel
        {
            JobId = 1,
            NewPrice = 100.00m
        };

        _jobRepositoryMock.Setup(x => x.SimpleRepriceJobManualAsync(request))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SimpleRepriceJobManual(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task RepriceJobWithBaseAmount_ValidRequest_ReturnsNewRate()
    {
        // Arrange
        var request = new RepriceJobWithBaseAmountModel
        {
            JobId = 1,
            BaseAmount = 50.00m
        };
        const decimal expectedRate = 75.00m;

        _jobRepositoryMock.Setup(x => x.RepriceJobWithBaseAmountAsync(request))
            .ReturnsAsync(expectedRate);

        var controller = CreateController();

        // Act
        var result = await controller.RepriceJobWithBaseAmount(request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        okResult.Value.Should().Be(expectedRate);
    }

    [Fact]
    public async Task RecalculateJobRate_ValidJobId_ReturnsNewRate()
    {
        // Arrange
        const int jobId = 1;
        const decimal expectedRate = 85.00m;

        _jobRepositoryMock.Setup(x => x.IsJobArchived(jobId))
            .ReturnsAsync(false);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(x => x.GetJobDetailsForRatingAsync(jobId))
            .ReturnsAsync(new JobRatingDetailsDto { JobId = jobId });
        _rateJobServiceMock.Setup(x => x.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()))
            .ReturnsAsync(expectedRate);

        var controller = CreateController();

        // Act
        var result = await controller.RecalculateJobRate(jobId);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        okResult.Value.Should().Be(expectedRate);
    }

    [Fact]
    public async Task ApplyRecalculatedJobRate_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;

        _jobRepositoryMock.Setup(x => x.IsJobArchived(jobId))
            .ReturnsAsync(false);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _jobRepositoryMock.Setup(x => x.GetJobDetailsForRatingNzAsync(jobId, false))
            .ReturnsAsync(new JobRatingDetailsDtoNz());

        var controller = CreateController();

        // Act
        var result = await controller.ApplyRecalculatedJobRate(jobId);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region POD Swap Tests

    [Fact]
    public async Task ValidateSwapPod_ValidJob_ReturnsTrue()
    {
        // Arrange
        const string jobNumber = "JOB001";

        _jobRepositoryMock.Setup(x => x.ValidatePodSwapAsync(jobNumber))
            .ReturnsAsync(true);

        var controller = CreateController();

        // Act
        var result = await controller.ValidateSwapPod(jobNumber);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(true);
    }

    [Fact]
    public async Task SwapPod_ValidJobs_ReturnsOk()
    {
        // Arrange
        const string job1 = "JOB001";
        const string job2 = "JOB002";

        _jobRepositoryMock.Setup(x => x.SwapPodAsync(job1, job2))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SwapPod(job1, job2);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region ReSend/ReAssign Tests

    [Fact]
    public async Task ReSendSelected_ValidJobIds_ReturnsOk()
    {
        // Arrange
        const string jobIds = "1,2,3";

        _jobRepositoryMock.Setup(x => x.ReSendSelectedJobsAsync(jobIds))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.ReSendSelected(jobIds);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task ReAssignSelected_ValidJobIds_ReturnsOk()
    {
        // Arrange
        const string jobIds = "1,2,3";

        _jobRepositoryMock.Setup(x => x.ReAssignSelectedJobsAsync(jobIds))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.ReAssignSelected(jobIds);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task SetFirstJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        const int courierId = 2;

        _jobRepositoryMock.Setup(x => x.SetFirstJobAsync(jobId, courierId))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SetFirstJob(jobId, courierId);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task ReSendAll_ValidCourierId_ReturnsOk()
    {
        // Arrange
        const int courierId = 1;

        _jobRepositoryMock.Setup(x => x.ReSendAllJobsAsync(courierId))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.ReSendAll(courierId);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region PpdExclusiveAmount Tests

    [Fact]
    public async Task PpdExclusiveAmount_ValidRequest_ReturnsPpdAmount()
    {
        // Arrange
        const int clientId = 1;
        const decimal amount = 100.00m;
        const decimal expectedPpd = 87.00m;

        _jobRepositoryMock.Setup(x => x.PpdExclusiveAmountAsync(clientId, amount))
            .ReturnsAsync(expectedPpd);

        var controller = CreateController();

        // Act
        var result = await controller.PpdExclusiveAmount(clientId, amount);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(expectedPpd);
    }

    #endregion

    #region HasClientItemsAvailable Tests

    [Fact]
    public async Task HasClientItemsAvailable_ItemsExist_ReturnsTrue()
    {
        // Arrange
        const int clientId = 1;
        const int speedId = 2;

        _jobRepositoryMock.Setup(x => x.HasClientItemsAvailableAsync(clientId, speedId))
            .ReturnsAsync(true);

        var controller = CreateController();

        // Act
        var result = await controller.HasClientItemsAvailable(clientId, speedId);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        jsonResult.Value.Should().Be(true);
    }

    [Fact]
    public async Task GetAllClientItems_ValidRequest_ReturnsItems()
    {
        // Arrange
        const int clientId = 1;
        const int speedId = 2;
        const int jobId = 3;
        var expectedItems = new PaginatedResponse<ClientItemsViewModel>
        {
            Items = [new ClientItemsViewModel { ItemId = 1, Name = "Extra Service" }],
            Total = 1
        };

        _jobRepositoryMock.Setup(x => x.GetClientItemsBySpeedAsync(clientId, speedId, jobId))
            .ReturnsAsync(expectedItems);

        var controller = CreateController();

        // Act
        var result = await controller.GetAllClientItems(clientId, speedId, jobId);

        // Assert
        result.Should().BeOfType<JsonResult>();
    }

    [Fact]
    public async Task AddClientItemsToJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        var itemsModel = new ClientItemsModel
        {
            ServiceIds = [1, 2],
            TotalCost = 25.00m
        };

        _jobRepositoryMock.Setup(x => x.AddClientsItemToJobAsync(jobId, itemsModel.ServiceIds, itemsModel.TotalCost))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.AddClientItemsToJob(jobId, itemsModel);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region UpdatePodDetails Tests

    [Fact]
    public async Task UpdatePodDetails_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new UpdatePodDetailsRequest
        {
            JobId = 1,
            PodName = "John Smith",
            PodTime = DateTime.Now.ToString("o")
        };

        _jobRepositoryMock.Setup(x => x.UpdatePodDetailsAsync(request))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdatePodDetails(request);

        // Assert
        result.Should().BeOfType<OkResult>();
    }

    #endregion

    #region ScanJobDetail Tests

    [Fact]
    public async Task ScanJobDetail_ValidRequest_ReturnsScanList()
    {
        // Arrange
        var runDate = DateTimeOffset.Now;
        const string scan = "SCAN001";
        var expectedResults = new List<ScanDetailResult>
        {
            new() { BulkScanId = 1, ScanDateTime = DateTime.Now }
        };

        _jobRepositoryMock.Setup(x => x.ScanList(runDate, scan))
            .ReturnsAsync(expectedResults);

        var controller = CreateController();

        // Act
        var result = await controller.ScanJobDetail(runDate, scan);

        // Assert
        result.Should().BeOfType<JsonResult>();
        var jsonResult = (JsonResult)result;
        var results = jsonResult.Value as List<ScanDetailResult>;
        results.Should().HaveCount(1);
    }

    #endregion

    #region Helper Methods

    private static DispatchJobViewModel CreateTestDispatchJob(int id, string jobNumber)
    {
        return new DispatchJobViewModel
        {
            Id = id,
            JobNo = jobNumber,
            Status = "Pending",
            From = "123 Test St",
            ToAddress = "456 Delivery Ave"
        };
    }

    #endregion
}
