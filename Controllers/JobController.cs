using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
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
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Serilog;
using EventType = DespatchWeb.Enums.EventType;

namespace DespatchWeb.Controllers;

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
    IPodExportService podExportService
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

            return Json(result);
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(
                StatusCodes.Status401Unauthorized,
                $"Unauthorized access attempt for client {cid}"
            );
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error processing job list request");
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
        int cid,
        string clientIds,
        [FromQuery] List<int> despatchViewIds,
        [FromQuery] ClearListEnvelopeViewModel clearListEnvelope
    )
    {
        try
        {
            var isUsTenant = infoService.IsUsTenant();

            if (!isInternal)
                await clientAccessValidator.ValidateClientAccessAsync(cid, clientIds);

            // Get jobs
            var result = await jobRepository.JobListAsync(
                queryParams,
                isInternal,
                isUsTenant,
                clientIds,
                despatchViewIds,
                clearListEnvelope
            );

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, $"an error occured getting jobs by clear list");
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddPallet(
        [FromBody] PalletInfo palletInfo,
        bool preBook,
        string despatcher
    )
    {
        await jobRepository.AddPalletInfoAsync(palletInfo, preBook, despatcher);
        return Ok("OK");
    }

    [HttpPost]
    public async Task<IActionResult> EditPallet(
        [FromBody] PalletInfo palletInfo,
        bool preBook,
        string despatcher
    )
    {
        await jobRepository.EditPalletInfoAsync(palletInfo, preBook, despatcher);
        return Ok("OK");
    }

    [HttpPost]
    public async Task<IActionResult> DeletePallet(
        [FromBody] PalletInfo palletInfo,
        bool preBook,
        string despatcher
    )
    {
        await jobRepository.DeletePalletInfoAsync(palletInfo, preBook, despatcher);
        return Ok("OK");
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
    public async Task<IActionResult> AddPriceComponent(int staffId, string despatcherName,
        [FromBody] ChargeViewModel breakdown)
    {
        try
        {
            var jobId = breakdown.JobId ?? breakdown.PrebookJobId;
            ArgumentNullException.ThrowIfNull(jobId);

            Log.Information("Adding price breakdown for job {JobId}", jobId);

            var chargeId = await jobRepository.AddJobPriceBreakdownAsync(breakdown);

            if (breakdown.JobId.HasValue)
            {
                await taskRepository.AddEventAsync(
                    jobId ?? 0,
                    staffId,
                    despatcherName,
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
    public async Task<IActionResult> UpdatePriceComponent(int staffId, string despatcherName,
        [FromBody] ChargeViewModel breakdown)
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
                    staffId,
                    despatcherName,
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
    public async Task<IActionResult> DeletePriceComponent(int staffId, string despatcherName, int jobId, int chargeId)
    {
        try
        {
            Log.Information("Deleting price breakdown for charge {chargeId}", chargeId);

            await jobRepository.DeleteJobPriceBreakdownAsync(chargeId);

            await taskRepository.AddEventAsync(
                jobId,
                staffId,
                despatcherName,
                "Manually rated price",
                (int)EventType.ChangePrice);

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error deleting price breakdown for charge {chargeId}",
                chargeId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> SendPrebookJob(int jobId)
    {
        await jobRepository.SendPrebookJobAsync(jobId);
        return Ok();
    }

    public async Task<IActionResult> VoidPrebookJob(int jobId, string despatcher, int staffId)
    {
        await jobRepository.VoidPrebookJobAsync(jobId, despatcher, staffId);
        return Ok();
    }

    public async Task<IActionResult> Current(int courierId, bool done)
    {
        try
        {
            var result = await jobRepository.CurrentJobListAsync(courierId, done);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting current jobs courier {CourierId}", courierId);
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
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file was uploaded");
        }

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var folder = isPod ? "DeliveryPhotos" : "DeliverySignatures";

            // Create the file path in format: [folder]/[year]/[month]/[jobId]-[timestamp]-[filename]
            var now = DateTime.UtcNow;
            var monthFolder = $"{now.Year}/{now:MM}/";

            // Extract the file extension
            var fileExtension = Path.GetExtension(file.FileName);

            // Generate a unique filename with timestamp
            var timestamp = now.ToString("yyyyMMddHHmmss");
            var filename = $"{jobId}-{timestamp}{fileExtension}";

            // Combine parts to form the full S3 key
            var key = $"{folder}/{monthFolder}{filename}";

            // Create the S3 upload request
            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            memoryStream.Position = 0;

            var contentType = DetermineContentType(fileExtension);

            var putRequest = new PutObjectRequest
            {
                BucketName = bucketName,
                Key = key,
                InputStream = memoryStream,
                ContentType = contentType
            };

            // Add metadata properly using the metadata dictionary
            if (isPod && !string.IsNullOrEmpty(podDescription))
            {
                putRequest.Metadata.Add("pod-description", podDescription);
            }

            Log.Debug("Uploading {Type} file for job {JobId} to S3 path: {Key}",
                isPod ? "POD photo" : "signature", jobId, key);

            // Execute the upload
            await s3Client.PutObjectAsync(putRequest);

            Log.Information("Successfully uploaded {Type} file for job {JobId}",
                isPod ? "POD photo" : "signature", jobId);

            // Return the uploaded file information
            return Json(new
            {
                success = true,
                fileName = filename,
                s3Key = key,
                contentType,
                size = file.Length,
                uploadDate = now.ToString("o"),
                isPOD = isPod,
                podDescription
            });
        }
        catch (AmazonS3Exception e)
        {
            Log.Error(e, "S3 error encountered when uploading {Type} for job {JobId}. Message: {Message}",
                isPod ? "POD photo" : "signature", jobId, e.Message);
            return StatusCode(500, $"S3 error: {e.Message}");
        }
        catch (Exception e)
        {
            Log.Error(e, "Unknown error encountered when uploading {Type} for job {JobId}. Message: {Message}",
                isPod ? "POD photo" : "signature", jobId, e.Message);
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    private static string DetermineContentType(string fileExtension)
    {
        return fileExtension.ToLower() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream" // Default content type
        };
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteJobDeliveryPhotoOrSignature(int jobId, string key)
    {
        if (string.IsNullOrEmpty(key)) return BadRequest("File key is required");

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");

            var deleteRequest = new DeleteObjectRequest
            {
                BucketName = bucketName,
                Key = key
            };

            Log.Debug("Deleting file with key {Key} for job {JobId}", key, jobId);

            await s3Client.DeleteObjectAsync(deleteRequest);

            Log.Information("Successfully deleted file with key {Key} for job {JobId}", key, jobId);

            return Json(new { success = true, message = "File deleted successfully" });
        }
        catch (AmazonS3Exception e)
        {
            Log.Error(e, "S3 error encountered when deleting file for job {JobId}. Message: {Message}",
                jobId, e.Message);
            return StatusCode(500, $"S3 error: {e.Message}");
        }
        catch (Exception e)
        {
            Log.Error(e, "Unknown error encountered when deleting file for job {JobId}. Message: {Message}",
                jobId, e.Message);
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    private async Task<List<S3Object>> SearchDeliveryFilesByPatternAsync(
        string bucketName,
        string pattern,
        int year,
        int month
    )
    {
        var allResults = new List<S3Object>();
        // Calculate next month and year (handling December rollover)
        var nextMonth = month == 12 ? 1 : month + 1;
        var nextYear = month == 12 ? year + 1 : year;
        try
        {
            var monthPrefixes = new[] { $"{year}/{month:D2}/", $"{nextYear}/{nextMonth:D2}/" };

            var folders = new[] { "DeliverySignatures", "DeliveryPhotos" };

            foreach (var folder in folders)
            {
                foreach (var monthPrefix in monthPrefixes)
                {
                    var request = new ListObjectsV2Request
                    {
                        BucketName = bucketName,
                        Prefix = $"{folder}/{monthPrefix}{pattern}",
                        MaxKeys = 1000
                    };

                    var response = await s3Client.ListObjectsV2Async(request);
                    allResults.AddRange(response.S3Objects);
                    if (allResults.Count > 0)
                    {
                        break;
                    }
                }
            }
        }
        catch (AmazonS3Exception e)
        {
            Log.Error(
                e,
                "Error encountered on server. Message:'{EMessage}' when writing an object", e.Message
            );
        }
        catch (Exception e)
        {
            Log.Error(
                e,
                "Unknown encountered on server. Message:'{EMessage}' when writing an object", e.Message
            );
        }

        return allResults;
    }

    public async Task<IActionResult> GetJobDeliveryPhotosAndSignature(
        int jobId,
        int year,
        int month
    )
    {
        var all = new List<byte[]>();
        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var key = $"{jobId}-";
            Log.Debug("Get S3 Object List for {Key}", key);
            var s3List =
                await SearchDeliveryFilesByPatternAsync(bucketName, key, year, month);
            Log.Debug("Found {S3ListCount} objects for {Key}", s3List.Count, key);
            foreach (
                var getObjectRequest in s3List.Select(s3Object => new GetObjectRequest
                {
                    BucketName = bucketName,
                    Key = s3Object.Key
                })
            )
            {
                using var response = await s3Client.GetObjectAsync(getObjectRequest);
                await using var responseStream = response.ResponseStream;
                using var reader = new StreamReader(responseStream);
                using var memoryStream = new MemoryStream();
                await response.ResponseStream.CopyToAsync(memoryStream);
                all.Add(memoryStream.ToArray());
            }
        }
        catch (Exception e)
        {
            Log.Error(e, $"{nameof(GetJobDeliveryPhotosAndSignature)} Error: ");
        }

        return Json(all);
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
            Log.Error(ex, "An unexpected error occured");
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

    public async Task<IActionResult> Related(int parentId, int clientId)
    {
        var result = await jobRepository.RelatedJobsAsync(parentId, clientId);
        return Json(result);
    }

    public async Task<IActionResult> BulkDetail(int bulkJobId)
    {
        var result = await jobRepository.GetBulkJobDetailAsync(bulkJobId);
        return Json(result);
    }

    public async Task<IActionResult> PreBookJobs(bool active)
    {
        var result = await recurringJobRepository.PreBookJobListAsync(active);
        return Json(result);
    }

    public async Task<IActionResult> GetRecurringJobDetail(int jobBookingId)
    {
        try
        {
            var job = await recurringJobRepository.GetPrebookJobByIdAsync(jobBookingId);
            return Json(job);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting JobBooking: {JobBookingId}", jobBookingId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> PodSearch(PodSearchRequest data)
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
            if (rows.Count != 0)
            {
                Log.Debug("Sample Row Data: {@FirstRow}", rows.First());
            }

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
        var fromDate = infoService.GetCurrentTenantTime();

        var searchRequest = new PodSearchRequest
        {
            CourierId = null,
            ClientId = null,
            Wild = string.Empty,
            Job = job,
            FromDate = fromDate.ResetTimeToStartOfDay(),
            ToDate = fromDate.ResetTimeToEndOfDay()
        };

        var result = await jobRepository.PodSearchAsync(searchRequest);
        return result.Count == 0 ? Json(false) : Json(true);
    }

    public async Task<IActionResult> SwapPod(string job1, string job2)
    {
        await jobRepository.SwapPodAsync(job1, job2);
        return Ok();
    }

    public async Task<IActionResult> BulkSearch(PodSearchRequest data)
    {
        try
        {
            var result = await jobRepository.BulkSearchAsync(data);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobController), nameof(BulkSearch)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> PreBookSearch(
        int? courierId,
        int? clientId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        int pageIndex,
        int pageSize
    )
    {
        var result = await recurringJobRepository.PreBookSearchAsync(
            courierId,
            wild ?? string.Empty,
            job ?? string.Empty,
            fromDate.ResetTimeToStartOfDay(),
            toDate.ResetTimeToEndOfDay(),
            clientId,
            pageIndex,
            pageSize
        );

        return Json(result);
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
                    request.StaffId,
                    request.DespatcherName,
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

        // Don't create event if AlertLatePickup is negative
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
        int staffId,
        string contact,
        int eventType,
        int lateTime,
        DateTime etaTime)
    {
        await taskRepository.AddEventAsync(
            jobId,
            staffId,
            contact,
            "Late Call from Despatch",
            eventType,
            null,
            lateTime,
            etaTime
        );
    }

    [HttpPost]
    public async Task<IActionResult> Allocate(int courierId, int dispId, List<int> jobIds)
    {
        try
        {
            await jobRepository.DispatchSelectedJobsAsync(courierId, dispId, jobIds);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error allocating jobs");
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> ReAllocate(int courierId, int dispId, List<int> jobIds)
    {
        try
        {
            await jobRepository.ReDispatchSelectedJobsAsync(courierId, dispId, jobIds);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error reallocating jobs");
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
    public async Task<IActionResult> Void([FromBody] VoidJobRequest requestData)
    {
        try
        {
            await jobRepository.VoidJobAsync(requestData.JobId,
                requestData.VoidReason,
                requestData.VoidSingleJobOnly);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error voiding {SingleJobString} Job(s) with ID {JobId}. Error: {ErrorMessage}",
                requestData.JobId,
                requestData.VoidSingleJobOnly ? "Single" : "All",
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
    public async Task<IActionResult> RestoreJobs([FromQuery] List<int> jobIds)
    {
        try
        {
            await jobRepository.RestoreJobsAsync(jobIds);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error restoring the following jobs {JobId}. Error: {ErrorMessage}",
                jobIds.ToString(),
                ex.Message
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> SplitJob(int jobId, string despatcherName)
    {
        await jobRepository.SplitJobAsync(jobId, despatcherName);
        return Ok();
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

    public async Task<IActionResult> ReRateSplitJob(int jobId)
    {
        await jobRepository.ReRateSplitJobAsync(jobId);
        return Ok();
    }

    public async Task<IActionResult> FinishSplitJobProcess(int jobId, string despatcherName)
    {
        await jobRepository.FinishSplitJobProcessAsync(jobId, despatcherName);
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
    public async Task<IActionResult> AddRestoreEvent(int jobId, int staffId, string despatcherName)
    {
        try
        {
            var currentDate = infoService.GetCurrentTenantTime();

            await taskRepository.AddEventAsync(
                jobId,
                staffId,
                despatcherName,
                $"Restored by {despatcherName} at {currentDate.ToShortDateString()} {currentDate.ToShortTimeString()}",
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
    public async Task<IActionResult> AddPriceSuburbChangeEvent(
        int staffId,
        int jobId,
        string despatcherName)
    {
        await taskRepository.AddEventAsync(
            jobId,
            staffId,
            despatcherName,
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
                data.StaffId,
                data.DespatcherName,
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
        string jobNumber,
        string despatcherName
    )
    {
        var baseUrl = Environment.GetEnvironmentVariable("ExsalerateAPI");
        var un = Environment.GetEnvironmentVariable("ExsalerateAPIUsername");
        var pw = Environment.GetEnvironmentVariable("ExsalerateAPIPW");

        // Set up HttpClient
        httpClient.BaseAddress = new Uri(baseUrl ?? string.Empty);
        httpClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Basic",
                Convert.ToBase64String(Encoding.ASCII.GetBytes($"{un}:{pw}"))
            );

        var body = new ExsalerateActivity
        {
            SiteOwnerID = 11,
            CustomerRefCode = clientId.ToString(),
            Subject = $"Dispatch:{despatcherName} {eventName}",
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
            await recurringJobRepository.UpdateTucJobRecurringAsync(jobId, field, value);

            // Recalculate job
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
                var jobDetails = await jobRepository.GetJobDetailsForRatingNzAsync(jobId);
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

            // Recalculate job
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
                var jobDetails = await jobRepository.GetJobDetailsForRatingNzAsync(jobId);
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
            _ => false
        };
    }

    public async Task<IActionResult> UpdateBulkJob(
        int bulkJobId,
        string field,
        string value,
        decimal? rate,
        string despatcherName,
        int staffId
    )
    {
        await jobRepository.UpdateBulkJobAsync(
            bulkJobId,
            field,
            value,
            rate,
            despatcherName,
            staffId
        );
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> QuickCreateJob([FromBody] CreateJobRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);
            ArgumentNullException.ThrowIfNull(request.StaffId);

            if (!IsValidRequest(request))
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    new { message = "Bad Request" }
                );

            var jobId = await jobRepository.QuickAddJobAsync(request.Job, request.StaffId.Value);

            //Check if jobId is valid before continuing
            if (jobId == 0)
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    "Created Job Id is null"
                );

            // Add note
            await jobRepository.SaveNoteAsync(jobId,
                $"This job was created manually by {request.DespatcherName} via the Quick Create Job feature.");

            return Json(jobId);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error creating job");
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    private static bool IsValidRequest(CreateJobRequest request) =>
        !(request?.Job == null || request.Job.ClientId == 0 || request.StaffId == null);


    [HttpPost]
    public async Task<IActionResult> InterCourierCharge(
        [FromBody] InterCourierChargeViewModel viewModel
    )
    {
        ArgumentNullException.ThrowIfNull(viewModel);

        await jobRepository.AddInterCourierChargeAsync(viewModel);
        return Ok();
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
        var selectedJob = await jobRepository.GetJobByIdAsync(jobId);

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

    private async Task<List<S3Object>> SearchFilesByPatternAsync(string bucketName, string pattern)
    {
        var request = new ListObjectsV2Request
        {
            BucketName = bucketName,
            Prefix = pattern,
            MaxKeys = 1000 // Adjust if needed, but 1000 is the maximum allowed
        };

        var result = new List<S3Object>();

        try
        {
            ListObjectsV2Response response;
            do
            {
                response = await s3Client.ListObjectsV2Async(request);

                result.AddRange(response.S3Objects);
                request.ContinuationToken = response.NextContinuationToken;
            } while (response.IsTruncated ?? false);
        }
        catch (AmazonS3Exception e)
        {
            Log.Error(e, "{UploadFileName} Error encountered. Message:'{EMessage}'", nameof(UploadFile), e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{UploadFileName} Error encountered. Message:'{EMessage}'", nameof(UploadFile), e.Message);
        }

        return result;
    }

    public async Task<IActionResult> IsFilesAttachedToJob(int jobId)
    {
        var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
        var key = $"JobAttachments/{jobId}-";
        Log.Debug("Get S3 Object List for {Key}", key);
        var s3List = await SearchFilesByPatternAsync(bucketName, key);
        Log.Debug("Found {S3ListCount} objects for {Key}", s3List.Count, key);

        return Json(s3List.Count > 0);
    }

    public async Task<IActionResult> GetAttachedFiles(int jobId)
    {
        var s3Files = new List<S3FileInfo>();
        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var key = $"JobAttachments/{jobId}-";
            Log.Debug("Get S3 Object List for {Key}", key);
            var s3List = await SearchFilesByPatternAsync(bucketName, key);
            foreach (var s3Object in s3List)
            {
                var getObjectRequest = new GetObjectRequest
                {
                    BucketName = bucketName,
                    Key = s3Object.Key
                };
                using var response = await s3Client.GetObjectAsync(getObjectRequest);
                await using var responseStream = response.ResponseStream;
                using var reader = new StreamReader(responseStream);
                using var memoryStream = new MemoryStream();
                await response.ResponseStream.CopyToAsync(memoryStream);
                var fileName = response.Metadata["FileName"];
                var s3FileInfo = new S3FileInfo
                {
                    S3Key = s3Object.Key,
                    FileName = fileName,
                    LastModified = s3Object.LastModified,
                    Size = s3Object.Size
                };
                s3Files.Add(s3FileInfo);
            }
        }
        catch (Exception e)
        {
            Log.Error(e, "Error {GetAttachedFilesName}: {EMessage}", nameof(GetAttachedFiles), e.Message);
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }

        return Ok(s3Files);
    }

    [HttpPost]
    public async Task<IActionResult> UploadFile([FromForm] FileUploadRequest request)
    {
        try
        {
            var currentDate = infoService.GetCurrentTenantTime();

            if (request?.File == null || request.File.Length == 0)
                return BadRequest("No file uploaded");

            // Validate file type
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "application/pdf" };
            if (!allowedTypes.Contains(request.File.ContentType.ToLower()))
                return BadRequest("Invalid file type. Only images and PDFs are allowed.");

            // Validate file size (10MB max)
            if (request.File.Length > 10 * 1024 * 1024)
                return BadRequest("File size exceeds the limit of 10MB.");

            using var memoryStream = new MemoryStream();
            if (request.File == null)
                return Ok(
                    new { message = "File uploaded successfully", fileName = request.File.FileName }
                );

            await request.File.CopyToAsync(memoryStream);

            var byteArray = memoryStream.ToArray();

            var timestamp = currentDate.ToString("yyyyMMddHHmmss");
            var key = $"JobAttachments/{request.JobId}-{timestamp}";

            using var ms = new MemoryStream(byteArray);
            try
            {
                var putRequest = new PutObjectRequest
                {
                    BucketName = Environment.GetEnvironmentVariable("S3BucketMars"),
                    Key = key,
                    ContentType = request.File.ContentType,
                    InputStream = ms
                };
                putRequest.Metadata.Add("FileName", request.File.FileName);
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

            return Ok(
                new { message = "File uploaded successfully", fileName = request.File.FileName }
            );
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobController), nameof(UploadFile)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> DownloadFile(string key)
    {
        var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
        try
        {
            var request = new GetObjectRequest { BucketName = bucketName, Key = key };

            using var response = await s3Client.GetObjectAsync(request);
            if (response.HttpStatusCode != HttpStatusCode.OK) return NotFound($"File {key} not found.");
            var originalFileName = response.Metadata["FileName"];
            var contentType = response.Headers.ContentType;

            // Read the stream into a memory stream to get the bytes
            using var ms = new MemoryStream();
            await response.ResponseStream.CopyToAsync(ms);
            var fileBytes = ms.ToArray();

            // Return file with proper headers
            return File(
                fileBytes,
                contentType,
                originalFileName
            );
        }
        catch (AmazonS3Exception ex)
        {
            return ex.StatusCode == HttpStatusCode.NotFound
                ? NotFound($"File {key} not found in bucket")
                : StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> DeleteFile(string key)
    {
        var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");

        try
        {
            var deleteObjectRequest = new DeleteObjectRequest
            {
                BucketName = bucketName,
                Key = key
            };
            await s3Client.DeleteObjectAsync(deleteObjectRequest);
        }
        catch (AmazonS3Exception ex)
        {
            Log.Error(
                ex,
                "{DeleteFileName} AWS S3 error occurred while deleting object {Key} from bucket {BucketName}. StatusCode: {HttpStatusCode}, ErrorCode: {ExErrorCode}",
                nameof(DeleteFile), key, bucketName, ex.StatusCode, ex.ErrorCode
            );
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "{DeleteFileName} An unexpected error occurred while deleting object {Key} from bucket {BucketName}",
                nameof(DeleteFile), key, bucketName
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }

        return Ok();
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
            return Ok(new { message = "Parcels updated successfully" });
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error updating packages for job {JobId}. Error: {ErrorMessage}",
                request.JobId,
                ex.Message
            );
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> IsJobParent(int jobId)
    {
        var isParent = await jobRepository.IsJobParentAsync(jobId);
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
            jobRepository.UpdateBookingPickupAddressAsync,
            AddressType.Pickup,
            isBooking: true);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateBookingDeliveryAddress([FromBody] UpdateAddressRequest request)
    {
        return await UpdateAddressAsync(
            request,
            jobRepository.UpdateBookingDeliveryAddressAsync,
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
            await RecalculateJobRateAsync(request.JobId, request.Address.FullAddress, addressType, isBooking);

            return Ok();
        }
        catch (Exception ex)
        {
            var operationType = $"{(isBooking ? "booking " : string.Empty)}{addressType.ToString().ToLower()}";
            Log.Error(ex, "Error updating {OperationType} address for job {JobId}", operationType, request.JobId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    private async Task RecalculateJobRateAsync(int jobId, string newAddress, AddressType addressType, bool isBooking)
    {
        var isUsCustomer = infoService.IsUsTenant();

        if (isUsCustomer)
        {
            var jobDetailsUs = isBooking
                ? await jobRepository.GetJobBookingDetailsForRatingAsync(jobId)
                : await jobRepository.GetJobDetailsForRatingAsync(jobId);

            await rateJobService.RateJobUsAsync(jobDetailsUs);
        }
        else
        {
            var jobDetailsNz = isBooking
                ? await jobRepository.GetJobBookingDetailsForRatingNzAsync(jobId)
                : await jobRepository.GetJobDetailsForRatingNzAsync(jobId);

            var rate = await rateJobService.RateJobNzAsync(jobDetailsNz);
            var noteText = $"{addressType} address updated to {newAddress}. Rate recalculated: {rate:C}";
            await jobRepository.UpdateJobRateAsync(jobId, rate, noteText);
        }
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
            var deliveryJourney = await jobRepository.GetDeliveryJourneyForJobAsync(jobId);
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
}