using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;
using EventType = DespatchWeb.Enums.EventType;

namespace DespatchWeb.Controllers;

[Authorize]
public class JobController(
    IJobQueryRepository jobQueryRepository,
    IJobCommandRepository jobCommandRepository,
    ITaskRepository taskRepository,
    IClientAccessValidatorService clientAccessValidator,
    HttpClient httpClient,
    IRateJobService rateJobService,
    IRecurringJobRepository recurringJobRepository,
    ITenantInfoService infoService,
    ITenantClock clock,
    IAddStopJobService addStopJobService,
    IJobReportService jobReportService,
    IJobPhotoService jobPhotoService,
    IPodMediaService podMediaService,
    IDispatchJobService dispatchJobService,
    IDeliveryJourneyService deliveryJourneyService,
    IPricingPermissionService pricingPermissionService,
    IPodReportService podReportService,
    IPriceReportService priceReportService,
    IPdfOverlayClient pdfOverlay,
    ISplitJobService splitJobService,
    ISplitPricingPreviewService splitPricingPreviewService,
    ISendToPartnerService sendToPartnerService,
    IPartnerJobGate partnerJobGate,
    IFlightAssignmentService flightAssignmentService,
    IArrivalWaitRerateService arrivalWaitRerateService,
    IAccessorialChargeRepository accessorialChargeRepository
) : Controller
{
    public async Task<IActionResult> Index(
        [FromQuery] JobQueryParams queryParams,
        bool isInternal,
        int cid,
        string clientIds,
        [FromQuery] List<int> despatchViewIds
    )
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var isUsTenant = infoService.IsUsTenant();
            if (!isInternal)
            {
                await clientAccessValidator.ValidateClientAccessAsync(cid, clientIds);
            }

            var result = await jobQueryRepository.JobListAsync(
                queryParams,
                isInternal,
                isUsTenant,
                clientIds,
                despatchViewIds
            );

            sw.Stop();
            Log.Information(
                "Job list query completed in {ElapsedMs}ms - returned {JobCount} jobs, {TotalCount} total (Views: {ViewIds}, DateRange: {StartDate} to {EndDate})",
                sw.ElapsedMilliseconds,
                result.Jobs?.Count ?? 0,
                result.TotalCount,
                string.Join(",", despatchViewIds),
                queryParams.StartDate?.ToString("yyyy-MM-dd") ?? "none",
                queryParams.EndDate?.ToString("yyyy-MM-dd") ?? "none");

            return Json(result);
        }
        catch (UnauthorizedAccessException)
        {
            sw.Stop();
            Log.Warning("Unauthorized job list access attempt for client {ClientId} after {ElapsedMs}ms", cid,
                sw.ElapsedMilliseconds);
            return StatusCode(
                StatusCodes.Status401Unauthorized,
                $"Unauthorized access attempt for client {cid}"
            );
        }
        catch (Exception ex)
        {
            sw.Stop();
            Log.Error(ex,
                "Error processing job list request after {ElapsedMs}ms (Views: {ViewIds}, DateRange: {StartDate} to {EndDate})",
                sw.ElapsedMilliseconds,
                string.Join(",", despatchViewIds ?? []),
                queryParams.StartDate?.ToString("yyyy-MM-dd") ?? "none",
                queryParams.EndDate?.ToString("yyyy-MM-dd") ?? "none");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetAllJobCoordinates(
        bool isInternal,
        string clientIds,
        [FromQuery] List<int> despatchViewIds)
    {
        try
        {
            Log.Information(
                "GetAllJobCoordinates endpoint called with Status: {Status}, IsInternal: {IsInternal}, "
                + "ClientIds: {ClientIds}",
                isInternal,
                clientIds,
                despatchViewIds
            );

            if (!isInternal)
            {
                await clientAccessValidator.ValidateClientAccessAsync(0, clientIds);
            }

            var result = await jobQueryRepository.GetJobCoordinatesAsync(despatchViewIds);

            Log.Information(
                "Successfully retrieved {Count} job coordinates",
                result.Count
            );

            return Json(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(ex, "Unauthorized access attempt");
            return StatusCode(StatusCodes.Status401Unauthorized, "Unauthorized access");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error processing job coordinates request");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetJobsByClearListEnvelope(
        JobQueryParams queryParams,
        bool isInternal,
        string clientIds,
        [FromQuery] List<int> despatchViewIds,
        int selectedClearListId
    )
    {
        var staffId = infoService.GetStaffId();
        try
        {
            var isUsTenant = infoService.IsUsTenant();

            if (!isInternal)
            {
                await clientAccessValidator.ValidateClientAccessAsync(staffId, clientIds);
            }

            var jobs = await jobQueryRepository.JobListAsync(
                queryParams,
                isInternal,
                isUsTenant,
                clientIds,
                despatchViewIds,
                selectedClearListId
            );

            return Json(jobs);
        }
        catch (Exception e)
        {
            Log.Error(e, "an error occured getting jobs by clear list");
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetPricingBreakdown(int jobId, bool isPrebook, bool isArchived = false)
    {
        try
        {
            Log.Information("Getting price breakdown for job {JobId} (prebook: {IsPrebook}, archived: {IsArchived})",
                jobId, isPrebook, isArchived);
            var priceComponents = await jobQueryRepository.GetJobPriceBreakdownAsync(jobId, isPrebook, isArchived);
            return Json(priceComponents);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting price breakdown for job {JobId}",
                jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetSplitPricingBreakdown(int jobId)
    {
        try
        {
            var breakdown = await jobQueryRepository.GetSplitPricingBreakdownAsync(jobId);
            return Json(breakdown);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting split pricing breakdown for job {JobId}", jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetSuggestedFuelCharge(int jobId, decimal chargeAmount, bool isPrebook, bool isArchived = false)
    {
        try
        {
            var suggestion = await jobQueryRepository.GetSuggestedFuelChargeAsync(jobId, chargeAmount, isPrebook, isArchived);
            return Json(suggestion);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting suggested fuel charge for job {JobId}", jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddPriceComponent([FromBody] ChargeViewModel breakdown)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var jobId = breakdown.ChildJobId ?? breakdown.PrebookJobId;
            if (!jobId.HasValue)
            {
                throw new ArgumentException(
                    "ChildJobId or PrebookJobId must be provided",
                    nameof(breakdown));
            }

            var partnerGuard = await RejectIfAnyPartnerJobAsync(breakdown.JobId, breakdown.ChildJobId);
            if (partnerGuard != null)
            {
                return partnerGuard;
            }

            if (!await pricingPermissionService.CanModifyPriceBreakdownAsync())
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to modify price breakdowns");
            }

            await pricingPermissionService.ValidateJobAccessAsync(jobId.Value);

            Log.Information("Adding price breakdown for job {JobId} (archived: {IsArchived})", jobId,
                breakdown.IsArchived);

            var chargeId = await jobCommandRepository.AddJobPriceBreakdownAsync(breakdown, breakdown.IsArchived);

            if (breakdown.JobId.HasValue && !breakdown.IsArchived)
            {
                await taskRepository.AddEventAsync(
                    (int)jobId,
                    "Manually rated price",
                    (int)EventType.ChangePrice);
            }

            return Json(chargeId);
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(ex, "Unauthorized access to add price component for job {JobId}",
                breakdown.JobId ?? breakdown.PrebookJobId);
            return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error adding price breakdown for job {JobId}",
                breakdown.JobId ?? breakdown.PrebookJobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdatePriceComponent([FromBody] ChargeViewModel breakdown)
    {
        try
        {
            var jobId = breakdown.JobId ?? breakdown.PrebookJobId;
            if (!jobId.HasValue)
            {
                throw new ArgumentException(
                    "JobId or PrebookJobId must be provided",
                    nameof(breakdown));
            }

            var partnerGuard = await RejectIfAnyPartnerJobAsync(breakdown.JobId, breakdown.ChildJobId);
            if (partnerGuard != null)
            {
                return partnerGuard;
            }

            if (!await pricingPermissionService.CanModifyPriceBreakdownAsync())
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to modify price breakdowns");
            }

            await pricingPermissionService.ValidateJobAccessAsync(jobId.Value);

            Log.Information("Updating price breakdown for job {JobId} (archived: {IsArchived})",
                breakdown.JobId ?? breakdown.PrebookJobId, breakdown.IsArchived);

            await jobCommandRepository.UpdateJobPriceBreakdownAsync(breakdown, breakdown.IsArchived);

            if (breakdown.JobId.HasValue && !breakdown.IsArchived)
            {
                await taskRepository.AddEventAsync(
                    jobId ?? 0,
                    "Manually rated price",
                    (int)EventType.ChangePrice);
            }

            return Ok();
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(ex, "Unauthorized access to update price component for job {JobId}",
                breakdown.JobId ?? breakdown.PrebookJobId);
            return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating price breakdown for job {JobId}",
                breakdown.JobId ?? breakdown.PrebookJobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> DeletePriceComponent([FromBody] DeletePriceComponentRequest request)
    {
        try
        {
            var partnerGuard = await RejectIfPartnerJobAsync(request.JobId);
            if (partnerGuard != null)
            {
                return partnerGuard;
            }

            if (!await pricingPermissionService.CanModifyPriceBreakdownAsync())
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to modify price breakdowns");
            }

            await pricingPermissionService.ValidateJobAccessAsync(request.JobId);

            Log.Information("Deleting price breakdown for charge {ChargeId} (archived: {IsArchived})",
                request.ChargeId, request.IsArchived);

            await jobCommandRepository.DeleteJobPriceBreakdownAsync(request.ChargeId, request.IsArchived);

            if (!request.IsArchived)
            {
                await taskRepository.AddEventAsync(
                    request.JobId,
                    "Manually rated price",
                    (int)EventType.ChangePrice);
            }

            return Ok();
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(ex, "Unauthorized access to delete price component for job {JobId}", request.JobId);
            return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error deleting price breakdown for charge {ChargeId}",
                request.ChargeId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateSplitPricingBreakdown([FromBody] UpdateSplitPricingBreakdownRequest request)
    {
        try
        {
            var partnerGuard = await RejectIfPartnerJobAsync(request.JobId);
            if (partnerGuard != null)
            {
                return partnerGuard;
            }

            if (!await pricingPermissionService.CanModifyPriceBreakdownAsync())
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to modify price breakdowns");
            }

            await pricingPermissionService.ValidateJobAccessAsync(request.JobId);

            Log.Information("Updating split pricing breakdown for job {JobId}", request.JobId);

            await jobCommandRepository.UpdateSplitPricingBreakdownAsync(request);

            await taskRepository.AddEventAsync(request.JobId, "Manually rated price", (int)EventType.ChangePrice);

            return Ok();
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(ex, "Unauthorized access to update split pricing breakdown for job {JobId}", request.JobId);
            return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            Log.Warning(ex, "Rejected split pricing breakdown update for job {JobId}", request.JobId);
            return StatusCode(StatusCodes.Status409Conflict, ex.Message);
        }
        catch (ArgumentException ex)
        {
            Log.Warning(ex, "Invalid split pricing breakdown update for job {JobId}", request.JobId);
            return StatusCode(StatusCodes.Status400BadRequest, ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating split pricing breakdown for job {JobId}", request.JobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> InsertRecurringToLive([FromBody] InsertRecurringToLiveRequest request)
    {
        try
        {
            var result = await recurringJobRepository.InsertRecurringToLiveAsync(request);

            var flightSummary = await flightAssignmentService.AutoAssignSavedFlightsAsync(result.InsertedJobIds);
            result.FlightsAutoAssigned = flightSummary.Assigned;
            result.FlightsUnmatched = flightSummary.Unmatched;

            return Json(result);
        }
        catch (InvalidOperationException ex)
        {
            Log.Warning(ex, "InsertRecurringToLive rejected: {Message}", ex.Message);
            return BadRequest(ex.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(InsertRecurringToLive)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> PreviewCreateAheadBackfill(
        [FromBody] PreviewCreateAheadBackfillRequest request)
    {
        try
        {
            var result = await recurringJobRepository.PreviewCreateAheadBackfillAsync(request);
            return Json(result);
        }
        catch (ArgumentException ex)
        {
            Log.Warning(ex, "PreviewCreateAheadBackfill rejected: {Message}", ex.Message);
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            Log.Warning(ex, "PreviewCreateAheadBackfill rejected: {Message}", ex.Message);
            return BadRequest(ex.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(PreviewCreateAheadBackfill)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateCreateAheadBackfill(
        [FromBody] CreateCreateAheadBackfillRequest request)
    {
        try
        {
            var result = await recurringJobRepository.CreateCreateAheadBackfillAsync(request);
            return Json(result);
        }
        catch (ArgumentException ex)
        {
            Log.Warning(ex, "CreateCreateAheadBackfill rejected: {Message}", ex.Message);
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            Log.Warning(ex, "CreateCreateAheadBackfill rejected: {Message}", ex.Message);
            return BadRequest(ex.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(CreateCreateAheadBackfill)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetCurrentWorkList(int courierId,
        DateTimeOffset startDate,
        DateTimeOffset endDate)
    {
        try
        {
            var result = await jobQueryRepository.CurrentJobListAsync(courierId, startDate, endDate);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(GetCurrentWorkList)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UploadJobDeliveryPhotoOrSignature(
        int jobId,
        IFormFile file,
        bool isPod = true,
        string podDescription = null)
    {
        if (Debugger.IsAttached)
        {
            return Json(new
            {
                success = true,
                fileName = file.FileName,
                s3Key = $"pods/{jobId}/{file.FileName}_{DateTimeOffset.UtcNow.Ticks}",
                contentType = file.ContentType,
                size = file.Length,
                uploadDate = DateTimeOffset.UtcNow.ToString("o"),
                isPOD = true,
                podDescription
            });
        }

        try
        {
            var result = await jobPhotoService.UploadJobPhotoOrSignatureAsync(
                jobId, file, JobPhotoType.Delivery, isPod, podDescription);
            if (!result.Success)
            {
                return BadRequest(result.ErrorMessage);
            }

            return Json(new
            {
                success = result.Success,
                fileName = result.FileName,
                s3Key = result.S3Key,
                contentType = result.ContentType,
                size = result.Size,
                uploadDate = result.UploadDate.ToString("o"),
                isPOD = result.IsPod,
                podDescription = result.PodDescription
            });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController),
                    nameof(UploadJobDeliveryPhotoOrSignature)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteJobDeliveryPhotoOrSignature(int jobId, string key)
    {
        if (Debugger.IsAttached)
        {
            return Json(new { success = true, message = "File deleted successfully" });
        }

        try
        {
            var success = await jobPhotoService.ArchiveJobPhotoAsync(jobId, key);
            if (!success)
            {
                return BadRequest("Failed to delete file or file key is required");
            }

            return Json(new { success = true, message = "File deleted successfully" });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController),
                    nameof(DeleteJobDeliveryPhotoOrSignature)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetJobDeliveryPhotosAndSignature(int jobId, int year, int month)
    {
        if (Debugger.IsAttached)
        {
            return Json(new[]
            {
                new
                {
                    fileName = "delivery_front_door.jpg", s3Key = $"pods/{jobId}/delivery_front_door.jpg",
                    contentType = "image/jpeg", size = 2_097_152L,
                    uploadDate = DateTimeOffset.UtcNow.AddDays(-1).ToString("o"), podDescription = "Left at front door"
                },
                new
                {
                    fileName = "signature_smith.png", s3Key = $"pods/{jobId}/signature_smith.png",
                    contentType = "image/png", size = 51_200L,
                    uploadDate = DateTimeOffset.UtcNow.AddHours(-2).ToString("o"), podDescription = "Signed by J. Smith"
                }
            });
        }

        try
        {
            var allPodPhotos = await podMediaService.GetDeliveryMediaAsync(jobId, year, month);
            return Json(allPodPhotos);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController),
                    nameof(GetJobDeliveryPhotosAndSignature)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetJobPickupPhotos(int jobId, int year, int month)
    {
        try
        {
            var allPickupPhotos = await podMediaService.GetPickupMediaAsync(jobId, year, month);
            return Json(allPickupPhotos);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(GetJobPickupPhotos)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> RecurringJobDetail(int jobId)
    {
        try
        {
            var job = await recurringJobRepository.GetRecurringJobByIdAsync(jobId);
            return Json(job);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "An unexpected error occured");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> Detail(int jobId)
    {
        try
        {
            var job = await jobQueryRepository.GetJobByIdAsync(jobId);
            return Json(job);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController), nameof(Detail)));
            return StatusCode(500, ex.Message);
        }
    }

    public async Task<IActionResult> DispatchJobDetail(int jobId)
    {
        try
        {
            var job = await jobQueryRepository.GetDispatchJobDetailAsync(jobId);
            return Json(job);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "An unexpected error occured");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> DispatchBulkJobDetail(int bulkJobId)
    {
        try
        {
            var job = await jobQueryRepository.GetBulkDispatchJobDetailAsync(bulkJobId);
            return Json(job);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController), nameof(DispatchBulkJobDetail)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> BulkDetail(int bulkJobId)
    {
        var result = await jobQueryRepository.GetBulkJobDetailAsync(bulkJobId);
        return Json(result);
    }

    [HttpPost]
    public async Task<IActionResult> PreBookJobs([FromBody] RecurringJobQueryRequest request)
    {
        try
        {
            var result = await recurringJobRepository.GetRecurringJobsListAsync(request);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(PreBookJobs)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> RecurringJobsExportCsv([FromBody] RecurringJobQueryRequest request)
    {
        try
        {
            var (fileBytes, fileName) = await jobReportService.GenerateRecurringJobsCsvAsync(request);
            return File(fileBytes, "text/csv", fileName);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(RecurringJobsExportCsv)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> PodSearch([FromQuery] PodSearchRequest data)
    {
        try
        {
            var result = await jobQueryRepository.PodSearchAsync(data);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(PodSearch)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> PodSearchDownload([FromQuery] PodSearchDownloadRequest requestData)
    {
        try
        {
            var result = await jobReportService.GenerateJobsReportAsync(requestData);
            return File(result.FileBytes, "text/csv", result.FileName);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController), nameof(PodSearchDownload)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> PriceDetailReportDownload([FromQuery] PriceDetailReportRequest request)
    {
        try
        {
            var (fileBytes, fileName) = await priceReportService.GeneratePriceDetailReportAsync(request);
            return File(fileBytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController), nameof(PriceDetailReportDownload)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> ClientJobsReportDownload([FromQuery] ClientJobsReportRequest request)
    {
        try
        {
            var (fileBytes, fileName) = await jobReportService.GenerateClientJobsReportCsvAsync(request);
            return File(fileBytes, "text/csv", fileName);
        }
        catch (InvalidOperationException ex)
        {
            Log.Warning(ex, "Client jobs report - no data found: {@Request}", request);
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController),
                    nameof(ClientJobsReportDownload)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> PodReport(int jobId)
    {
        try
        {
            var overlayPdf = await pdfOverlay.TryRenderJobAsync(jobId, "ProofOfDelivery", HttpContext.RequestAborted);
            if (overlayPdf is not null)
            {
                var overlayWithPhotos = await podReportService.AppendDeliveryPhotosAsync(overlayPdf, jobId);
                return File(overlayWithPhotos, "application/pdf", $"POD-{jobId}.pdf");
            }

            var (bytes, fileName) = await podReportService.GeneratePodReportAsync(jobId);
            return File(bytes, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error generating POD report for job {JobId}", jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> PodSpreadsheet(int jobId)
    {
        try
        {
            var (bytes, fileName) = await podReportService.GeneratePodSpreadsheetAsync(jobId);
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error generating POD spreadsheet for job {JobId}", jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> OverlayDocuments(int jobId)
    {
        var docs = await pdfOverlay.ListJobDocumentsAsync(jobId, HttpContext.RequestAborted);
        return Json((docs ?? []).Select(d => new
        {
            documentType = d.DocumentType,
            displayName = d.DisplayName,
            available = d.Available
        }));
    }

    public async Task<IActionResult> OverlayDocument(int jobId, string documentType)
    {
        if (string.IsNullOrWhiteSpace(documentType))
        {
            return BadRequest("documentType is required.");
        }

        try
        {
            var pdf = await pdfOverlay.RenderJobAsync(jobId, documentType, HttpContext.RequestAborted);
            if (pdf is null)
            {
                return NotFound($"No '{documentType}' template available for job {jobId}.");
            }

            return File(pdf, "application/pdf", $"{documentType}-{jobId}.pdf");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error generating overlay document {DocType} for job {JobId}", documentType, jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> SendPodReport([FromBody] SendPodReportRequest request)
    {
        try
        {
            if (request.Recipients == null || request.Recipients.Count == 0)
            {
                return BadRequest("At least one recipient is required.");
            }

            var allRecipients = request.Recipients
                .SelectMany(r => r.Split([';', ','], StringSplitOptions.RemoveEmptyEntries))
                .Select(r => r.Trim())
                .Where(r => !string.IsNullOrEmpty(r))
                .Distinct()
                .ToList();

            if (allRecipients.Count == 0)
            {
                return BadRequest("No valid recipients provided.");
            }

            var validRecipients = new List<string>();
            foreach (var recipient in allRecipients)
            {
                if (MailAddress.TryCreate(recipient, out _))
                {
                    validRecipients.Add(recipient);
                }
                else
                {
                    Log.Warning("Skipping invalid email address '{Address}' for job {JobId}", recipient, request.JobId);
                }
            }

            if (validRecipients.Count == 0)
            {
                return BadRequest("No valid email addresses provided.");
            }

            await podReportService.SendPodEmailAsync(request.JobId, validRecipients, request.Subject, request.Body);

            return Ok();
        }
        catch (PodEmailException e)
        {
            Log.Warning(e, "POD email rejected for job {JobId}: {Message}", request.JobId, e.Message);
            return StatusCode(500, e.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error sending POD report email for job {JobId}", request.JobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        try
        {
            await jobReportService.ProcessJobPriceUploadAsync(file);
            return Ok();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(Upload)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ApplyBulkPriceUpdate(IFormFile file, [FromQuery] string pricingMode)
    {
        try
        {
            pricingPermissionService.ValidatePricingMode(pricingMode);

            if (!await pricingPermissionService.CanBulkUpdatePricesAsync())
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to perform bulk price updates");
            }

            if (!await pricingPermissionService.CanUsePricingModeAsync(pricingMode))
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    $"You do not have permission to use the '{pricingMode}' pricing mode");
            }

            var result = await rateJobService.ApplyBulkPriceUpdateAsync(file, pricingMode);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(ex, "Unauthorized bulk price update attempt");
            return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(ApplyBulkPriceUpdate)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> ValidateSwapPod(string job)
    {
        try
        {
            var isSwapValid = await jobQueryRepository.ValidatePodSwapAsync(job);
            return Json(isSwapValid);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(ValidateSwapPod)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> SwapPod(string job1, string job2)
    {
        await jobCommandRepository.SwapPodAsync(job1, job2);

        try
        {
            var firstJobId = await jobQueryRepository.GetJobIdByNumberAsync(job1);
            var secondJobId = await jobQueryRepository.GetJobIdByNumberAsync(job2);

            if (secondJobId is { } secondId)
            {
                await jobCommandRepository.ReSendSelectedJobsAsync([secondId]);
            }

            if (firstJobId is { } firstId)
            {
                if (!await jobQueryRepository.IsOutboundPartnerJobAsync(firstId, infoService.GetCurrentTenantId()))
                {
                    await jobCommandRepository.ReAssignSelectedJobsAsync([firstId]);
                }

                await jobCommandRepository.ReSendSelectedJobsAsync([firstId]);
            }
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(SwapPod)));
        }

        return Ok();
    }

    public async Task<IActionResult> BulkSearch([FromQuery] PodSearchRequest request)
    {
        try
        {
            var result = await jobQueryRepository.BulkSearchAsync(request);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(BulkSearch)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> LateCall([FromBody] LateCallRequest request)
    {
        try
        {
            var job = await jobQueryRepository.GetJobForLateCallAsync(request.JobId);
            ArgumentNullException.ThrowIfNull(job);

            var lateStatus = await DetermineLateStatus(
                request.LateType,
                request.LateTime,
                job.MinutesRemaining,
                job.PickupTime,
                job.AlertLatePickup,
                job.DeliveryTime,
                job.AlertLateDelivery
            );

            if (lateStatus.ShouldCreateEvent)
            {
                await CreateLateNotificationEvent(
                    job.Id,
                    lateStatus.EventType,
                    lateStatus.LateTime,
                    job.JobTime.AddMinutes(lateStatus.LateTime)
                );
            }

            await jobCommandRepository.ResetLateEventAsync(job.Id, request.LateType);

            switch (request.LateType)
            {
                case (int)LateEventType.Pickup:
                    await jobCommandRepository.LatePickupAsync(
                        job.Id,
                        job.BookedSpeed,
                        job.NotifiedSpeed,
                        request.LateTime,
                        request.CalculationRequired
                    );
                    break;
                case (int)LateEventType.Delivery:
                    await jobCommandRepository.LateDeliveryAsync(
                        job.Id,
                        job.BookedSpeed,
                        job.NotifiedSpeed,
                        request.LateTime,
                        request.CalculationRequired
                    );
                    break;
            }

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error allocating jobs");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    private async Task<LateStatusResult> DetermineLateStatus(
        int lateType,
        int lateTime,
        int minutes,
        int pickupTime,
        int alertLatePickup,
        int deliveryTime,
        int alertLateDelivery)
    {
        return lateType switch
        {
            (int)LateEventType.Pickup => await DeterminePickupLateStatus(lateTime, minutes,
                pickupTime, alertLatePickup),
            (int)LateEventType.Delivery => await DetermineDeliveryLateStatus(lateTime, minutes,
                deliveryTime, alertLateDelivery),
            _ => new LateStatusResult { ShouldCreateEvent = true, EventType = 0, LateTime = lateTime }
        };
    }

    private async Task<LateStatusResult> DeterminePickupLateStatus(
        int lateTime,
        int minutes,
        int pickupTime,
        int alertLatePickup)
    {
        const int latePickupStatus = (int)JobStatus.LatePickup;

        if (alertLatePickup < 0)
        {
            return new LateStatusResult
                { ShouldCreateEvent = false, EventType = latePickupStatus, LateTime = lateTime };
        }

        var maxAutoLate = await jobQueryRepository.MaxAutoLatePickupAlertAsync();
        var shouldCreateEvent = minutes < maxAutoLate
            ? lateTime > pickupTime
            : lateTime - pickupTime > alertLatePickup;

        return new LateStatusResult
            { ShouldCreateEvent = shouldCreateEvent, EventType = latePickupStatus, LateTime = lateTime };
    }

    private async Task<LateStatusResult> DetermineDeliveryLateStatus(
        int lateTime,
        int minutes,
        int deliveryTime,
        int alertLateDelivery)
    {
        const int lateDeliveryStatus = (int)EventType.LateDelivery;
        var adjustedLateTime = lateTime + deliveryTime;

        if (alertLateDelivery < 0)
        {
            return new LateStatusResult
                { ShouldCreateEvent = false, EventType = lateDeliveryStatus, LateTime = adjustedLateTime };
        }

        var maxAutoLateDelAlert = await jobQueryRepository.MaxAutoLateDeliveryAlertAsync();
        var shouldCreateEvent = minutes < maxAutoLateDelAlert || adjustedLateTime > alertLateDelivery;

        return new LateStatusResult
            { ShouldCreateEvent = shouldCreateEvent, EventType = lateDeliveryStatus, LateTime = adjustedLateTime };
    }

    private async Task CreateLateNotificationEvent(
        int jobId,
        int eventType,
        int lateTime,
        DateTimeOffset etaTime)
    {
        await taskRepository.AddEventAsync(
            jobId,
            "Late Call from Despatch",
            eventType,
            null,
            lateTime,
            etaTime.DateTime
        );
    }

    [HttpPost]
    public async Task<IActionResult> Allocate([FromBody] AllocateJobsToCourierRequest data)
    {
        try
        {
            foreach (var jobId in data.JobIds)
            {
                var partnerGuard = await RejectIfOutboundPartnerJobAsync(jobId);
                if (partnerGuard != null)
                {
                    return partnerGuard;
                }

                var acceptanceGuard = await RejectIfRateNotAcceptedAsync(jobId);
                if (acceptanceGuard != null)
                {
                    return acceptanceGuard;
                }
            }

            await dispatchJobService.DispatchJobsToCourierAsync(data.JobIds, data.CourierId);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error allocating jobs");
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> ReAllocate([FromBody] AllocateJobsToCourierRequest data)
    {
        try
        {
            foreach (var jobId in data.JobIds)
            {
                var partnerGuard = await RejectIfOutboundPartnerJobAsync(jobId);
                if (partnerGuard != null)
                {
                    return partnerGuard;
                }

                var acceptanceGuard = await RejectIfRateNotAcceptedAsync(jobId);
                if (acceptanceGuard != null)
                {
                    return acceptanceGuard;
                }
            }

            await jobCommandRepository.ReDispatchSelectedJobsAsync(data.JobIds);
            await dispatchJobService.DispatchJobsToCourierAsync(data.JobIds, data.CourierId);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController), nameof(ReAllocate)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ReSendSelected(string jobIds)
    {
        var parsedIds = jobIds.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(id => int.Parse(id.Trim()))
            .ToList();
        await jobCommandRepository.ReSendSelectedJobsAsync(parsedIds);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> ReAssignSelected(string jobIds)
    {
        var parsedIds = jobIds.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(id => int.Parse(id.Trim()))
            .ToList();

        foreach (var jobId in parsedIds)
        {
            var partnerGuard = await RejectIfOutboundPartnerJobAsync(jobId);
            if (partnerGuard != null)
            {
                return partnerGuard;
            }
        }

        await jobCommandRepository.ReAssignSelectedJobsAsync(parsedIds);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> SetFirstJob(int jobId, int courierId)
    {
        var partnerGuard = await RejectIfOutboundPartnerJobAsync(jobId);
        if (partnerGuard != null)
        {
            return partnerGuard;
        }

        await jobCommandRepository.SetFirstJobAsync(jobId, courierId);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> Void([FromBody] VoidJobRequest request)
    {
        try
        {
            var partnerGuard = await RejectIfOutboundPartnerJobAsync(request.JobId);
            if (partnerGuard != null)
            {
                return partnerGuard;
            }

            var isArchived = await jobQueryRepository.IsJobArchived(request.JobId);

            if (isArchived)
            {
                await jobCommandRepository.VoidArchivedJobAsync(request);
                return Ok();
            }

            var parentId = await jobQueryRepository.GetJobParentIdAsync(request.JobId);

            var isParentBeingVoided = parentId.HasValue &&
                                      request.SelectedJobIds is { Count: > 0 } &&
                                      request.SelectedJobIds.Contains(parentId.Value);

            await jobCommandRepository.VoidJobAsync(request);

            if (!parentId.HasValue || isParentBeingVoided)
            {
                return Ok();
            }

            if (Debugger.IsAttached)
            {
                return Ok();
            }

            try
            {
                var isUsTenant = infoService.IsUsTenant();
                if (isUsTenant)
                {
                    var jobDetails = await jobQueryRepository.GetJobDetailsForRatingAsync(parentId.Value);
                    if (!jobDetails.IsManuallyRated)
                    {
                        await rateJobService.RateJobUsAsync(jobDetails);
                    }
                }
                else
                {
                    var jobDetails = await jobQueryRepository.GetJobDetailsForRatingNzAsync(parentId.Value, false);
                    if (!jobDetails.IsManuallyRated)
                    {
                        await rateJobService.RateJobNzAsync(jobDetails);
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error re-rating parent job {ParentId} after voiding child {JobId}",
                    parentId.Value, request.JobId);
            }

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error voiding {SingleJobString} Job(s) with ID {JobId}. Error: {ErrorMessage}",
                request.JobId,
                request.VoidSingleJobOnly ? "Single" : "All",
                ex.Message
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ChangeArchivedJobCourier([FromBody] ChangeArchivedJobCourierRequest request)
    {
        var partnerGuard = await RejectIfOutboundPartnerJobAsync(request.JobId);
        if (partnerGuard != null)
        {
            return partnerGuard;
        }

        try
        {
            await jobCommandRepository.ChangeArchivedJobCourierAsync(request.JobId, request.CourierId);
            return Ok();
        }
        catch (ArchivedCourierChangeException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error changing archived courier on job {JobId}", request.JobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpGet]
    public async Task<IActionResult> CourierChangeEligibility(int jobId)
    {
        var eligibility = await jobQueryRepository.GetArchivedCourierChangeEligibilityAsync(jobId);

        return Ok(new ArchivedCourierChangeEligibilityResponse
        {
            CanChange = eligibility?.CanChange ?? false,
            Reason = eligibility == null ? "notArchived"
                : eligibility.IsInvoiced ? "invoiced"
                : eligibility.IsSettled ? "settled"
                : null,
            CurrentCourierId = eligibility?.CurrentCourierId,
            CurrentCourierName = eligibility?.CurrentCourierName
        });
    }

    [HttpPost]
    public async Task<IActionResult> VoidBulkJob([FromBody] VoidBulkJobRequest request)
    {
        try
        {
            await jobCommandRepository.VoidBulkJobAsync(request);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error voiding {SingleJobString} Job(s) with ID {JobId}. Error: {ErrorMessage}",
                request.BulkJobId,
                request.VoidSingleJobOnly ? "Single" : "All",
                ex.Message
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ReSendAll(int courierId)
    {
        try
        {
            await jobCommandRepository.ReSendAllJobsAsync(courierId);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error resending jobs to CourierId {CourierId}. Error: {ErrorMessage}",
                courierId,
                ex.Message
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> RestoreSplitJobs([FromQuery] List<int> jobIds)
    {
        try
        {
            await jobCommandRepository.RestoreSplitJobsAsync(jobIds);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error restoring the following split jobs {JobId}. Error: {ErrorMessage}",
                jobIds.ToString(),
                ex.Message
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> RestoreJobs([FromBody] RestoreJobsRequest data)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(data);
            ArgumentNullException.ThrowIfNull(data.JobIds);

            if (data.JobIds.Count is 0)
            {
                throw new ArgumentException("JobIds cannot be empty", nameof(data));
            }
            Log.Information(
                "RestoreJobs request received for {JobCount} job(s) {JobIds} (RemoveCapturedImages={RemoveCapturedImages})",
                data.JobIds.Count,
                string.Join(",", data.JobIds),
                data.RemoveCapturedImages);

            var completionTimes = data.RemoveCapturedImages
                ? await jobQueryRepository.GetJobCompletionTimesAsync(data.JobIds)
                : null;

            await jobCommandRepository.RestoreJobsAsync(data.JobIds);

            if (completionTimes is not null)
            {
                await ArchiveRestoredJobImagesAsync(completionTimes);
            }

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error restoring the following jobs {JobId}. Error: {ErrorMessage}",
                data.JobIds?.ToString(),
                ex.Message
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public const int MaxRestorePodImageProbeJobs = 50;

    private const int RestorePodImageProbeConcurrency = 8;

    [HttpPost]
    public async Task<IActionResult> GetRestorePodImpact([FromBody] RestorePodImpactRequest data)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(data);

            if (data.JobIds is null or { Count: 0 })
            {
                return BadRequest("JobIds cannot be empty");
            }

            var details = await jobQueryRepository.GetRestorePodDetailsAsync(data.JobIds);
            var probeImages = data.JobIds.Count <= MaxRestorePodImageProbeJobs;

            if (!probeImages)
            {
                Log.Information(
                    "GetRestorePodImpact skipped the S3 image probe for {JobCount} job(s) (cap is {Cap})",
                    data.JobIds.Count, MaxRestorePodImageProbeJobs);

                return Json(details
                    .Select(d => new RestorePodImpact { JobId = d.JobId, PodName = d.PodName })
                    .ToList());
            }

            var impacts = await Task.WhenAll(details.Select(async detail =>
            {
                if (detail.CompletedTime is not { } completed)
                {
                    return new RestorePodImpact
                    {
                        JobId = detail.JobId, PodName = detail.PodName, ImageCountKnown = true
                    };
                }

                using var throttle = new SemaphoreSlim(RestorePodImageProbeConcurrency);

                await throttle.WaitAsync();
                try
                {
                    var count = await jobPhotoService.CountJobCapturedMediaAsync(
                        detail.JobId, completed.Year, completed.Month);

                    return new RestorePodImpact
                    {
                        JobId = detail.JobId,
                        PodName = detail.PodName,
                        CapturedImageCount = count,
                        ImageCountKnown = true
                    };
                }
                catch (Exception ex)
                {
                    Log.Error(ex,
                        "Failed to count captured images for job {JobId}. Error: {ErrorMessage}",
                        detail.JobId, ex.Message);

                    return new RestorePodImpact { JobId = detail.JobId, PodName = detail.PodName };
                }
                finally
                {
                    throttle.Release();
                }
            }));

            return Json(impacts);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error checking the restore POD impact for jobs {JobIds}. Error: {ErrorMessage}",
                data?.JobIds is null ? string.Empty : string.Join(",", data.JobIds), ex.Message);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    private async Task ArchiveRestoredJobImagesAsync(IReadOnlyDictionary<int, DateTime?> completionTimes)
    {
        foreach (var (jobId, completedTime) in completionTimes)
        {
            if (completedTime is not { } completed)
            {
                continue;
            }

            try
            {
                var result = await jobPhotoService.ArchiveJobCapturedMediaAsync(
                    jobId, completed.Year, completed.Month);

                Log.Information(
                    "Archived {Successful}/{Total} captured image(s) for restored job {JobId} ({Failed} failed)",
                    result.SuccessfulFiles, result.TotalFiles, jobId, result.FailedFiles);
            }
            catch (Exception ex)
            {
                Log.Error(ex,
                    "Failed to archive captured images for restored job {JobId}. Error: {ErrorMessage}",
                    jobId, ex.Message);
            }
        }
    }

    [HttpPost]
    public async Task<IActionResult> PreviewSplitPricing([FromBody] SplitPricingPreviewRequest request)
    {
        try
        {
            var partnerGuard = await RejectIfPartnerJobAsync(request.JobId);
            if (partnerGuard != null)
            {
                return partnerGuard;
            }

            await pricingPermissionService.ValidateJobAccessAsync(request.JobId);

            var preview = await splitPricingPreviewService.PreviewAsync(
                request.JobId, request.MeetingPointAddress);

            return Json(preview);
        }
        catch (UnauthorizedAccessException e)
        {
            Log.Warning(e, "Unauthorized split pricing preview for job {JobId}", request.JobId);
            return StatusCode(StatusCodes.Status403Forbidden, e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}", ErrorMessageStringFormatter.Format(e));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> SplitJob([FromBody] SplitJobRequest request)
    {
        try
        {
            var partnerGuard = await RejectIfPartnerJobAsync(request.JobId);
            if (partnerGuard != null)
            {
                return partnerGuard;
            }

            var staffInfo = await infoService.GetStaffInfoAsync();
            if (staffInfo is null)
            {
                throw new NullReferenceException("Staff Info Can Not be Null");
            }

            var staffName = staffInfo.Text;

            await splitJobService.SplitJobAsync(
                request.JobId,
                staffName,
                request.MeetingPointAddress,
                request.CourierIdForLegB,
                request.PricingAllocation,
                request.LineAllocation);

            return Ok();
        }
        catch (SplitJobException e)
        {
            Log.Warning(e, "Split rejected for job {JobId}: {Message}", request.JobId, e.Message);
            return StatusCode(500, e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}", ErrorMessageStringFormatter.Format(e));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UnSplitJob(int jobId)
    {
        var message = await jobCommandRepository.UnSplitJobAsync(jobId);
        return Json(message);
    }

    [HttpPost]
    public async Task<IActionResult> UpdatePodDetails([FromBody] UpdatePodDetailsRequest requestData)
    {
        try
        {
            await jobCommandRepository.UpdatePodDetailsAsync(requestData);
            return Ok();
        }
        catch (JobNotFoundException e)
        {
            Log.Error(e, "UpdatePodDetails failed for job {JobId}: {Message}", requestData.JobId, e.Message);
            return NotFound(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}", ErrorMessageStringFormatter.Format(e));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddRestoreEvent(int jobId)
    {
        try
        {
            var currentDate = clock.TenantNow;

            await taskRepository.AddEventAsync(
                jobId,
                $"Restored at {currentDate.ToShortDateString()} {currentDate.ToShortTimeString()}",
                (int)EventType.RestoreJob,
                null,
                33
            );

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error adding restore events for job {JobId}", jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddEvent([FromBody] JobEventDataRequest data)
    {
        try
        {
            await taskRepository.AddEventAsync(data.JobId,
                data.Notes,
                data.EventTypeId,
                data.EventDueDate);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating pickup address for job {JobId}", data.JobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> ExsalerateActivity(
        string eventName,
        string notes,
        int clientId,
        string jobNumber
    )
    {
        var baseUrl = Environment.GetEnvironmentVariable("ExsalerateAPI");
        var un = Environment.GetEnvironmentVariable("ExsalerateAPIUsername");
        var pw = Environment.GetEnvironmentVariable("ExsalerateAPIPW");

        httpClient.BaseAddress = new Uri(baseUrl ?? string.Empty);
        httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue(
                "Basic",
                Convert.ToBase64String(Encoding.ASCII.GetBytes($"{un}:{pw}"))
            );

        var staffId = infoService.GetStaffId();
        var staffName = await jobQueryRepository.GetStaffNameAsync(staffId);

        var body = new ExsalerateActivity
        {
            SiteOwnerID = 11,
            CustomerRefCode = clientId.ToString(),
            Subject = $"Dispatch:{staffName} {eventName}",
            ActivityType = eventName,
            Description = $"Job Number: {jobNumber} - {notes}"
        };

        var content = new StringContent(
            JsonSerializer.Serialize(body),
            Encoding.UTF8,
            "application/json"
        );

        var response = await httpClient.PostAsync("activity", content);

        if (response.StatusCode == HttpStatusCode.OK)
        {
            return Ok();
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var e = new ApplicationException(
            $"Exsalerate Activity Failed {responseContent} {Environment.NewLine} CurrentBody= {body}"
        );
        throw e;
    }

    public async Task<IActionResult> SpeedList()
    {
        var data = await jobQueryRepository.GetSpeedsAsync();
        return Json(data);
    }

    public async Task<IActionResult> RouteList()
    {
        var data = await jobQueryRepository.GetActiveRoutesAsync();
        return Json(data);
    }

    public async Task<IActionResult> SearchSpeedOptions(string searchTerm)
    {
        try
        {
            var speedOptions = await jobQueryRepository.GetSpeedsBySearchTermAsync(searchTerm);
            return Json(speedOptions);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(SearchSpeedOptions)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> ContactList(int clientId)
    {
        var data = await jobQueryRepository.GetContactsByClientIdAsync(clientId);
        return Json(data);
    }

    public async Task<IActionResult> LeaveList()
    {
        var data = await jobQueryRepository.LeaveParcelLocationsAsync();
        return Json(data);
    }

    public async Task<IActionResult> UndeliverableList()
    {
        var data = await jobQueryRepository.UndeliverableLocationsAsync();
        return Json(data);
    }

    public async Task<IActionResult> InternalStatusList()
    {
        var data = await jobQueryRepository.GetInternalStatusListAsync();
        return Json(data);
    }

    public async Task<IActionResult> StatusList()
    {
        var data = await jobQueryRepository.GetStatusListAsync();
        return Json(data);
    }

    public async Task<IActionResult> EventTypeList()
    {
        var data = await jobQueryRepository.EventTypeListAsync();
        return Json(data);
    }

    public async Task<IActionResult> PpdExclusiveAmount(int clientId, decimal amount)
    {
        var ppd = await jobQueryRepository.PpdExclusiveAmountAsync(clientId, amount);
        return Json(ppd);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateRecurringJob(
        int jobId,
        JobProperty field,
        string value
    )
    {
        try
        {
            await recurringJobRepository.UpdateRecurringJobAsync(jobId, field, value);

            if (Debugger.IsAttached)
            {
                return Ok();
            }

            var shouldRecalculateRate = ShouldRecalculateRate(field);
            if (!shouldRecalculateRate)
            {
                return Ok();
            }

            var isUsTenant = infoService.IsUsTenant();
            if (isUsTenant)
            {
                var jobDetails = await jobQueryRepository.GetJobBookingDetailsForRatingAsync(jobId);
                if (jobDetails.IsManuallyRated)
                {
                    return Ok();
                }

                await rateJobService.RateJobUsAsync(jobDetails);
            }
            else
            {
                var jobDetails = await jobQueryRepository.GetJobBookingDetailsForRatingNzAsync(jobId);
                if (jobDetails.IsManuallyRated)
                {
                    return Ok();
                }

                await rateJobService.RateJobNzAsync(jobDetails);
            }

            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(
                e,
                "An error occured updating field {Field} with value {Value} for job {JobId}", field, value, jobId
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> SaveRecurringFlight(
        int jobId,
        int fromAirportId,
        int toAirportId,
        string flightNumber
    )
    {
        try
        {
            await recurringJobRepository.SaveRecurringFlightAsync(jobId, fromAirportId, toAirportId, flightNumber);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured saving recurring flight {Flight} for job {JobId}", flightNumber, jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateJob(
        int jobId,
        JobProperty field,
        string value,
        CancellationToken ct,
        bool cascadeToChildren = false
    )
    {
        var staffId = infoService.GetStaffId();
        Log.Information(
            "UpdateJob requested: job {JobId}, field {JobProperty}, value {Value}, staff {StaffId}",
            jobId, field, value, staffId);

        try
        {
            var gateResult = await partnerJobGate.EvaluateAsync(jobId, field, value, ct);
            switch (gateResult)
            {
                case PartnerJobGateResult.AutoApplied auto:
                    Log.Information(
                        "UpdateJob gate=AutoApplied: job {JobId}, field {JobProperty}, requestId {RequestId}",
                        jobId, field, auto.RequestId);
                    return Ok(new { applied = true, requestId = auto.RequestId });
                case PartnerJobGateResult.PendingApproval pending:
                    Log.Information(
                        "UpdateJob gate=PendingApproval: job {JobId}, field {JobProperty}, requestId {RequestId}",
                        jobId, field, pending.RequestId);
                    return Accepted(new { pending = true, requestId = pending.RequestId });
                case PartnerJobGateResult.Blocked blocked:
                    Log.Information(
                        "UpdateJob gate=Blocked: job {JobId}, field {JobProperty}, reason {Reason}",
                        jobId, field, blocked.Message);
                    return BadRequest(new { message = blocked.Message });
            }

            await jobCommandRepository.UpdateJobAsync(jobId, field, value);
            Log.Information(
                "UpdateJob direct write complete: job {JobId}, field {JobProperty}", jobId, field);
        }
        catch (ArchivedJobCompletionException e)
        {
            Log.Information(e, "UpdateJob refused: job {JobId}, field {JobProperty}, reason",
                jobId, field);

            return BadRequest(new { message = e.Message });
        }
        catch (Exception e)
        {
            Log.Error(
                e,
                "An error occured updating field {JobProperty} with value {Value} for job {JobId}. Error: {Message}",
                field, value, jobId, e.Message
            );

            return StatusCode(500, e.Message + e.InnerException?.Message);
        }

        if (IsDateCascadeField(field))
        {
            if (!cascadeToChildren)
            {
                Log.Information(
                    "UpdateJob date edit not cascaded (user chose this job only): job {JobId}, field {JobProperty}",
                    jobId, field);
                return Ok(new { updatedJobIds = new[] { jobId } });
            }

            try
            {
                var cascade = await splitJobService.PropagateDateToChildrenAsync(jobId, field, value, ct);
                return Ok(new
                {
                    updatedJobIds = new[] { jobId }.Concat(cascade.UpdatedJobIds).ToArray(),
                    failedJobIds = cascade.FailedJobIds
                });
            }
            catch (Exception e)
            {
                Log.Error(e,
                    "Failed to cascade {JobProperty} from job {JobId} to its family. Error: {Message}",
                    field, jobId, e.Message);
                return Ok(new { updatedJobIds = new[] { jobId }, cascadeFailed = true });
            }
        }

        await arrivalWaitRerateService.HandleArrivalEditAsync(jobId, field, ct);

        if (!ShouldRecalculateRate(field))
        {
            Log.Information(
                "UpdateJob skipping propagation (field not rate-relevant): job {JobId}, field {JobProperty}",
                jobId, field);
            return Ok();
        }

        try
        {
            await splitJobService.PropagateUpdateToChildrenAsync(jobId, field, value, ct);
        }
        catch (Exception e)
        {
            Log.Error(e,
                "Failed to propagate {JobProperty} update to split children for job {JobId}. Error: {Message}",
                field, jobId, e.Message);
        }

        return Ok();
    }

    [HttpGet]
    public async Task<IActionResult> GetFamilyForDateChange(int jobId, CancellationToken ct)
    {
        try
        {
            var family = await splitJobService.GetDateCascadeFamilyAsync(jobId, ct);
            return Json(new
            {
                relationshipTypeId = family.RelationshipTypeId,
                members = family.Members.Select(m => new
                {
                    jobId = m.JobId,
                    jobNo = m.JobNumber,
                    date = m.Date,
                    time = m.Time,
                    amount = m.Amount,
                    ratedManually = m.RatedManually,
                    locked = m.Locked,
                    isPartnerJob = m.IsPartnerJob,
                    cascadable = m.Cascadable
                })
            });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController),
                    nameof(GetFamilyForDateChange)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    private static bool IsDateCascadeField(JobProperty property) =>
        property is JobProperty.Date or JobProperty.BookedTime;

    internal static bool ShouldRecalculateRate(JobProperty property) =>
        property switch
        {
            JobProperty.AirportOnly => true,
            JobProperty.Date => true,
            JobProperty.Size => true,
            JobProperty.Items => true,
            JobProperty.SpeedID => true,
            JobProperty.AcceptedJobTypeID => true,
            JobProperty.Weight => true,
            JobProperty.ClientID => true,
            JobProperty.Pedal => true,
            JobProperty.Reprice => true,
            JobProperty.Truck => true,
            JobProperty.Van => true,
            JobProperty.DGClass => true,
            JobProperty.DGDocumentation => true,
            JobProperty.Direct => true,
            JobProperty.BookedTime => true,
            JobProperty.TailLiftPu => true,
            JobProperty.TailLiftDo => true,
            JobProperty.DeliverToPrivateRes => true,
            JobProperty.PickupArrivalTime => true,
            JobProperty.DeliveryArrivalTime => true,
            _ => false
        };

    public async Task<IActionResult> UpdateBulkJob(
        int bulkJobId,
        JobProperty field,
        string value
    )
    {
        await jobCommandRepository.UpdateBulkJobAsync(bulkJobId, field, value);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> ReleaseBulkJob(int bulkJobId)
    {
        try
        {
            var jobNumbers = await jobCommandRepository.ReleaseBulkJobByIdAsync(bulkJobId);

            Log.Information("Released bulk job {BulkJobId} — produced live jobs {JobNumbers}",
                bulkJobId, string.Join(", ", jobNumbers));
            return Ok(new { jobNumbers });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController), nameof(ReleaseBulkJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> QuickCreateJob([FromBody] JobCreateViewModel request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);

            var created = await jobCommandRepository.QuickAddJobAsync(request);

            if (created.JobId == 0)
            {
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    "Created Job Id is null"
                );
            }

            return Json(new { jobId = created.JobId, jobNumber = created.JobNumber });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(QuickCreateJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> InterCourierCharge([FromBody] InterCourierChargeViewModel viewModel)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(viewModel);

            await jobCommandRepository.AddInterCourierChargeAsync(viewModel);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(InterCourierCharge)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> HasClientItemsAvailable(int clientId, int speedId)
    {
        var hasItems = await jobQueryRepository.HasClientItemsAvailableAsync(clientId, speedId);
        return Json(hasItems);
    }

    public async Task<IActionResult> GetAllClientItems(int clientId, int speedId, int jobId)
    {
        var clientItems =
            await jobQueryRepository.GetClientItemsBySpeedAsync(clientId, speedId, jobId);
        return Json(clientItems);
    }

    [HttpPost]
    public async Task<IActionResult> AddClientItemsToJob(
        int jobId,
        [FromBody] ClientItemsModel itemsModel
    )
    {
        if (itemsModel != null)
        {
            await jobCommandRepository.AddClientsItemToJobAsync(
                jobId,
                itemsModel.ServiceIds,
                itemsModel.TotalCost
            );
        }

        return Ok();
    }

    public async Task<IActionResult> SendPod(int jobId, string toEmail)
    {
        var selectedJob = await jobQueryRepository.GetSingleJobById(jobId);

        if (selectedJob == null)
        {
            return NotFound();
        }

        var att = new Attachment(
            new MemoryStream(selectedJob.PodPhoto),
            selectedJob.JobNo + ".png"
        );

        SendEmail(
            toEmail,
            Environment.GetEnvironmentVariable("FromAddress"),
            $"Hello, attached is the proof of delivery photo for job {selectedJob.JobNo}.",
            $"Delivery Photo for {selectedJob.JobNo}",
            att
        );

        return Ok();
    }

    private static void SendEmail(
        string toAddress,
        string fromAddress,
        string body,
        string subject,
        Attachment attachment = null,
        string replyTo = null
    )
    {
        using var message = new MailMessage();
        message.IsBodyHtml = true;
        message.From = new MailAddress(fromAddress);
        message.Subject = subject;
        message.Body = body;
        message.Priority = MailPriority.High;
        message.To.Add(toAddress);
        message.Headers.Add("Message-ID", $"<{Guid.NewGuid()}@DFRNT.com>");

        if (attachment != null)
        {
            message.Attachments.Add(attachment);
        }

        if (!string.IsNullOrEmpty(replyTo))
        {
            message.ReplyToList.Add(new MailAddress(replyTo));
        }

        using var smtp = new SmtpClient();
        smtp.Host = Environment.GetEnvironmentVariable("SMTPServer");
        smtp.UseDefaultCredentials = false;
        smtp.EnableSsl = true;
        smtp.Credentials = new NetworkCredential(
            Environment.GetEnvironmentVariable("SMTPUser"),
            Environment.GetEnvironmentVariable("SMTPPass")
        );
        var smtpPortEnv = Environment.GetEnvironmentVariable("SMTP_Port");
        smtp.Port = int.TryParse(smtpPortEnv, out var smtpPort) ? smtpPort : 587;
        smtp.Send(message);
    }

    public async Task<IActionResult> GetAttachedFiles(int jobId)
    {
        if (Debugger.IsAttached)
        {
            return Ok(new[]
            {
                new
                {
                    fileName = "invoice_2026.pdf", s3Key = $"jobs/{jobId}/invoice_2026.pdf",
                    contentType = "application/pdf", size = 245_760L, lastModified = DateTimeOffset.UtcNow.AddDays(-2),
                    isPOD = false
                },
                new
                {
                    fileName = "packing_slip.pdf", s3Key = $"jobs/{jobId}/packing_slip.pdf",
                    contentType = "application/pdf", size = 102_400L, lastModified = DateTimeOffset.UtcNow.AddDays(-3),
                    isPOD = false
                },
                new
                {
                    fileName = "label_photo.jpg", s3Key = $"jobs/{jobId}/label_photo.jpg", contentType = "image/jpeg",
                    size = 1_048_576L, lastModified = DateTimeOffset.UtcNow.AddDays(-4), isPOD = false
                }
            });
        }

        try
        {
            var s3Files = await jobPhotoService.GetAttachedFilesAsync(jobId);
            return Ok(s3Files);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(GetAttachedFiles)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UploadFile([FromForm] FileUploadRequest request)
    {
        if (Debugger.IsAttached)
        {
            if (request?.File == null)
            {
                return BadRequest("No file uploaded");
            }

            return Ok(new
            {
                message = "File uploaded successfully",
                fileName = request.File.FileName,
                s3Key = $"jobs/{request.JobId}/{request.File.FileName}_{DateTimeOffset.UtcNow.Ticks}",
                size = request.File.Length,
                contentType = request.File.ContentType,
                uploadDate = DateTimeOffset.UtcNow.ToString("o")
            });
        }

        try
        {
            if (request?.File == null)
            {
                return BadRequest("No file uploaded");
            }

            var result = await jobPhotoService.UploadJobAttachmentAsync(request.JobId, request.File);

            if (!result.Success)
            {
                return BadRequest(result.ErrorMessage);
            }

            return Ok(new
            {
                message = "File uploaded successfully",
                fileName = result.FileName,
                s3Key = result.S3Key,
                size = result.Size,
                contentType = result.ContentType,
                uploadDate = result.UploadDate.ToString("o")
            });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(UploadFile)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> DownloadFile(string key)
    {
        if (Debugger.IsAttached)
        {
            var png = Convert.FromBase64String(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
            var fileName = key.Contains('/') ? key[(key.LastIndexOf('/') + 1)..] : key;
            return File(png, "image/png", fileName);
        }

        try
        {
            var result = await jobPhotoService.DownloadFileAsync(key);

            if (!result.Success)
            {
                return result.ErrorMessage.Contains("not found")
                    ? NotFound(result.ErrorMessage)
                    : StatusCode(500, result.ErrorMessage);
            }

            return File(result.FileBytes, result.ContentType, result.FileName);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(DownloadFile)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> DeleteFile(string key)
    {
        if (Debugger.IsAttached)
        {
            return Ok(new { message = "File deleted successfully" });
        }

        try
        {
            var success = await jobPhotoService.DeleteFileAsync(key);

            if (!success)
            {
                return BadRequest("Failed to delete file or file key is required");
            }

            return Ok(new { message = "File deleted successfully" });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(DeleteFile)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateNote(int jobId, string note, CancellationToken ct)
    {
        Log.Information("Request received to update note for job {JobId}", jobId);

        if (jobId <= 0)
        {
            Log.Warning("Invalid jobId received: {JobId}", jobId);
            return BadRequest(new { message = "Invalid job ID" });
        }

        if (string.IsNullOrWhiteSpace(note))
        {
            Log.Warning("Empty note value received for job {JobId}", jobId);
            return BadRequest(new { message = "Note cannot be empty" });
        }

        var gateResult = await partnerJobGate.EvaluateAsync(jobId, JobChangeField.Notes, note, reason: null, ct);
        switch (gateResult)
        {
            case PartnerJobGateResult.AutoApplied auto:
                return Ok(new { applied = true, requestId = auto.RequestId, message = "Note synced with partner" });
            case PartnerJobGateResult.PendingApproval pending:
                return Accepted(new { pending = true, requestId = pending.RequestId });
            case PartnerJobGateResult.Blocked blocked:
                return BadRequest(new { message = blocked.Message });
        }

        try
        {
            await jobCommandRepository.UpdateJobNoteAsync(jobId, note);
            Log.Information("Successfully updated note for job {JobId}", jobId);
            return Ok(new { message = "Note updated successfully" });
        }
        catch (KeyNotFoundException ex)
        {
            Log.Error(ex, "Job not found for ID {JobId}", jobId);
            return StatusCode(500, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error updating note for job {JobId}. Error: {ErrorMessage}",
                jobId,
                ex.Message
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateJobPackages([FromBody] UpdateJobPackagesRequest request,
        CancellationToken ct)
    {
        try
        {
            var payload = JsonSerializer.Serialize(
                new { request.Parcels, request.Weight, request.CalculateDimsOncePerJob },
                CompoundPayloadJsonOptions);
            var gateResult = await partnerJobGate.EvaluateAsync(
                request.JobId, JobChangeField.Packages, payload, reason: null, ct);
            if (TryHandleGateResult(gateResult, out var earlyResponse))
            {
                return earlyResponse;
            }

            await jobCommandRepository.UpdatePackagesForJobAsync(request.JobId, request.Parcels, request.CalculateDimsOncePerJob);
            if (request.Weight is > 0)
            {
                await jobCommandRepository.UpdateJobWeightAsync(request.JobId, request.Weight.Value);
            }

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController), nameof(UpdateJobPackages)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateBulkJobPackages([FromBody] UpdateBulkJobPackagesRequest request)
    {
        try
        {
            await jobCommandRepository.UpdatePackagesForBulkJobAsync(request.BulkJobId, request.Parcels, request.CalculateDimsOncePerJob);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController), nameof(UpdateBulkJobPackages)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> IsJobParent(int jobId)
    {
        var isParent = await jobQueryRepository.IsJobParentAsync(jobId);
        return Json(isParent);
    }

    public async Task<IActionResult> GetRelatedJobsMultiSelectList(int jobId, bool isArchived, bool isBulkJob = false)
    {
        try
        {
            var relatedJobs = await jobQueryRepository.GetRelatedJobsMultiSelectListAsync(jobId, isArchived, isBulkJob);
            return Json(relatedJobs);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting related jobs for Job {JobId}", jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> IsBulkJobParent(int bulkJobId)
    {
        var isParent = await jobQueryRepository.IsBulkJobParent(bulkJobId);
        return Json(isParent);
    }

    public async Task<IActionResult> GetJobItemTypes(int? jobId, int? bulkJobId)
    {
        var items = await jobQueryRepository.GetJobItemTypesAsync(jobId, bulkJobId);
        return Json(items);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateJobReadStatus(int jobId, bool hasBeenRead)
    {
        try
        {
            await jobCommandRepository.UpdateJobReadStatusAsync(jobId, hasBeenRead);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating job read status for Job {JobId}", jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateDeliveryAddress([FromBody] UpdateAddressRequest request,
        CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(request.Address, CompoundPayloadJsonOptions);
        var gateResult = await partnerJobGate.EvaluateAsync(
            request.JobId, JobChangeField.DeliveryAddress, payload, reason: null, ct);
        if (TryHandleGateResult(gateResult, out var earlyResponse))
        {
            return earlyResponse;
        }

        return await UpdateAddressAsync(
            request,
            jobCommandRepository.UpdateDeliveryAddressAsync,
            AddressType.Delivery,
            isBooking: false);
    }

    [HttpPost]
    public async Task<IActionResult> UpdatePickupAddress([FromBody] UpdateAddressRequest request, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(request.Address, CompoundPayloadJsonOptions);
        var gateResult = await partnerJobGate.EvaluateAsync(
            request.JobId, JobChangeField.PickupAddress, payload, reason: null, ct);
        if (TryHandleGateResult(gateResult, out var earlyResponse))
        {
            return earlyResponse;
        }

        return await UpdateAddressAsync(
            request,
            jobCommandRepository.UpdatePickupAddressAsync,
            AddressType.Pickup,
            isBooking: false);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateBookingPickupAddress([FromBody] UpdateAddressRequest request)
    {
        var partnerGuard = await RejectIfPartnerJobAsync(request.JobId);
        if (partnerGuard != null)
        {
            return partnerGuard;
        }

        return await UpdateAddressAsync(
            request,
            recurringJobRepository.UpdateBookingPickupAddressAsync,
            AddressType.Pickup,
            isBooking: true);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateBookingDeliveryAddress([FromBody] UpdateAddressRequest request)
    {
        var partnerGuard = await RejectIfPartnerJobAsync(request.JobId);
        if (partnerGuard != null)
        {
            return partnerGuard;
        }

        return await UpdateAddressAsync(
            request,
            recurringJobRepository.UpdateBookingDeliveryAddressAsync,
            AddressType.Delivery,
            isBooking: true);
    }

    private async Task<IActionResult> UpdateAddressAsync(
        UpdateAddressRequest request,
        Func<UpdateAddressRequest, Task> updateAddressAction,
        AddressType addressType,
        bool isBooking)
    {
        try
        {
            await updateAddressAction(request);
            return Ok();
        }
        catch (Exception ex)
        {
            var operationType = $"{(isBooking ? "booking " : string.Empty)}{addressType.ToString().ToLower()}";
            Log.Error(ex, "Error updating {OperationType} address for job {JobId}", operationType, request.JobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    private async Task RecalculateJobRateAsync(int jobId, bool isBooking)
    {
        var isArchived = !isBooking && await jobQueryRepository.IsJobArchived(jobId);

        await jobCommandRepository.SetJobRatedManuallyAsync(jobId, isBooking, false);

        var isUsCustomer = infoService.IsUsTenant();

        if (isUsCustomer)
        {
            var jobDetailsUs = isBooking
                ? await jobQueryRepository.GetJobBookingDetailsForRatingAsync(jobId)
                : await jobQueryRepository.GetJobDetailsForRatingAsync(jobId);

            await rateJobService.RateJobUsAsync(jobDetailsUs);
            return;
        }

        var jobDetailsNz = isBooking
            ? await jobQueryRepository.GetJobBookingDetailsForRatingNzAsync(jobId)
            : await jobQueryRepository.GetJobDetailsForRatingNzAsync(jobId, isArchived);

        await rateJobService.RateJobNzAsync(jobDetailsNz);
    }

    public async Task<IActionResult> GetTimeZoneOptions()
    {
        try
        {
            var timeZones = await jobQueryRepository.GetTimeZoneOptions();
            return Json(timeZones);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating job read status");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddStopToJob([FromBody] AddStopRequest data)
    {
        try
        {
            var newStopJobId = await addStopJobService.AddStopInsertJobAsync(data);
            return Json(newStopJobId);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating job read status");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddStopToRecurringJob([FromBody] AddStopRequest data)
    {
        try
        {
            var newStopJobId = await addStopJobService.AddStopInsertRecurringJobAsync(data);
            return Json(newStopJobId);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating job read status for Job {JobId}", data.JobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetDeliveryJourney(int jobId, string timeZone = null)
    {
        try
        {
            infoService.SetTenantTimeZoneOverride(timeZone);

            await jobCommandRepository.ApplyWebQtyUpdateAsync(jobId);
            var deliveryJourney = await deliveryJourneyService.GetDeliveryJourneyForJobAsync(jobId);
            return Json(deliveryJourney);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving the delivery journey for Job {JobId}", jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetRecurringJobDeliveryJourney(int bookingId, string timeZone = null)
    {
        try
        {
            infoService.SetTenantTimeZoneOverride(timeZone);

            var journey = await deliveryJourneyService.GetDeliveryJourneyForRecurringBookingAsync(bookingId);
            return Json(journey);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving the recurring delivery journey for Booking {BookingId}", bookingId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ApplyWebQtyUpdate(int jobId)
    {
        try
        {
            var partnerGuard = await RejectIfPartnerJobAsync(jobId);
            if (partnerGuard != null)
            {
                return partnerGuard;
            }

            var applied = await jobCommandRepository.ApplyWebQtyUpdateAsync(jobId);
            return applied ? Ok() : NotFound("No pending web qty update found for this job.");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController), nameof(ApplyWebQtyUpdate)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> BulkUpdateReadStatus([FromBody] BulkReadUpdateRequestModel data)
    {
        try
        {
            await jobCommandRepository.BulkUpdateReadStatusAsync(data);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error bulk marking jobs as read");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> ScanJobDetail(DateTimeOffset runDate, int jobId, bool isBulkJob = false)
    {
        try
        {
            var scanList = await jobQueryRepository.ScanList(runDate, jobId, isBulkJob);
            return Json(scanList);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(ScanJobDetail)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> SimpleRepriceJobManual([FromBody] SimpleRepriceJobModel data)
    {
        try
        {
            if (!await pricingPermissionService.CanModifyPricesAsync())
            {
                return StatusCode(StatusCodes.Status403Forbidden, "You do not have permission to modify job prices");
            }

            await pricingPermissionService.ValidateJobAccessAsync(data.JobId);

            await jobCommandRepository.SimpleRepriceJobManualAsync(data);
            return Ok();
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(ex, "Unauthorized access to reprice job {JobId}", data.JobId);
            return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(SimpleRepriceJobManual)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> RepriceJobWithBaseAmount([FromBody] RepriceJobWithBaseAmountModel data)
    {
        try
        {
            if (!await pricingPermissionService.CanUsePricingModeAsync("base"))
            {
                return StatusCode(StatusCodes.Status403Forbidden, "You do not have permission to set base amounts");
            }

            await pricingPermissionService.ValidateJobAccessAsync(data.JobId);

            var newRate = await jobCommandRepository.RepriceJobWithBaseAmountAsync(data);
            return Ok(newRate);
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(ex, "Unauthorized access to reprice job with base amount {JobId}", data.JobId);
            return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController),
                    nameof(RepriceJobWithBaseAmount)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpGet]
    public async Task<IActionResult> RecalculateJobRate(int jobId)
    {
        try
        {
            if (!await pricingPermissionService.CanUsePricingModeAsync("recalculate"))
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to recalculate job prices");
            }

            await pricingPermissionService.ValidateJobAccessAsync(jobId);

            var newRate = await GetJobRateAsync(jobId, false);
            return Ok(newRate);
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(ex, "Unauthorized access to recalculate job rate {JobId}", jobId);
            return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(RecalculateJobRate)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpGet]
    public async Task<IActionResult> RecalculateJobRates(string jobIds)
    {
        try
        {
            if (!await pricingPermissionService.CanUsePricingModeAsync("recalculate"))
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to recalculate job prices");
            }

            var ids = (jobIds ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(id => int.TryParse(id, out var parsed) ? parsed : 0)
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            if (ids.Count == 0)
            {
                return Json(Array.Empty<object>());
            }

            var currentAmounts = await jobQueryRepository.GetJobCurrentAmountsAsync(ids);
            var results = new List<object>(ids.Count);

            foreach (var id in ids)
            {
                currentAmounts.TryGetValue(id, out var current);

                try
                {
                    await pricingPermissionService.ValidateJobAccessAsync(id);
                    var rate = await GetJobRateAsync(id, current?.IsPrebook ?? false);

                    results.Add(new
                    {
                        jobId = id,
                        jobNo = current?.JobNo,
                        rate = rate.Rate,
                        description = rate.Description,
                        currentAmount = current?.Amount ?? 0m,
                        isPrebook = current?.IsPrebook ?? false,
                        ratedManually = current?.RatedManually ?? false,
                        failed = false
                    });
                }
                catch (Exception e)
                {
                    Log.Warning(e, "Failed to preview rate for job {JobId} in batch", id);
                    results.Add(new
                    {
                        jobId = id,
                        jobNo = current?.JobNo,
                        rate = 0m,
                        description = (string)null,
                        currentAmount = current?.Amount ?? 0m,
                        isPrebook = current?.IsPrebook ?? false,
                        ratedManually = current?.RatedManually ?? false,
                        failed = true
                    });
                }
            }

            return Json(results);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController),
                    nameof(RecalculateJobRates)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ApplyRecalculatedJobRate(int jobId, bool isPrebook = false)
    {
        try
        {
            await RecalculateJobRateAsync(jobId, isPrebook);
            var newRate = await jobQueryRepository.GetJobAmountAsync(jobId, isPrebook);
            return Ok(new { rate = newRate });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController),
                    nameof(ApplyRecalculatedJobRate)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    private async Task<ApiRerate> GetJobRateAsync(int jobId, bool isBooking)
    {
        var isArchived = !isBooking && await jobQueryRepository.IsJobArchived(jobId);

        var isUsCustomer = infoService.IsUsTenant();

        ApiRerate result;
        if (isUsCustomer)
        {
            var jobDetailsUs = isBooking
                ? await jobQueryRepository.GetJobBookingDetailsForRatingAsync(jobId)
                : await jobQueryRepository.GetJobDetailsForRatingAsync(jobId);

            result = await rateJobService.GetJobRateUsAsync(jobDetailsUs);
        }
        else
        {
            var jobDetailsNz = isBooking
                ? await jobQueryRepository.GetJobBookingDetailsForRatingNzAsync(jobId)
                : await jobQueryRepository.GetJobDetailsForRatingNzAsync(jobId, isArchived);

            result = await rateJobService.GetJobRateNzAsync(jobDetailsNz);
        }

        // The rating engine only calculates freight - manually-added accessorial charges
        // (JobAccessorialCharge, separate from the engine's own PricingBreakdown rows) are
        // layered on top of the job's real amount already, so the preview must add them back in
        // too or it misleadingly looks like a reprice would drop them. Accessorial charges are a
        // live-job concept only (added via the job list), so skip for prebook jobs.
        if (!isBooking)
        {
            var accessorialTotal = await accessorialChargeRepository.GetTotalAppliedChargesAsync(jobId);
            if (accessorialTotal != 0)
            {
                result = result with { Rate = result.Rate + accessorialTotal };
            }
        }

        return result;
    }

    public async Task<IActionResult> GetPricingPermissions()
    {
        try
        {
            var permissions = await pricingPermissionService.GetPricingPermissionsAsync();
            return Json(permissions);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting pricing permissions");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetActivePartnerOptions()
    {
        try
        {
            var activePartners = await jobQueryRepository.GetActivePartnerOptionsAsync();
            return Json(activePartners);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting active partner options");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> SendToPartner([FromBody] SendToPartnerRequest request)
    {
        try
        {
            var result = await sendToPartnerService.SendAsync(request);

            if (result.Success)
            {
                await jobCommandRepository.UpdateJobAsync(request.JobId, JobProperty.Locked, "true");
            }

            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error sending job {JobId} to partner", request.JobId);
            return Json(new SendToPartnerResponse
            {
                Success = false,
                Message = $"An error occurred while sending job to partner: {ErrorMessageStringFormatter.Format(ex)}"
            });
        }
    }

    [HttpPost]
    public async Task<IActionResult> GetPartnerRateForJob([FromBody] PartnerRateForJobRequest request)
    {
        try
        {
            var result = await sendToPartnerService.GetRateForJobAsync(request.PairingId, request.JobId);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting partner rate for pairing {PairingId}, job {JobId}",
                request.PairingId, request.JobId);
            return Json(new PartnerRateForJobResponse { Source = "none" });
        }
    }

    [HttpGet("{jobId:int}")]
    public async Task<IActionResult> GetPartnerInboundRateAcceptance(int jobId)
    {
        var state = await sendToPartnerService.GetInboundJobAcceptanceStateAsync(jobId);
        return state is null
            ? Json(new PartnerInboundJobAcceptanceStateResponse { Status = "Allowed" })
            : Json(state);
    }

    [HttpPost]
    public async Task<IActionResult> AcceptPartnerRate([FromBody] AcceptPartnerRateRequest request)
    {
        try
        {
            var result = await sendToPartnerService.AcceptInboundJobAsync(request.JobId);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error accepting partner rate for job {JobId}", request.JobId);
            return Json(new PartnerInboundJobActionResponse { Success = false, ErrorMessage = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> RejectPartnerRate([FromBody] RejectPartnerRateRequest request)
    {
        try
        {
            var result = await sendToPartnerService.RejectInboundJobAsync(request.JobId, request.Reason);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error rejecting partner rate for job {JobId}", request.JobId);
            return Json(new PartnerInboundJobActionResponse { Success = false, ErrorMessage = ex.Message });
        }
    }

    private async Task<IActionResult> RejectIfPartnerJobAsync(int jobId)
    {
        if (await jobQueryRepository.IsPartnerJobAsync(jobId))
        {
            return BadRequest(new { message = "This job is managed by a partner and cannot be modified." });
        }

        return null;
    }

    private async Task<IActionResult> RejectIfOutboundPartnerJobAsync(int jobId)
    {
        if (await jobQueryRepository.IsOutboundPartnerJobAsync(jobId, infoService.GetCurrentTenantId()))
        {
            return BadRequest(new
            {
                message = "This job has been dispatched to a partner; manage it from the partner-pairing side."
            });
        }

        return null;
    }

    private async Task<IActionResult> RejectIfRateNotAcceptedAsync(int jobId)
    {
        var gate = await partnerJobGate.EvaluateAllocateAsync(jobId, CancellationToken.None);
        return gate is PartnerJobGateResult.Blocked blocked
            ? BadRequest(new { message = blocked.Message })
            : null;
    }

    private async Task<IActionResult> RejectIfAnyPartnerJobAsync(params int?[] jobIds)
    {
        foreach (var id in jobIds)
        {
            if (id is { } jobId && await jobQueryRepository.IsPartnerJobAsync(jobId))
            {
                return BadRequest(new { message = "This job is managed by a partner and cannot be modified." });
            }
        }

        return null;
    }

    private static readonly JsonSerializerOptions CompoundPayloadJsonOptions = new(JsonSerializerDefaults.Web);

    private static bool TryHandleGateResult(PartnerJobGateResult result, out IActionResult earlyResponse)
    {
        switch (result)
        {
            case PartnerJobGateResult.AutoApplied auto:
                earlyResponse = new OkObjectResult(new { applied = true, requestId = auto.RequestId });
                return true;
            case PartnerJobGateResult.PendingApproval pending:
                earlyResponse = new AcceptedResult(string.Empty, new { pending = true, requestId = pending.RequestId });
                return true;
            case PartnerJobGateResult.Blocked blocked:
                earlyResponse = new BadRequestObjectResult(new { message = blocked.Message });
                return true;
            default:
                earlyResponse = null!;
                return false;
        }
    }
}