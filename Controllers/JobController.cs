using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Mail;
using System.Reflection;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using ExcelDataReader;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualBasic;
using Serilog;
using EventType = DespatchWeb.Enums.EventType;
using Exception = System.Exception;

namespace DespatchWeb.Controllers;

public class JobController(
    IJobRepository jobRepository,
    ITaskRepository taskRepository,
    IClientAccessValidatorService clientAccessValidator,
    IAmazonS3 s3Client,
    HttpClient httpClient,
    IRateJobService rateJobService,
    ICountryService countryService
) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Index(
        [FromQuery] JobQueryParams queryParams,
        bool isInternal,
        int cid,
        string clientIds,
        [FromQuery] List<int> despatchViewIds
    )
    {
        Log.Information(
            messageTemplate: "Index endpoint called with params: {@QueryParams}, IsInternal: {IsInternal}, "
                             + "ClientId: {ClientId}, ClientIds: {ClientIds}, DespatchViewIds: {@DespatchViewIds}",
            propertyValues: [queryParams, isInternal, cid, clientIds, despatchViewIds]
        );

        try
        {
            var isUsTenant = countryService.IsUsTenant();

            if (!isInternal)
            {
                Log.Debug(messageTemplate: "Validating client access for cid: {ClientId}", propertyValue: cid);
                await clientAccessValidator.ValidateClientAccess(contactId: cid, clientIds: clientIds);
            }

            var result = await jobRepository.JobListAsync(
                queryParams: queryParams,
                isInternal: isInternal,
                isUsTenant: isUsTenant,
                clientIds: clientIds,
                selectedViewIds: despatchViewIds
            );

            return Json(data: result);
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(exception: ex, messageTemplate: "Unauthorized access attempt for client {ClientId}",
                propertyValue: cid);
            return StatusCode(
                statusCode: StatusCodes.Status401Unauthorized,
                value: $"Unauthorized access attempt for client {cid}"
            );
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error processing job list request");
            return StatusCode(statusCode: StatusCodes.Status500InternalServerError, value: ex.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAllJobCoordinates(
        bool isInternal,
        string clientIds,
        [FromQuery] List<int> despatchViewIds)
    {
        try
        {
            Log.Information(
                messageTemplate:
                "GetAllJobCoordinates endpoint called with Status: {Status}, IsInternal: {IsInternal}, "
                + "ClientIds: {ClientIds}",
                propertyValue0: isInternal,
                propertyValue1: clientIds,
                propertyValue2: despatchViewIds
            );

            var isUsTenant = countryService.IsUsTenant();

            if (!isInternal) await clientAccessValidator.ValidateClientAccess(contactId: 0, clientIds: clientIds);

            var result = await jobRepository.GetJobCoordinatesAsync(
                isInternal: isInternal,
                isUsTenant: isUsTenant,
                clientIds: clientIds,
                selectedViewIds: despatchViewIds
            );

            Log.Information(
                messageTemplate: "Successfully retrieved {Count} job coordinates",
                propertyValue: result.Count
            );

            return Json(data: result);
        }
        catch (UnauthorizedAccessException ex)
        {
            Log.Warning(exception: ex, messageTemplate: "Unauthorized access attempt");
            return StatusCode(statusCode: StatusCodes.Status401Unauthorized, value: "Unauthorized access");
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error processing job coordinates request");
            return StatusCode(statusCode: StatusCodes.Status500InternalServerError, value: ex.Message);
        }
    }

    [HttpGet]
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
            var isUsTenant = countryService.IsUsTenant();

            if (!isInternal)
                await clientAccessValidator.ValidateClientAccess(contactId: cid, clientIds: clientIds);

            // Get jobs
            var result = await jobRepository.JobListAsync(
                queryParams: queryParams,
                isInternal: isInternal,
                isUsTenant: isUsTenant,
                clientIds: clientIds,
                selectedViewIds: despatchViewIds,
                clearListEnvelope: clearListEnvelope
            );

            return Json(data: result);
        }
        catch (Exception e)
        {
            Log.Error(exception: e, messageTemplate: $"an error occured getting jobs by clear list");
            return StatusCode(statusCode: StatusCodes.Status500InternalServerError, value: e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddPallet(
        [FromBody] PalletInfo palletInfo,
        bool preBook,
        string despatcher
    )
    {
        await jobRepository.AddPalletInfoAsync(p: palletInfo, preBook: preBook, despatcher: despatcher);
        return Ok(value: "OK");
    }

    [HttpPost]
    public async Task<IActionResult> EditPallet(
        [FromBody] PalletInfo palletInfo,
        bool preBook,
        string despatcher
    )
    {
        await jobRepository.EditPalletInfoAsync(p: palletInfo, preBook: preBook, despatcher: despatcher);
        return Ok(value: "OK");
    }

    [HttpPost]
    public async Task<IActionResult> DeletePallet(
        [FromBody] PalletInfo palletInfo,
        bool preBook,
        string despatcher
    )
    {
        await jobRepository.DeletePalletInfoAsync(p: palletInfo, preBook: preBook, despatcher: despatcher);
        return Ok(value: "OK");
    }

    [HttpGet]
    public async Task<IActionResult> GetPricingBreakdown(int jobId)
    {
        try
        {
            Log.Information(messageTemplate: "Getting price breakdown for job {JobId}", propertyValue: jobId);
            var priceComponents = await jobRepository.GetJobPriceBreakdownAsync(jobId: jobId);
            return Json(data: priceComponents);
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error getting price breakdown for job {JobId}",
                propertyValue: jobId);
            return StatusCode(statusCode: 500, value: "An error occurred while retrieving the pricing breakdown");
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddPriceComponent(int staffId, string despatcherName,
        [FromBody] ChargeViewModel breakdown)
    {
        try
        {
            var jobId = breakdown.JobId ?? breakdown.PrebookJobId;
            ArgumentNullException.ThrowIfNull(argument: jobId);

            Log.Information(messageTemplate: "Adding price breakdown for job {JobId}", propertyValue: jobId);

            var chargeId = await jobRepository.AddJobPriceBreakdownAsync(viewModel: breakdown, staffId: staffId);

            await taskRepository.AddEventAsync(
                jobId: jobId ?? 0,
                staffId: staffId,
                despatcherName: despatcherName,
                notes: "Manually rated price",
                eventType: (int)EventType.ChangePrice);
            return Json(data: chargeId);
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error adding price breakdown for job {JobId}",
                propertyValue: breakdown.JobId);
            return StatusCode(statusCode: 500, value: "An error occurred while adding the pricing breakdown");
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdatePriceComponent(int staffId, string despatcherName,
        [FromBody] ChargeViewModel breakdown)
    {
        try
        {
            var jobId = breakdown.JobId ?? breakdown.PrebookJobId;
            ArgumentNullException.ThrowIfNull(argument: jobId);

            Log.Information(messageTemplate: "Updating price breakdown for job {JobId}",
                propertyValue: breakdown.JobId ?? breakdown.PrebookJobId);

            await jobRepository.UpdateJobPriceBreakdownAsync(viewModel: breakdown, staffId: staffId);

            await taskRepository.AddEventAsync(
                jobId: jobId ?? 0,
                staffId: staffId,
                despatcherName: despatcherName,
                notes: "Manually rated price",
                eventType: (int)EventType.ChangePrice);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error updating price breakdown for job {JobId}",
                propertyValue: breakdown.JobId);
            return StatusCode(statusCode: 500, value: "An error occurred while updating the pricing breakdown");
        }
    }

    [HttpPost]
    public async Task<IActionResult> DeletePriceComponent(int staffId, string despatcherName, int jobId, int chargeId)
    {
        try
        {
            Log.Information(messageTemplate: "Deleting price breakdown for charge {chargeId}", propertyValue: chargeId);

            await jobRepository.DeleteJobPriceBreakdownAsync(chargeId: chargeId, staffId: staffId);

            await taskRepository.AddEventAsync(
                jobId: jobId,
                staffId: staffId,
                despatcherName: despatcherName,
                notes: "Manually rated price",
                eventType: (int)EventType.ChangePrice);

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error deleting price breakdown for charge {chargeId}",
                propertyValue: chargeId);
            return StatusCode(statusCode: 500, value: "An error occurred while adding the deleting breakdown");
        }
    }

    public async Task<IActionResult> SendPrebookJob(int jobId)
    {
        await jobRepository.SendPrebookJobAsync(jobId: jobId);
        return Ok(value: "OK");
    }

    public async Task<IActionResult> VoidPrebookJob(int jobId, string despatcher, int staffId)
    {
        await jobRepository.VoidPrebookJobAsync(jobId: jobId, despatcher: despatcher, staffId: staffId);
        return Ok(value: "OK");
    }

    public async Task<IActionResult> Current(int courierId, bool done)
    {
        try
        {
            var result = await jobRepository.CurrentJobList(courierId: courierId, done: done);
            return Json(data: result);
        }
        catch (Exception e)
        {
            var message = $"An error occured getting current jobs courier {courierId}";
            Log.Error(exception: e, messageTemplate: message);
            return StatusCode(statusCode: StatusCodes.Status500InternalServerError, value: message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> CloseSupport(int supportId, int staffId)
    {
        await jobRepository.CloseSupportEvent(supportId: supportId, staffId: staffId);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> LockSupport(int id, string dispatcher)
    {
        var support = await jobRepository.GetSupportEventAsync(eventId: id);
        support.UcevDespatcher = dispatcher;
        var result = await jobRepository.UpdateSupportEventAsync(supportEvent: support);
        return Json(data: result > 0);
    }

    [HttpPost]
    public async Task<IActionResult> UnLockSupport(int id, string dispatcher)
    {
        var support = await jobRepository.GetSupportEventAsync(eventId: id);
        if (support.UcevDespatcher != dispatcher)
            return Json(data: false);
        support.UcevDespatcher = "";
        var result = await jobRepository.UpdateSupportEventAsync(supportEvent: support);
        return Json(data: result > 0);
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
                        MaxKeys = 1000,
                    };

                    var response = await s3Client.ListObjectsV2Async(request: request);
                    allResults.AddRange(collection: response.S3Objects);
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
                exception: e,
                messageTemplate: $"Error encountered on server. Message:'{e.Message}' when writing an object"
            );
        }
        catch (Exception e)
        {
            Log.Error(
                exception: e,
                messageTemplate: $"Unknown encountered on server. Message:'{e.Message}' when writing an object"
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
            var bucketName = Environment.GetEnvironmentVariable(variable: "S3BucketMars");
            var key = $"{jobId}-";
            Log.Debug(messageTemplate: $"Get S3 Object List for {key}");
            var s3List =
                await SearchDeliveryFilesByPatternAsync(bucketName: bucketName, pattern: key, year: year, month: month);
            Log.Debug(messageTemplate: $"Found {s3List.Count} objects for {key}");
            foreach (
                var getObjectRequest in s3List.Select(selector: s3Object => new GetObjectRequest
                {
                    BucketName = bucketName,
                    Key = s3Object.Key,
                })
            )
            {
                using var response = await s3Client.GetObjectAsync(request: getObjectRequest);
                await using var responseStream = response.ResponseStream;
                using var reader = new StreamReader(stream: responseStream);
                using var memoryStream = new MemoryStream();
                await response.ResponseStream.CopyToAsync(destination: memoryStream);
                all.Add(item: memoryStream.ToArray());
            }
        }
        catch (Exception e)
        {
            Log.Error(exception: e, messageTemplate: $"{nameof(GetJobDeliveryPhotosAndSignature)} Error: ");
        }

        return Json(data: all);
    }

    public async Task<IActionResult> Detail(int jobId)
    {
        try
        {
            var job = await jobRepository.GetJobByIdAsync(jobId: jobId);
            return Json(data: job);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(statusCode: 408); // Request Timeout
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "An unexpected error occured");
            return StatusCode(statusCode: 500, value: "An error occurred while processing your request.");
        }
    }

    [HttpGet]
    public async Task<IActionResult> ScanJobDetailAsync(DateTime? runDate, string scan)
    {
        var data = await jobRepository.ScanList(runDate: runDate, scan: scan);
        return Json(data: data);
    }

    public async Task<IActionResult> Related(int parentId, int clientId)
    {
        var result = await jobRepository.RelatedJobs(parentId: parentId, clientId: clientId);
        return Json(data: result);
    }

    public async Task<IActionResult> BulkDetail(int bulkJobId)
    {
        var result = await jobRepository.BulkJobDetail(bulkJobId: bulkJobId);
        return Json(data: result);
    }

    public async Task<IActionResult> PreBookDetail(int preBookJobId)
    {
        var result = await jobRepository.GetJobByIdAsync(jobId: preBookJobId);
        return Json(data: result);
    }

    public async Task<IActionResult> PreBookJobs()
    {
        var result = await jobRepository.PreBookJobListAsync();
        return Json(data: result);
    }

    public async Task<IActionResult> PodSearch(
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
        var result = await jobRepository.PodSearch(
            courierId: courierId,
            wild: wild ?? "",
            job: job ?? "",
            fromDate: fromDate.ResetTimeToStartOfDay(),
            toDate: toDate.ResetTimeToEndOfDay(),
            clientId: clientId,
            pageIndex: pageIndex,
            pageSize: pageSize
        );

        return Json(data: result);
    }

    public async Task<IActionResult> PodSearchDownload(
        int? courierId,
        int? clientId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate
    )
    {
        var data = await jobRepository.PodSearchDownloadAsync(
            courierId: courierId,
            wild: wild ?? "",
            job: job ?? "",
            fromDate: fromDate.ResetTimeToStartOfDay(),
            toDate: toDate.ResetTimeToEndOfDay(),
            clientId: clientId
        );

        var formatField = (object x) =>
        {
            var formatted =
                x?.ToString()?.Replace(oldValue: "\"", newValue: "\"\"").Replace(oldValue: "\n", newValue: "\\n") ??
                string.Empty;

            return formatted.Contains(value: "\"") || formatted.Contains(value: ',')
                ? $"\"{formatted}\""
                : formatted;
        };

        using var stream = new MemoryStream();
        await using (var writer = new StreamWriter(stream: stream, encoding: Encoding.UTF8))
        {
            await writer.WriteLineAsync(
                value:
                "Id,JobNumber,BookDate,Amount,Fuel,Ppd,CourierPayment,CourierFuel,CourierBonus,Quantity,Weight,Size,PickupAddressLine1,PickupAddressLine2,PickupAddressLine3,PickupAddressLine4,PickupAddressLine5,PickupAddressLine6,PickupAddressLine7,PickupAddressLine8,DeliveryAddressLine1,DeliveryAddressLine2,DeliveryAddressLine3,DeliveryAddressLine4,DeliveryAddressLine5,DeliveryAddressLine6,DeliveryAddressLine7,DeliveryAddressLine8,ClientReferenceA,ClientReferenceB,ClientReferenceC"
            );
            foreach (var x in data)
            {
                await writer.WriteLineAsync(
                    value:
                    $"{x.Id},{formatField(arg: x.JobNumber)},{x.BookDate:yyyy-MM-dd HH:mm:ss},{x.Amount},{x.Fuel},{x.Ppd},{x.CourierPayment},{x.CourierFuel},{x.CourierBonus},{x.Quantity},{x.Weight},{x.Size},{formatField(arg: x.PickupAddressLine1)},{formatField(arg: x.PickupAddressLine2)},{formatField(arg: x.PickupAddressLine3)},{formatField(arg: x.PickupAddressLine4)},{formatField(arg: x.PickupAddressLine5)},{formatField(arg: x.PickupAddressLine6)},{formatField(arg: x.PickupAddressLine7)},{formatField(arg: x.PickupAddressLine8)},{formatField(arg: x.DeliveryAddressLine1)},{formatField(arg: x.DeliveryAddressLine2)},{formatField(arg: x.DeliveryAddressLine3)},{formatField(arg: x.DeliveryAddressLine4)},{formatField(arg: x.DeliveryAddressLine5)},{formatField(arg: x.DeliveryAddressLine6)},{formatField(arg: x.DeliveryAddressLine7)},{formatField(arg: x.DeliveryAddressLine8)},{formatField(arg: x.ClientReferenceA)},{formatField(arg: x.ClientReferenceB)},{formatField(arg: x.ClientReferenceC)}"
                );
            }
        }

        var bytes = stream.ToArray();
        var filename = $"Jobs {DateTime.Now:yyyyMMddHHmmssfff}.csv";
        var folder = DateTime.UtcNow.ToString(format: "yyyyMM");
        var timestamp = DateTime.UtcNow.ToString(format: "yyyyMMddHHmmss");
        var key = $"Jobs/{folder}/Jobs-{timestamp}";

        using var ms = new MemoryStream(buffer: bytes);
        try
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = Environment.GetEnvironmentVariable(variable: "S3Bucket"),
                Key = key,
                ContentType = "text/csv",
                InputStream = ms,
            };
            await s3Client.PutObjectAsync(request: putRequest);
        }
        catch (AmazonS3Exception e)
        {
            Log.Error(
                exception: e,
                messageTemplate:
                $"{nameof(PodSearchDownload)} Error encountered when writing jobs download object to S3: "
            );
        }
        catch (Exception e)
        {
            Log.Error(
                exception: e,
                messageTemplate:
                $"{nameof(PodSearchDownload)} Error encountered when writing jobs download object to S3: "
            );
        }

        return File(fileContents: bytes, contentType: "text/csv", fileDownloadName: filename);
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (
            file == null
            || string.IsNullOrWhiteSpace(value: file.FileName)
            || !new[] { ".xls", ".xlsx", ".csv" }.Contains(
                value: file.FileName.Trim()[
                        file.FileName.Trim().LastIndexOf(value: ".", comparisonType: StringComparison.Ordinal)..].Trim()
                    .ToLower()
            )
        )
            return BadRequest(error: "Invalid file format.");

        var folder = DateTime.UtcNow.ToString(format: "yyyyMM");
        var fileExtension = file
            .FileName.Trim()
            .ToLower()[file.FileName.Trim().LastIndexOf(value: ".", comparisonType: StringComparison.Ordinal)..];

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(target: memoryStream);
        var byteArray = memoryStream.ToArray();

        var timestamp = DateTime.UtcNow.ToString(format: "yyyyMMddHHmmss");
        var key = $"Jobs/{folder}/Jobs-{timestamp}";

        using var ms = new MemoryStream(buffer: byteArray);
        try
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = Environment
                    .GetEnvironmentVariable(variable: "S3Bucket")
                    ?.Replace(oldValue: "downloads", newValue: "uploads"),
                Key = key,
                ContentType = file.ContentType,
                InputStream = ms,
            };
            putRequest.Metadata.Add(name: "FileName", value: file.FileName);
            await s3Client.PutObjectAsync(request: putRequest);
        }
        catch (AmazonS3Exception e)
        {
            Log.Error(
                exception: e,
                messageTemplate: $"{nameof(UploadFile)} Error encountered when writing job file upload object to S3: "
            );
        }
        catch (Exception e)
        {
            Log.Error(
                exception: e,
                messageTemplate: $"{nameof(UploadFile)} Error encountered when writing file upload object to S3: "
            );
        }

        Encoding.RegisterProvider(provider: CodePagesEncodingProvider.Instance);
        string sResult;

        using (
            var reader = (
                fileExtension == ".csv"
                    ? ExcelReaderFactory.CreateCsvReader(fileStream: memoryStream)
                    : ExcelReaderFactory.CreateReader(fileStream: memoryStream)
            )
        )
        {
            var output = reader
                .AsDataSet(
                    configuration: new ExcelDataSetConfiguration
                    {
                        ConfigureDataTable = (_) =>
                            new ExcelDataTableConfiguration { UseHeaderRow = true },
                    }
                )
                .Tables[index: 0]; //Only ready from the first sheet

            // Log the column names from the DataTable
            Log.Debug(
                messageTemplate: "DataTable Columns: {@Columns}",
                propertyValue: output.Columns.Cast<DataColumn>().Select(selector: c => c.ColumnName).ToList()
            );

            // Convert DataTable to a List of Dictionary
            var rows = new List<Dictionary<string, object>>();
            foreach (DataRow row in output.Rows)
            {
                var dict = new Dictionary<string, object>();
                foreach (DataColumn col in output.Columns)
                {
                    // Handle DBNull conversion
                    var value = row[column: col];
                    dict[key: col.ColumnName] = value == DBNull.Value ? null : value;
                }

                rows.Add(item: dict);
            }

            // Log the first row as a sample
            if (rows.Count != 0)
            {
                Log.Debug(messageTemplate: "Sample Row Data: {@FirstRow}", propertyValue: rows.First());
            }

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true,
                Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
                NumberHandling = JsonNumberHandling.AllowReadingFromString,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            };

            sResult = JsonSerializer.Serialize(value: rows, options: options);
            Log.Debug(
                messageTemplate: "Serialized JSON (first 500 chars): {JsonSample}",
                propertyValue: sResult.Length > 500 ? sResult[..500] + "..." : sResult
            );
        }

        var deserializeOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            NumberHandling = JsonNumberHandling.AllowReadingFromString,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };

        var result = JsonSerializer.Deserialize<List<JobManualPriceModel>>(
            json: sResult,
            options: deserializeOptions
        );

        if (result.Count == 0)
            return Ok();

        await jobRepository.UpdateManualPriceAsync(data: result);

        return Ok();
    }

    public async Task<IActionResult> ValidateSwapPod(string job)
    {
        var fromDate = DateTime.Today;
        var result = await jobRepository.PodSearch(
            courierId: null,
            wild: "",
            job: job,
            fromDate: fromDate.ResetTimeToStartOfDay(),
            toDate: fromDate.ResetTimeToEndOfDay(),
            clientId: null,
            pageIndex: 1,
            pageSize: 5
        );

        return result.Item1 == 0 ? Json(data: false) : Json(data: result.Item2.First().Id);
    }

    public async Task<IActionResult> SwapPod(string job1, string job2)
    {
        await jobRepository.SwapPod(job1: job1, job2: job2);
        return Ok();
    }

    public async Task<IActionResult> BulkSearch(
        int? courierId,
        int? clientId,
        string job,
        string wild,
        DateTime fromDate,
        DateTime toDate,
        int pageIndex,
        int pageSize
    )
    {
        var result = await jobRepository.BulkSearchAsync(
            courierId: courierId,
            job: job ?? "",
            wild: wild ?? "",
            fromDate: fromDate.ResetTimeToStartOfDay(),
            toDate: toDate.ResetTimeToEndOfDay(),
            clientId: clientId,
            pageIndex: pageIndex,
            pageSize: pageSize
        );

        return Json(data: result);
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
        var result = await jobRepository.PreBookSearchAsync(
            courierId: courierId,
            wild: wild ?? "",
            job: job ?? "",
            fromDate: fromDate.ResetTimeToStartOfDay(),
            toDate: toDate.ResetTimeToEndOfDay(),
            clientId: clientId,
            pageIndex: pageIndex,
            pageSize: pageSize
        );

        return Json(data: result);
    }

    [HttpPost]
    public async Task<IActionResult> LateCall([FromBody] LateCallRequest request)
    {
        try
        {
            var job = await jobRepository.GetJobForLateCallAsync(jobId: request.JobId);
            ArgumentNullException.ThrowIfNull(argument: job);

            var lateStatus = await DetermineLateStatus(
                lateType: request.LateType,
                lateTime: request.LateTime,
                minutes: job.MinutesRemaining,
                pickupTime: job.PickupTime,
                alertLatePickup: job.AlertLatePickup,
                deliveryTime: job.DeliveryTime,
                alertLateDelivery: job.AlertLateDelivery
            );

            if (lateStatus.ShouldCreateEvent)
            {
                await CreateLateNotificationEvent(
                    jobId: job.Id,
                    staffId: request.StaffId,
                    contact: request.DespatcherName,
                    eventType: lateStatus.EventType,
                    lateTime: lateStatus.LateTime,
                    etaTime: job.JobTime.AddMinutes(value: lateStatus.LateTime)
                );
            }

            await jobRepository.ResetLateEvent(jobId: job.Id, lateEventType: request.LateType);

            switch (request.LateType)
            {
                case (int)LateEventType.Pickup:
                    await jobRepository.LatePickup(
                        jobId: job.Id,
                        bookedSpeed: job.BookedSpeed,
                        notifiedSpeed: job.NotifiedSpeed,
                        late: request.LateTime,
                        staffId: request.StaffId,
                        calculationRequired: request.CalculationRequired
                    );
                    break;
                case (int)LateEventType.Delivery:
                    await jobRepository.LateDelivery(
                        jobId: job.Id,
                        bookedSpeed: job.BookedSpeed,
                        notifiedSpeed: job.NotifiedSpeed,
                        late: request.LateTime,
                       staffId: request.StaffId,
                        calculationRequired: request.CalculationRequired
                    );
                    break;
            }

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error allocating jobs");
            return StatusCode(statusCode: 500, value: ex.Message);
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
            (int)LateEventType.Pickup => await DeterminePickupLateStatus(lateTime: lateTime, minutes: minutes,
                pickupTime: pickupTime, alertLatePickup: alertLatePickup),
            (int)LateEventType.Delivery => await DetermineDeliveryLateStatus(lateTime: lateTime, minutes: minutes,
                deliveryTime: deliveryTime, alertLateDelivery: alertLateDelivery),
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

        var maxAutoLate = await jobRepository.MaxAutoLatePickupAlert();
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

        var maxAutoLateDelAlert = await jobRepository.MaxAutoLateDeliveryAlert();
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
            jobId: jobId,
            staffId: staffId,
            despatcherName: contact,
            notes: "Late Call from Despatch",
            eventType: eventType,
            lateTime: lateTime,
            etaTime: etaTime
        );
    }

    [HttpPost]
    public async Task<IActionResult> Allocate(int courierId, int dispId, List<int> jobIds)
    {
        try
        {
            await jobRepository.DispatchSelectedJobs(courierId: courierId, dispId: dispId, jobIds: jobIds);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error allocating jobs");
            return StatusCode(statusCode: 500, value: ex.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> ReAllocate(int courierId, int dispId, List<int> jobIds)
    {
        try
        {
            await jobRepository.ReDispatchSelectedJobs(courierId: courierId, dispId: dispId, jobIds: jobIds);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error reallocating jobs");
            return StatusCode(statusCode: 500, value: ex.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> ReSendSelected(string jobIds)
    {
        await jobRepository.ReSendSelectedJobs(jobIds: jobIds);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> ReAssignSelected(string jobIds)
    {
        await jobRepository.ReAssignSelectedJobs(jobIds: jobIds);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> Transfer(int jobId, int courierId, int dispId)
    {
        await jobRepository.TransferJob(jobId: jobId, courierId: courierId, dispId: dispId);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> SetFirstJob(int jobId, int courierId)
    {
        await jobRepository.SetFirstJob(jobId: jobId, courierId: courierId);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> Void(int jobId)
    {
        await jobRepository.VoidJob(jobId: jobId);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> ReSendAll(int courierId)
    {
        await jobRepository.ReSendAllJobs(courierId: courierId);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> RestoreSplitJobs([FromQuery] List<int> jobIds)
    {
        try
        {
            await jobRepository.RestoreSplitJobs(jobIds: jobIds);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(
                exception: ex,
                messageTemplate: "Error restoring the following split jobs {JobId}. Error: {ErrorMessage}",
                propertyValue0: jobIds.ToString(),
                propertyValue1: ex.Message
            );
            return StatusCode(
                statusCode: 500,
                value: new { message = "An unexpected error occurred restoring the jobs" }
            );
        }
    }

    [HttpPost]
    public async Task<IActionResult> RestoreJobs([FromQuery] List<int> jobIds)
    {
        try
        {
            await jobRepository.RestoreJobs(jobIds: jobIds);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(
                exception: ex,
                messageTemplate: "Error restoring the following jobs {JobId}. Error: {ErrorMessage}",
                propertyValue0: jobIds.ToString(),
                propertyValue1: ex.Message
            );
            return StatusCode(
                statusCode: 500,
                value: new { message = "An unexpected error occurred restoring the jobs" }
            );
        }
    }

    [HttpPost]
    public async Task<IActionResult> SplitJob(int jobId, string despatcherName)
    {
        await jobRepository.SplitJob(jobId: jobId, user: despatcherName);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> UnSplitJob(int jobId)
    {
        var message = await jobRepository.UnSplitJob(jobId: jobId);
        return Json(data: message);
    }

    [HttpPost]
    public async Task<IActionResult> UpdatePodDetails(
        int jobId,
        int jobStatus,
        string podName,
        DateTime podTime
    )
    {
        await jobRepository.UpdatePodDetails(jobId: jobId, jobStatus: jobStatus, podName: podName, podTime: podTime);
        return Ok();
    }

    public async Task<IActionResult> ReRateSplitJob(int jobId)
    {
        await jobRepository.ReRateSplitJob(jobId: jobId);
        return Ok();
    }

    public async Task<IActionResult> FinishSplitJobProcess(int jobId, string despatcherName)
    {
        await jobRepository.FinishSplitJobProcess(jobId: jobId, despatcher: despatcherName);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> SendSms(
        int courierId,
        int dispId,
        string despatcherName,
        string message
    )
    {
        await jobRepository.MessageCourier(courierId: courierId, dispId: dispId, despatcher: despatcherName,
            message: message);
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
        await jobRepository.UpdateSplitJobAddress(
            jobId: jobId,
            toSuburbId: toSuburbId,
            address: address,
            deliveryLat: deliveryLat,
            deliveryLng: deliveryLng
        );
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> AddRestoreEvent(int jobId, int staffId, string despatcherName)
    {
        try
        {
            await taskRepository.AddEventAsync(
                jobId: jobId,
                staffId: staffId,
                despatcherName: despatcherName,
                notes:
                $"Restored by {despatcherName} at {DateTime.Now.ToShortDateString()} {DateTime.Now.ToShortTimeString()}",
                eventType: (int)EventType.RestoreJob,
                lateTime: 33
            );

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error adding restore eventS");
            return StatusCode(statusCode: 500, value: ex.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddPriceSuburbChangeEvent(
        string jobNo,
        int clientId,
        string contact,
        int staffId,
        int? courierId,
        int jobId,
        int jobType,
        string despatcherName
    )
    {
        await taskRepository.AddEventAsync(
            jobId: jobId,
            staffId: staffId,
            despatcherName: despatcherName,
            notes: "Changed Price or Suburb",
            eventType: (int)EventType.ChangePrice
        );

        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> AddOtherEvent(
        string jobNo,
        int clientId,
        string contact,
        int staffId,
        int? courierId,
        int jobId,
        int jobType,
        string despatcherName,
        string notes
    )
    {
        await taskRepository.AddEventAsync(
            jobId: jobId,
            staffId: staffId,
            despatcherName: despatcherName,
            notes: notes,
            eventType: (int)EventType.Other
        );

        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> AddEvent(
        int staffId,
        int jobId,
        string despatcherName,
        string notes,
        int eventType
    )
    {
        await taskRepository.AddEventAsync(jobId: jobId, staffId: staffId, despatcherName: despatcherName, notes: notes,
            eventType: eventType);
        return Ok();
    }

    public async Task<IActionResult> ExsalerateActivity(
        string eventName,
        string notes,
        int clientId,
        string jobNumber,
        string despatcherName
    )
    {
        var baseUrl = Environment.GetEnvironmentVariable(variable: "ExsalerateAPI");
        var un = Environment.GetEnvironmentVariable(variable: "ExsalerateAPIUsername");
        var pw = Environment.GetEnvironmentVariable(variable: "ExsalerateAPIPW");

        // Set up HttpClient
        httpClient.BaseAddress = new Uri(uriString: baseUrl ?? string.Empty);
        httpClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                scheme: "Basic",
                parameter: Convert.ToBase64String(inArray: Encoding.ASCII.GetBytes(s: $"{un}:{pw}"))
            );

        var body = new ExsalerateActivity
        {
            SiteOwnerID = 11,
            CustomerRefCode = clientId.ToString(),
            Subject = $"Dispatch:{despatcherName} {eventName}",
            ActivityType = eventName,
            Description = $"Job Number: {jobNumber} - {notes}",
        };

        var content = new StringContent(
            content: JsonSerializer.Serialize(value: body),
            encoding: Encoding.UTF8,
            mediaType: "application/json"
        );

        var response = await httpClient.PostAsync(requestUri: "activity", content: content);

        if (response.StatusCode != HttpStatusCode.OK)
        {
            var responseContent = await response.Content.ReadAsStringAsync();
            var e = new ApplicationException(
                message: $"Exsalerate Activity Failed {responseContent} {Environment.NewLine} CurrentBody= {body}"
            );
            throw e;
        }

        return Ok();
    }

    [HttpGet]
    public async Task<IActionResult> SuburbList()
    {
        var data = await jobRepository.SuburbsAsync();
        return Json(data: data);
    }

    [HttpGet]
    public async Task<IActionResult> SpeedList()
    {
        var data = await jobRepository.SpeedsAsync();
        return Json(data: data);
    }

    [HttpGet]
    public async Task<IActionResult> ContactList(int clientId)
    {
        var data = await jobRepository.ContactsAsync(clientId: clientId);
        return Json(data: data);
    }

    [HttpGet]
    public async Task<IActionResult> ContactDetailList(int clientId)
    {
        var data = await jobRepository.ContactDetailList(clientId: clientId);
        return Json(data: data);
    }

    [HttpGet]
    public async Task<IActionResult> LeaveList()
    {
        var data = await jobRepository.LeaveParcelLocationsAsync();
        return Json(data: data);
    }

    [HttpGet]
    public async Task<IActionResult> UndeliverableList()
    {
        var data = await jobRepository.UndeliverableLocationsAsync();
        return Json(data: data);
    }

    [HttpGet]
    public async Task<IActionResult> InternalStatusList()
    {
        var data = await jobRepository.GetInternalStatusListAsync();
        return Json(data: data);
    }

    [HttpGet]
    public async Task<IActionResult> StatusList()
    {
        var data = await jobRepository.GetStatusListAsync();
        return Json(data: data);
    }

    [HttpGet]
    public async Task<IActionResult> EventTypeList()
    {
        var data = await jobRepository.EventTypeListAsync();
        return Json(data: data);
    }

    public async Task<IActionResult> TruckJobAmountBreakdown(
        int clientId,
        int fromId,
        int toId,
        double weight,
        int size,
        int speed,
        int qty,
        DateTime bookedDate,
        int pickUp,
        int dropOff,
        bool privateRes,
        int oversizeItems,
        int overWeightItems,
        int dGClass,
        DateTime truckStartTime,
        double truckHours,
        decimal gstRate
    )
    {
        var rate = await jobRepository.RateTruckJob(
            clientId: clientId,
            fromId: fromId,
            toId: toId,
            weight: weight,
            size: size,
            speed: speed,
            qty: qty,
            bookedDate: bookedDate,
            pickUp: pickUp,
            dropOff: dropOff,
            privateRes: privateRes,
            oversizeItems: oversizeItems,
            overWeightItems: overWeightItems,
            dGClass: dGClass,
            truckStartTime: truckStartTime,
            truckHours: truckHours
        );
        var description = await jobRepository.RateTruckJobDescription(
            clientId: clientId,
            fromId: fromId,
            toId: toId,
            weight: weight,
            size: size,
            speed: speed,
            qty: qty,
            bookedDate: bookedDate,
            pickUp: pickUp,
            dropOff: dropOff,
            privateRes: privateRes,
            oversizeItems: oversizeItems,
            overWeightItems: overWeightItems,
            dGClass: dGClass,
            truckStartTime: truckStartTime,
            truckHours: truckHours
        );
        description += $"\rTotal = {rate:C}";
        description += $"\rTotal (+GST) = {rate * (1 + gstRate):C}";
        return Json(data: description);
    }

    public async Task<IActionResult> RateTruckJob(
        int clientId,
        int fromId,
        int toId,
        double weight,
        int size,
        int speed,
        int qty,
        DateTime bookedDate,
        int pickUp,
        int dropOff,
        bool privateRes,
        int oversizeItems,
        int overWeightItems,
        int dGClass,
        DateTime truckStartTime,
        double truckHours
    )
    {
        var rate = await jobRepository.RateTruckJob(
            clientId: clientId,
            fromId: fromId,
            toId: toId,
            weight: weight,
            size: size,
            speed: speed,
            qty: qty,
            bookedDate: bookedDate,
            pickUp: pickUp,
            dropOff: dropOff,
            privateRes: privateRes,
            oversizeItems: oversizeItems,
            overWeightItems: overWeightItems,
            dGClass: dGClass,
            truckStartTime: truckStartTime,
            truckHours: truckHours
        );
        return Json(data: $"{rate:C}");
    }

    public async Task<IActionResult> JobAmountBreakdown(
        int clientId,
        int fromId,
        int toId,
        int speed,
        bool pedal,
        bool van,
        bool returnJob,
        int weight,
        int size,
        bool includeFuelSurcharge,
        bool direct,
        int acceptedJobTypeId,
        string ourRef,
        string refA,
        string refB,
        int quantity,
        DateTime booked,
        decimal gstRate,
        decimal amount
    )
    {
        var currentRateAmount = await jobRepository.RateJobAsync(
            clientId: clientId,
            fromId: fromId,
            toId: toId,
            speed: speed,
            pedal: pedal,
            van: van,
            returnJob: returnJob,
            weight: weight,
            size: size,
            includeFuelSurcharge: includeFuelSurcharge,
            direct: direct,
            acceptedJobTypeId: acceptedJobTypeId,
            ourRef: ourRef,
            refA: refA,
            refB: refB,
            quantity: quantity,
            booked: booked
        );

        var finalDescription =
            direct ? "DIRECT PRICE\r"
            : currentRateAmount != amount ? "NORMAL PRICE\r"
            : "";
        var description = await jobRepository.RateJobDescription(
            clientId: clientId,
            fromId: fromId,
            toId: toId,
            speed: speed,
            pedal: pedal,
            van: van,
            returnJob: returnJob,
            weight: weight,
            size: size,
            includeFuelSurcharge: includeFuelSurcharge,
            direct: direct,
            acceptedJobTypeId: acceptedJobTypeId,
            ourRef: ourRef,
            refA: refA,
            refB: refB,
            quantity: quantity,
            booked: booked
        );
        finalDescription += description;
        finalDescription += $"\rTotal = {currentRateAmount:C}";
        finalDescription += $"\rTotal (+GST) = {currentRateAmount * (1 + gstRate):C}";

        if (currentRateAmount == amount)
            return Json(data: finalDescription);

        var fs = includeFuelSurcharge
            ? await jobRepository.FuelSurchargeInclusiveAmount(
                clientId: clientId,
                amount: amount,
                from: fromId,
                to: toId,
                booked: booked,
                size: size
            )
            : 0;
        var ppd = includeFuelSurcharge
            ? await jobRepository.PpdInclusiveAmount(clientId: clientId, amount: amount)
            : 0;
        finalDescription += ($"\rSPECIAL PRICE = {(amount - fs - ppd):C}");
        if (fs <= 0)
            return Json(data: finalDescription);

        finalDescription += $"\rPlus fuel surcharge = {fs:C}";
        finalDescription += $"\rPlus PPD = {ppd:C}";
        finalDescription += $"\rTOTAL = {amount:C}";
        finalDescription += $"\rTotal (+GST) = {amount * (1 + gstRate):C}";

        return Json(data: finalDescription);
    }

    public async Task<IActionResult> RateJob(
        int clientId,
        int fromId,
        int toId,
        int speed,
        bool pedal,
        bool van,
        bool returnJob,
        int weight,
        int size,
        bool includeFuelSurcharge,
        bool direct,
        int acceptedJobTypeId,
        string ourRef,
        string refA,
        string refB,
        int quantity,
        DateTime booked
    )
    {
        var rate = await jobRepository.RateJobAsync(
            clientId: clientId,
            fromId: fromId,
            toId: toId,
            speed: speed,
            pedal: pedal,
            van: van,
            returnJob: returnJob,
            weight: weight,
            size: size,
            includeFuelSurcharge: includeFuelSurcharge,
            direct: direct,
            acceptedJobTypeId: acceptedJobTypeId,
            ourRef: ourRef,
            refA: refA,
            refB: refB,
            quantity: quantity,
            booked: booked
        );
        return Json(data: $"{rate:C}");
    }

    public async Task<IActionResult> RateJobUs(
        int jobId,
        int clientId,
        int speed,
        string fromZip,
        string toZip,
        int weight,
        DateTime booked,
        int size,
        bool dangerousGoods,
        int totalPallets,
        int extraStopOffs,
        int dryIceWeight,
        int waitTime,
        decimal pickUpLat,
        decimal pickUpLong,
        decimal deliveryLat,
        decimal deliveryLong
    )
    {
        try
        {
            // Get distances and airport info
            var distanceResult = await rateJobService.CalculateJobRateUs(
                request: new JobRateRequest
                {
                    SpeedId = speed,
                    PickupLat = pickUpLat,
                    PickupLong = pickUpLong,
                    DeliveryLat = deliveryLat,
                    DeliveryLong = deliveryLong,
                }
            );

            // Calculate final rate
            var rate = await jobRepository.RateJobUsAsync(
                jobId: jobId,
                clientId: clientId,
                speed: speed,
                fromZip: fromZip,
                toZip: toZip,
                totalMiles: (decimal)distanceResult.TotalMiles, // Used for non-flight jobs
                fromMiles: (decimal)distanceResult.FromMiles, // Used for flight jobs
                toMiles: (decimal)distanceResult.ToMiles, // Used for flight jobs
                weight: weight,
                booked: booked,
                size: size,
                dangerousGoods: dangerousGoods,
                totalPallets: totalPallets,
                extraStopOffs: extraStopOffs,
                dryIceWeight: dryIceWeight,
                waitTime: waitTime,
                fromAgentId: distanceResult.FromAirport?.AgentId,
                fromAirportId: distanceResult.FromAirport?.AirportId,
                toAgentId: distanceResult.ToAirport?.AgentId,
                toAirportId: distanceResult.ToAirport?.AirportId
            );

            return Json(data: $"{rate:C}");
        }
        catch (Exception ex)
        {
            Log.Error(exception: ex, messageTemplate: "Error calculating job rate");
            return StatusCode(statusCode: 500, value: ex.Message);
        }
    }

    public async Task<IActionResult> PpdExclusiveAmount(int clientId, decimal amount)
    {
        var ppd = await jobRepository.PpdExclusiveAmount(clientId: clientId, amount: amount);
        return Json(data: ppd);
    }

    public async Task<IActionResult> TruckItemsSummary(int jobId, int truckWeightLimit)
    {
        var summary = await jobRepository.TruckJobItemsAsync(jobId: jobId, truckWeightLimit: truckWeightLimit);
        return Json(data: summary);
    }

    public async Task<IActionResult> UpdateDeliveryAddressNz(
        [FromBody] UpdateAddressRequestNz request
    )
    {
        try
        {
            if (request is null)
                return BadRequest(error: "Request Address Data Not Provided");

            await jobRepository.UpdateDeliveryAddressNzAsync(request: request);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(exception: e, messageTemplate: $"An error occured updating address for job {request.JobId}");
            return StatusCode(statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateDeliveryAddressUs(
        [FromBody] UpdateAddressRequestUs request
    )
    {
        try
        {
            if (request is null)
                return BadRequest(error: "Request Address Data Not Provided");

            await jobRepository.UpdateDeliveryAddressUsAsync(request: request);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(exception: e, messageTemplate: $"An error occured updating address for job {request.JobId}");
            return StatusCode(statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateBulkDeliveryAddress(
        int bulkJobId,
        string toSuburb,
        int toPostCode,
        string address,
        decimal deliveryLat,
        decimal deliveryLng,
        string despatcherName
    )
    {
        await jobRepository.UpdateBulkDeliveryAddressAsync(
            bulkJobId: bulkJobId,
            toSuburb: toSuburb,
            toPostCode: toPostCode,
            address: address,
            deliveryLat: deliveryLat,
            deliveryLng: deliveryLng,
            despatcher: despatcherName
        );
        return Ok();
    }

    public async Task<IActionResult> UpdateBookingDeliveryAddress(
        int jobId,
        int toSuburbId,
        string address,
        decimal deliveryLat,
        decimal deliveryLng,
        bool cbd,
        decimal rate,
        string despatcherName
    )
    {
        await jobRepository.UpdateBookingDeliveryAddressAsync(
            jobId: jobId,
            toSuburbId: toSuburbId,
            address: address,
            deliveryLat: deliveryLat,
            deliveryLng: deliveryLng,
            cbd: cbd,
            rate: rate,
            despatcher: despatcherName
        );
        return Ok();
    }

    public async Task<IActionResult> UpdatePickupAddressNz(
        [FromBody] UpdateAddressRequestNz request
    )
    {
        try
        {
            if (request is null)
                return BadRequest(error: "Request Address Data Not Provided");

            await jobRepository.UpdatePickupAddressNzAsync(request: request);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(exception: e, messageTemplate: $"An error occured updating address for job {request.JobId}");
            return StatusCode(statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdatePickupAddressUs(
        [FromBody] UpdateAddressRequestUs request
    )
    {
        try
        {
            if (request is null)
                return BadRequest(error: "Request Address Data Not Provided");

            await jobRepository.UpdatePickupAddressUsAsync(request: request);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(exception: e, messageTemplate: $"An error occured updating address for job {request.JobId}");
            return StatusCode(statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateJobType(int jobId, int jobType, string despatcherName)
    {
        await jobRepository.UpdateJobTypeAsync(jobId: jobId, jobType: jobType, despatcher: despatcherName);
        return Ok();
    }

    public async Task<IActionResult> UpdateBulkPickupAddress(
        int bulkJobId,
        string fromSuburb,
        int fromPostCode,
        string address,
        decimal pickupLat,
        decimal pickupLng,
        string despatcherName
    )
    {
        await jobRepository.UpdateBulkPickupAddressAsync(
            bulkJobId: bulkJobId,
            fromSuburb: fromSuburb,
            fromPostCode: fromPostCode,
            address: address,
            pickupLat: pickupLat,
            pickupLng: pickupLng,
            despatcher: despatcherName
        );
        return Ok();
    }

    public async Task<IActionResult> UpdateBookingPickupAddress(
        int jobId,
        int fromSuburbId,
        string address,
        decimal pickupLat,
        decimal pickupLng,
        bool cbd,
        decimal rate,
        string despatcherName
    )
    {
        await jobRepository.UpdateBookingPickupAddressAsync(
            jobId: jobId,
            fromSuburbId: fromSuburbId,
            address: address,
            pickupLat: pickupLat,
            pickupLng: pickupLng,
            cbd: cbd,
            rate: rate,
            despatcher: despatcherName
        );
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> UpdateJob(
        int jobId,
        string field,
        string value,
        decimal? rate,
        string despatcherName,
        int staffId
    )
    {
        try
        {
            await jobRepository.UpdateJobAsync(jobId: jobId, field: field, value: value, rate: rate,
                userName: despatcherName, staffId: staffId);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(
                exception: e,
                messageTemplate: $"An error occured updating field {field} with value {value} for job {jobId}"
            );
            return StatusCode(statusCode: StatusCodes.Status500InternalServerError);
        }
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
            bulkJobId: bulkJobId,
            field: field,
            value: value,
            rate: rate,
            despatcher: despatcherName,
            staffId: staffId
        );
        return Ok();
    }

    public async Task<IActionResult> ReleaseBulkJob(string jobNumber, DateTime bookDate)
    {
        await jobRepository.ReleaseBulkJobAsync(jobNumber: jobNumber, bookDate: bookDate);
        return Ok();
    }

    public async Task<IActionResult> UpdateJobBooking(
        int jobId,
        string field,
        string value,
        decimal? rate,
        string despatcherName,
        int staffId
    )
    {
        await jobRepository.UpdateJobBookingAsync(
            jobId: jobId,
            field: field,
            value: value,
            rate: rate,
            despatcher: despatcherName,
            staffId: staffId
        );
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> QuickCreateJob([FromBody] CreateJobRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(argument: request);

            if (!IsValidRequest(request: request))
                return StatusCode(
                    statusCode: StatusCodes.Status500InternalServerError,
                    value: new { message = "Bad Request" }
                );

            var jobId = await jobRepository.QuickAddJobAsync(request: request.Job, staffId: request.StaffId.Value);

            //Check if jobId is valid before continuing
            if (jobId == 0)
                return StatusCode(
                    statusCode: StatusCodes.Status500InternalServerError,
                    value: "Created Job Id is null"
                );

            // Add note
            await jobRepository.SaveNoteAsync(jobId: jobId,
                noteText:
                $"This job was created manually by {request.DespatcherName} via the Quick Create Job feature.",
                staffId: request.StaffId.Value);

            return Json(data: jobId);
        }
        catch (Exception e)
        {
            Console.WriteLine(value: e);
            throw;
        }
    }

    private static bool IsValidRequest(CreateJobRequest request) =>
        !(request?.Job == null || request.Job.ClientId == 0 || request.StaffId == null);


    [HttpPost]
    public async Task<IActionResult> InterCourierCharge(
        [FromBody] InterCourierChargeViewModel viewModel
    )
    {
        ArgumentNullException.ThrowIfNull(argument: viewModel);

        await jobRepository.AddInterCourierChargeAsync(viewModel: viewModel);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> ProcessUncheckDirect(
        int jobId,
        string despatcher,
        int staffId,
        string currentSpeed
    )
    {
        var jobData = await jobRepository.DirectToAsap(jobId: jobId);
        var settingData = await jobRepository.SettingsAsync();
        var emailMessage = FormatDelimMessage(
            format: settingData.UncheckDirectEmailMessage,
            startDelim: "[",
            endDelim: "]",
            data: jobData
        );

        await taskRepository.AddEventAsync(
            jobId: jobId,
            staffId: staffId,
            despatcherName: despatcher,
            notes: "Direct job changed to ASAP",
            eventType: (int)EventType.DirectAsap,
            lateTime: null,
            etaTime: null,
            close: jobData.CloseEvent
        );

        if (jobData.NotifyViaEmail)
        {
            SendEmail(
                toAddress: jobData.ContactEmail,
                fromAddress: "noreply@urgent.co.nz",
                body: emailMessage,
                subject: settingData.UncheckDirectEmailSubject ?? ""
            );
        }

        var result = await jobRepository.UpdateFirstAvailableSpeed(jobId: jobId);

        var msg =
            $"Client advised by email that job changed from a Direct {currentSpeed} to ASAP {result.Name ?? currentSpeed}";
        var msgPhone =
            $" to be called and advised that job changed from a Direct {currentSpeed} to ASAP {result.Name ?? currentSpeed}";

        if (jobData.NotifyViaEmail)
            await jobRepository.SaveNoteAsync(jobId: jobId, noteText: msg, staffId: staffId);
        else
            await jobRepository.SaveNoteAsync(jobId: jobId, noteText: jobData.Contact + msgPhone, staffId: staffId);

        return Ok();
    }

    [HttpGet]
    public async Task<IActionResult> HasClientItemsAvailable(int clientId, int speedId)
    {
        var hasItems = await jobRepository.HasClientItemsAvailableAsync(clientId: clientId, speedId: speedId);
        return Json(data: hasItems);
    }

    [HttpGet]
    public async Task<IActionResult> GetAllClientItems(int clientId, int speedId, int jobId)
    {
        var clientItems =
            await jobRepository.GetClientItemsBySpeedAsync(clientId: clientId, speedId: speedId, jobId: jobId);
        return Json(data: clientItems);
    }

    [HttpPost]
    public async Task<IActionResult> AddClientItemsToJob(
        int jobId,
        [FromBody] ClientItemsModel itemsModel
    )
    {
        if (itemsModel != null)
            await jobRepository.AddClientsItemToJobAsync(
                jobId: jobId,
                clientItemIds: itemsModel.ServiceIds,
                totalCost: itemsModel.TotalCost
            );
        return Ok();
    }

    private static string FormatDelimMessage<T>(
        string format,
        string startDelim,
        string endDelim,
        T data
    )
    {
        var message = "";
        while (format?.Length > 0)
        {
            var c = Strings.Left(str: format, Length: 1);
            format = Strings.Mid(str: format, Start: 2);
            if (c == startDelim)
            {
                var fieldName = Strings.Left(str: format,
                    Length: Strings.InStr(String1: format, String2: endDelim) - 1);
                format = Strings.Mid(str: format, Start: Strings.InStr(String1: format, String2: endDelim) + 1);
                var props = typeof(T).GetRuntimeProperties();
                var p = props.First(predicate: x =>
                    string.Equals(a: x.Name, b: fieldName, comparisonType: StringComparison.CurrentCultureIgnoreCase)
                );

                message += p.GetValue(obj: data)?.ToString();
            }
            else
            {
                message += c;
            }
        }

        message = message.Replace(oldValue: "  ", newValue: " ");
        message = Strings.Trim(str: message);
        return message;
    }

    public async Task<IActionResult> SendPod(int jobId, string toEmail)
    {
        var selectedJob = await jobRepository.GetJobByIdAsync(jobId: jobId);

        if (selectedJob == null)
        {
            return NotFound();
        }

        var att = new Attachment(
            contentStream: new MemoryStream(buffer: selectedJob.PodPhoto),
            name: selectedJob.JobNo.ToString() + ".png"
        );

        SendEmail(
            toAddress: toEmail,
            fromAddress: Environment.GetEnvironmentVariable(variable: "FromAddress"),
            body: $"Hello, attached is the proof of delivery photo for job {selectedJob.JobNo}.",
            subject: $"Delivery Photo for {selectedJob.JobNo}",
            attachment: att
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
        message.From = new MailAddress(address: fromAddress);
        message.Subject = subject;
        message.Body = body;
        message.Priority = MailPriority.High;
        message.To.Add(addresses: toAddress);
        message.Headers.Add(name: "Message-ID", value: $"<{Guid.NewGuid()}@DFRNT.com>");

        if (attachment != null) message.Attachments.Add(item: attachment);

        if (!string.IsNullOrEmpty(value: replyTo)) message.ReplyToList.Add(item: new MailAddress(address: replyTo));

        using var smtp = new SmtpClient();
        smtp.Host = Environment.GetEnvironmentVariable(variable: "SMTPServer");
        smtp.UseDefaultCredentials = false;
        smtp.EnableSsl = true;
        smtp.Credentials = new NetworkCredential(
            userName: Environment.GetEnvironmentVariable(variable: "SMTPUser"),
            password: Environment.GetEnvironmentVariable(variable: "SMTPPass")
        );
        smtp.Port = int.Parse(s: Environment.GetEnvironmentVariable(variable: "SMTP_Port") ?? string.Empty);
        smtp.Send(message: message);
    }

    private async Task<List<S3Object>> SearchFilesByPatternAsync(string bucketName, string pattern)
    {
        var request = new ListObjectsV2Request
        {
            BucketName = bucketName,
            Prefix = pattern,
            MaxKeys = 1000, // Adjust if needed, but 1000 is the maximum allowed
        };

        var result = new List<S3Object>();

        try
        {
            ListObjectsV2Response response;
            do
            {
                response = await s3Client.ListObjectsV2Async(request: request);

                result.AddRange(collection: response.S3Objects);
                request.ContinuationToken = response.NextContinuationToken;
            } while (response.IsTruncated);
        }
        catch (AmazonS3Exception e)
        {
            Log.Error(exception: e, messageTemplate: $"{nameof(UploadFile)} Error encountered. Message:'{e.Message}'");
        }
        catch (Exception e)
        {
            Log.Error(exception: e, messageTemplate: $"{nameof(UploadFile)} Error encountered. Message:'{e.Message}'");
        }

        return result;
    }

    public async Task<IActionResult> IsFilesAttachedToJob(int jobId)
    {
        var bucketName = Environment.GetEnvironmentVariable(variable: "S3BucketMars");
        var tenantId = HttpContext.User.Claims.FirstOrDefault(predicate: x => x.Type == "CurrentTenantID")
            ?.Value;
        var key = $"JobAttachments/{jobId}-";
        Log.Debug(messageTemplate: $"Get S3 Object List for {key}");
        var s3List = await SearchFilesByPatternAsync(bucketName: bucketName, pattern: key);
        Log.Debug(messageTemplate: $"Found {s3List.Count} objects for {key}");

        return Json(data: s3List.Count > 0);
    }

    public async Task<IActionResult> GetAttachedFiles(int jobId)
    {
        var s3Files = new List<S3FileInfo>();
        try
        {
            var bucketName = Environment.GetEnvironmentVariable(variable: "S3BucketMars");
            var tenantId = HttpContext.User.Claims.FirstOrDefault(predicate: x => x.Type == "CurrentTenantID")
                ?.Value;
            var key = $"JobAttachments/{jobId}-";
            Log.Debug(messageTemplate: $"Get S3 Object List for {key}");
            var s3List = await SearchFilesByPatternAsync(bucketName: bucketName, pattern: key);
            foreach (var s3Object in s3List)
            {
                var getObjectRequest = new GetObjectRequest
                {
                    BucketName = bucketName,
                    Key = s3Object.Key,
                };
                using var response = await s3Client.GetObjectAsync(request: getObjectRequest);
                await using var responseStream = response.ResponseStream;
                using var reader = new StreamReader(stream: responseStream);
                using var memoryStream = new MemoryStream();
                await response.ResponseStream.CopyToAsync(destination: memoryStream);
                var fileName = response.Metadata[name: "FileName"];
                var s3FileInfo = new S3FileInfo
                {
                    S3Key = s3Object.Key,
                    FileName = fileName,
                    LastModified = s3Object.LastModified,
                    Size = s3Object.Size,
                };
                s3Files.Add(item: s3FileInfo);
            }
        }
        catch (Exception e)
        {
            Log.Error(exception: e, messageTemplate: $"Error {nameof(GetAttachedFiles)}: {e.Message}");
            return StatusCode(statusCode: 500, value: new { message = "Error retrieving files", error = e.Message });
        }

        return Ok(value: s3Files);
    }

    [HttpPost]
    public async Task<IActionResult> UploadFile([FromForm] FileUploadRequest request)
    {
        try
        {
            if (request?.File == null || request.File.Length == 0)
                return BadRequest(error: "No file uploaded");

            // Validate file type
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "application/pdf" };
            if (!allowedTypes.Contains(value: request.File.ContentType.ToLower()))
                return BadRequest(error: "Invalid file type. Only images and PDFs are allowed.");

            // Validate file size (10MB max)
            if (request.File.Length > 10 * 1024 * 1024)
                return BadRequest(error: "File size exceeds the limit of 10MB.");

            using var memoryStream = new MemoryStream();
            if (request.File == null)
                return Ok(
                    value: new { message = "File uploaded successfully", fileName = request.File.FileName }
                );

            await request.File.CopyToAsync(target: memoryStream);

            var byteArray = memoryStream.ToArray();

            var timestamp = DateTime.UtcNow.ToString(format: "yyyyMMddHHmmss");
            var key = $"JobAttachments/{request.JobId}-{timestamp}";

            using var ms = new MemoryStream(buffer: byteArray);
            try
            {
                var putRequest = new PutObjectRequest
                {
                    BucketName = Environment.GetEnvironmentVariable(variable: "S3BucketMars"),
                    Key = key,
                    ContentType = request.File.ContentType,
                    InputStream = ms,
                };
                putRequest.Metadata.Add(name: "FileName", value: request.File.FileName);
                await s3Client.PutObjectAsync(request: putRequest);
            }
            catch (AmazonS3Exception e)
            {
                Log.Error(
                    exception: e,
                    messageTemplate:
                    $"{nameof(UploadFile)} Error encountered when writing job file upload object to S3: "
                );
            }
            catch (Exception e)
            {
                Log.Error(
                    exception: e,
                    messageTemplate: $"{nameof(UploadFile)} Error encountered when writing file upload object to S3: "
                );
            }

            return Ok(
                value: new { message = "File uploaded successfully", fileName = request.File.FileName }
            );
        }
        catch (Exception ex)
        {
            // Log the exception
            return StatusCode(statusCode: 500, value: ex.Message);
        }
    }

    public async Task<IActionResult> DownloadFile(int jobId, string key)
    {
        var bucketName = Environment.GetEnvironmentVariable(variable: "S3BucketMars");
        try
        {
            var request = new GetObjectRequest { BucketName = bucketName, Key = key };

            using var response = await s3Client.GetObjectAsync(request: request);
            if (response.HttpStatusCode == HttpStatusCode.OK)
            {
                var originalFileName = response.Metadata[name: "FileName"];
                var contentType = response.Headers.ContentType;

                // Read the stream into a memory stream to get the bytes
                using var ms = new MemoryStream();
                await response.ResponseStream.CopyToAsync(destination: ms);
                var fileBytes = ms.ToArray();

                // Return file with proper headers
                return File(
                    fileContents: fileBytes,
                    contentType: contentType,
                    fileDownloadName: originalFileName
                );
            }
            else
            {
                return NotFound(value: $"File {key} not found.");
            }
        }
        catch (AmazonS3Exception ex)
        {
            return ex.StatusCode == HttpStatusCode.NotFound
                ? NotFound(value: $"File {key} not found in bucket")
                : StatusCode(statusCode: 500, value: $"Error downloading file: {ex.Message}");
        }
    }

    public async Task<IActionResult> DeleteFile(int jobId, string key)
    {
        var bucketName = Environment.GetEnvironmentVariable(variable: "S3BucketMars");

        try
        {
            var deleteObjectRequest = new DeleteObjectRequest
            {
                BucketName = bucketName,
                Key = key,
            };
            await s3Client.DeleteObjectAsync(request: deleteObjectRequest);
        }
        catch (AmazonS3Exception ex)
        {
            Log.Error(
                exception: ex,
                messageTemplate:
                $"{nameof(DeleteFile)} AWS S3 error occurred while deleting object {key} from bucket {bucketName}. StatusCode: {ex.StatusCode}, ErrorCode: {ex.ErrorCode}"
            );
        }
        catch (Exception ex)
        {
            Log.Error(
                exception: ex,
                messageTemplate:
                $"{nameof(DeleteFile)} An unexpected error occurred while deleting object {key} from bucket {bucketName}"
            );
        }

        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> UpdateNote(int jobId, string note)
    {
        Log.Information(messageTemplate: "Request received to update note for job {JobId}", propertyValue: jobId);

        if (jobId <= 0)
        {
            Log.Warning(messageTemplate: "Invalid jobId received: {JobId}", propertyValue: jobId);
            return BadRequest(error: new { message = "Invalid job ID" });
        }

        if (string.IsNullOrWhiteSpace(value: note))
        {
            Log.Warning(messageTemplate: "Empty note value received for job {JobId}", propertyValue: jobId);
            return BadRequest(error: new { message = "Note cannot be empty" });
        }

        try
        {
            await jobRepository.UpdateJobNoteAsync(jobId: jobId, note: note);
            Log.Information(messageTemplate: "Successfully updated note for job {JobId}", propertyValue: jobId);
            return Ok(value: new { message = "Note updated successfully" });
        }
        catch (KeyNotFoundException ex)
        {
            Log.Error(exception: ex, messageTemplate: "Job not found for ID {JobId}", propertyValue: jobId);
            return StatusCode(statusCode: 500, value: new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Log.Error(
                exception: ex,
                messageTemplate: "Error updating note for job {JobId}. Error: {ErrorMessage}",
                propertyValue0: jobId,
                propertyValue1: ex.Message
            );
            return StatusCode(
                statusCode: 500,
                value: new { message = "An unexpected error occurred while updating the note" }
            );
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateConnote(int jobId, string conNote)
    {
        Log.Information(
            messageTemplate: "Request received to update connote for job {JobId} with value {NewConnote}",
            propertyValue0: jobId,
            propertyValue1: conNote
        );

        if (jobId <= 0)
        {
            Log.Warning(messageTemplate: "Invalid jobId received: {JobId}", propertyValue: jobId);
            return BadRequest(error: new { message = "Invalid job ID" });
        }

        if (string.IsNullOrWhiteSpace(value: conNote))
        {
            Log.Warning(messageTemplate: "Empty connote value received for job {JobId}", propertyValue: jobId);
            return BadRequest(error: new { message = "Connote value cannot be empty" });
        }

        try
        {
            await jobRepository.UpdateJobConnoteAsync(jobId: jobId, conNote: conNote);
            Log.Information(messageTemplate: "Successfully updated connote for job {JobId}", propertyValue: jobId);
            return Ok(value: new { message = "Connote updated successfully" });
        }
        catch (KeyNotFoundException ex)
        {
            Log.Error(exception: ex, messageTemplate: "Job not found for ID {JobId}", propertyValue: jobId);
            return NotFound(value: new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Log.Error(
                exception: ex,
                messageTemplate: "Error updating connote for job {JobId}. Error: {ErrorMessage}",
                propertyValue0: jobId,
                propertyValue1: ex.Message
            );
            return StatusCode(
                statusCode: 500,
                value: new { message = "An unexpected error occurred while updating the connote" }
            );
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateJobPackages([FromBody] UpdateJobPackagesRequest request)
    {
        try
        {
            await jobRepository.UpdatePackagesForJobAsync(jobId: request.JobId, parcels: request.Parcels);
            return Ok(value: new { message = "Parcels updated successfully" });
        }
        catch (Exception ex)
        {
            Log.Error(
                exception: ex,
                messageTemplate: "Error updating packages for job {JobId}. Error: {ErrorMessage}",
                propertyValue0: request.JobId,
                propertyValue1: ex.Message
            );
            return StatusCode(statusCode: 500, value: new { message = ex.Message });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetJobTypes()
    {
        var types = await jobRepository.GetAllAsync<TucJobType>();
        var formattedList = types
            .Select(selector: t => new Suggestion { Id = t.UcjtId, Text = t.UcjtName })
            .ToList();

        return Json(data: formattedList);
    }

    [HttpGet]
    public async Task<IActionResult> IsJobParent(int jobId)
    {
        var isParent = await jobRepository.IsJobParentAsync(jobId: jobId);
        return Json(data: isParent);
    }

    #region Single use Api models

    public class ClientItemsModel
    {
        public List<int> ServiceIds { get; init; }
        public decimal TotalCost { get; init; }
    }

    public class UpdateJobPackagesRequest
    {
        public int JobId { get; init; }
        public List<ParcelDimensions> Parcels { get; init; }
    }

    #endregion
}
