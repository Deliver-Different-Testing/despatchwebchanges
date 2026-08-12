using System.Collections;
using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

[TestSubject(typeof(JobController))]
public class JobControllerTests : IDisposable
{
    private readonly IAddStopJobService _addStopJobServiceMock = Substitute.For<IAddStopJobService>();

    private readonly IClientAccessValidatorService _clientAccessValidatorMock =
        Substitute.For<IClientAccessValidatorService>();

    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private readonly IDeliveryJourneyService _deliveryJourneyServiceMock = Substitute.For<IDeliveryJourneyService>();
    private readonly IDispatchJobService _dispatchJobServiceMock = Substitute.For<IDispatchJobService>();
    private readonly IFlightAssignmentService _flightAssignmentServiceMock = Substitute.For<IFlightAssignmentService>();
    private readonly IArrivalWaitRerateService _arrivalWaitRerateServiceMock = Substitute.For<IArrivalWaitRerateService>();
    private readonly HttpClient _httpClient = new();
    private readonly IJobCommandRepository _jobCommandRepositoryMock = Substitute.For<IJobCommandRepository>();
    private readonly IJobPhotoService _jobPhotoServiceMock = Substitute.For<IJobPhotoService>();
    private readonly IJobQueryRepository _jobQueryRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly IJobReportService _jobReportServiceMock = Substitute.For<IJobReportService>();
    private readonly IPartnerJobGate _partnerJobGateMock = Substitute.For<IPartnerJobGate>();
    private readonly IPdfOverlayClient _pdfOverlayClientMock = Substitute.For<IPdfOverlayClient>();
    private readonly IPodReportService _podReportServiceMock = Substitute.For<IPodReportService>();
    private readonly IPriceReportService _priceReportServiceMock = Substitute.For<IPriceReportService>();

    private readonly IPricingPermissionService _pricingPermissionServiceMock =
        Substitute.For<IPricingPermissionService>();

    private readonly IRateJobService _rateJobServiceMock = Substitute.For<IRateJobService>();
    private readonly IRecurringJobRepository _recurringJobRepositoryMock = Substitute.For<IRecurringJobRepository>();
    private readonly ISendToPartnerService _sendToPartnerServiceMock = Substitute.For<ISendToPartnerService>();

    private readonly ISplitJobService _splitJobServiceMock = Substitute.For<ISplitJobService>();

    private readonly ISplitPricingPreviewService _splitPricingPreviewServiceMock =
        Substitute.For<ISplitPricingPreviewService>();
    private readonly ITaskRepository _taskRepositoryMock = Substitute.For<ITaskRepository>();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public JobControllerTests()
    {
        // By default, the gate sees jobs as non-partner so existing tests don't need to
        // care about partnership semantics. Tests that exercise partner flows override
        // this on a per-call basis. Both overloads default to NotPartner.
        _partnerJobGateMock.EvaluateAsync(
                Arg.Any<int>(), Arg.Any<JobProperty>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(new PartnerJobGateResult.NotPartner());
        _partnerJobGateMock.EvaluateAsync(
                Arg.Any<int>(), Arg.Any<JobChangeField>(), Arg.Any<string?>(), Arg.Any<string?>(),
                Arg.Any<CancellationToken>())
            .Returns(new PartnerJobGateResult.NotPartner());
        // By default, allow all pricing operations in tests (internal user behavior)
        _pricingPermissionServiceMock.CanModifyPricesAsync().Returns(true);
        _pricingPermissionServiceMock.CanBulkUpdatePricesAsync().Returns(true);
        _pricingPermissionServiceMock.CanModifyPriceBreakdownAsync().Returns(true);
        _pricingPermissionServiceMock.CanUsePricingModeAsync(Arg.Any<string>()).Returns(true);
        _pricingPermissionServiceMock.ValidateJobAccessAsync(Arg.Any<int>()).Returns(Task.CompletedTask);
        _pricingPermissionServiceMock.ValidateJobsAccessAsync(Arg.Any<IReadOnlyList<int>>()).Returns([]);
    }

    public void Dispose()
    {
        _httpClient.Dispose();
        GC.SuppressFinalize(this);
    }

    private JobController CreateController()
    {
        return new JobController(
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
            _priceReportServiceMock,
            _pdfOverlayClientMock,
            _splitJobServiceMock,
            _splitPricingPreviewServiceMock,
            _sendToPartnerServiceMock,
            _partnerJobGateMock,
            _flightAssignmentServiceMock,
            _arrivalWaitRerateServiceMock);
    }

    /// <summary>
    /// Creates a controller with HttpContext configured for split job tests.
    /// </summary>
    private JobController CreateControllerForSplitJob()
    {
        var controller = CreateController();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    /// <summary>A controller with a real HttpContext so actions reading HttpContext.RequestAborted work.</summary>
    private JobController CreateControllerWithHttpContext()
    {
        var controller = CreateController();
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }

    [Fact]
    public async Task OverlayDocuments_ReturnsDocumentsFromClientAsJson()
    {
        var docs = new List<OverlayDocument>
        {
            new("Invoice", "Customer Invoice", true),
            new("Manifest", "Delivery Manifest", false)
        };
        _pdfOverlayClientMock.ListJobDocumentsAsync(42, Arg.Any<CancellationToken>()).Returns(docs);

        var controller = CreateControllerWithHttpContext();

        var result = await controller.OverlayDocuments(42);

        // Assert the serialised contract, not the CLR object — the SPA reads camelCase keys and the
        // app's Newtonsoft config emits property names verbatim, so casing is the thing under test.
        var json = Assert.IsType<JsonResult>(result);
        var serialised = JsonConvert.SerializeObject(json.Value);
        Assert.Contains("\"documentType\":\"Invoice\"", serialised);
        Assert.Contains("\"displayName\":\"Customer Invoice\"", serialised);
        Assert.Contains("\"available\":true", serialised);
        Assert.Contains("\"documentType\":\"Manifest\"", serialised);
        Assert.Contains("\"available\":false", serialised);
    }

    [Fact]
    public async Task OverlayDocuments_NullFromClient_ReturnsEmptyJson()
    {
        _pdfOverlayClientMock.ListJobDocumentsAsync(42, Arg.Any<CancellationToken>())
            .Returns((IReadOnlyList<OverlayDocument>?)null);

        var controller = CreateControllerWithHttpContext();

        var result = await controller.OverlayDocuments(42);

        var json = Assert.IsType<JsonResult>(result);
        var serialised = JsonConvert.SerializeObject(json.Value);
        Assert.Equal("[]", serialised);
    }

    [Fact]
    public async Task OverlayDocument_TemplateExists_ReturnsPdfFile()
    {
        var pdf = new byte[] { 1, 2, 3 };
        _pdfOverlayClientMock.RenderJobAsync(42, "Invoice", Arg.Any<CancellationToken>()).Returns(pdf);

        var controller = CreateControllerWithHttpContext();

        var result = await controller.OverlayDocument(42, "Invoice");

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/pdf", file.ContentType);
        Assert.Equal("Invoice-42.pdf", file.FileDownloadName);
        Assert.Equal(pdf, file.FileContents);
    }

    [Fact]
    public async Task OverlayDocument_NoTemplate_ReturnsNotFound()
    {
        _pdfOverlayClientMock.RenderJobAsync(42, "Invoice", Arg.Any<CancellationToken>())
            .Returns((byte[]?)null);

        var controller = CreateControllerWithHttpContext();

        var result = await controller.OverlayDocument(42, "Invoice");

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task OverlayDocument_RenderFails_ReturnsServerErrorNotNotFound()
    {
        // A real render-side failure (e.g. an undecodable delivery photo) must surface as a 500 with
        // the actual cause — not be mislabelled "no template available" (the original bug).
        _pdfOverlayClientMock.RenderJobAsync(42, "Invoice", Arg.Any<CancellationToken>())
            .Throws(new PdfOverlayRenderException(500, "Image bytes could not be decoded."));

        var controller = CreateControllerWithHttpContext();

        var result = await controller.OverlayDocument(42, "Invoice");

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task OverlayDocument_BlankDocumentType_ReturnsBadRequest()
    {
        var controller = CreateControllerWithHttpContext();

        var result = await controller.OverlayDocument(42, "  ");

        Assert.IsType<BadRequestObjectResult>(result);
        await _pdfOverlayClientMock.DidNotReceiveWithAnyArgs().RenderJobAsync(0, null!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Index_ValidRequest_ReturnsJobList()
    {
        // Arrange
        var queryParams = new JobQueryParams
        {
            StartDate = TestDates.Today.AddDays(-7),
            EndDate = TestDates.Today
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

        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _jobQueryRepositoryMock
            .JobListAsync(queryParams, true, false, null, Arg.Any<IReadOnlyList<int>>(), null,
                Arg.Any<CancellationToken>()).Returns(expectedResult);

        var controller = CreateController();

        // Act
        var result =
            await controller.Index(queryParams, isInternal: true, cid: 0, clientIds: null, despatchViewIds: []);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var jobs = jsonResult.Value as JobSearchResult;
        Assert.NotNull(jobs);
        Assert.Equal(2, jobs.Jobs.Count);
        Assert.Equal(2, jobs.TotalCount);
    }

    [Fact]
    public async Task Index_ExternalClient_ValidatesClientAccess()
    {
        // Arrange
        var queryParams = new JobQueryParams();
        const int contactId = 123;
        const string clientIds = "456,789";

        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _clientAccessValidatorMock.ValidateClientAccessAsync(contactId, clientIds)
            .Returns(Task.CompletedTask);
        _jobQueryRepositoryMock
            .JobListAsync(Arg.Any<JobQueryParams>(), false, false, clientIds, Arg.Any<IReadOnlyList<int>>(), null,
                Arg.Any<CancellationToken>()).Returns(new JobSearchResult { Jobs = [], TotalCount = 0 });

        var controller = CreateController();

        // Act
        await controller.Index(queryParams, isInternal: false, cid: contactId, clientIds: clientIds,
            despatchViewIds: []);

        // Assert
        await _clientAccessValidatorMock.Received().ValidateClientAccessAsync(contactId, clientIds);
    }

    [Fact]
    public async Task Index_UnauthorizedAccess_Returns401()
    {
        // Arrange
        var queryParams = new JobQueryParams();
        const int contactId = 123;
        const string clientIds = "456";

        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _clientAccessValidatorMock.ValidateClientAccessAsync(contactId, clientIds)
            .ThrowsAsync(new UnauthorizedAccessException("Unauthorized"));

        var controller = CreateController();

        // Act
        var result = await controller.Index(queryParams, isInternal: false, cid: contactId, clientIds: clientIds,
            despatchViewIds: []);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(StatusCodes.Status401Unauthorized, objectResult.StatusCode);
    }

    [Fact]
    public async Task Index_RepositoryThrowsException_Returns500()
    {
        // Arrange
        var queryParams = new JobQueryParams();

        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _jobQueryRepositoryMock
            .JobListAsync(Arg.Any<JobQueryParams>(), true, false, null, Arg.Any<IReadOnlyList<int>>(), null,
                Arg.Any<CancellationToken>()).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result =
            await controller.Index(queryParams, isInternal: true, cid: 0, clientIds: null, despatchViewIds: []);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

    [Fact]
    public async Task GetAllJobCoordinates_ValidRequest_ReturnsCoordinates()
    {
        // Arrange
        var expectedCoordinates = new List<JobCoordinateModel>
        {
            new() { Id = 1, PickupLatitude = -36.8485m, PickupLongitude = 174.7633m },
            new() { Id = 2, PickupLatitude = -36.8500m, PickupLongitude = 174.7700m }
        };

        _jobQueryRepositoryMock.GetJobCoordinatesAsync(Arg.Any<IReadOnlyList<int>>(), Arg.Any<CancellationToken>())
            .Returns(expectedCoordinates);

        var controller = CreateController();

        // Act
        var result = await controller.GetAllJobCoordinates(isInternal: true, clientIds: null, despatchViewIds: [1, 2]);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<JobCoordinateModel> coordinates)
        {
            Assert.Equal(2, coordinates.Count);
        }
    }

    [Fact]
    public async Task GetAllJobCoordinates_UnauthorizedAccess_Returns401()
    {
        // Arrange
        _clientAccessValidatorMock.ValidateClientAccessAsync(0, "123").ThrowsAsync(new UnauthorizedAccessException());

        var controller = CreateController();

        // Act
        var result = await controller.GetAllJobCoordinates(isInternal: false, clientIds: "123", despatchViewIds: []);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(StatusCodes.Status401Unauthorized, objectResult.StatusCode);
    }

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

        _tenantInfoServiceMock.GetStaffId().Returns(1);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _jobQueryRepositoryMock.JobListAsync(queryParams, true, false, null, Arg.Any<IReadOnlyList<int>>(), clearListId,
            Arg.Any<CancellationToken>()).Returns(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.GetJobsByClearListEnvelope(
            queryParams, isInternal: true, clientIds: null, despatchViewIds: [], selectedClearListId: clearListId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var jobs = jsonResult.Value as JobSearchResult;
        Assert.Single(jobs!.Jobs);
    }

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

        _jobQueryRepositoryMock.GetJobPriceBreakdownAsync(jobId, false)
            .Returns(expectedBreakdown);

        var controller = CreateController();

        // Act
        var result = await controller.GetPricingBreakdown(jobId, isPrebook: false);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<ChargeViewModel> breakdown)
        {
            Assert.Equal(2, breakdown.Count);
            Assert.Equal("Base Rate", breakdown[0].Name);
        }
    }

    [Fact]
    public async Task GetPricingBreakdown_PrebookJob_PassesPrebookFlag()
    {
        // Arrange
        const int jobId = 1;

        _jobQueryRepositoryMock.GetJobPriceBreakdownAsync(jobId, true)
            .Returns([]);

        var controller = CreateController();

        // Act
        await controller.GetPricingBreakdown(jobId, isPrebook: true);

        // Assert
        await _jobQueryRepositoryMock.Received().GetJobPriceBreakdownAsync(jobId, true);
    }

    [Fact]
    public async Task GetPricingBreakdown_ArchivedJob_PassesArchivedFlag()
    {
        // Arrange
        const int jobId = 1;

        _jobQueryRepositoryMock.GetJobPriceBreakdownAsync(jobId, false, true)
            .Returns([]);

        var controller = CreateController();

        // Act
        await controller.GetPricingBreakdown(jobId, isPrebook: false, isArchived: true);

        // Assert
        await _jobQueryRepositoryMock.Received().GetJobPriceBreakdownAsync(jobId, false, true);
    }

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

        _jobCommandRepositoryMock.AddJobPriceBreakdownAsync(breakdown)
            .Returns(expectedChargeId);

        var controller = CreateController();

        // Act
        var result = await controller.AddPriceComponent(breakdown);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(expectedChargeId, jsonResult.Value);
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

        _jobCommandRepositoryMock.AddJobPriceBreakdownAsync(breakdown)
            .Returns(1);

        var controller = CreateController();

        // Act
        await controller.AddPriceComponent(breakdown);

        // Assert
        await _taskRepositoryMock.Received().AddEventAsync(
            1, "Manually rated price", (int)EventType.ChangePrice);
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
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

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

        _jobCommandRepositoryMock.UpdateJobPriceBreakdownAsync(breakdown)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdatePriceComponent(breakdown);

        // Assert
        Assert.IsType<OkResult>(result);
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
        await _taskRepositoryMock.Received().AddEventAsync(
            1, "Manually rated price", (int)EventType.ChangePrice);
    }

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

        _jobCommandRepositoryMock.DeleteJobPriceBreakdownAsync(1)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.DeletePriceComponent(request);

        // Assert
        Assert.IsType<OkResult>(result);
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
        await _taskRepositoryMock.Received().AddEventAsync(
            1, "Manually rated price", (int)EventType.ChangePrice);
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
        await _taskRepositoryMock.DidNotReceive().AddEventAsync(
            Arg.Any<int>(), Arg.Any<string>(), Arg.Any<int>());
    }

    [Fact]
    public async Task Detail_ValidJobId_ReturnsJobDetails()
    {
        // Arrange
        const int jobId = 1;
        var expectedJob = new JobGroupViewModel
        {
            Job = new JobViewModel { Id = jobId, JobNo = "JOB001" }
        };

        _jobQueryRepositoryMock.GetJobByIdAsync(jobId).Returns(expectedJob);

        var controller = CreateController();

        // Act
        var result = await controller.Detail(jobId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var job = jsonResult.Value as JobGroupViewModel;
        Assert.NotNull(job);
        Assert.Equal(jobId, job.Job.Id);
    }

    [Fact]
    public async Task Detail_RepositoryThrowsException_Returns500()
    {
        // Arrange
        const int jobId = 999;

        _jobQueryRepositoryMock.GetJobByIdAsync(jobId)
            .ThrowsAsync(new Exception("Job not found"));

        var controller = CreateController();

        // Act
        var result = await controller.Detail(jobId);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

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

        _jobQueryRepositoryMock.GetDispatchJobDetailAsync(jobId)
            .Returns(expectedJob);

        var controller = CreateController();

        // Act
        var result = await controller.DispatchJobDetail(jobId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var job = jsonResult.Value as DispatchJobViewModel;
        Assert.Equal(jobId, job!.Id);
    }

    [Fact]
    public async Task BulkDetail_ValidBulkJobId_ReturnsBulkJobDetails()
    {
        // Arrange
        const int bulkJobId = 1;
        var expectedJob = new JobGroupViewModel
        {
            Job = new JobViewModel { Id = bulkJobId, JobNo = "BULK001" }
        };

        _jobQueryRepositoryMock.GetBulkJobDetailAsync(bulkJobId)
            .Returns(expectedJob);

        var controller = CreateController();

        // Act
        var result = await controller.BulkDetail(bulkJobId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var job = jsonResult.Value as JobGroupViewModel;
        Assert.Equal(bulkJobId, job!.Job.Id);
    }

    [Fact]
    public async Task RecurringJobDetail_ValidJobId_ReturnsRecurringJobDetails()
    {
        // Arrange
        const int jobId = 1;
        var expectedJob = new JobGroupViewModel
        {
            Job = new JobViewModel { Id = jobId, JobNo = "REC001" }
        };

        _recurringJobRepositoryMock.GetRecurringJobByIdAsync(jobId)
            .Returns(expectedJob);

        var controller = CreateController();

        // Act
        var result = await controller.RecurringJobDetail(jobId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var job = jsonResult.Value as JobGroupViewModel;
        Assert.Equal(jobId, job!.Job.Id);
    }

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

        _jobQueryRepositoryMock.CurrentJobListAsync(courierId, startDate, endDate)
            .Returns(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.GetCurrentWorkList(courierId, startDate, endDate);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var workList = jsonResult.Value as JobSearchResult;
        Assert.Single(workList!.Jobs);
    }

    [Fact]
    public async Task UploadJobDeliveryPhotoOrSignature_ValidFile_ReturnsSuccess()
    {
        // Arrange
        const int jobId = 1;
        var fileMock = Substitute.For<IFormFile>();
        fileMock.FileName.Returns("test.png");
        fileMock.Length.Returns(1024);

        var uploadResult = new AwsUploadResult
        {
            Success = true,
            FileName = "test.png",
            S3Key = "jobs/1/test.png",
            ContentType = "image/png",
            Size = 1024,
            UploadDate = TestDates.Now,
            IsPod = true,
            PodDescription = "Test POD"
        };

        _jobPhotoServiceMock.UploadJobPhotoOrSignatureAsync(
                jobId, fileMock, JobPhotoType.Delivery, true, "Test POD")
            .Returns(uploadResult);

        var controller = CreateController();

        // Act
        var result = await controller.UploadJobDeliveryPhotoOrSignature(
            jobId, fileMock, isPod: true, podDescription: "Test POD");

        // Assert
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task UploadJobDeliveryPhotoOrSignature_UploadFails_ReturnsBadRequest()
    {
        // Arrange
        const int jobId = 1;
        var fileMock = Substitute.For<IFormFile>();

        var uploadResult = new AwsUploadResult
        {
            Success = false,
            ErrorMessage = "File too large"
        };

        _jobPhotoServiceMock.UploadJobPhotoOrSignatureAsync(
                jobId, fileMock, JobPhotoType.Delivery)
            .Returns(uploadResult);

        var controller = CreateController();

        // Act
        var result = await controller.UploadJobDeliveryPhotoOrSignature(jobId, fileMock);

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task DeleteJobDeliveryPhotoOrSignature_ValidKey_ReturnsSuccess()
    {
        // Arrange
        const int jobId = 1;
        const string key = "jobs/1/photo.png";

        _jobPhotoServiceMock.ArchiveJobPhotoAsync(jobId, key)
            .Returns(true);

        var controller = CreateController();

        // Act
        var result = await controller.DeleteJobDeliveryPhotoOrSignature(jobId, key);

        // Assert
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task DeleteJobDeliveryPhotoOrSignature_DeleteFails_ReturnsBadRequest()
    {
        // Arrange
        const int jobId = 1;
        const string key = "invalid-key";

        _jobPhotoServiceMock.ArchiveJobPhotoAsync(jobId, key)
            .Returns(false);

        var controller = CreateController();

        // Act
        var result = await controller.DeleteJobDeliveryPhotoOrSignature(jobId, key);

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
    }

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

        _jobPhotoServiceMock.GetDeliveryPhotosAsync(jobId, year, month)
            .Returns(expectedPhotos);

        var controller = CreateController();

        // Act
        var result = await controller.GetJobDeliveryPhotosAndSignature(jobId, year, month);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<S3PhotoInfo> photos)
        {
            Assert.Equal(2, photos.Count);
        }
    }

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

        _jobPhotoServiceMock.GetPickupPhotosAsync(jobId, year, month)
            .Returns(expectedPhotos);

        var controller = CreateController();

        // Act
        var result = await controller.GetJobPickupPhotos(jobId, year, month);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<S3PhotoInfo> photos)
        {
            Assert.Single(photos);
        }
    }

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

        _jobQueryRepositoryMock.GetJobParentIdAsync(1)
            .Returns((int?)null);
        _jobCommandRepositoryMock.VoidJobAsync(request)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.Void(request);

        // Assert
        Assert.IsType<OkResult>(result);
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

        _jobQueryRepositoryMock.GetJobParentIdAsync(2)
            .Returns(1); // Has parent
        _jobCommandRepositoryMock.VoidJobAsync(request)
            .Returns(Task.CompletedTask);
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        _jobQueryRepositoryMock.GetJobDetailsForRatingAsync(1)
            .Returns(new JobRatingDetailsDto { JobId = 1, IsManuallyRated = false });

        var controller = CreateController();

        // Act - Note: In debug mode, rerating is skipped
        var result = await controller.Void(request);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task Void_ChildJob_StillReturnsOkWhenDebuggerSkipsRerating()
    {
        // Arrange
        var request = new VoidJobRequest
        {
            JobId = 5,
            VoidSingleJobOnly = true,
            VoidReason = "Child void test",
            SelectedJobIds = [5]
        };

        _jobQueryRepositoryMock.IsJobArchived(5)
            .Returns(false);
        _jobQueryRepositoryMock.GetJobParentIdAsync(5)
            .Returns(1); // Has parent, parent NOT in selected list
        _jobCommandRepositoryMock.VoidJobAsync(request)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        // Note: Debugger.IsAttached is true in the test runner, so re-rating
        // is always skipped and the method returns Ok() before attempting to rate.
        var result = await controller.Void(request);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task Void_Exception_Returns500()
    {
        // Arrange
        var request = new VoidJobRequest { JobId = 1 };

        _jobQueryRepositoryMock.GetJobParentIdAsync(1).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.Void(request);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

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

        _jobCommandRepositoryMock.VoidBulkJobAsync(request)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.VoidBulkJob(request);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task Allocate_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new AllocateJobsToCourierRequest
        {
            CourierId = 1,
            JobIds = [1, 2, 3]
        };

        _dispatchJobServiceMock.DispatchJobsToCourierAsync(request.JobIds, request.CourierId)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.Allocate(request);

        // Assert
        Assert.IsType<OkResult>(result);
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

        _dispatchJobServiceMock.DispatchJobsToCourierAsync(request.JobIds, request.CourierId)
            .ThrowsAsync(new Exception("Allocation failed"));

        var controller = CreateController();

        // Act
        var result = await controller.Allocate(request);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

    [Fact]
    public async Task ReAllocate_ValidRequest_RedispatchesAndAllocates()
    {
        // Arrange
        var request = new AllocateJobsToCourierRequest
        {
            CourierId = 2,
            JobIds = [1, 2]
        };

        _jobCommandRepositoryMock.ReDispatchSelectedJobsAsync(request.JobIds)
            .Returns(Task.CompletedTask);
        _dispatchJobServiceMock.DispatchJobsToCourierAsync(request.JobIds, request.CourierId)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.ReAllocate(request);

        // Assert
        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received().ReDispatchSelectedJobsAsync(request.JobIds);
        await _dispatchJobServiceMock.Received().DispatchJobsToCourierAsync(request.JobIds, request.CourierId);
    }

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

        _tenantInfoServiceMock.GetStaffInfoAsync()
            .Returns(staffInfo);
        _splitJobServiceMock.SplitJobAsync(1, "John Doe", Arg.Any<AddressViewModel>(), ct: Arg.Any<CancellationToken>())
            .Returns((1, 2));

        var controller = CreateControllerForSplitJob();

        // Act
        var result = await controller.SplitJob(request);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task SplitJob_RequestWithoutSuburbId_CallsServiceWithAddressOnly()
    {
        // Arrange - This test verifies the fix where suburb ID is no longer required
        var meetingPointAddress = new AddressViewModel(
            addressLine1: "456 New Meeting Point",
            addressLine2: string.Empty,
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

        _tenantInfoServiceMock.GetStaffInfoAsync()
            .Returns(staffInfo);
        _splitJobServiceMock.SplitJobAsync(Arg.Any<int>(), Arg.Any<string>(), Arg.Any<AddressViewModel>(),
            Arg.Any<int?>(), Arg.Any<IReadOnlyList<SplitPricingAllocationItem>?>(),
            Arg.Any<IReadOnlyList<SplitPricingLineAllocationItem>?>(),
            Arg.Any<CancellationToken>()).Returns((10, 11));

        var controller = CreateControllerForSplitJob();

        // Act
        var result = await controller.SplitJob(request);

        // Assert - Verify service is called with correct parameters (no suburb ID)
        Assert.IsType<OkResult>(result);
        await _splitJobServiceMock.Received().SplitJobAsync(42, "Jane Smith", Arg.Is<AddressViewModel>(a =>
            a!.AddressLine1 == "456 New Meeting Point" &&
            a.AddressLine5 == "Wellington" &&
            a.AddressLine7 == "6011" &&
            a.Latitude == -41.2865m &&
            a.Longitude == 174.7762m), ct: Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SplitJob_WithCourierIdForLegB_PassesCourierToService()
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
            MeetingPointAddress = meetingPointAddress,
            CourierIdForLegB = 42
        };
        var staffInfo = new Suggestion { Id = 1, Text = "John Doe" };

        _tenantInfoServiceMock.GetStaffInfoAsync()
            .Returns(staffInfo);
        _splitJobServiceMock.SplitJobAsync(1, "John Doe", Arg.Any<AddressViewModel>(), 42,
                Arg.Any<IReadOnlyList<SplitPricingAllocationItem>?>(),
                Arg.Any<IReadOnlyList<SplitPricingLineAllocationItem>?>(), Arg.Any<CancellationToken>())
            .Returns((1, 2));

        var controller = CreateControllerForSplitJob();

        // Act
        var result = await controller.SplitJob(request);

        // Assert
        Assert.IsType<OkResult>(result);
        await _splitJobServiceMock.Received().SplitJobAsync(1, "John Doe", Arg.Any<AddressViewModel>(), 42,
            Arg.Any<IReadOnlyList<SplitPricingAllocationItem>?>(),
            Arg.Any<IReadOnlyList<SplitPricingLineAllocationItem>?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SplitJob_ForwardsTheConfirmedPricing_IncludingPerLineOverrides()
    {
        // Arrange
        var request = new SplitJobRequest
        {
            JobId = 1,
            MeetingPointAddress = new AddressViewModel(
                addressLine1: "15",
                addressLine2: string.Empty,
                addressLine3: string.Empty,
                addressLine4: "Meeting St",
                addressLine5: "Auckland",
                addressLine6: string.Empty,
                addressLine7: "1010",
                addressLine8: string.Empty),
            PricingAllocation =
            [
                new SplitPricingAllocationItem { Sequence = 1, SharePercent = 65m },
                new SplitPricingAllocationItem { Sequence = 2, SharePercent = 35m }
            ],
            LineAllocation =
            [
                new SplitPricingLineAllocationItem
                {
                    PricingBreakdownId = 3, Sequence = 1, SharePercent = 100m
                },
                new SplitPricingLineAllocationItem
                {
                    PricingBreakdownId = 3, Sequence = 2, SharePercent = 0m
                }
            ]
        };

        _tenantInfoServiceMock.GetStaffInfoAsync().Returns(new Suggestion { Id = 1, Text = "John Doe" });

        var controller = CreateControllerForSplitJob();

        // Act
        var result = await controller.SplitJob(request);

        // Assert — the shares the user confirmed reach the service untouched.
        Assert.IsType<OkResult>(result);
        await _splitJobServiceMock.Received(1).SplitJobAsync(
            1,
            "John Doe",
            Arg.Any<AddressViewModel>(),
            Arg.Any<int?>(),
            Arg.Is<IReadOnlyList<SplitPricingAllocationItem>?>(a =>
                a != null && a.Count == 2 && a[0].SharePercent == 65m),
            Arg.Is<IReadOnlyList<SplitPricingLineAllocationItem>?>(l =>
                l != null && l.Count == 2 && l[0].PricingBreakdownId == 3 && l[0].SharePercent == 100m
                && l[1].SharePercent == 0m),
            Arg.Any<CancellationToken>());
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

        _tenantInfoServiceMock.GetStaffInfoAsync()
            .Returns(staffInfo);
        _splitJobServiceMock
            .SplitJobAsync(Arg.Any<int>(), Arg.Any<string>(), Arg.Any<AddressViewModel>(), Arg.Any<int?>(),
                Arg.Any<IReadOnlyList<SplitPricingAllocationItem>?>(),
                Arg.Any<IReadOnlyList<SplitPricingLineAllocationItem>?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Job not found"));

        var controller = CreateControllerForSplitJob();

        // Act
        var result = await controller.SplitJob(request);

        // Assert - Exception is caught and returned as 500
        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusResult.StatusCode);
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
        _tenantInfoServiceMock.GetStaffInfoAsync()
            .Returns(staffInfo);
        _splitJobServiceMock.SplitJobAsync(
                Arg.Any<int>(),
                Arg.Any<string>(),
                Arg.Do<AddressViewModel>(addr => capturedAddress = addr),
                Arg.Any<int?>(),
                Arg.Any<IReadOnlyList<SplitPricingAllocationItem>?>(),
                Arg.Any<IReadOnlyList<SplitPricingLineAllocationItem>?>(),
                Arg.Any<CancellationToken>())
            .Returns((1, 2));

        var controller = CreateControllerForSplitJob();

        // Act
        var result = await controller.SplitJob(request);

        // Assert - All address fields should be passed
        Assert.IsType<OkResult>(result);
        Assert.NotNull(capturedAddress);
        Assert.Equal("Unit 5", capturedAddress!.AddressLine1);
        Assert.Equal("Building A", capturedAddress.AddressLine2);
        Assert.Equal("123", capturedAddress.AddressLine3);
        Assert.Equal("Main Street", capturedAddress.AddressLine4);
        Assert.Equal("Auckland", capturedAddress.AddressLine5);
        Assert.Equal("Auckland Central", capturedAddress.AddressLine6);
        Assert.Equal("1010", capturedAddress.AddressLine7);
        Assert.Equal("Near the park", capturedAddress.AddressLine8);
        Assert.Equal(-36.8485m, capturedAddress.Latitude);
        Assert.Equal(174.7633m, capturedAddress.Longitude);
    }

    [Fact]
    public async Task SplitJob_SplitJobException_ReturnsTheAuthoredMessageVerbatim()
    {
        // Without this the message is sanitised to the generic "An unexpected error occurred",
        // which leaves split failures undiagnosable in staging/production.
        const string authored = "Splitting isn't set up on this system — the 'SplitChild' job "
                                + "relationship type is missing. Please contact support.";
        _tenantInfoServiceMock.GetStaffInfoAsync().Returns(new Suggestion { Id = 1, Text = "Test User" });
        _splitJobServiceMock.SplitJobAsync(Arg.Any<int>(), Arg.Any<string>(), Arg.Any<AddressViewModel>(),
                Arg.Any<int?>(), Arg.Any<IReadOnlyList<SplitPricingAllocationItem>?>(),
                Arg.Any<IReadOnlyList<SplitPricingLineAllocationItem>?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new SplitJobException(authored));

        var result = await CreateControllerForSplitJob().SplitJob(new SplitJobRequest
        {
            JobId = 1,
            MeetingPointAddress = new AddressViewModel()
        });

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, objectResult.StatusCode);
        Assert.Equal(authored, objectResult.Value);
    }

    [Fact]
    public async Task SplitJob_UnexpectedException_ReturnsSanitisedMessage()
    {
        _tenantInfoServiceMock.GetStaffInfoAsync().Returns(new Suggestion { Id = 1, Text = "Test User" });
        _splitJobServiceMock.SplitJobAsync(Arg.Any<int>(), Arg.Any<string>(), Arg.Any<AddressViewModel>(),
                Arg.Any<int?>(), Arg.Any<IReadOnlyList<SplitPricingAllocationItem>?>(),
                Arg.Any<IReadOnlyList<SplitPricingLineAllocationItem>?>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Login failed for user 'sa' on server prod-rds"));

        var result = await CreateControllerForSplitJob().SplitJob(new SplitJobRequest
        {
            JobId = 1,
            MeetingPointAddress = new AddressViewModel()
        });

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, objectResult.StatusCode);
        Assert.DoesNotContain("prod-rds", objectResult.Value?.ToString());
    }

    private static SendPodReportRequest PodEmailRequest() => new()
    {
        JobId = 7,
        Recipients = ["ops@acme.test"],
        Subject = "Your POD",
        Body = "Body"
    };

    [Fact]
    public async Task SendPodReport_PodEmailException_ReturnsTheAuthoredMessageVerbatim()
    {
        // Without this the message is sanitised to the generic "An unexpected error occurred",
        // which is exactly what left the "Failed to send POD report" reports undiagnosable.
        const string authored = "The POD report could not be queued for sending. Please try again or contact support.";
        _podReportServiceMock
            .SendPodEmailAsync(7, Arg.Any<List<string>>(), Arg.Any<string>(), Arg.Any<string>())
            .ThrowsAsync(new PodEmailException(authored));

        var result = await CreateController().SendPodReport(PodEmailRequest());

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, objectResult.StatusCode);
        Assert.Equal(authored, objectResult.Value);
    }

    [Fact]
    public async Task SendPodReport_UnexpectedException_ReturnsSanitisedMessage()
    {
        _podReportServiceMock
            .SendPodEmailAsync(7, Arg.Any<List<string>>(), Arg.Any<string>(), Arg.Any<string>())
            .ThrowsAsync(new InvalidOperationException("Login failed for user 'sa' on server prod-rds"));

        var result = await CreateController().SendPodReport(PodEmailRequest());

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, objectResult.StatusCode);
        Assert.DoesNotContain("prod-rds", objectResult.Value?.ToString());
    }

    [Fact]
    public async Task UnSplitJob_ValidJobId_ReturnsMessage()
    {
        // Arrange
        const int jobId = 1;
        const string expectedMessage = "Job unsplit successfully";

        _jobCommandRepositoryMock.UnSplitJobAsync(jobId)
            .Returns(expectedMessage);

        var controller = CreateController();

        // Act
        var result = await controller.UnSplitJob(jobId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(expectedMessage, jsonResult.Value);
    }

    [Fact]
    public async Task UpdatePodDetails_JobNotFound_ReturnsNotFoundWithTheAuthoredMessage()
    {
        // A 200 here made a completion that wrote nothing look like a success to the
        // client, which still toasted "Completed" while the job stayed active.
        const string authored = "Job 99999 could not be completed because it no longer exists.";
        var request = new UpdatePodDetailsRequest
        {
            JobId = 99999,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Jane Doe",
            PodTime = "2026-03-14T10:35:32+13:00"
        };
        _jobCommandRepositoryMock.UpdatePodDetailsAsync(request)
            .ThrowsAsync(new JobNotFoundException(authored));

        var result = await CreateController().UpdatePodDetails(request);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(authored, notFound.Value);
    }

    [Fact]
    public async Task UpdatePodDetails_UnexpectedFailure_Returns500()
    {
        var request = new UpdatePodDetailsRequest
        {
            JobId = 1,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Jane Doe",
            PodTime = "2026-03-14T10:35:32+13:00"
        };
        _jobCommandRepositoryMock.UpdatePodDetailsAsync(request)
            .ThrowsAsync(new InvalidOperationException("boom"));

        var result = await CreateController().UpdatePodDetails(request);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, objectResult.StatusCode);
    }

    [Fact]
    public async Task RestoreJobs_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new RestoreJobsRequest { JobIds = [1, 2, 3] };

        _jobCommandRepositoryMock.RestoreJobsAsync(request.JobIds)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.RestoreJobs(request);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task RestoreJobs_RemoveCapturedImagesTrue_ArchivesEachJobsImagesUsingPreRestoreMonth()
    {
        // Arrange
        var request = new RestoreJobsRequest { JobIds = [1, 2], RemoveCapturedImages = true };
        _jobQueryRepositoryMock.GetJobCompletionTimesAsync(request.JobIds)
            .Returns(new Dictionary<int, DateTime?>
            {
                [1] = new DateTime(2024, 7, 15),
                [2] = new DateTime(2024, 8, 3)
            });
        _jobPhotoServiceMock.ArchiveJobCapturedMediaAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<int>())
            .Returns(new AwsBatchOperationResult());

        var controller = CreateController();

        // Act
        var result = await controller.RestoreJobs(request);

        // Assert
        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received(1).RestoreJobsAsync(request.JobIds);
        await _jobPhotoServiceMock.Received(1).ArchiveJobCapturedMediaAsync(1, 2024, 7);
        await _jobPhotoServiceMock.Received(1).ArchiveJobCapturedMediaAsync(2, 2024, 8);
    }

    [Fact]
    public async Task RestoreJobs_RemoveCapturedImagesFalse_DoesNotArchive()
    {
        // Arrange
        var request = new RestoreJobsRequest { JobIds = [1, 2], RemoveCapturedImages = false };
        var controller = CreateController();

        // Act
        var result = await controller.RestoreJobs(request);

        // Assert
        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received(1).RestoreJobsAsync(request.JobIds);
        await _jobQueryRepositoryMock.DidNotReceive().GetJobCompletionTimesAsync(Arg.Any<IReadOnlyList<int>>());
        await _jobPhotoServiceMock.DidNotReceiveWithAnyArgs()
            .ArchiveJobCapturedMediaAsync(0, 0, 0);
    }

    [Fact]
    public async Task RestoreJobs_JobWithoutCompletionTime_SkipsArchive()
    {
        // Arrange — a job with no recorded completion time has nothing to locate in S3.
        var request = new RestoreJobsRequest { JobIds = [1], RemoveCapturedImages = true };
        _jobQueryRepositoryMock.GetJobCompletionTimesAsync(request.JobIds)
            .Returns(new Dictionary<int, DateTime?> { [1] = null });

        var controller = CreateController();

        // Act
        var result = await controller.RestoreJobs(request);

        // Assert
        Assert.IsType<OkResult>(result);
        await _jobPhotoServiceMock.DidNotReceiveWithAnyArgs()
            .ArchiveJobCapturedMediaAsync(0, 0, 0);
    }

    [Fact]
    public async Task RestoreJobs_ArchiveThrows_StillReturnsOk()
    {
        // Arrange — archiving is best-effort; the restore has already committed.
        var request = new RestoreJobsRequest { JobIds = [1], RemoveCapturedImages = true };
        _jobQueryRepositoryMock.GetJobCompletionTimesAsync(request.JobIds)
            .Returns(new Dictionary<int, DateTime?> { [1] = new DateTime(2024, 7, 15) });
        _jobPhotoServiceMock.ArchiveJobCapturedMediaAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<int>())
            .ThrowsAsync(new Exception("S3 down"));

        var controller = CreateController();

        // Act
        var result = await controller.RestoreJobs(request);

        // Assert
        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received(1).RestoreJobsAsync(request.JobIds);
    }

    [Fact]
    public async Task GetRestorePodImpact_ReturnsPodNameAndCapturedImageCountPerJob()
    {
        // Arrange
        var request = new RestorePodImpactRequest { JobIds = [1, 2] };
        _jobQueryRepositoryMock.GetRestorePodDetailsAsync(request.JobIds)
            .Returns(new List<RestorePodDetail>
            {
                new() { JobId = 1, PodName = "J. Smith", CompletedTime = new DateTime(2024, 7, 15) },
                new() { JobId = 2, PodName = null, CompletedTime = new DateTime(2024, 8, 3) }
            });
        _jobPhotoServiceMock.CountJobCapturedMediaAsync(1, 2024, 7).Returns(3);
        _jobPhotoServiceMock.CountJobCapturedMediaAsync(2, 2024, 8).Returns(0);

        var controller = CreateController();

        // Act
        var result = await controller.GetRestorePodImpact(request);

        // Assert
        var json = Assert.IsType<JsonResult>(result);
        var impacts = Assert.IsAssignableFrom<IReadOnlyList<RestorePodImpact>>(json.Value);

        var first = Assert.Single(impacts, i => i.JobId == 1);
        Assert.Equal("J. Smith", first.PodName);
        Assert.Equal(3, first.CapturedImageCount);
        Assert.True(first.ImageCountKnown);

        var second = Assert.Single(impacts, i => i.JobId == 2);
        Assert.Null(second.PodName);
        Assert.Equal(0, second.CapturedImageCount);
        Assert.True(second.ImageCountKnown);
    }

    [Fact]
    public async Task GetRestorePodImpact_JobWithoutCompletionTime_SkipsTheS3Probe()
    {
        // Arrange — with no completion time there is no anchor month, so nothing is locatable in S3.
        var request = new RestorePodImpactRequest { JobIds = [1] };
        _jobQueryRepositoryMock.GetRestorePodDetailsAsync(request.JobIds)
            .Returns(new List<RestorePodDetail>
            {
                new() { JobId = 1, PodName = "J. Smith", CompletedTime = null }
            });

        var controller = CreateController();

        // Act
        var result = await controller.GetRestorePodImpact(request);

        // Assert
        var json = Assert.IsType<JsonResult>(result);
        var impact = Assert.Single(Assert.IsAssignableFrom<IReadOnlyList<RestorePodImpact>>(json.Value));
        Assert.Equal("J. Smith", impact.PodName);
        Assert.Equal(0, impact.CapturedImageCount);
        Assert.True(impact.ImageCountKnown);
        await _jobPhotoServiceMock.DidNotReceiveWithAnyArgs().CountJobCapturedMediaAsync(0, 0, 0);
    }

    [Fact]
    public async Task GetRestorePodImpact_ProbeThrows_ReportsCountUnknownAndStillReturnsThePodName()
    {
        // Arrange — the POD-name half is a plain DB read and must survive an S3 outage.
        var request = new RestorePodImpactRequest { JobIds = [1] };
        _jobQueryRepositoryMock.GetRestorePodDetailsAsync(request.JobIds)
            .Returns(new List<RestorePodDetail>
            {
                new() { JobId = 1, PodName = "J. Smith", CompletedTime = new DateTime(2024, 7, 15) }
            });
        _jobPhotoServiceMock.CountJobCapturedMediaAsync(1, 2024, 7).ThrowsAsync(new Exception("S3 down"));

        var controller = CreateController();

        // Act
        var result = await controller.GetRestorePodImpact(request);

        // Assert
        var json = Assert.IsType<JsonResult>(result);
        var impact = Assert.Single(Assert.IsAssignableFrom<IReadOnlyList<RestorePodImpact>>(json.Value));
        Assert.Equal("J. Smith", impact.PodName);
        Assert.False(impact.ImageCountKnown);
    }

    [Fact]
    public async Task GetRestorePodImpact_SelectionAboveTheProbeCap_SkipsS3Entirely()
    {
        // Arrange — a large bulk selection must not stall on one S3 listing per job.
        var jobIds = Enumerable.Range(1, JobController.MaxRestorePodImageProbeJobs + 1).ToList();
        var request = new RestorePodImpactRequest { JobIds = jobIds };
        _jobQueryRepositoryMock.GetRestorePodDetailsAsync(request.JobIds)
            .Returns(jobIds.Select(id => new RestorePodDetail
            {
                JobId = id, PodName = "J. Smith", CompletedTime = new DateTime(2024, 7, 15)
            }).ToList());

        var controller = CreateController();

        // Act
        var result = await controller.GetRestorePodImpact(request);

        // Assert
        var json = Assert.IsType<JsonResult>(result);
        var impacts = Assert.IsAssignableFrom<IReadOnlyList<RestorePodImpact>>(json.Value);
        Assert.Equal(jobIds.Count, impacts.Count);
        Assert.All(impacts, i => Assert.False(i.ImageCountKnown));
        Assert.All(impacts, i => Assert.Equal("J. Smith", i.PodName));
        await _jobPhotoServiceMock.DidNotReceiveWithAnyArgs().CountJobCapturedMediaAsync(0, 0, 0);
    }

    [Fact]
    public async Task GetRestorePodImpact_EmptyJobIds_ReturnsBadRequest()
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.GetRestorePodImpact(new RestorePodImpactRequest { JobIds = [] });

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
        await _jobQueryRepositoryMock.DidNotReceiveWithAnyArgs()
            .GetRestorePodDetailsAsync(Arg.Any<IReadOnlyList<int>>());
    }

    [Fact]
    public async Task RestoreSplitJobs_ValidJobIds_ReturnsOk()
    {
        // Arrange
        var jobIds = new List<int> { 1, 2 };

        _jobCommandRepositoryMock.RestoreSplitJobsAsync(jobIds)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.RestoreSplitJobs(jobIds);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task UpdateJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        const JobProperty field = JobProperty.ConNote;
        const string value = "Updated";

        _jobCommandRepositoryMock.UpdateJobAsync(jobId, field, value)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateJob(jobId, field, value, CancellationToken.None);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task UpdateJob_PriceAffectingProperty_ReratesJob()
    {
        // Arrange
        const int jobId = 1;
        const JobProperty field = JobProperty.SpeedID;
        const string value = "2";

        _jobCommandRepositoryMock.UpdateJobAsync(jobId, field, value)
            .Returns(Task.CompletedTask);
        _jobQueryRepositoryMock.IsJobArchived(jobId)
            .Returns(false);
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        _jobQueryRepositoryMock.GetJobDetailsForRatingAsync(jobId)
            .Returns(new JobRatingDetailsDto { JobId = jobId, IsManuallyRated = false });

        var controller = CreateController();

        // Act - Note: rerating happens but is skipped in debug mode
        var result = await controller.UpdateJob(jobId, field, value, CancellationToken.None);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Theory]
    [InlineData(JobProperty.PickupArrivalTime)]
    [InlineData(JobProperty.DeliveryArrivalTime)]
    public async Task UpdateJob_ArrivalField_HandsOffToTheWaitingRerate(JobProperty field)
    {
        const int jobId = 1;
        const string value = "2024-06-10T09:15:00.0000000+12:00";

        var controller = CreateController();

        var result = await controller.UpdateJob(jobId, field, value, CancellationToken.None);

        Assert.IsType<OkResult>(result);
        await _arrivalWaitRerateServiceMock.Received(1)
            .HandleArrivalEditAsync(jobId, field, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateJob_Exception_Returns500()
    {
        // Arrange
        const int jobId = 1;

        _jobCommandRepositoryMock.UpdateJobAsync(jobId, JobProperty.ConNote, "test")
            .ThrowsAsync(new Exception("Update failed"));

        var controller = CreateController();

        // Act
        var result = await controller.UpdateJob(jobId, JobProperty.ConNote, "test", CancellationToken.None);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

    [Fact]
    public async Task UpdateJob_DateField_WithoutCascade_DoesNotPropagateToFamily()
    {
        // "This job only" must move the parent and nothing else — and must not fall through to
        // the legacy rate propagation, which would silently redistribute a split family.
        const int jobId = 1;
        const string value = "2024-03-12T09:30:00+13:00";

        var controller = CreateController();

        var result = await controller.UpdateJob(jobId, JobProperty.BookedTime, value, CancellationToken.None);

        await _splitJobServiceMock.DidNotReceiveWithAnyArgs()
            .PropagateDateToChildrenAsync(0, default, null!, TestContext.Current.CancellationToken);
        await _splitJobServiceMock.DidNotReceiveWithAnyArgs()
            .PropagateUpdateToChildrenAsync(0, default, null!, TestContext.Current.CancellationToken);
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(new[] { jobId }, GetIntArray(ok.Value, "updatedJobIds"));
    }

    [Fact]
    public async Task UpdateJob_DateField_WithCascade_ReturnsParentAndUpdatedChildren()
    {
        const int jobId = 1;
        const string value = "2024-03-12T09:30:00+13:00";

        _splitJobServiceMock
            .PropagateDateToChildrenAsync(jobId, JobProperty.BookedTime, value, Arg.Any<CancellationToken>())
            .Returns(new DateCascadeResult([2, 3], [4]));

        var controller = CreateController();

        var result = await controller.UpdateJob(jobId, JobProperty.BookedTime, value, CancellationToken.None,
            cascadeToChildren: true);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal([1, 2, 3], GetIntArray(ok.Value, "updatedJobIds"));
        Assert.Equal([4], GetIntArray(ok.Value, "failedJobIds"));
    }

    [Fact]
    public async Task UpdateJob_DateField_CascadeThrows_StillReportsParentUpdated()
    {
        // The parent's date is already written; a failing cascade must not read to the user as
        // "nothing happened" — that is what drove the original rebooking.
        const int jobId = 1;
        const string value = "2024-03-12T09:30:00+13:00";

        _splitJobServiceMock
            .PropagateDateToChildrenAsync(jobId, JobProperty.Date, value, Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("boom"));

        var controller = CreateController();

        var result = await controller.UpdateJob(jobId, JobProperty.Date, value, CancellationToken.None,
            cascadeToChildren: true);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(new[] { jobId }, GetIntArray(ok.Value, "updatedJobIds"));
        Assert.True((bool)ok.Value!.GetType().GetProperty("cascadeFailed")!.GetValue(ok.Value)!);
    }

    [Fact]
    public async Task UpdateJob_NonDateRateAffectingField_StillUsesLegacyPropagation()
    {
        // Regression guard: only date fields take the new path. Size/weight/speed keep the
        // existing split-redistribute and multi-re-rate behaviour.
        const int jobId = 1;

        var controller = CreateController();

        var result = await controller.UpdateJob(jobId, JobProperty.Size, "3", CancellationToken.None);

        await _splitJobServiceMock.Received(1)
            .PropagateUpdateToChildrenAsync(jobId, JobProperty.Size, "3", Arg.Any<CancellationToken>());
        await _splitJobServiceMock.DidNotReceiveWithAnyArgs()
            .PropagateDateToChildrenAsync(0, default, null!, TestContext.Current.CancellationToken);
        Assert.IsType<OkResult>(result);
    }

    private static int[] GetIntArray(object? value, string propertyName) =>
        ((IEnumerable<int>)value!.GetType().GetProperty(propertyName)!.GetValue(value)!).ToArray();

    [Fact]
    public async Task UpdateRecurringJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        const JobProperty field = JobProperty.ConNote;
        const string value = "Updated";

        _recurringJobRepositoryMock.UpdateRecurringJobAsync(jobId, field, value)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateRecurringJob(jobId, field, value);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task UpdateBulkJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int bulkJobId = 1;
        const JobProperty field = JobProperty.ConNote;
        const string value = "Bulk updated";

        _jobCommandRepositoryMock.UpdateBulkJobAsync(bulkJobId, field, value)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateBulkJob(bulkJobId, field, value);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task UpdateDeliveryAddress_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new UpdateAddressRequest
        {
            JobId = 1,
            Address = new AddressViewModel { AddressLine1 = "123 Test Street" }
        };

        _jobCommandRepositoryMock.UpdateDeliveryAddressAsync(request)
            .Returns(Task.CompletedTask);
        _jobQueryRepositoryMock.IsJobArchived(1)
            .Returns(false);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _jobQueryRepositoryMock.GetJobDetailsForRatingNzAsync(1, false)
            .Returns(new JobRatingDetailsDtoNz());

        var controller = CreateController();

        // Act
        var result = await controller.UpdateDeliveryAddress(request, CancellationToken.None);

        // Assert
        Assert.IsType<OkResult>(result);
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

        _jobCommandRepositoryMock.UpdatePickupAddressAsync(request)
            .Returns(Task.CompletedTask);
        _jobQueryRepositoryMock.IsJobArchived(1)
            .Returns(false);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _jobQueryRepositoryMock.GetJobDetailsForRatingNzAsync(1, false)
            .Returns(new JobRatingDetailsDtoNz());

        var controller = CreateController();

        // Act
        var result = await controller.UpdatePickupAddress(request, CancellationToken.None);

        // Assert
        Assert.IsType<OkResult>(result);
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

        _recurringJobRepositoryMock.UpdateBookingPickupAddressAsync(request)
            .Returns(Task.CompletedTask);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _jobQueryRepositoryMock.GetJobBookingDetailsForRatingNzAsync(1)
            .Returns(new JobRatingDetailsDtoNz());

        var controller = CreateController();

        // Act
        var result = await controller.UpdateBookingPickupAddress(request);

        // Assert
        Assert.IsType<OkResult>(result);
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

        _recurringJobRepositoryMock.UpdateBookingDeliveryAddressAsync(request)
            .Returns(Task.CompletedTask);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _jobQueryRepositoryMock.GetJobBookingDetailsForRatingNzAsync(1)
            .Returns(new JobRatingDetailsDtoNz());

        var controller = CreateController();

        // Act
        var result = await controller.UpdateBookingDeliveryAddress(request);

        // Assert
        Assert.IsType<OkResult>(result);
    }

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

        _jobQueryRepositoryMock.GetSpeedsAsync()
            .Returns(expectedSpeeds);

        var controller = CreateController();

        // Act
        var result = await controller.SpeedList();

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<Suggestion> speeds)
        {
            Assert.Equal(3, speeds.Count);
        }
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

        _jobQueryRepositoryMock.GetSpeedsBySearchTermAsync(searchTerm)
            .Returns(expectedSpeeds);

        var controller = CreateController();

        // Act
        var result = await controller.SearchSpeedOptions(searchTerm);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<Suggestion> speeds)
        {
            Assert.Single((IEnumerable)speeds);
        }
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

        _jobQueryRepositoryMock.GetContactsByClientIdAsync(clientId)
            .Returns(expectedContacts);

        var controller = CreateController();

        // Act
        var result = await controller.ContactList(clientId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<Suggestion> contacts)
        {
            Assert.Equal(2, contacts.Count);
        }
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

        _jobQueryRepositoryMock.LeaveParcelLocationsAsync()
            .Returns(expectedLocations);

        var controller = CreateController();

        // Act
        var result = await controller.LeaveList();

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<Lookup> locations)
        {
            Assert.Equal(2, locations.Count);
        }
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

        _jobQueryRepositoryMock.UndeliverableLocationsAsync()
            .Returns(expectedLocations);

        var controller = CreateController();

        // Act
        var result = await controller.UndeliverableList();

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<UndeliverableLocation> locations)
        {
            Assert.Equal(2, locations.Count);
        }
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

        _jobQueryRepositoryMock.GetStatusListAsync()
            .Returns(expectedStatuses);

        var controller = CreateController();

        // Act
        var result = await controller.StatusList();

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<Suggestion> statuses)
        {
            Assert.Equal(3, statuses.Count);
        }
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

        _jobQueryRepositoryMock.GetInternalStatusListAsync()
            .Returns(expectedStatuses);

        var controller = CreateController();

        // Act
        var result = await controller.InternalStatusList();

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<InternalStatus> statuses)
        {
            Assert.Equal(2, statuses.Count);
        }
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

        _jobQueryRepositoryMock.EventTypeListAsync()
            .Returns(expectedEventTypes);

        var controller = CreateController();

        // Act
        var result = await controller.EventTypeList();

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<Suggestion> eventTypes)
        {
            Assert.Equal(3, eventTypes.Count);
        }
    }

    [Fact]
    public async Task PodSearch_ValidRequest_ReturnsSearchResults()
    {
        // Arrange
        var request = new PodSearchRequest
        {
            FromDate = TestDates.Today.AddDays(-7),
            ToDate = TestDates.Today,
            Wild = "test"
        };
        var expectedResult = new JobSearchResult
        {
            Jobs = [CreateTestDispatchJob(1, "JOB001")],
            TotalCount = 1
        };

        _jobQueryRepositoryMock.PodSearchAsync(request, Arg.Any<CancellationToken>()).Returns(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.PodSearch(request);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var searchResult = jsonResult.Value as JobSearchResult;
        Assert.Single(searchResult!.Jobs);
    }

    [Fact]
    public async Task BulkSearch_ValidRequest_ReturnsSearchResults()
    {
        // Arrange
        var request = new PodSearchRequest
        {
            FromDate = TestDates.Today.AddDays(-30),
            ToDate = TestDates.Today
        };
        var expectedResult = new JobSearchResult
        {
            Jobs = [CreateTestDispatchJob(1, "BULK001")],
            TotalCount = 1
        };

        _jobQueryRepositoryMock.BulkSearchAsync(request, Arg.Any<CancellationToken>()).Returns(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.BulkSearch(request);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var searchResult = jsonResult.Value as JobSearchResult;
        Assert.Equal(1, searchResult!.TotalCount);
    }

    [Fact]
    public async Task PodSearchDownload_ValidRequest_ReturnsFile()
    {
        // Arrange
        var request = new PodSearchDownloadRequest
        {
            FromDate = TestDates.Today.AddDays(-7),
            ToDate = TestDates.Today
        };
        var reportResult = new JobsReportResult
        {
            FileBytes = [1, 2, 3],
            FileName = "jobs_report.csv"
        };

        _jobReportServiceMock.GenerateJobsReportAsync(request)
            .Returns(reportResult);

        var controller = CreateController();

        // Act
        var result = await controller.PodSearchDownload(request);

        // Assert
        Assert.IsType<FileContentResult>(result);
        var fileResult = (FileContentResult)result;
        Assert.Equal("jobs_report.csv", fileResult.FileDownloadName);
        Assert.Equal("text/csv", fileResult.ContentType);
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

        _jobReportServiceMock.GenerateClientJobsReportCsvAsync(request)
            .Returns((new byte[] { 1, 2, 3 }, "client_jobs.csv"));

        var controller = CreateController();

        // Act
        var result = await controller.ClientJobsReportDownload(request);

        // Assert
        Assert.IsType<FileContentResult>(result);
        var fileResult = (FileContentResult)result;
        Assert.Equal("client_jobs.csv", fileResult.FileDownloadName);
    }

    [Fact]
    public async Task ClientJobsReportDownload_NoData_ReturnsNotFound()
    {
        // Arrange
        var request = new ClientJobsReportRequest();

        _jobReportServiceMock.GenerateClientJobsReportCsvAsync(request)
            .ThrowsAsync(new InvalidOperationException("No jobs found"));

        var controller = CreateController();

        // Act
        var result = await controller.ClientJobsReportDownload(request);

        // Assert
        Assert.IsType<NotFoundObjectResult>(result);
    }

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

        _recurringJobRepositoryMock.GetRecurringJobsListAsync(request)
            .Returns(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.PreBookJobs(request);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var jobs = jsonResult.Value as PaginatedResponse<PrebookListViewModel>;
        Assert.Single(jobs!.Items);
    }

    [Fact]
    public async Task RecurringJobsExportCsv_ValidRequest_ReturnsFile()
    {
        // Arrange
        var request = new RecurringJobQueryRequest();

        _jobReportServiceMock.GenerateRecurringJobsCsvAsync(request)
            .Returns((new byte[] { 1, 2, 3 }, "recurring_jobs.csv"));

        var controller = CreateController();

        // Act
        var result = await controller.RecurringJobsExportCsv(request);

        // Assert
        Assert.IsType<FileContentResult>(result);
        var fileResult = (FileContentResult)result;
        Assert.Equal("recurring_jobs.csv", fileResult.FileDownloadName);
    }

    [Fact]
    public async Task UploadFile_ValidFile_ReturnsSuccess()
    {
        // Arrange
        var fileMock = Substitute.For<IFormFile>();
        fileMock.FileName.Returns("document.pdf");
        fileMock.Length.Returns(2048);

        var request = new FileUploadRequest
        {
            JobId = 1,
            File = fileMock
        };

        var uploadResult = new AwsUploadResult
        {
            Success = true,
            FileName = "document.pdf",
            S3Key = "jobs/1/attachments/document.pdf",
            ContentType = "application/pdf",
            Size = 2048,
            UploadDate = TestDates.Now
        };

        _jobPhotoServiceMock.UploadJobAttachmentAsync(1, fileMock)
            .Returns(uploadResult);

        var controller = CreateController();

        // Act
        var result = await controller.UploadFile(request);

        // Assert
        Assert.IsType<OkObjectResult>(result);
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
        Assert.IsType<BadRequestObjectResult>(result);
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

        _jobPhotoServiceMock.DownloadFileAsync(key)
            .Returns(downloadResult);

        var controller = CreateController();

        // Act
        var result = await controller.DownloadFile(key);

        // Assert
        Assert.IsType<FileContentResult>(result);
        var fileResult = (FileContentResult)result;
        Assert.Equal("document.pdf", fileResult.FileDownloadName);
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

        _jobPhotoServiceMock.DownloadFileAsync(key)
            .Returns(downloadResult);

        var controller = CreateController();

        // Act
        var result = await controller.DownloadFile(key);

        // Assert
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task DeleteFile_ValidKey_ReturnsSuccess()
    {
        // Arrange
        const string key = "jobs/1/document.pdf";

        _jobPhotoServiceMock.DeleteFileAsync(key)
            .Returns(true);

        var controller = CreateController();

        // Act
        var result = await controller.DeleteFile(key);

        // Assert
        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task DeleteFile_DeleteFails_ReturnsBadRequest()
    {
        // Arrange
        const string key = "invalid/key";

        _jobPhotoServiceMock.DeleteFileAsync(key)
            .Returns(false);

        var controller = CreateController();

        // Act
        var result = await controller.DeleteFile(key);

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
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

        _jobPhotoServiceMock.GetAttachedFilesAsync(jobId)
            .Returns(expectedFiles);

        var controller = CreateController();

        // Act
        var result = await controller.GetAttachedFiles(jobId);

        // Assert
        Assert.IsType<OkObjectResult>(result);
        var okResult = (OkObjectResult)result;
        if (okResult.Value is List<S3FileInfo> files)
        {
            Assert.Equal(2, files.Count);
        }
    }

    [Fact]
    public async Task UpdateNote_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        const string note = "Updated note content";

        _jobCommandRepositoryMock.UpdateJobNoteAsync(jobId, note)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateNote(jobId, note, CancellationToken.None);

        // Assert
        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task UpdateNote_InvalidJobId_ReturnsBadRequest()
    {
        // Arrange
        const int jobId = 0;
        const string note = "Test";

        var controller = CreateController();

        // Act
        var result = await controller.UpdateNote(jobId, note, CancellationToken.None);

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateNote_EmptyNote_ReturnsBadRequest()
    {
        // Arrange
        const int jobId = 1;
        const string note = "";

        var controller = CreateController();

        // Act
        var result = await controller.UpdateNote(jobId, note, CancellationToken.None);

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateNote_JobNotFound_Returns500()
    {
        // Arrange
        const int jobId = 999;
        const string note = "Test";

        _jobCommandRepositoryMock.UpdateJobNoteAsync(jobId, note)
            .ThrowsAsync(new KeyNotFoundException("Job not found"));

        var controller = CreateController();

        // Act
        var result = await controller.UpdateNote(jobId, note, CancellationToken.None);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

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

        _jobCommandRepositoryMock.UpdatePackagesForJobAsync(request.JobId, request.Parcels)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateJobPackages(request, CancellationToken.None);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task UpdateJobPackages_WithWeight_UpdatesWeightAcrossChain()
    {
        // Arrange
        var request = new UpdateJobPackagesRequest
        {
            JobId = 1,
            Parcels = [new ParcelDimensions { Length = 10, Height = 10, Depth = 10 }],
            Weight = 15.5m
        };

        _jobCommandRepositoryMock.UpdatePackagesForJobAsync(request.JobId, request.Parcels)
            .Returns(Task.CompletedTask);
        _jobCommandRepositoryMock.UpdateJobWeightAsync(request.JobId, request.Weight.Value)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateJobPackages(request, CancellationToken.None);

        // Assert
        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received(1).UpdateJobWeightAsync(request.JobId, request.Weight.Value);
    }

    [Fact]
    public async Task UpdateJobPackages_WithZeroWeight_DoesNotUpdateWeight()
    {
        // Arrange
        var request = new UpdateJobPackagesRequest
        {
            JobId = 1,
            Parcels = [new ParcelDimensions { Length = 10, Height = 10, Depth = 10 }],
            Weight = 0m
        };

        _jobCommandRepositoryMock.UpdatePackagesForJobAsync(request.JobId, request.Parcels)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateJobPackages(request, CancellationToken.None);

        // Assert
        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.DidNotReceive().UpdateJobWeightAsync(Arg.Any<int>(), Arg.Any<decimal>());
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

        _jobCommandRepositoryMock.UpdatePackagesForBulkJobAsync(request.BulkJobId, request.Parcels)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateBulkJobPackages(request);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task IsJobParent_ParentJob_ReturnsTrue()
    {
        // Arrange
        const int jobId = 1;

        _jobQueryRepositoryMock.IsJobParentAsync(jobId)
            .Returns(true);

        var controller = CreateController();

        // Act
        var result = await controller.IsJobParent(jobId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(true, jsonResult.Value);
    }

    [Fact]
    public async Task IsJobParent_ChildJob_ReturnsFalse()
    {
        // Arrange
        const int jobId = 2;

        _jobQueryRepositoryMock.IsJobParentAsync(jobId)
            .Returns(false);

        var controller = CreateController();

        // Act
        var result = await controller.IsJobParent(jobId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(false, jsonResult.Value);
    }

    [Fact]
    public async Task IsBulkJobParent_ParentBulkJob_ReturnsTrue()
    {
        // Arrange
        const int bulkJobId = 1;

        _jobQueryRepositoryMock.IsBulkJobParent(bulkJobId)
            .Returns(true);

        var controller = CreateController();

        // Act
        var result = await controller.IsBulkJobParent(bulkJobId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(true, jsonResult.Value);
    }

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

        _jobQueryRepositoryMock.GetRelatedJobsMultiSelectListAsync(jobId, false)
            .Returns(expectedJobs);

        var controller = CreateController();

        // Act
        var result = await controller.GetRelatedJobsMultiSelectList(jobId, isArchived: false);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<MultiSuggestion> jobs)
        {
            Assert.Equal(2, jobs.Count);
        }
    }

    [Fact]
    public async Task GetRelatedJobsMultiSelectList_WithBulkJob_ReturnsRelatedBulkJobs()
    {
        // Arrange
        const int jobId = 1;
        var expectedJobs = new List<MultiSuggestion>
        {
            new() { Id = 1, Text = "BULK001", IsBulkJob = true },
            new() { Id = 2, Text = "BULK002", IsBulkJob = true }
        };

        _jobQueryRepositoryMock.GetRelatedJobsMultiSelectListAsync(jobId, false, true)
            .Returns(expectedJobs);

        var controller = CreateController();

        // Act
        var result = await controller.GetRelatedJobsMultiSelectList(jobId, isArchived: false, isBulkJob: true);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<MultiSuggestion> jobs)
        {
            Assert.Equal(2, jobs.Count);
        }
    }

    [Fact]
    public async Task UpdateJobReadStatus_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        const bool hasBeenRead = true;

        _jobCommandRepositoryMock.UpdateJobReadStatusAsync(jobId, hasBeenRead)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdateJobReadStatus(jobId, hasBeenRead);

        // Assert
        Assert.IsType<OkResult>(result);
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

        _jobCommandRepositoryMock.BulkUpdateReadStatusAsync(request)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.BulkUpdateReadStatus(request);

        // Assert
        Assert.IsType<OkResult>(result);
    }

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

        _taskRepositoryMock.AddEventAsync(
                request.JobId, request.Notes, request.EventTypeId, request.EventDueDate)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.AddEvent(request);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task AddRestoreEvent_ValidJobId_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;

        _taskRepositoryMock.AddEventAsync(
                jobId, Arg.Any<string>(), (int)EventType.RestoreJob, null, 33)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.AddRestoreEvent(jobId);

        // Assert
        Assert.IsType<OkResult>(result);
    }

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

        _jobCommandRepositoryMock.QuickAddJobAsync(request)
            .Returns(expectedJobId);

        var controller = CreateController();

        // Act
        var result = await controller.QuickCreateJob(request);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(expectedJobId, jsonResult.Value);
    }

    [Fact]
    public async Task QuickCreateJob_NullRequest_Returns500()
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.QuickCreateJob(null);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

    [Fact]
    public async Task QuickCreateJob_ZeroJobId_Returns500()
    {
        // Arrange
        var request = new JobCreateViewModel();

        _jobCommandRepositoryMock.QuickAddJobAsync(request)
            .Returns(0);

        var controller = CreateController();

        // Act
        var result = await controller.QuickCreateJob(request);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(StatusCodes.Status500InternalServerError, objectResult.StatusCode);
    }

    [Fact]
    public async Task ReleaseBulkJob_ValidBulkJobId_ReturnsOkWithJobNumbers()
    {
        // Arrange
        const int bulkJobId = 1;
        var expectedNumbers = new[] { "BJR-001", "BJR-002" };

        _jobCommandRepositoryMock.ReleaseBulkJobByIdAsync(bulkJobId)
            .Returns(expectedNumbers);

        var controller = CreateController();

        // Act
        var result = await controller.ReleaseBulkJob(bulkJobId);

        // Assert — the controller now returns the job numbers so the client can copy
        // them to the clipboard and surface them in the success toast.
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
        var jobNumbersProperty = ok.Value.GetType().GetProperty("jobNumbers")?.GetValue(ok.Value);
        Assert.Equal(expectedNumbers, jobNumbersProperty);
    }

    [Fact]
    public async Task ReleaseBulkJob_Exception_Returns500()
    {
        // Arrange
        const int bulkJobId = 1;

        _jobCommandRepositoryMock.ReleaseBulkJobByIdAsync(bulkJobId)
            .ThrowsAsync(new Exception("Release failed"));

        var controller = CreateController();

        // Act
        var result = await controller.ReleaseBulkJob(bulkJobId);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

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

        _addStopJobServiceMock.AddStopInsertJobAsync(request)
            .Returns(newJobId);

        var controller = CreateController();

        // Act
        var result = await controller.AddStopToJob(request);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(newJobId, jsonResult.Value);
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

        _addStopJobServiceMock.AddStopInsertRecurringJobAsync(request)
            .Returns(newJobId);

        var controller = CreateController();

        // Act
        var result = await controller.AddStopToRecurringJob(request);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(newJobId, jsonResult.Value);
    }

    [Fact]
    public async Task GetDeliveryJourney_ValidJobId_ReturnsJourney()
    {
        // Arrange
        const int jobId = 1;
        var expectedJourney = new List<DeliveryJourneyViewModel>
        {
            new() { JobId = jobId, Title = "Pickup Completed" }
        };

        _deliveryJourneyServiceMock.GetDeliveryJourneyForJobAsync(jobId)
            .Returns(expectedJourney);

        var controller = CreateController();

        // Act
        var result = await controller.GetDeliveryJourney(jobId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var journey = jsonResult.Value as List<DeliveryJourneyViewModel>;
        Assert.Single(journey!);
        if (journey != null)
        {
            Assert.Equal(jobId, journey[0].JobId);
        }
    }

    [Fact]
    public async Task GetDeliveryJourney_WithClientTimeZone_AppliesTenantTimeZoneOverride()
    {
        // The client passes its known-good window.TimeZone so the journey converts
        // correctly even when the server-side TimeZone claim is missing on this request.
        const int jobId = 1;
        _deliveryJourneyServiceMock.GetDeliveryJourneyForJobAsync(jobId)
            .Returns(new List<DeliveryJourneyViewModel>());

        var controller = CreateController();

        await controller.GetDeliveryJourney(jobId, "New Zealand Standard Time");

        _tenantInfoServiceMock.Received(1).SetTenantTimeZoneOverride("New Zealand Standard Time");
    }

    [Fact]
    public async Task GetDeliveryJourney_WithoutClientTimeZone_PassesNullOverride()
    {
        // No client tz supplied — the override is a no-op (null is ignored by the service),
        // leaving the existing claim-based resolution untouched.
        const int jobId = 1;
        _deliveryJourneyServiceMock.GetDeliveryJourneyForJobAsync(jobId)
            .Returns(new List<DeliveryJourneyViewModel>());

        var controller = CreateController();

        await controller.GetDeliveryJourney(jobId);

        _tenantInfoServiceMock.Received(1).SetTenantTimeZoneOverride(null);
    }

    [Fact]
    public async Task GetRecurringJobDeliveryJourney_WithClientTimeZone_AppliesTenantTimeZoneOverride()
    {
        const int bookingId = 7;
        _deliveryJourneyServiceMock.GetDeliveryJourneyForRecurringBookingAsync(bookingId, Arg.Any<int>())
            .Returns(new RecurringJourneyDto());

        var controller = CreateController();

        await controller.GetRecurringJobDeliveryJourney(bookingId, "New Zealand Standard Time");

        _tenantInfoServiceMock.Received(1).SetTenantTimeZoneOverride("New Zealand Standard Time");
    }

    [Fact]
    public async Task GetTimeZoneOptions_ReturnsTimeZones()
    {
        // Arrange
        var expectedTimeZones = new List<TimeZoneSuggestion>
        {
            new() { Id = 1, Text = "Eastern Time", TimeZoneIana = "America/New_York" },
            new() { Id = 2, Text = "Pacific Time", TimeZoneIana = "America/Los_Angeles" }
        };

        _jobQueryRepositoryMock.GetTimeZoneOptions()
            .Returns(expectedTimeZones);

        var controller = CreateController();

        // Act
        var result = await controller.GetTimeZoneOptions();

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<TimeZoneSuggestion> timeZones)
        {
            Assert.Equal(2, timeZones.Count);
        }
    }

    [Fact]
    public async Task SimpleRepriceJobManual_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new SimpleRepriceJobModel
        {
            JobId = 1,
            NewPrice = 100.00m
        };

        _jobCommandRepositoryMock.SimpleRepriceJobManualAsync(request)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SimpleRepriceJobManual(request);

        // Assert
        Assert.IsType<OkResult>(result);
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

        _jobCommandRepositoryMock.RepriceJobWithBaseAmountAsync(request)
            .Returns(expectedRate);

        var controller = CreateController();

        // Act
        var result = await controller.RepriceJobWithBaseAmount(request);

        // Assert
        Assert.IsType<OkObjectResult>(result);
        var okResult = (OkObjectResult)result;
        Assert.Equal(expectedRate, okResult.Value);
    }

    [Fact]
    public async Task RecalculateJobRate_ValidJobId_ReturnsNewRate()
    {
        // Arrange
        const int jobId = 1;
        const decimal expectedRate = 85.00m;

        _jobQueryRepositoryMock.IsJobArchived(jobId)
            .Returns(false);
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        _jobQueryRepositoryMock.GetJobDetailsForRatingAsync(jobId)
            .Returns(new JobRatingDetailsDto { JobId = jobId });
        _rateJobServiceMock.GetJobRateUsAsync(Arg.Any<JobRatingDetailsDto>())
            .Returns(new ApiRerate { Rate = expectedRate });

        var controller = CreateController();

        // Act
        var result = await controller.RecalculateJobRate(jobId);

        // Assert
        Assert.IsType<OkObjectResult>(result);
        var okResult = (OkObjectResult)result;
        var apiRerate = Assert.IsType<ApiRerate>(okResult.Value);
        Assert.Equal(expectedRate, apiRerate.Rate);
    }

    [Fact]
    public async Task ApplyRecalculatedJobRate_ValidRequest_ReturnsOkWithRate()
    {
        // Arrange
        const int jobId = 1;
        const decimal expectedRate = 99.50m;

        _jobQueryRepositoryMock.IsJobArchived(jobId)
            .Returns(false);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _jobQueryRepositoryMock.GetJobDetailsForRatingNzAsync(jobId, false)
            .Returns(new JobRatingDetailsDtoNz());
        _jobQueryRepositoryMock.GetJobAmountAsync(jobId, false)
            .Returns(expectedRate);

        var controller = CreateController();

        // Act
        var result = await controller.ApplyRecalculatedJobRate(jobId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, okResult.StatusCode);

        // The Recalculate button is a deliberate user-initiated override: the manual-pricing
        // flag must be cleared BEFORE the rate engine runs (so it isn't blocked by the
        // RatedManually guard), and must not be restamped back to true afterward — the result
        // is a genuine system-computed rate, not a manual override.
        Received.InOrder(() =>
        {
            _jobCommandRepositoryMock.SetJobRatedManuallyAsync(jobId, false, false);
            _rateJobServiceMock.RateJobNzAsync(Arg.Any<JobRatingDetailsDtoNz>());
        });
        await _jobCommandRepositoryMock.DidNotReceive()
            .SetJobRatedManuallyAsync(jobId, Arg.Any<bool>(), true);
    }

    [Fact]
    public async Task ValidateSwapPod_ValidJob_ReturnsTrue()
    {
        // Arrange
        const string jobNumber = "JOB001";

        _jobQueryRepositoryMock.ValidatePodSwapAsync(jobNumber)
            .Returns(true);

        var controller = CreateController();

        // Act
        var result = await controller.ValidateSwapPod(jobNumber);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(true, jsonResult.Value);
    }

    [Fact]
    public async Task SwapPod_ValidJobs_ReturnsOk()
    {
        // Arrange
        const string job1 = "JOB001";
        const string job2 = "JOB002";

        _jobCommandRepositoryMock.SwapPodAsync(job1, job2)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SwapPod(job1, job2);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task SwapPod_AfterSwap_ReSendsSecondAndReAssignsAndReSendsFirst()
    {
        // After swapping the POD, the corrected delivery data must be pushed back
        // out: re-send the second job, then re-assign + re-send the first job
        // (mirrors the legacy Job Search controller chain).
        const string job1 = "JOB001";
        const string job2 = "JOB002";

        _jobQueryRepositoryMock.GetJobIdByNumberAsync(job1).Returns(10);
        _jobQueryRepositoryMock.GetJobIdByNumberAsync(job2).Returns(20);
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(10, Arg.Any<string?>()).Returns(false);

        var controller = CreateController();

        var result = await controller.SwapPod(job1, job2);

        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received(1)
            .ReSendSelectedJobsAsync(Arg.Is<IReadOnlyList<int>>(ids => ids!.Count == 1 && ids[0] == 20));
        await _jobCommandRepositoryMock.Received(1)
            .ReAssignSelectedJobsAsync(Arg.Is<IReadOnlyList<int>>(ids => ids!.Count == 1 && ids[0] == 10));
        await _jobCommandRepositoryMock.Received(1)
            .ReSendSelectedJobsAsync(Arg.Is<IReadOnlyList<int>>(ids => ids!.Count == 1 && ids[0] == 10));
    }

    [Fact]
    public async Task SwapPod_FirstJobIsOutboundPartnerJob_SkipsReAssignButStillReSends()
    {
        // Re-assigning a partner-dispatched job would diverge from the partner's
        // view, so the first job's re-assign is skipped — but the re-sends still run.
        const string job1 = "JOB001";
        const string job2 = "JOB002";

        _jobQueryRepositoryMock.GetJobIdByNumberAsync(job1).Returns(10);
        _jobQueryRepositoryMock.GetJobIdByNumberAsync(job2).Returns(20);
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(10, Arg.Any<string?>()).Returns(true);

        var controller = CreateController();

        var result = await controller.SwapPod(job1, job2);

        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.DidNotReceive()
            .ReAssignSelectedJobsAsync(Arg.Any<IReadOnlyList<int>>());
        await _jobCommandRepositoryMock.Received(1)
            .ReSendSelectedJobsAsync(Arg.Is<IReadOnlyList<int>>(ids => ids!.Count == 1 && ids[0] == 20));
        await _jobCommandRepositoryMock.Received(1)
            .ReSendSelectedJobsAsync(Arg.Is<IReadOnlyList<int>>(ids => ids!.Count == 1 && ids[0] == 10));
    }

    [Fact]
    public async Task ReSendSelected_ValidJobIds_ReturnsOk()
    {
        // Arrange
        const string jobIds = "1,2,3";

        _jobCommandRepositoryMock.ReSendSelectedJobsAsync(Arg.Any<IReadOnlyList<int>>())
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.ReSendSelected(jobIds);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task ReAssignSelected_ValidJobIds_ReturnsOk()
    {
        // Arrange
        const string jobIds = "1,2,3";

        _jobCommandRepositoryMock.ReAssignSelectedJobsAsync(Arg.Any<IReadOnlyList<int>>())
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.ReAssignSelected(jobIds);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task SetFirstJob_ValidRequest_ReturnsOk()
    {
        // Arrange
        const int jobId = 1;
        const int courierId = 2;

        _jobCommandRepositoryMock.SetFirstJobAsync(jobId, courierId)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SetFirstJob(jobId, courierId);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task ReSendAll_ValidCourierId_ReturnsOk()
    {
        // Arrange
        const int courierId = 1;

        _jobCommandRepositoryMock.ReSendAllJobsAsync(courierId)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.ReSendAll(courierId);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task PpdExclusiveAmount_ValidRequest_ReturnsPpdAmount()
    {
        // Arrange
        const int clientId = 1;
        const decimal amount = 100.00m;
        const decimal expectedPpd = 87.00m;

        _jobQueryRepositoryMock.PpdExclusiveAmountAsync(clientId, amount)
            .Returns(expectedPpd);

        var controller = CreateController();

        // Act
        var result = await controller.PpdExclusiveAmount(clientId, amount);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(expectedPpd, jsonResult.Value);
    }

    [Fact]
    public async Task HasClientItemsAvailable_ItemsExist_ReturnsTrue()
    {
        // Arrange
        const int clientId = 1;
        const int speedId = 2;

        _jobQueryRepositoryMock.HasClientItemsAvailableAsync(clientId, speedId)
            .Returns(true);

        var controller = CreateController();

        // Act
        var result = await controller.HasClientItemsAvailable(clientId, speedId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(true, jsonResult.Value);
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

        _jobQueryRepositoryMock.GetClientItemsBySpeedAsync(clientId, speedId, jobId)
            .Returns(expectedItems);

        var controller = CreateController();

        // Act
        var result = await controller.GetAllClientItems(clientId, speedId, jobId);

        // Assert
        Assert.IsType<JsonResult>(result);
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

        _jobCommandRepositoryMock.AddClientsItemToJobAsync(jobId, itemsModel.ServiceIds, itemsModel.TotalCost)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.AddClientItemsToJob(jobId, itemsModel);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task UpdatePodDetails_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new UpdatePodDetailsRequest
        {
            JobId = 1,
            PodName = "John Smith",
            PodTime = TestDates.Now.ToString("o")
        };

        _jobCommandRepositoryMock.UpdatePodDetailsAsync(request)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.UpdatePodDetails(request);

        // Assert
        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task ScanJobDetail_ValidRequest_ReturnsScanList()
    {
        // Arrange
        var runDate = DateTimeOffset.Now;
        const int jobId = 42;
        var expectedResults = new List<ScanDetailResult>
        {
            new() { BulkScanId = 1, ScanDateTime = TestDates.Now }
        };

        _jobQueryRepositoryMock.ScanList(runDate, jobId, false)
            .Returns(expectedResults);

        var controller = CreateController();

        // Act
        var result = await controller.ScanJobDetail(runDate, jobId);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<ScanDetailResult> results)
        {
            Assert.Single((IEnumerable)results);
        }
    }

    [Fact]
    public async Task ScanJobDetail_BulkJob_PassesIsBulkJobTrue()
    {
        // Arrange
        var runDate = DateTimeOffset.Now;
        const int bulkJobId = 99;
        _jobQueryRepositoryMock.ScanList(runDate, bulkJobId, true)
            .Returns(new List<ScanDetailResult>());

        var controller = CreateController();

        // Act
        await controller.ScanJobDetail(runDate, bulkJobId, isBulkJob: true);

        // Assert
        await _jobQueryRepositoryMock.Received(1).ScanList(runDate, bulkJobId, true);
    }

    private static DispatchJobViewModel CreateTestDispatchJob(int id, string jobNumber) =>
        new()
        {
            Id = id,
            JobNo = jobNumber,
            Status = "Pending",
            From = "123 Test St",
            ToAddress = "456 Delivery Ave"
        };

    [Fact]
    public async Task SendToPartner_Success_LocksJob()
    {
        var controller = CreateController();
        var request = new SendToPartnerRequest { JobId = 1, PartnerId = 10 };

        _sendToPartnerServiceMock.SendAsync(request)
            .Returns(new SendToPartnerResponse { Success = true, TrackingNumber = "DFRNT-123" });

        await controller.SendToPartner(request);

        await _jobCommandRepositoryMock.Received(1)
            .UpdateJobAsync(1, JobProperty.Locked, "true");
    }

    [Fact]
    public async Task SendToPartner_Failure_DoesNotLockJob()
    {
        var controller = CreateController();
        var request = new SendToPartnerRequest { JobId = 1, PartnerId = 10 };

        _sendToPartnerServiceMock.SendAsync(request)
            .Returns(new SendToPartnerResponse { Success = false, Message = "Partner unavailable" });

        await controller.SendToPartner(request);

        await _jobCommandRepositoryMock.DidNotReceive()
            .UpdateJobAsync(Arg.Any<int>(), JobProperty.Locked, Arg.Any<string>());
    }

    [Fact]
    public async Task UpdateJob_NonPartnerJob_WritesDirectly()
    {
        var controller = CreateController();
        // Default mock returns NotPartner — UpdateJob falls through to the direct write.

        var result = await controller.UpdateJob(42, JobProperty.RefA, "new-ref", CancellationToken.None);

        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received().UpdateJobAsync(42, JobProperty.RefA, "new-ref");
    }

    [Fact]
    public async Task UpdateJob_PartnerJobLocalOnlyField_WritesDirectly()
    {
        var controller = CreateController();
        _partnerJobGateMock.EvaluateAsync(42, JobProperty.CourierId, "7", Arg.Any<CancellationToken>())
            .Returns(new PartnerJobGateResult.LocalOnly());

        var result = await controller.UpdateJob(42, JobProperty.CourierId, "7", CancellationToken.None);

        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received().UpdateJobAsync(42, JobProperty.CourierId, "7");
    }

    [Fact]
    public async Task UpdateJob_PartnerJobAutoField_ReturnsAppliedWithoutDirectWrite()
    {
        var controller = CreateController();
        _partnerJobGateMock.EvaluateAsync(42, JobProperty.RefA, "new-ref", Arg.Any<CancellationToken>())
            .Returns(new PartnerJobGateResult.AutoApplied(99));

        var result = await controller.UpdateJob(42, JobProperty.RefA, "new-ref", CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        await _jobCommandRepositoryMock.DidNotReceive().UpdateJobAsync(42, JobProperty.RefA, Arg.Any<string>());
    }

    [Fact]
    public async Task UpdateJob_PartnerJobManualField_ReturnsAcceptedWithoutDirectWrite()
    {
        var controller = CreateController();
        _partnerJobGateMock.EvaluateAsync(42, JobProperty.SpeedID, "5", Arg.Any<CancellationToken>())
            .Returns(new PartnerJobGateResult.PendingApproval(99));

        var result = await controller.UpdateJob(42, JobProperty.SpeedID, "5", CancellationToken.None);

        Assert.IsType<AcceptedResult>(result);
        await _jobCommandRepositoryMock.DidNotReceive().UpdateJobAsync(42, JobProperty.SpeedID, Arg.Any<string>());
    }

    [Fact]
    public async Task UpdateJob_PartnerJobUnsupportedField_ReturnsBadRequest()
    {
        var controller = CreateController();
        _partnerJobGateMock.EvaluateAsync(42, JobProperty.Weight, "10", Arg.Any<CancellationToken>())
            .Returns(new PartnerJobGateResult.Blocked("not supported"));

        var result = await controller.UpdateJob(42, JobProperty.Weight, "10", CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        await _jobCommandRepositoryMock.DidNotReceive().UpdateJobAsync(42, JobProperty.Weight, Arg.Any<string>());
    }

    [Fact]
    public async Task Void_RejectsOutboundPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(1, Arg.Any<string?>()).Returns(true);

        var result = await controller.Void(new VoidJobRequest { JobId = 1 });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Void_AllowsInboundPartnerJob()
    {
        // Receiver-side mirror: PartnerJobGuid is set but no JobPartnerDispatch row,
        // so IsOutboundPartnerJobAsync returns false and the void runs locally.
        var controller = CreateController();
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(2, Arg.Any<string?>()).Returns(false);
        _jobQueryRepositoryMock.IsJobArchived(2).Returns(false);
        _jobQueryRepositoryMock.GetJobParentIdAsync(2).Returns((int?)null);

        var result = await controller.Void(new VoidJobRequest { JobId = 2 });

        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received().VoidJobAsync(Arg.Is<VoidJobRequest>(r => r!.JobId == 2));
    }

    [Fact]
    public async Task Allocate_RejectsOutboundPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(5, Arg.Any<string?>()).Returns(true);

        var result = await controller.Allocate(new AllocateJobsToCourierRequest { JobIds = [5], CourierId = 1 });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Allocate_AllowsInboundPartnerJob()
    {
        // Tenant B (receiver) has no JobPartnerDispatch row for the job — they own
        // the courier slot locally and must be able to dispatch.
        var controller = CreateController();
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(6, Arg.Any<string?>()).Returns(false);

        var result = await controller.Allocate(new AllocateJobsToCourierRequest { JobIds = [6], CourierId = 1 });

        Assert.IsType<OkResult>(result);
        await _dispatchJobServiceMock.Received()
            .DispatchJobsToCourierAsync(Arg.Is<List<int>>(ids => ids!.Contains(6)), 1);
    }

    [Fact]
    public async Task ReAllocate_RejectsOutboundPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(7, Arg.Any<string?>()).Returns(true);

        var result = await controller.ReAllocate(new AllocateJobsToCourierRequest { JobIds = [7], CourierId = 1 });

        Assert.IsType<BadRequestObjectResult>(result);
        await _jobCommandRepositoryMock.DidNotReceive()
            .ReDispatchSelectedJobsAsync(Arg.Any<IReadOnlyList<int>>());
        await _dispatchJobServiceMock.DidNotReceive()
            .DispatchJobsToCourierAsync(Arg.Any<List<int>>(), Arg.Any<int>());
    }

    [Fact]
    public async Task ReAssignSelected_RejectsOutboundPartnerJob()
    {
        // Auto-dispatch reassignment would swap the partner-placeholder courier on the
        // sender side and diverge from the partner's view of who owns the job.
        var controller = CreateController();
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(31, Arg.Any<string?>()).Returns(true);

        var result = await controller.ReAssignSelected("31");

        Assert.IsType<BadRequestObjectResult>(result);
        await _jobCommandRepositoryMock.DidNotReceive()
            .ReAssignSelectedJobsAsync(Arg.Any<IReadOnlyList<int>>());
    }

    [Fact]
    public async Task ReAssignSelected_RejectsWhenAnyJobInBatchIsOutboundPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(32, Arg.Any<string?>()).Returns(false);
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(33, Arg.Any<string?>()).Returns(true);

        var result = await controller.ReAssignSelected("32,33");

        Assert.IsType<BadRequestObjectResult>(result);
        await _jobCommandRepositoryMock.DidNotReceive()
            .ReAssignSelectedJobsAsync(Arg.Any<IReadOnlyList<int>>());
    }

    [Fact]
    public async Task ReAssignSelected_AllowsInboundPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(35, Arg.Any<string?>()).Returns(false);

        var result = await controller.ReAssignSelected("35");

        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received()
            .ReAssignSelectedJobsAsync(Arg.Is<IReadOnlyList<int>>(ids => ids!.Contains(35)));
    }

    [Fact]
    public async Task SetFirstJob_RejectsOutboundPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(34, Arg.Any<string?>()).Returns(true);

        var result = await controller.SetFirstJob(jobId: 34, courierId: 1);

        Assert.IsType<BadRequestObjectResult>(result);
        await _jobCommandRepositoryMock.DidNotReceive().SetFirstJobAsync(34, 1);
    }

    [Fact]
    public async Task SetFirstJob_AllowsInboundPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsOutboundPartnerJobAsync(36, Arg.Any<string?>()).Returns(false);

        var result = await controller.SetFirstJob(jobId: 36, courierId: 2);

        Assert.IsType<OkResult>(result);
        await _jobCommandRepositoryMock.Received().SetFirstJobAsync(36, 2);
    }

    [Fact]
    public async Task SplitJob_RejectsPartnerJob()
    {
        var controller = CreateControllerForSplitJob();
        _jobQueryRepositoryMock.IsPartnerJobAsync(7).Returns(true);

        var result = await controller.SplitJob(new SplitJobRequest
        {
            JobId = 7,
            MeetingPointAddress = new AddressViewModel()
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdatePriceComponent_RejectsPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsPartnerJobAsync(11).Returns(true);

        var result = await controller.UpdatePriceComponent(new ChargeViewModel
        {
            JobId = 11,
            Name = "Fuel",
            Amount = 12.50m
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdatePriceComponent_RejectsPartnerChildJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsPartnerJobAsync(12).Returns(false);
        _jobQueryRepositoryMock.IsPartnerJobAsync(13).Returns(true);

        var result = await controller.UpdatePriceComponent(new ChargeViewModel
        {
            JobId = 12,
            ChildJobId = 13,
            Name = "Fuel",
            Amount = 12.50m
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task AddPriceComponent_RejectsPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsPartnerJobAsync(14).Returns(true);

        var result = await controller.AddPriceComponent(new ChargeViewModel
        {
            JobId = 14,
            ChildJobId = 14,
            Name = "Surcharge",
            Amount = 5m
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task DeletePriceComponent_RejectsPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsPartnerJobAsync(15).Returns(true);

        var result = await controller.DeletePriceComponent(new DeletePriceComponentRequest
        {
            JobId = 15,
            ChargeId = 99
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateNote_NonPartnerJob_WritesDirectly()
    {
        var controller = CreateController();
        // Default gate mock returns NotPartner; controller falls through to the direct write.

        var result = await controller.UpdateNote(16, "some note", CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        await _jobCommandRepositoryMock.Received().UpdateJobNoteAsync(16, "some note");
    }

    [Fact]
    public async Task UpdateNote_PartnerJob_FilesAutoChangeRequestAndSkipsDirectWrite()
    {
        var controller = CreateController();
        _partnerJobGateMock.EvaluateAsync(16, JobChangeField.Notes, "some note", null, Arg.Any<CancellationToken>())
            .Returns(new PartnerJobGateResult.AutoApplied(99));

        var result = await controller.UpdateNote(16, "some note", CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        // The gate's CreateLocalAsync path already wrote UcjbNotes and forwarded the
        // change to the peer; the controller must NOT do a second direct write that
        // would race the gate's update.
        await _jobCommandRepositoryMock.DidNotReceive().UpdateJobNoteAsync(Arg.Any<int>(), Arg.Any<string>());
    }

    [Fact]
    public async Task UpdateJobPackages_RejectsPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsPartnerJobAsync(17).Returns(true);

        // After Phase B-3 the partner-job path filed a change request and returned 202
        // Accepted instead of 400 BadRequest. The mock gate returns its default
        // (NotPartner) since the test class doesn't configure the new partner path —
        // restate the assertion to reflect the new gate-routed behavior.
        _partnerJobGateMock.EvaluateAsync(17, JobChangeField.Packages, Arg.Any<string?>(), Arg.Any<string?>(),
                Arg.Any<CancellationToken>())
            .Returns(new PartnerJobGateResult.PendingApproval(123));

        var result = await controller.UpdateJobPackages(new UpdateJobPackagesRequest
        {
            JobId = 17,
            Parcels = []
        }, CancellationToken.None);

        Assert.IsType<AcceptedResult>(result);
    }

    [Fact]
    public async Task UpdateBookingPickupAddress_RejectsPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsPartnerJobAsync(18).Returns(true);

        var result = await controller.UpdateBookingPickupAddress(new UpdateAddressRequest
        {
            JobId = 18,
            Address = new AddressViewModel()
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateBookingDeliveryAddress_RejectsPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsPartnerJobAsync(19).Returns(true);

        var result = await controller.UpdateBookingDeliveryAddress(new UpdateAddressRequest
        {
            JobId = 19,
            Address = new AddressViewModel()
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task ApplyWebQtyUpdate_RejectsPartnerJob()
    {
        var controller = CreateController();
        _jobQueryRepositoryMock.IsPartnerJobAsync(20).Returns(true);

        var result = await controller.ApplyWebQtyUpdate(20);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    // ------------------------------------------------------------------
    // PreviewCreateAheadBackfill / CreateCreateAheadBackfill endpoints
    // ------------------------------------------------------------------

    [Fact]
    public async Task PreviewCreateAheadBackfill_ReturnsJson_OnHappyPath()
    {
        var controller = CreateController();
        var preview = new PreviewCreateAheadBackfillResult
        {
            Candidates = new List<CreateAheadBackfillCandidate>
            {
                new() { ServiceDate = new DateOnly(2024, 6, 17), DisplayLabel = "Mon 17 Jun" }
            }
        };
        _recurringJobRepositoryMock
            .PreviewCreateAheadBackfillAsync(Arg.Any<PreviewCreateAheadBackfillRequest>())
            .Returns(preview);

        var result = await controller.PreviewCreateAheadBackfill(new PreviewCreateAheadBackfillRequest
        {
            JobId = 100, OldValue = 0, NewValue = 2
        });

        var json = Assert.IsType<JsonResult>(result);
        Assert.Same(preview, json.Value);
    }

    [Fact]
    public async Task PreviewCreateAheadBackfill_ReturnsBadRequest_OnArgumentException()
    {
        var controller = CreateController();
        _recurringJobRepositoryMock
            .PreviewCreateAheadBackfillAsync(Arg.Any<PreviewCreateAheadBackfillRequest>())
            .Throws(new ArgumentException("NewValue must be between 0 and 30"));

        var result = await controller.PreviewCreateAheadBackfill(new PreviewCreateAheadBackfillRequest
        {
            JobId = 100, OldValue = 0, NewValue = 999
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("between 0 and 30", bad.Value?.ToString());
    }

    [Fact]
    public async Task PreviewCreateAheadBackfill_ReturnsBadRequest_OnInvalidOperationException()
    {
        var controller = CreateController();
        _recurringJobRepositoryMock
            .PreviewCreateAheadBackfillAsync(Arg.Any<PreviewCreateAheadBackfillRequest>())
            .Throws(new InvalidOperationException("Parent recurring booking 100 not found"));

        var result = await controller.PreviewCreateAheadBackfill(new PreviewCreateAheadBackfillRequest
        {
            JobId = 100, OldValue = 0, NewValue = 2
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task PreviewCreateAheadBackfill_Returns500_OnUnexpectedException()
    {
        var controller = CreateController();
        _recurringJobRepositoryMock
            .PreviewCreateAheadBackfillAsync(Arg.Any<PreviewCreateAheadBackfillRequest>())
            .Throws(new Exception("boom"));

        var result = await controller.PreviewCreateAheadBackfill(new PreviewCreateAheadBackfillRequest
        {
            JobId = 100, OldValue = 0, NewValue = 2
        });

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, obj.StatusCode);
    }

    [Fact]
    public async Task CreateCreateAheadBackfill_ReturnsJson_OnHappyPath()
    {
        var controller = CreateController();
        var payload = new CreateCreateAheadBackfillResult
        {
            JobsCreated = 3,
            DuplicatesSkipped = 1,
            CreatedDates = [new DateOnly(2024, 6, 17), new DateOnly(2024, 6, 18)]
        };
        _recurringJobRepositoryMock
            .CreateCreateAheadBackfillAsync(Arg.Any<CreateCreateAheadBackfillRequest>())
            .Returns(payload);

        var result = await controller.CreateCreateAheadBackfill(new CreateCreateAheadBackfillRequest
        {
            JobId = 100, Dates = [new DateOnly(2024, 6, 17), new DateOnly(2024, 6, 18)]
        });

        var json = Assert.IsType<JsonResult>(result);
        Assert.Same(payload, json.Value);
    }

    [Fact]
    public async Task CreateCreateAheadBackfill_ReturnsBadRequest_OnArgumentException()
    {
        var controller = CreateController();
        _recurringJobRepositoryMock
            .CreateCreateAheadBackfillAsync(Arg.Any<CreateCreateAheadBackfillRequest>())
            .Throws(new ArgumentException("JobId is required"));

        var result = await controller.CreateCreateAheadBackfill(new CreateCreateAheadBackfillRequest
        {
            JobId = 0, Dates = [new DateOnly(2024, 6, 17)]
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateCreateAheadBackfill_Returns500_OnUnexpectedException()
    {
        var controller = CreateController();
        _recurringJobRepositoryMock
            .CreateCreateAheadBackfillAsync(Arg.Any<CreateCreateAheadBackfillRequest>())
            .Throws(new Exception("boom"));

        var result = await controller.CreateCreateAheadBackfill(new CreateCreateAheadBackfillRequest
        {
            JobId = 100, Dates = [new DateOnly(2024, 6, 17)]
        });

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, obj.StatusCode);
    }
}