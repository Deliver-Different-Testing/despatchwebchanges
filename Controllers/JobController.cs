using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
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
    IDispatchJobService dispatchJobService,
    IDeliveryJourneyService deliveryJourneyService,
    IPricingPermissionService pricingPermissionService,
    IPodReportService podReportService,
    ISplitJobService splitJobService,
    ISendToPartnerService sendToPartnerService,
    IPartnerJobGate partnerJobGate
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
            if (!isInternal) await clientAccessValidator.ValidateClientAccessAsync(cid, clientIds);

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

            if (!isInternal) await clientAccessValidator.ValidateClientAccessAsync(0, clientIds);
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
                await clientAccessValidator.ValidateClientAccessAsync(staffId, clientIds);

            // Get jobs
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
            Log.Information("Getting price breakdown for job {JobId} (prebook: {isPrebook}, archived: {isArchived})",
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

    [HttpPost]
    public async Task<IActionResult> AddPriceComponent([FromBody] ChargeViewModel breakdown)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var jobId = breakdown.ChildJobId ?? breakdown.PrebookJobId;
            if (!jobId.HasValue) throw new ArgumentException(
                    "ChildJobId or PrebookJobId must be provided",
                    nameof(breakdown));

            var partnerGuard = await RejectIfAnyPartnerJobAsync(breakdown.JobId, breakdown.ChildJobId);
            if (partnerGuard != null) return partnerGuard;

            // Permission check: user must have breakdown permission
            if (!await pricingPermissionService.CanModifyPriceBreakdownAsync())
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to modify price breakdowns");

            // Job access validation
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
                throw new ArgumentException(
                    "JobId or PrebookJobId must be provided",
                    nameof(breakdown));

            var partnerGuard = await RejectIfAnyPartnerJobAsync(breakdown.JobId, breakdown.ChildJobId);
            if (partnerGuard != null) return partnerGuard;

            // Permission check: user must have breakdown permission
            if (!await pricingPermissionService.CanModifyPriceBreakdownAsync())
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to modify price breakdowns");

            // Job access validation
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
            if (partnerGuard != null) return partnerGuard;

            // Permission check: user must have breakdown permission
            if (!await pricingPermissionService.CanModifyPriceBreakdownAsync())
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to modify price breakdowns");

            // Job access validation
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
    public async Task<IActionResult> VoidPrebookJob([FromBody] int jobId)
    {
        await jobCommandRepository.VoidPrebookJobAsync(jobId);
        return Ok();
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

        try
        {
            var result = await jobPhotoService.UploadJobPhotoOrSignatureAsync(
                jobId, file, JobPhotoType.Delivery, isPod, podDescription);
            if (!result.Success) return BadRequest(result.ErrorMessage);

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
        if (Debugger.IsAttached) return Json(new { success = true, message = "File deleted successfully" });

        try
        {
            var success = await jobPhotoService.DeleteJobPhotoOrSignatureAsync(jobId, key);
            if (!success) return BadRequest("Failed to delete file or file key is required");

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
            var allPodPhotos = await jobPhotoService.GetDeliveryPhotosAsync(jobId, year, month);
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
            var allPickupPhotos = await jobPhotoService.GetPickupPhotosAsync(jobId, year, month);
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

    [HttpPost]
    public async Task<IActionResult> SendPodReport([FromBody] SendPodReportRequest request)
    {
        try
        {
            if (request.Recipients == null || request.Recipients.Count == 0)
                return BadRequest("At least one recipient is required.");

            // Flatten any semicolon/comma-separated entries into individual addresses
            var allRecipients = request.Recipients
                .SelectMany(r => r.Split([';', ','], StringSplitOptions.RemoveEmptyEntries))
                .Select(r => r.Trim())
                .Where(r => !string.IsNullOrEmpty(r))
                .Distinct()
                .ToList();

            if (allRecipients.Count == 0)
                return BadRequest("No valid recipients provided.");

            // Validate each recipient is a well-formed email address
            var validRecipients = new List<string>();
            foreach (var recipient in allRecipients)
            {
                if (MailAddress.TryCreate(recipient, out _))
                    validRecipients.Add(recipient);
                else
                    Log.Warning("Skipping invalid email address '{Address}' for job {JobId}", recipient, request.JobId);
            }

            if (validRecipients.Count == 0)
                return BadRequest("No valid email addresses provided.");

            await podReportService.QueuePodEmailAsync(request.JobId, validRecipients, request.Subject, request.Body);

            return Ok();
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

    /// <summary>
    /// Applies bulk price updates from an uploaded spreadsheet and returns the results.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> ApplyBulkPriceUpdate(IFormFile file, [FromQuery] string pricingMode)
    {
        try
        {
            // Validate pricing mode is a valid value
            pricingPermissionService.ValidatePricingMode(pricingMode);

            // Permission check: user must have bulk update permission
            if (!await pricingPermissionService.CanBulkUpdatePricesAsync())
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to perform bulk price updates");

            // Permission check: user must have permission for the specific pricing mode
            if (!await pricingPermissionService.CanUsePricingModeAsync(pricingMode))
                return StatusCode(StatusCodes.Status403Forbidden,
                    $"You do not have permission to use the '{pricingMode}' pricing mode");

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

        // Don't create an event if AlertLatePickup is negative
        if (alertLatePickup < 0)
            return new LateStatusResult
                { ShouldCreateEvent = false, EventType = latePickupStatus, LateTime = lateTime };

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

        // Don't create event if AlertLateDelivery is negative
        if (alertLateDelivery < 0)
            return new LateStatusResult
                { ShouldCreateEvent = false, EventType = lateDeliveryStatus, LateTime = adjustedLateTime };

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
                var partnerGuard = await RejectIfPartnerJobAsync(jobId);
                if (partnerGuard != null) return partnerGuard;
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
                var partnerGuard = await RejectIfPartnerJobAsync(jobId);
                if (partnerGuard != null) return partnerGuard;
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
        await jobCommandRepository.ReAssignSelectedJobsAsync(parsedIds);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> SetFirstJob(int jobId, int courierId)
    {
        await jobCommandRepository.SetFirstJobAsync(jobId, courierId);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> Void([FromBody] VoidJobRequest request)
    {
        try
        {
            var partnerGuard = await RejectIfPartnerJobAsync(request.JobId);
            if (partnerGuard != null) return partnerGuard;

            var isArchived = await jobQueryRepository.IsJobArchived(request.JobId);

            if (isArchived)
            {
                await jobCommandRepository.VoidArchivedJobAsync(request);
                return Ok();
            }

            // Get the parent ID before voiding (if this is a child job)
            var parentId = await jobQueryRepository.GetJobParentIdAsync(request.JobId);

            // Determine if the parent is being voided too
            var isParentBeingVoided = parentId.HasValue &&
                                      request.SelectedJobIds is { Count: > 0 } &&
                                      request.SelectedJobIds.Contains(parentId.Value);

            await jobCommandRepository.VoidJobAsync(request);

            // Rerate the parent job if a child was voided but the parent was not
            if (!parentId.HasValue || isParentBeingVoided) return Ok();

            // Don't re-rate if debugging
            if (Debugger.IsAttached) return Ok();

            try
            {
                var isUsTenant = infoService.IsUsTenant();
                if (isUsTenant)
                {
                    var jobDetails = await jobQueryRepository.GetJobDetailsForRatingAsync(parentId.Value);
                    if (!jobDetails.IsManuallyRated)
                        await rateJobService.RateJobUsAsync(jobDetails);
                }
                else
                {
                    var jobDetails = await jobQueryRepository.GetJobDetailsForRatingNzAsync(parentId.Value, false);
                    if (!jobDetails.IsManuallyRated)
                        await rateJobService.RateJobNzAsync(jobDetails);
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
            await jobCommandRepository.RestoreJobsAsync(data.JobIds);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error restoring the following jobs {JobId}. Error: {ErrorMessage}",
                data.JobIds.ToString(),
                ex.Message
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> SplitJob([FromBody] SplitJobRequest request)
    {
        try
        {
            var partnerGuard = await RejectIfPartnerJobAsync(request.JobId);
            if (partnerGuard != null) return partnerGuard;

            var staffInfo = await infoService.GetStaffInfoAsync();
            var staffName = staffInfo.Text;

            await splitJobService.SplitJobAsync(
                request.JobId,
                staffName,
                request.MeetingPointAddress,
                request.CourierIdForLegB);

            return Ok();
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

        // Set up HttpClient
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

        if (response.StatusCode == HttpStatusCode.OK) return Ok();
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

            // Skip re-reate if debugging
            if (Debugger.IsAttached) return Ok();

            // Recalculate the job
            var shouldRecalculateRate = ShouldRecalculateRate(field);
            if (!shouldRecalculateRate) return Ok();

            var isUsTenant = infoService.IsUsTenant();
            if (isUsTenant)
            {
                var jobDetails = await jobQueryRepository.GetJobBookingDetailsForRatingAsync(jobId);
                if (jobDetails.IsManuallyRated) return Ok();

                await rateJobService.RateJobUsAsync(jobDetails);
            }
            else
            {
                var jobDetails = await jobQueryRepository.GetJobBookingDetailsForRatingNzAsync(jobId);
                if (jobDetails.IsManuallyRated) return Ok();

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
    public async Task<IActionResult> UpdateJob(
        int jobId,
        JobProperty field,
        string value,
        CancellationToken ct
    )
    {
        try
        {
            // Route through the partner-job gate. For non-partner jobs and LocalOnly
            // fields this is a no-op and we fall through to the direct write. For
            // Manual / Auto fields on a partner job the gate files a change request
            // (auto-applying or queueing for counterparty approval) and we short-circuit
            // with the gate's outcome instead of writing directly.
            var gateResult = await partnerJobGate.EvaluateAsync(jobId, field, value, ct);
            switch (gateResult)
            {
                case PartnerJobGateResult.AutoApplied auto:
                    return Ok(new { applied = true, requestId = auto.RequestId });
                case PartnerJobGateResult.PendingApproval pending:
                    return Accepted(new { pending = true, requestId = pending.RequestId });
                case PartnerJobGateResult.Blocked blocked:
                    return BadRequest(new { message = blocked.Message });
                // NotPartner / LocalOnly → fall through to the direct write below.
            }

            await jobCommandRepository.UpdateJobAsync(jobId, field, value);
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

        if (!ShouldRecalculateRate(field)) return Ok();

        // Propagate field update and re-rate split children (best effort)
        try
        {
            await splitJobService.PropagateUpdateToSplitChildrenAsync(jobId, field, value);
        }
        catch (Exception e)
        {
            Log.Error(e,
                "Failed to propagate {JobProperty} update to split children for job {JobId}. Error: {Message}",
                field, jobId, e.Message);
        }

        return Ok();
    }

    internal static bool ShouldRecalculateRate(JobProperty property) =>
        // Properties that affect job rating
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
            await jobCommandRepository.ReleaseBulkJobByIdAsync(bulkJobId);

            Log.Information("Successfully released bulk job {JobNumber}", bulkJobId);
            return Ok();
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

            var jobId = await jobCommandRepository.QuickAddJobAsync(request);

            //Check if jobId is valid before continuing
            if (jobId == 0)
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    "Created Job Id is null"
                );

            return Json(jobId);
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
            await jobCommandRepository.AddClientsItemToJobAsync(
                jobId,
                itemsModel.ServiceIds,
                itemsModel.TotalCost
            );
        return Ok();
    }

    public async Task<IActionResult> SendPod(int jobId, string toEmail)
    {
        var selectedJob = await jobQueryRepository.GetSingleJobById(jobId);

        if (selectedJob == null) return NotFound();

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

        if (attachment != null) message.Attachments.Add(attachment);

        if (!string.IsNullOrEmpty(replyTo)) message.ReplyToList.Add(new MailAddress(replyTo));

        using var smtp = new SmtpClient();
        smtp.Host = Environment.GetEnvironmentVariable("SMTPServer");
        smtp.UseDefaultCredentials = false;
        smtp.EnableSsl = true;
        smtp.Credentials = new NetworkCredential(
            Environment.GetEnvironmentVariable("SMTPUser"),
            Environment.GetEnvironmentVariable("SMTPPass")
        );
        var smtpPortEnv = Environment.GetEnvironmentVariable("SMTP_Port");
        smtp.Port = int.TryParse(smtpPortEnv, out var smtpPort) ? smtpPort : 587; // Default to 587 (TLS)
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
            if (request?.File == null) return BadRequest("No file uploaded");
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
            if (request?.File == null) return BadRequest("No file uploaded");

            var result = await jobPhotoService.UploadJobAttachmentAsync(request.JobId, request.File);

            if (!result.Success) return BadRequest(result.ErrorMessage);

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
            // Return a 1x1 transparent PNG as placeholder
            var png = Convert.FromBase64String(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
            var fileName = key.Contains('/') ? key[(key.LastIndexOf('/') + 1)..] : key;
            return File(png, "image/png", fileName);
        }

        try
        {
            var result = await jobPhotoService.DownloadFileAsync(key);

            if (!result.Success)
                return result.ErrorMessage.Contains("not found")
                    ? NotFound(result.ErrorMessage)
                    : StatusCode(500, result.ErrorMessage);

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
        if (Debugger.IsAttached) return Ok(new { message = "File deleted successfully" });

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

        // Notes is an Auto-apply field on partner jobs: the gate writes UcjbNotes on
        // our side via the change-request flow AND forwards the same change to the peer
        // so both mirrors stay in sync. Non-partner jobs fall through to the direct write.
        var gateResult = await partnerJobGate.EvaluateAsync(jobId, JobChangeField.Notes, note, reason: null, ct);
        switch (gateResult)
        {
            case PartnerJobGateResult.AutoApplied auto:
                return Ok(new { applied = true, requestId = auto.RequestId, message = "Note synced with partner" });
            case PartnerJobGateResult.PendingApproval pending:
                return Accepted(new { pending = true, requestId = pending.RequestId });
            case PartnerJobGateResult.Blocked blocked:
                return BadRequest(new { message = blocked.Message });
            // NotPartner / LocalOnly → fall through to direct write below.
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
    public async Task<IActionResult> UpdateJobPackages([FromBody] UpdateJobPackagesRequest request, CancellationToken ct)
    {
        try
        {
            // Serialise just the apply-payload fields (Parcels + Weight) — not JobId,
            // which lives on the change-request row. The peer applies against its own
            // mirror by reading the row's UjcrJobId, not the JSON.
            var payload = JsonSerializer.Serialize(
                new { request.Parcels, request.Weight },
                CompoundPayloadJsonOptions);
            var gateResult = await partnerJobGate.EvaluateAsync(
                request.JobId, JobChangeField.Packages, payload, reason: null, ct);
            if (TryHandleGateResult(gateResult, out var earlyResponse)) return earlyResponse;

            await jobCommandRepository.UpdatePackagesForJobAsync(request.JobId, request.Parcels);
            if (request.Weight is > 0)
                await jobCommandRepository.UpdateJobWeightAsync(request.JobId, request.Weight.Value);
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
            await jobCommandRepository.UpdatePackagesForBulkJobAsync(request.BulkJobId, request.Parcels);
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
    public async Task<IActionResult> UpdateDeliveryAddress([FromBody] UpdateAddressRequest request, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(request.Address, CompoundPayloadJsonOptions);
        var gateResult = await partnerJobGate.EvaluateAsync(
            request.JobId, JobChangeField.DeliveryAddress, payload, reason: null, ct);
        if (TryHandleGateResult(gateResult, out var earlyResponse)) return earlyResponse;

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
        if (TryHandleGateResult(gateResult, out var earlyResponse)) return earlyResponse;

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
        if (partnerGuard != null) return partnerGuard;

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
        if (partnerGuard != null) return partnerGuard;

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
            // First update the address
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
        // Skip if a job is archived
        var isArchived = !isBooking && await jobQueryRepository.IsJobArchived(jobId);
        //if (isArchived) return;

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

    public async Task<IActionResult> GetDeliveryJourney(int jobId)
    {
        try
        {
            // Auto-apply any pending external qty changes before returning the journey
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

    [HttpPost]
    public async Task<IActionResult> ApplyWebQtyUpdate(int jobId)
    {
        try
        {
            var partnerGuard = await RejectIfPartnerJobAsync(jobId);
            if (partnerGuard != null) return partnerGuard;

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


    public async Task<IActionResult> ScanJobDetail(DateTimeOffset runDate, string scan)
    {
        try
        {
            var scanList = await jobQueryRepository.ScanList(runDate, scan);
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
            // Permission check: user must have modified prices permission
            if (!await pricingPermissionService.CanModifyPricesAsync())
                return StatusCode(StatusCodes.Status403Forbidden, "You do not have permission to modify job prices");

            // Job access validation
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
            // Permission check: user must have base amount permission
            if (!await pricingPermissionService.CanUsePricingModeAsync("base"))
                return StatusCode(StatusCodes.Status403Forbidden, "You do not have permission to set base amounts");

            // Job access validation
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
            // Permission check: user must have recalculated permission
            if (!await pricingPermissionService.CanUsePricingModeAsync("recalculate"))
                return StatusCode(StatusCodes.Status403Forbidden,
                    "You do not have permission to recalculate job prices");

            // Job access validation
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
        // Don't skip if a job is archived (should skip if invoiced tho)
        var isArchived = !isBooking && await jobQueryRepository.IsJobArchived(jobId);

        var isUsCustomer = infoService.IsUsTenant();

        if (isUsCustomer)
        {
            var jobDetailsUs = isBooking
                ? await jobQueryRepository.GetJobBookingDetailsForRatingAsync(jobId)
                : await jobQueryRepository.GetJobDetailsForRatingAsync(jobId);

            return await rateJobService.GetJobRateUsAsync(jobDetailsUs);
        }

        var jobDetailsNz = isBooking
            ? await jobQueryRepository.GetJobBookingDetailsForRatingNzAsync(jobId)
            : await jobQueryRepository.GetJobDetailsForRatingNzAsync(jobId, isArchived);

        return await rateJobService.GetJobRateNzAsync(jobDetailsNz);
    }

    /// <summary>
    /// Gets the current user's pricing permissions.
    /// </summary>
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

    private async Task<IActionResult> RejectIfPartnerJobAsync(int jobId)
    {
        if (await jobQueryRepository.IsPartnerJobAsync(jobId))
            return BadRequest(new { message = "This job is managed by a partner and cannot be modified." });
        return null;
    }

    private async Task<IActionResult> RejectIfAnyPartnerJobAsync(params int?[] jobIds)
    {
        foreach (var id in jobIds)
        {
            if (id is { } jobId && await jobQueryRepository.IsPartnerJobAsync(jobId))
                return BadRequest(new { message = "This job is managed by a partner and cannot be modified." });
        }
        return null;
    }

    private static readonly JsonSerializerOptions CompoundPayloadJsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Translate a partner-job gate result into an IActionResult and tell the caller
    /// whether to short-circuit. Returns true when the gate handled the request (Auto
    /// applied, Manual queued, or Blocked); false when the caller should fall through
    /// to the existing direct-write path (NotPartner / LocalOnly).
    /// </summary>
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