using System;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using ExcelDataReader;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Serilog;
using EventType = DespatchWeb.Enums.EventType;

namespace DespatchWeb.Controllers;

[Authorize]
public class JobController(
    IJobRepository jobRepository,
    ITaskRepository taskRepository,
    IClientAccessValidatorService clientAccessValidator,
    IAmazonS3 s3Client,
    HttpClient httpClient,
    IRateJobService rateJobService,
    IRecurringJobRepository recurringJobRepository,
    ITenantInfoService infoService,
    IAddStopJobService addStopJobService,
    IPodExportService podExportService,
    IJobPhotoService jobPhotoService,
    IClientJobsReportService clientJobsReportService,
    IDispatchJobService dispatchJobService,
    IDeliveryJourneyService deliveryJourneyService
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

            var result = await jobRepository.JobListAsync(
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
                string.Join(",", despatchViewIds ?? []),
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
            var result = await jobRepository.GetJobCoordinatesAsync(despatchViewIds);

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
            var jobs = await jobRepository.JobListAsync(
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
            Log.Error(e, $"an error occured getting jobs by clear list");
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetPricingBreakdown(int jobId, bool isPrebook)
    {
        try
        {
            Log.Information("Getting price breakdown for job {JobId} (prebook {isPrebook})", jobId, isPrebook);
            var priceComponents = await jobRepository.GetJobPriceBreakdownAsync(jobId, isPrebook);
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
            var jobId = breakdown.ChildJobId ?? breakdown.PrebookJobId;
            ArgumentNullException.ThrowIfNull(jobId);

            Log.Information("Adding price breakdown for job {JobId}", jobId);

            var chargeId = await jobRepository.AddJobPriceBreakdownAsync(breakdown);

            if (breakdown.JobId.HasValue)
            {
                await taskRepository.AddEventAsync(
                    (int)jobId,
                    "Manually rated price",
                    (int)EventType.ChangePrice);
            }

            return Json(chargeId);
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
            ArgumentNullException.ThrowIfNull(jobId);

            Log.Information("Updating price breakdown for job {JobId}",
                breakdown.JobId ?? breakdown.PrebookJobId);

            await jobRepository.UpdateJobPriceBreakdownAsync(breakdown);

            if (breakdown.JobId.HasValue)
            {
                await taskRepository.AddEventAsync(
                    jobId ?? 0,
                    "Manually rated price",
                    (int)EventType.ChangePrice);
            }

            return Ok();
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
            Log.Information("Deleting price breakdown for charge {chargeId}", request.ChargeId);

            await jobRepository.DeleteJobPriceBreakdownAsync(request.ChargeId);

            await taskRepository.AddEventAsync(
                request.JobId,
                "Manually rated price",
                (int)EventType.ChangePrice);

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error deleting price breakdown for charge {chargeId}",
                request.ChargeId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> VoidPrebookJob(int jobId)
    {
        await jobRepository.VoidPrebookJobAsync(jobId);
        return Ok();
    }

    public async Task<IActionResult> GetCurrentWorkList(int courierId,
        DateTimeOffset startDate,
        DateTimeOffset endDate)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(courierId);
            ArgumentNullException.ThrowIfNull(startDate);
            ArgumentNullException.ThrowIfNull(endDate);
            
            var result = await jobRepository.CurrentJobListAsync(courierId, startDate, endDate);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}", ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(GetCurrentWorkList)));
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

    [HttpDelete]
    public async Task<IActionResult> DeleteJobPickupPhotoOrSignature(int jobId, string key)
    {
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
                    nameof(DeleteJobPickupPhotoOrSignature)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetJobDeliveryPhotosAndSignature(int jobId, int year, int month)
    {
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
            var job = await jobRepository.GetJobByIdAsync(jobId);
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
            var job = await jobRepository.GetDispatchJobDetailAsync(jobId);
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
            var job = await jobRepository.GetBulkDispatchJobDetailAsync(bulkJobId);
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
        var result = await jobRepository.GetBulkJobDetailAsync(bulkJobId);
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

    public async Task<IActionResult> PodSearch([FromQuery] PodSearchRequest data)
    {
        try
        {
            var result = await jobRepository.PodSearchAsync(data);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(PodSearch)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> PodSearchDownload(PodSearchDownloadRequest requestData)
    {
        try
        {
            var result = await podExportService.GenerateJobsReportAsync(requestData);
            return File(result.FileBytes, "text/csv", result.FileName);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error generating jobs report download");
            return StatusCode(500, "An error occurred while generating the report");
        }
    }

    [HttpGet]
    public async Task<IActionResult> ClientJobsReportDownload([FromQuery] ClientJobsReportRequest request)
    {
        try
        {
            var (fileBytes, fileName) = await clientJobsReportService.GenerateClientJobsReportCsvAsync(request);
            return File(fileBytes, "text/csv", fileName);
        }
        catch (InvalidOperationException ex)
        {
            // Return 404 Not Found when no data matches the criteria
            Log.Warning(ex, "Client jobs report - no data found: {@Request}", request);
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        var currentDate = infoService.GetCurrentTenantTime();

        if (
            file == null
            || string.IsNullOrWhiteSpace(file.FileName)
            || !new[] { ".xls", ".xlsx", ".csv" }.Contains(
                file.FileName.Trim()[
                        file.FileName.Trim().LastIndexOf('.')..].Trim()
                    .ToLower()
            )
        )
            return BadRequest("Invalid file format.");

        var folder = currentDate.ToString("yyyyMM");
        var fileExtension = file
            .FileName.Trim()
            .ToLower()[file.FileName.Trim().LastIndexOf('.')..];

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        var byteArray = memoryStream.ToArray();

        var timestamp = currentDate.ToString("yyyyMMddHHmmss");
        var key = $"Jobs/{folder}/Jobs-{timestamp}";

        using var ms = new MemoryStream(byteArray);
        try
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = Environment
                    .GetEnvironmentVariable("S3Bucket")
                    //.GetEnvironmentVariable("S3BucketMars")
                    ?.Replace("downloads", "uploads"),
                Key = key,
                ContentType = file.ContentType,
                InputStream = ms
            };
            putRequest.Metadata.Add("FileName", file.FileName);
            await s3Client.PutObjectAsync(putRequest);
        }
        catch (AmazonS3Exception e)
        {
            Log.Error(
                e,
                $"{nameof(UploadFile)} Error encountered when writing job file upload object to S3: "
            );
        }
        catch (Exception e)
        {
            Log.Error(
                e,
                $"{nameof(UploadFile)} Error encountered when writing file upload object to S3: "
            );
        }

        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        string sResult;

        using (
            var reader = fileExtension == ".csv"
                ? ExcelReaderFactory.CreateCsvReader(memoryStream)
                : ExcelReaderFactory.CreateReader(memoryStream)
        )
        {
            var output = reader
                .AsDataSet(
                    new ExcelDataSetConfiguration
                    {
                        ConfigureDataTable = _ =>
                            new ExcelDataTableConfiguration { UseHeaderRow = true }
                    }
                )
                .Tables[0]; //Only ready from the first sheet

            // Log the column names from the DataTable
            Log.Debug(
                "DataTable Columns: {@Columns}",
                output.Columns.Cast<DataColumn>().Select(c => c.ColumnName).ToList()
            );

            // Convert DataTable to a List of Dictionary
            var rows = new List<Dictionary<string, object>>();
            foreach (DataRow row in output.Rows)
            {
                var dict = new Dictionary<string, object>();
                foreach (DataColumn col in output.Columns)
                {
                    // Handle DBNull conversion
                    var value = row[col];
                    dict[col.ColumnName] = value == DBNull.Value ? null : value;
                }

                rows.Add(dict);
            }

            // Log the first row as a sample
            if (rows.Count != 0) Log.Debug("Sample Row Data: {@FirstRow}", rows.First());

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true,
                Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
                NumberHandling = JsonNumberHandling.AllowReadingFromString,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            };

            sResult = JsonSerializer.Serialize(rows, options);
            Log.Debug(
                "Serialized JSON (first 500 chars): {JsonSample}",
                sResult.Length > 500 ? sResult[..500] + "..." : sResult
            );
        }

        // Replace empty strings with null before deserializing
        sResult = sResult.Replace("\"\"", "null");

        var deserializeOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            NumberHandling = JsonNumberHandling.AllowReadingFromString |
                             JsonNumberHandling.AllowNamedFloatingPointLiterals,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        try
        {
            var result = JsonSerializer.Deserialize<List<JobManualPriceModel>>(
                sResult,
                deserializeOptions);

            if (result.Count == 0)
                return Ok();

            await jobRepository.UpdateManualPriceAsync(result);
        }
        catch (JsonException ex)
        {
            // Log the specific error and the problematic JSON
            Console.WriteLine($"Error deserializing JSON: {ex.Message}");
            Console.WriteLine($"JSON content: {sResult}");
        }

        return Ok();
    }

    public async Task<IActionResult> ValidateSwapPod(string job)
    {
        try
        {
            var isSwapValid = await jobRepository.ValidatePodSwapAsync(job);
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
        await jobRepository.SwapPodAsync(job1, job2);
        return Ok();
    }

    public async Task<IActionResult> BulkSearch([FromQuery] PodSearchRequest request)
    {
        try
        {
            var result = await jobRepository.BulkSearchAsync(request);
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
            var job = await jobRepository.GetJobForLateCallAsync(request.JobId);
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

            await jobRepository.ResetLateEventAsync(job.Id, request.LateType);

            switch (request.LateType)
            {
                case (int)LateEventType.Pickup:
                    await jobRepository.LatePickupAsync(
                        job.Id,
                        job.BookedSpeed,
                        job.NotifiedSpeed,
                        request.LateTime,
                        request.CalculationRequired
                    );
                    break;
                case (int)LateEventType.Delivery:
                    await jobRepository.LateDeliveryAsync(
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

        var maxAutoLate = await jobRepository.MaxAutoLatePickupAlertAsync();
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

        var maxAutoLateDelAlert = await jobRepository.MaxAutoLateDeliveryAlertAsync();
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
            await jobRepository.ReDispatchSelectedJobsAsync(data.JobIds);
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
        await jobRepository.ReSendSelectedJobsAsync(jobIds);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> ReAssignSelected(string jobIds)
    {
        await jobRepository.ReAssignSelectedJobsAsync(jobIds);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> SetFirstJob(int jobId, int courierId)
    {
        await jobRepository.SetFirstJobAsync(jobId, courierId);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> Void([FromBody] VoidJobRequest request)
    {
        try
        {
            // Get the parent ID before voiding (if this is a child job)
            var parentId = await jobRepository.GetJobParentIdAsync(request.JobId);

            // Determine if the parent is being voided too
            var isParentBeingVoided = parentId.HasValue &&
                                      request.SelectedJobIds is { Count: > 0 } &&
                                      request.SelectedJobIds.Contains(parentId.Value);

            await jobRepository.VoidJobAsync(request);

            // Rerate the parent job if a child was voided but the parent was not
            if (!parentId.HasValue || isParentBeingVoided) return Ok();

            var isUsTenant = infoService.IsUsTenant();
            if (isUsTenant)
            {
                var jobDetails = await jobRepository.GetJobDetailsForRatingAsync(parentId.Value);
                if (jobDetails.IsManuallyRated) return Ok();

                await rateJobService.RateJobUsAsync(jobDetails);
            }
            else
            {
                var jobDetails = await jobRepository.GetJobDetailsForRatingNzAsync(parentId.Value, false);
                if (jobDetails.IsManuallyRated) return Ok();

                await rateJobService.RateJobNzAsync(jobDetails);
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
            await jobRepository.VoidBulkJobAsync(request);
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
            await jobRepository.ReSendAllJobsAsync(courierId);
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
            await jobRepository.RestoreSplitJobsAsync(jobIds);
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
            await jobRepository.RestoreJobsAsync(data.JobIds);
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
    public async Task<IActionResult> SplitJob([FromBody] JobUpdateBaseRequest request)
    {
        try
        {
            var staffInfo = await infoService.GetStaffInfoAsync();
            await jobRepository.SplitJobAsync(request.JobId, staffInfo.Text);
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
        var message = await jobRepository.UnSplitJobAsync(jobId);
        return Json(message);
    }

    [HttpPost]
    public async Task<IActionResult> UpdatePodDetails([FromBody] UpdatePodDetailsRequest requestData)
    {
        try
        {
            await jobRepository.UpdatePodDetailsAsync(requestData);
            return Ok();
        }
        catch (Exception e)
        {
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> ReRateSplitJob([FromBody] JobUpdateBaseRequest request)
    {
        await jobRepository.ReRateSplitJobAsync(request.JobId);
        return Ok();
    }

    public async Task<IActionResult> FinishSplitJobProcess([FromBody] JobUpdateBaseRequest request)
    {
        var staffInfo = await infoService.GetStaffInfoAsync();
        await jobRepository.FinishSplitJobProcessAsync(request.JobId, staffInfo.Text);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> UpdateSplitJobAddress(
        int jobId,
        int toSuburbId,
        string address,
        decimal deliveryLat,
        decimal deliveryLng
    )
    {
        await jobRepository.UpdateSplitJobAddressAsync(
            jobId,
            toSuburbId,
            address,
            deliveryLat,
            deliveryLng
        );
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> AddRestoreEvent(int jobId)
    {
        try
        {
            var currentDate = infoService.GetCurrentTenantTime();

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
    public async Task<IActionResult> AddPriceSuburbChangeEvent(int jobId)
    {
        await taskRepository.AddEventAsync(
            jobId,
            "Changed Price or Suburb",
            (int)EventType.ChangePrice
        );

        return Ok();
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
        var staffName = await jobRepository.GetStaffNameAsync(staffId);

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

    public async Task<IActionResult> SuburbList()
    {
        var data = await jobRepository.GetSuburbsAsync();
        return Json(data);
    }

    public async Task<IActionResult> SpeedList()
    {
        var data = await jobRepository.GetSpeedsAsync();
        return Json(data);
    }

    public async Task<IActionResult> SearchSpeedOptions(string searchTerm)
    {
        try
        {
            var speedOptions = await jobRepository.GetSpeedsBySearchTermAsync(searchTerm);
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
        var data = await jobRepository.GetContactsByClientIdAsync(clientId);
        return Json(data);
    }

    public async Task<IActionResult> LeaveList()
    {
        var data = await jobRepository.LeaveParcelLocationsAsync();
        return Json(data);
    }

    public async Task<IActionResult> UndeliverableList()
    {
        var data = await jobRepository.UndeliverableLocationsAsync();
        return Json(data);
    }

    public async Task<IActionResult> InternalStatusList()
    {
        var data = await jobRepository.GetInternalStatusListAsync();
        return Json(data);
    }

    public async Task<IActionResult> StatusList()
    {
        var data = await jobRepository.GetStatusListAsync();
        return Json(data);
    }

    public async Task<IActionResult> EventTypeList()
    {
        var data = await jobRepository.EventTypeListAsync();
        return Json(data);
    }

    public async Task<IActionResult> PpdExclusiveAmount(int clientId, decimal amount)
    {
        var ppd = await jobRepository.PpdExclusiveAmountAsync(clientId, amount);
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

            // Recalculate the job
            var shouldRecalculateRate = ShouldRecalculateRate(field);
            if (!shouldRecalculateRate) return Ok();

            var isUsTenant = infoService.IsUsTenant();
            if (isUsTenant)
            {
                var jobDetails = await jobRepository.GetJobBookingDetailsForRatingAsync(jobId);
                if (jobDetails.IsManuallyRated) return Ok();

                await rateJobService.RateJobUsAsync(jobDetails);
            }
            else
            {
                var jobDetails = await jobRepository.GetJobBookingDetailsForRatingNzAsync(jobId);
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
        string value
    )
    {
        try
        {
            await jobRepository.UpdateJobAsync(jobId, field, value);

            // Skip rating if a job is archived
            var isArchived = await jobRepository.IsJobArchived(jobId);

            // Recalculate a job
            var shouldRecalculateRate = ShouldRecalculateRate(field);
            if (!shouldRecalculateRate) return Ok();

            var isUsTenant = infoService.IsUsTenant();
            if (isUsTenant)
            {
                var jobDetails = await jobRepository.GetJobDetailsForRatingAsync(jobId);
                if (jobDetails.IsManuallyRated) return Ok();

                await rateJobService.RateJobUsAsync(jobDetails);
            }
            else
            {
                var jobDetails = await jobRepository.GetJobDetailsForRatingNzAsync(jobId, isArchived);
                if (jobDetails.IsManuallyRated) return Ok();

                await rateJobService.RateJobNzAsync(jobDetails);
            }

            return Ok();
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
    }

    private static bool ShouldRecalculateRate(JobProperty property)
    {
        // Properties that affect job rating
        return property switch
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
    }

    public async Task<IActionResult> UpdateBulkJob(
        int bulkJobId,
        JobProperty field,
        string value
    )
    {
        await jobRepository.UpdateBulkJobAsync(bulkJobId, field, value);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> ReleaseBulkJob(int bulkJobId)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(bulkJobId);
            await jobRepository.ReleaseBulkJobByIdAsync(bulkJobId);

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

            var jobId = await jobRepository.QuickAddJobAsync(request);

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

            await jobRepository.AddInterCourierChargeAsync(viewModel);
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
        var hasItems = await jobRepository.HasClientItemsAvailableAsync(clientId, speedId);
        return Json(hasItems);
    }

    public async Task<IActionResult> GetAllClientItems(int clientId, int speedId, int jobId)
    {
        var clientItems =
            await jobRepository.GetClientItemsBySpeedAsync(clientId, speedId, jobId);
        return Json(clientItems);
    }

    [HttpPost]
    public async Task<IActionResult> AddClientItemsToJob(
        int jobId,
        [FromBody] ClientItemsModel itemsModel
    )
    {
        if (itemsModel != null)
            await jobRepository.AddClientsItemToJobAsync(
                jobId,
                itemsModel.ServiceIds,
                itemsModel.TotalCost
            );
        return Ok();
    }

    public async Task<IActionResult> SendPod(int jobId, string toEmail)
    {
        var selectedJob = await jobRepository.GetSingleJobById(jobId);

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
        smtp.Port = int.Parse(Environment.GetEnvironmentVariable("SMTP_Port") ?? string.Empty);
        smtp.Send(message);
    }

    public async Task<IActionResult> GetAttachedFiles(int jobId)
    {
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
    public async Task<IActionResult> UpdateNote(int jobId, string note)
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

        try
        {
            await jobRepository.UpdateJobNoteAsync(jobId, note);
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
    public async Task<IActionResult> UpdateJobPackages([FromBody] UpdateJobPackagesRequest request)
    {
        try
        {
            await jobRepository.UpdatePackagesForJobAsync(request.JobId, request.Parcels);
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
            await jobRepository.UpdatePackagesForBulkJobAsync(request.BulkJobId, request.Parcels);
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
        var isParent = await jobRepository.IsJobParentAsync(jobId);
        return Json(isParent);
    }

    public async Task<IActionResult> GetRelatedJobsMultiSelectList(int jobId, bool isArchived)
    {
        try
        {
            var relatedJobs = await jobRepository.GetRelatedJobsMultiSelectListAsync(jobId, isArchived);
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
        var isParent = await jobRepository.IsBulkJobParent(bulkJobId);
        return Json(isParent);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateJobReadStatus(int jobId, bool hasBeenRead)
    {
        try
        {
            await jobRepository.UpdateJobReadStatusAsync(jobId, hasBeenRead);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating job read status for Job {JobId}", jobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateDeliveryAddress([FromBody] UpdateAddressRequest request)
    {
        return await UpdateAddressAsync(
            request,
            jobRepository.UpdateDeliveryAddressAsync,
            AddressType.Delivery,
            isBooking: false);
    }

    [HttpPost]
    public async Task<IActionResult> UpdatePickupAddress([FromBody] UpdateAddressRequest request)
    {
        return await UpdateAddressAsync(
            request,
            jobRepository.UpdatePickupAddressAsync,
            AddressType.Pickup,
            isBooking: false);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateBookingPickupAddress([FromBody] UpdateAddressRequest request)
    {
        return await UpdateAddressAsync(
            request,
            recurringJobRepository.UpdateBookingPickupAddressAsync,
            AddressType.Pickup,
            isBooking: true);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateBookingDeliveryAddress([FromBody] UpdateAddressRequest request)
    {
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

            // Get job details for rating and update
            await RecalculateJobRateAsync(request.JobId, isBooking);

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
        var isArchived = !isBooking && await jobRepository.IsJobArchived(jobId);
        //if (isArchived) return;

        var isUsCustomer = infoService.IsUsTenant();

        if (isUsCustomer)
        {
            var jobDetailsUs = isBooking
                ? await jobRepository.GetJobBookingDetailsForRatingAsync(jobId)
                : await jobRepository.GetJobDetailsForRatingAsync(jobId);

            await rateJobService.RateJobUsAsync(jobDetailsUs);
            return;
        }

        var jobDetailsNz = isBooking
            ? await jobRepository.GetJobBookingDetailsForRatingNzAsync(jobId)
            : await jobRepository.GetJobDetailsForRatingNzAsync(jobId, isArchived);

        await rateJobService.RateJobNzAsync(jobDetailsNz);
    }

    public async Task<IActionResult> GetTimeZoneOptions()
    {
        try
        {
            var timeZones = await jobRepository.GetTimeZoneOptions();
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
    public async Task<IActionResult> BulkUpdateReadStatus([FromBody] BulkReadUpdateRequestModel data)
    {
        try
        {
            await jobRepository.BulkUpdateReadStatusAsync(data);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error bulk marking jobs as read");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpGet]
    public async Task<IActionResult> ScanJobDetail(DateTimeOffset runDate, string scan)
    {
        try
        {
            var scanList = await jobRepository.ScanList(runDate, scan);
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
            await jobRepository.SimpleRepriceJobManualAsync(data);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(SimpleRepriceJobManual)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> RecalculateJobRate(int jobId)
    {
        try
        {
            var newRate = await GetJobRateAsync(jobId, false);
            return Ok(newRate);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(RecalculateJobRate)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    private async Task<decimal> GetJobRateAsync(int jobId, bool isBooking)
    {
        // Don't skip if a job is archived (should skip if invoiced tho)
        var isArchived = !isBooking && await jobRepository.IsJobArchived(jobId);

        var isUsCustomer = infoService.IsUsTenant();

        if (isUsCustomer)
        {
            var jobDetailsUs = isBooking
                ? await jobRepository.GetJobBookingDetailsForRatingAsync(jobId)
                : await jobRepository.GetJobDetailsForRatingAsync(jobId);

            return await rateJobService.GetJobRateUsAsync(jobDetailsUs);
        }

        var jobDetailsNz = isBooking
            ? await jobRepository.GetJobBookingDetailsForRatingNzAsync(jobId)
            : await jobRepository.GetJobDetailsForRatingNzAsync(jobId, isArchived);

        return await rateJobService.GetJobRateNzAsync(jobDetailsNz);
    }
}