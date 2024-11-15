using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualBasic;
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
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using ExcelDataReader;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Serilog;
using static Azure.Core.HttpHeader;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System.Threading;

namespace DespatchWeb.Controllers;

public class JobController(IJobRepository jobRepository, ICourierRepository courierRepo, IClientAccessValidatorService clientAccessValidator, IAmazonS3 s3Client, HttpClient httpClient) : Controller
{

    [HttpGet]
    public async Task<IActionResult> Index([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        // Validate Client Access
        if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);

        // Get jobs
        var result = await jobRepository.JobListAsync(queryParams.Status, queryParams.Order,
            queryParams.Asc, isInternal, clientIds, despatchViewIds);
        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetJobsByClearListEnvelope([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds,
        [FromQuery] ClearListEnvelopeViewModel clearListEnvelopeViewModel)
    {
        try
        {
            // Validate Client Access
            if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);

            // Get jobs
            var result = await jobRepository.JobListAsync(queryParams.Status, queryParams.Order,
                queryParams.Asc, isInternal, clientIds, despatchViewIds, clearListEnvelopeViewModel);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, $"an error occured geting jobs by clear list");
            return StatusCode(StatusCodes.Status500InternalServerError, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddPallet([FromBody] PalletInfo palletInfo, bool preBook, string despatcher)
    {
        await jobRepository.AddPalletInfoAsync(palletInfo, preBook, despatcher);
        return Ok("OK");
    }

    [HttpPost]
    public async Task<IActionResult> EditPallet([FromBody] PalletInfo palletInfo, bool preBook, string despatcher)
    {
        await jobRepository.EditPalletInfoAsync(palletInfo, preBook, despatcher);
        return Ok("OK");
    }

    [HttpPost]
    public async Task<IActionResult> DeletePallet([FromBody] PalletInfo palletInfo, bool preBook, string despatcher)
    {
        await jobRepository.DeletePalletInfoAsync(palletInfo, preBook, despatcher);
        return Ok("OK");
    }


    public async Task<IActionResult> SendPrebookJob(int jobId)
    {
        await jobRepository.SendPrebookJobAsync(jobId);
        return Ok("OK");
    }

    public async Task<IActionResult> VoidPrebookJob(int jobId, string despatcher, int staffId)
    {
        await jobRepository.VoidPrebookJobAsync(jobId, despatcher, staffId);
        return Ok("OK");
    }

    public async Task<IActionResult> Current(int courierId, bool done)
    {
        try
        {
            var result = await jobRepository.CurrentJobList(courierId, done);
            return Json(result);
        }
        catch (Exception e)
        {
            var message = $"An error occured getting current jobs courier {courierId}";
            Log.Error(e, message);
            return StatusCode(StatusCodes.Status500InternalServerError, message);
        }
    }

    public async Task<IActionResult> Supports(string channel)
    {
        var result = await jobRepository.SupportEvents(channel);
        return Json(result);
    }

    [HttpPost]
    public async Task<IActionResult> CloseSupport(int supportId, int staffId)
    {
        await jobRepository.CloseSupportEvent(supportId, staffId);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> LockSupport(int id, string dispatcher)
    {
        var support = await jobRepository.GetSupportEventAsync(id);
        support.UcevDespatcher = dispatcher;
        var result = await jobRepository.UpdateSupportEventAsync(support);
        return Json(result > 0);
    }

    [HttpPost]
    public async Task<IActionResult> UnLockSupport(int id, string dispatcher)
    {
        var support = await jobRepository.GetSupportEventAsync(id);
        if (support.UcevDespatcher != dispatcher) return Json(false);
        support.UcevDespatcher = "";
        var result = await jobRepository.UpdateSupportEventAsync(support);
        return Json(result > 0);
    }

    private async Task<List<S3Object>> SearchDeliveryFilesByPatternAsync(string bucketName, string pattern, int year, int month)
    {
        var allResults = new List<S3Object>();
        // Calculate next month and year (handling December rollover)
        var nextMonth = month == 12 ? 1 : month + 1;
        var nextYear = month == 12 ? year + 1 : year;
        try
        {

            var monthPrefixes = new[]
            {
                $"{year}/{month:D2}/",
                $"{nextYear}/{nextMonth:D2}/"
            };


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

            Log.Error(e, $"Error encountered on server. Message:'{e.Message}' when writing an object");
        }
        catch (Exception e)
        {
            Log.Error(e, $"Unknown encountered on server. Message:'{e.Message}' when writing an object");
        }



        return allResults;
    }

    public async Task<IActionResult> GetJobDeliveryPhotosAndSignature(int jobId, int year, int month)
    {

        var all = new List<byte[]>();
        try
        {

            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var key = $"{jobId}-";
            Log.Debug($"Get S3 Object List for {key}");
            var s3List = await SearchDeliveryFilesByPatternAsync(bucketName, key, year, month);
            Log.Debug($"Found {s3List.Count} objects for {key}");
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
                all.Add(memoryStream.ToArray());

            }
        }
        catch (Exception e)
        {
            Log.Error(e, $"{nameof(GetJobDeliveryPhotosAndSignature)} Error: ");
        }

        return Json(all);
    }


    public async Task<IActionResult> Detail(int jobId)
    {
        try
        {
            var job = await jobRepository.GetJobByIdAsync(jobId);

            return Json(job);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(408); // Request Timeout
        }
        catch (Exception ex)
        {
            Log.Error(ex, "An unexpected error occured");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet]
    public async Task<IActionResult> ScanJobDetailAsync(DateTime? runDate, string scan)
    {
        var data = await jobRepository.ScanList(runDate, scan);
        return Json(data);
    }

    public async Task<IActionResult> Related(int parentId, int clientId)
    {
        var result = await jobRepository.RelatedJobs(parentId, clientId);
        return Json(result);
    }

    public async Task<IActionResult> BulkDetail(int bulkJobId)
    {
        var result = await jobRepository.BulkJobDetail(bulkJobId);
        return Json(result);
    }

    public async Task<IActionResult> PreBookDetail(int preBookJobId)
    {
        var result = await jobRepository.PreBookDetailAsync(preBookJobId);
        return Json(result);
    }

    public async Task<IActionResult> PreBookJobs()
    {
        var result = await jobRepository.PreBookJobList();
        return Json(result);
    }

    public async Task<IActionResult> PodSearch(int? courierId, int? clientId, string wild, string job,
        DateTime fromDate,
        DateTime toDate,
        int pageIndex, int pageSize)
    {
        var result = await jobRepository.PodSearch(courierId, wild ?? "", job ?? "", fromDate.ResetTimeToStartOfDay(),
            toDate.ResetTimeToEndOfDay(), clientId, pageIndex, pageSize);

        return Json(result);
    }

    public async Task<IActionResult> PodSearchDownload(int? courierId, int? clientId, string wild, string job,
        DateTime fromDate,
        DateTime toDate)
    {
        try
        {
            var data = await jobRepository.PodSearchDownloadAsync(courierId, wild ?? "", job ?? "",
                fromDate.ResetTimeToStartOfDay(),
                toDate.ResetTimeToEndOfDay(), clientId);

            static string formatField(object x)
            {
                var formatted = x?.ToString()
                    ?.Replace("\"", "\"\"")
                    ?.Replace("\n", "\\n") ?? string.Empty;

                return formatted.Contains("\"") || formatted.Contains(',')
                    ? $"\"{formatted}\""
                    : formatted;
            }

            using var stream = new MemoryStream();
            await using (var writer = new StreamWriter(stream, Encoding.UTF8))
            {
                await writer.WriteLineAsync(
                    "Id,JobNumber,BookDate,Amount,Fuel,Ppd,CourierPayment,CourierFuel,CourierBonus,Quantity,Weight,Size,PickupAddressLine1,PickupAddressLine2,PickupAddressLine3,PickupAddressLine4,PickupAddressLine5,PickupAddressLine6,PickupAddressLine7,PickupAddressLine8,DeliveryAddressLine1,DeliveryAddressLine2,DeliveryAddressLine3,DeliveryAddressLine4,DeliveryAddressLine5,DeliveryAddressLine6,DeliveryAddressLine7,DeliveryAddressLine8,ClientReferenceA,ClientReferenceB,ClientReferenceC");
                foreach (var x in data)
                {
                    await writer.WriteLineAsync(
                        $"{x.Id},{formatField(x.JobNumber)},{x.BookDate.ToString("yyyy-MM-dd HH:mm:ss")},{x.Amount},{x.Fuel},{x.Ppd},{x.CourierPayment},{x.CourierFuel},{x.CourierBonus},{x.Quantity},{x.Weight},{x.Size},{formatField(x.PickupAddressLine1)},{formatField(x.PickupAddressLine2)},{formatField(x.PickupAddressLine3)},{formatField(x.PickupAddressLine4)},{formatField(x.PickupAddressLine5)},{formatField(x.PickupAddressLine6)},{formatField(x.PickupAddressLine7)},{formatField(x.PickupAddressLine8)},{formatField(x.DeliveryAddressLine1)},{formatField(x.DeliveryAddressLine2)},{formatField(x.DeliveryAddressLine3)},{formatField(x.DeliveryAddressLine4)},{formatField(x.DeliveryAddressLine5)},{formatField(x.DeliveryAddressLine6)},{formatField(x.DeliveryAddressLine7)},{formatField(x.DeliveryAddressLine8)},{formatField(x.ClientReferenceA)},{formatField(x.ClientReferenceB)},{formatField(x.ClientReferenceC)}");
                }
            }

            var bytes = stream.ToArray();
            var filename = $"Jobs {DateTime.Now:yyyyMMddHHmmssfff}.csv";
            var folder = DateTime.UtcNow.ToString("yyyyMM");
            var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
            var key = $"Jobs/{folder}/Jobs-{timestamp}";

            using var ms = new MemoryStream(bytes);
            try
            {
                var putRequest = new PutObjectRequest
                {
                    BucketName = Environment.GetEnvironmentVariable("S3Bucket"),
                    Key = key,
                    ContentType = "text/csv",
                    InputStream = ms
                };
                await s3Client.PutObjectAsync(putRequest);

            }
            catch (AmazonS3Exception e)
            {
                Log.Error(e, $"{nameof(PodSearchDownload)} Error encountered when writing jobs download object to S3: ");

            }
            catch (Exception e)
            {
                Log.Error(e, $"{nameof(PodSearchDownload)} Error encountered when writing jobs download object to S3: ");

            }


            return File(bytes, "text/csv", filename);
        }
        catch (Exception ex)
        {
            Log.Error(ex, $"Download error: {ex.Message}");
            throw;
        }
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || string.IsNullOrWhiteSpace(file.FileName) || !new[] { ".xls", ".xlsx", ".csv" }.Contains(file.FileName.Trim().Substring(file.FileName.Trim().LastIndexOf(".")).Trim().ToLower()))
            return BadRequest("Invalid file format.");

        var folder = DateTime.UtcNow.ToString("yyyyMM");
        var fileExtension = file.FileName.Trim().ToLower().Substring(file.FileName.Trim().LastIndexOf("."));

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        var byteArray = memoryStream.ToArray();

        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        var key = $"Jobs/{folder}/Jobs-{timestamp}";

        using var ms = new MemoryStream(byteArray);
        try
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = Environment.GetEnvironmentVariable("S3Bucket").Replace("downloads", "uploads"),
                Key = key,
                ContentType = file.ContentType,
                InputStream = ms
            };
            putRequest.Metadata.Add("FileName", file.FileName);
            await s3Client.PutObjectAsync(putRequest);

        }
        catch (AmazonS3Exception e)
        {
            Log.Error(e, $"{nameof(UploadFile)} Error encountered when writing job file upload object to S3: ");

        }
        catch (Exception e)
        {
            Log.Error(e, $"{nameof(UploadFile)} Error encountered when writing file upload object to S3: ");

        }

        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        string sResult = null;

        using (var reader = (fileExtension == ".csv" ? ExcelReaderFactory.CreateCsvReader(memoryStream) : ExcelReaderFactory.CreateReader(memoryStream)))
        {
            var output = reader.AsDataSet(new ExcelDataSetConfiguration()
            {
                ConfigureDataTable = (_) => new ExcelDataTableConfiguration()
                {
                    UseHeaderRow = true
                }
            }).Tables[0];  //Only ready from the first sheet

            // Log the column names from the DataTable
            Log.Debug("DataTable Columns: {@Columns}", output.Columns.Cast<DataColumn>().Select(c => c.ColumnName).ToList());


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
            if (rows.Any())
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
            Log.Debug("Serialized JSON (first 500 chars): {JsonSample}", sResult.Length > 500 ? sResult.Substring(0, 500) + "..." : sResult);

        }


        var deserializeOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            NumberHandling = JsonNumberHandling.AllowReadingFromString,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        var result = JsonSerializer.Deserialize<List<JobManualPriceModel>>(sResult, deserializeOptions);

        if (!result.Any())
            return Ok();

        await jobRepository.UpdateManualPriceAsync(result);

        return Ok();
    }

    public async Task<IActionResult> ValidateSwapPod(string job)
    {
        var fromDate = DateTime.Today;
        var result = await jobRepository.PodSearch(null, "", job, fromDate.ResetTimeToStartOfDay(),
            fromDate.ResetTimeToEndOfDay(), null, 1, 5);

        return result.Item1 == 0 ? Json(false) : Json(result.Item2.First().Id);
    }

    public async Task<IActionResult> SwapPod(string job1, string job2)
    {
        await jobRepository.SwapPod(job1, job2);
        return Json("OK");
    }

    public async Task<IActionResult> BulkSearch(int? courierId, int? clientId, string job, string wild,
        DateTime fromDate, DateTime toDate,
        int pageIndex, int pageSize)
    {
        var result = await jobRepository.BulkSearchAsync(courierId, job ?? "", wild ?? "",
            fromDate.ResetTimeToStartOfDay(),
            toDate.ResetTimeToEndOfDay(), clientId, pageIndex, pageSize);

        return Json(result);
    }

    public async Task<IActionResult> PreBookSearch(int? courierId, int? clientId, string wild, string job,
        DateTime fromDate, DateTime toDate,
        int pageIndex, int pageSize)
    {
        var result = await jobRepository.PreBookSearchAsync(courierId, wild ?? "", job ?? "",
            fromDate.ResetTimeToStartOfDay(),
            toDate.ResetTimeToEndOfDay(), clientId, pageIndex, pageSize);

        return Json(result);
    }

    [HttpPost]
    public async Task<IActionResult> LateCall([FromBody] LateCallRequest request)
    {
        var (createEvent, _, late) = await DetermineLateStatus(request);

        if (createEvent) await CreateLateEvent(request, late);

        await jobRepository.ResetLateEvent(request.JobId, request.LateType);

        await UpdateJobStatus(request);

        return Json("OK");
    }

    private async Task<(bool createEvent, int jobStatus, int late)> DetermineLateStatus(LateCallRequest request)
    {
        bool createEvent;
        var jobStatus = 0;
        var late = request.LateTime;

        if (request.LateType is 1 or 2)
        {
            (createEvent, jobStatus, late) = request.LateType switch
            {
                1 => await DeterminePickupLateStatus(request),
                2 => await DetermineDeliveryLateStatus(request),
                _ => throw new ArgumentException("Invalid LateType")
            };
        }
        else
        {
            createEvent = true;
        }

        return (createEvent, jobStatus, late);
    }

    private async Task<(bool createEvent, int jobStatus, int late)> DeterminePickupLateStatus(LateCallRequest request)
    {
        const int jobStatus = 4;
        var late = request.LateTime;

        if (request.AlertLatePickup < 0) return (false, jobStatus, late);

        var maxAutoLate = await jobRepository.MaxAutoLatePickupAlert();
        var createEvent = request.Minutes < maxAutoLate
            ? late > request.PickupTime
            : late - request.PickupTime > request.AlertLatePickup;

        return (createEvent, jobStatus, late);
    }

    private async Task<(bool createEvent, int jobStatus, int late)> DetermineDeliveryLateStatus(LateCallRequest request)
    {
        var createEvent = false;
        const int jobStatus = 8;
        var late = request.LateTime + request.DeliveryTime;

        if (request.AlertLateDelivery < 0) return (createEvent, jobStatus, late);

        var maxAutoLateDelAlert = await jobRepository.MaxAutoLateDeliveryAlert();
        createEvent = request.Minutes < maxAutoLateDelAlert || late > request.AlertLateDelivery;

        return (createEvent, jobStatus, late);
    }

    private async Task CreateLateEvent(LateCallRequest request, int late)
    {
        await courierRepo.AddEventAsync(
            request.JobNo,
            request.ClientId,
            request.Contact,
            int.Parse(request.StaffId),
            null,
            request.JobId,
            request.JobType,
            null,
            "Late Call from Despatch",
            request.LateType,
            request.LateTime,
            request.JobTime.AddMinutes(late)
        );
    }

    private async Task UpdateJobStatus(LateCallRequest request)
    {
        if (request is { LateType: 1 })
        {
            await jobRepository.LatePickup(
                request.JobId,
                request.BookedSpeed,
                request.NotifiedSpeed,
                request.LateTime,
                request.DespatcherName,
                request.CalculationRequired
            );
        }
        else
        {
            await jobRepository.LateDelivery(
                request.JobId,
                request.BookedSpeed,
                request.NotifiedSpeed,
                request.LateTime,
                request.DespatcherName,
                request.CalculationRequired
            );
        }
    }

    [HttpPost]
    public async Task<IActionResult> Allocate(int courierId, int dispId, string jobIds)
    {
        await jobRepository.DispatchSelectedJobs(courierId, dispId, jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> ReAllocate(int courierId, int dispId, string jobIds)
    {
        await jobRepository.ReDispatchSelectedJobs(courierId, dispId, jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> ReSendSelected(string jobIds)
    {
        await jobRepository.ReSendSelectedJobs(jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> ReAssignSelected(string jobIds)
    {
        await jobRepository.ReAssignSelectedJobs(jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> Transfer(int jobId, int courierId, int dispId)
    {
        await jobRepository.TransferJob(jobId, courierId, dispId);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> SetFirstJob(int jobId, int courierId)
    {
        await jobRepository.SetFirstJob(jobId, courierId);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> Void(int jobId)
    {
        await jobRepository.VoidJob(jobId);
        return Json("OK");
    }


    [HttpPost]
    public async Task<IActionResult> ReSendAll(int courierId)
    {
        await jobRepository.ReSendAllJobs(courierId);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> RestoreSplitJobs(int courierId, int dispId, string jobIds)
    {
        await jobRepository.RestoreSplitJobs(jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> RestoreJobs(int courierId, int dispId, string jobIds)
    {
        await jobRepository.RestoreJobs(jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> SplitJob(int jobId, string despatcherName)
    {
        await jobRepository.SplitJob(jobId, despatcherName);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> UnSplitJob(int jobId)
    {
        var message = await jobRepository.UnSplitJob(jobId);
        return Json(message);
    }

    [HttpPost]
    public async Task<IActionResult> UpdatePodDetails(string jobNumber, int jobStatus, string podName,
        DateTime podTime)
    {
        await jobRepository.UpdatePodDetails(jobNumber, jobStatus, podName, podTime);
        return Json("OK");
    }


    public async Task<IActionResult> ReRateSplitJob(int jobId)
    {
        await jobRepository.ReRateSplitJob(jobId);
        return Json("OK");
    }

    public async Task<IActionResult> FinishSplitJobProcess(int jobId, string despatcherName)
    {
        await jobRepository.FinishSplitJobProcess(jobId, despatcherName);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> SendSms(int courierId, int dispId, string despatcherName, string message)
    {
        await jobRepository.MessageCourier(courierId, dispId, despatcherName, message);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> UpdateSplitJobAddress(int jobId, int toSuburbId, string address,
        decimal deliveryLat, decimal deliveryLng)
    {
        await jobRepository.UpdateSplitJobAddress(jobId, toSuburbId, address, deliveryLat, deliveryLng);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddRestoreEvent(string jobNo, int clientId, string contact, int staffId,
        int courierId, int jobId, int jobType, string despatcherName)
    {
        await courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType,
            despatcherName, "Job Restored", 33);

        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddPriceSuburbChangeEvent(string jobNo, int clientId, string contact,
        int staffId, int? courierId, int jobId, int jobType, string despatcherName)
    {
        await courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, null,
            "Changed Price or Suburb", 35);

        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddOtherEvent(string jobNo, int clientId, string contact, int staffId,
        int? courierId, int jobId, int jobType, string despatcherName, string notes)
    {
        await courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, null, notes,
            66);

        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddEvent(string jobNo, int clientId, string contact, int staffId,
        int? courierId, int jobId, int jobType, string despatcherName, string notes, int eventType)
    {
        await courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType,
            despatcherName, notes, eventType);

        return Json("OK");
    }

    public async Task<IActionResult> ExsalerateActivity(string eventName, string notes, int clientId,
        string jobNumber, string despatcherName)
    {
        var baseUrl = Environment.GetEnvironmentVariable("ExsalerateAPI");
        var un = Environment.GetEnvironmentVariable("ExsalerateAPIUsername");
        var pw = Environment.GetEnvironmentVariable("ExsalerateAPIPW");

        // Set up HttpClient
        httpClient.BaseAddress = new Uri(baseUrl);
        httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(
            "Basic", Convert.ToBase64String(System.Text.Encoding.ASCII.GetBytes($"{un}:{pw}"))
        );

        var body = new ExsalerateActivity()
        {
            SiteOwnerID = 11,
            CustomerRefCode = clientId.ToString(),
            Subject = $"Dispatch:{despatcherName} {eventName}",
            ActivityType = eventName,
            Description = $"Job Number: {jobNumber} - {notes}"
        };

        var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(body), System.Text.Encoding.UTF8, "application/json");

        var response = await httpClient.PostAsync("activity", content);

        if (response.StatusCode != System.Net.HttpStatusCode.OK)
        {
            var responseContent = await response.Content.ReadAsStringAsync();
            var e = new ApplicationException($"Exsalerate Activity Failed {responseContent} {Environment.NewLine} CurrentBody= {body}");
            throw e;
        }

        return Json("OK");

    }


    public async Task<IActionResult> SuburbList()
    {
        var data = await jobRepository.SuburbsAsync();
        return Json(data);
    }

    public async Task<IActionResult> SpeedList()
    {
        var data = await jobRepository.SpeedsAsync();
        return Json(data);
    }

    public async Task<IActionResult> ContactList(int clientId)
    {
        var data = await jobRepository.ContactsAsync(clientId);
        return Json(data);
    }

    public async Task<IActionResult> ContactDetailList(int clientId)
    {
        var data = await jobRepository.ContactDetailList(clientId);
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

    public async Task<IActionResult> EventTypeList()
    {
        var data = await jobRepository.EventTypeListAsync();
        return Json(data);
    }

    public async Task<IActionResult> TruckJobAmountBreakdown(int clientId, int fromId, int toId, double weight,
        int size,
        int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
        int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours, decimal gstRate)
    {
        var rate = await jobRepository.RateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp,
            dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours);
        var description = await jobRepository.RateTruckJobDescription(clientId, fromId, toId, weight, size, speed, qty,
            bookedDate, pickUp,
            dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours);
        description += ($"\rTotal = {rate:C}");
        description += ($"\rTotal (+GST) = {rate * (1 + gstRate):C}");
        return Json(description);
    }


    public async Task<IActionResult> RateTruckJob(int clientId, int fromId, int toId, double weight, int size,
        int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
        int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours)
    {
        var rate = await jobRepository.RateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp,
            dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours);
        return Json($"{rate:C}");
    }

    public async Task<IActionResult> JobAmountBreakdown(int clientId, int fromId, int toId, int speed, bool pedal,
        bool van,
        bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
        string ourRef, string refA, string refB, int quantity, DateTime booked, decimal gstRate, decimal amount)
    {
        var currentRateAmount = await jobRepository.RateJobAsync(clientId, fromId, toId, speed, pedal, van, returnJob,
            weight,
            size,
            includeFuelSurcharge, direct, acceptedJobTypeId,
            ourRef, refA, refB, quantity, booked);
        var finalDescription = direct ? "DIRECT PRICE\r" : currentRateAmount != amount ? "NORMAL PRICE\r" : "";
        var description = await jobRepository.RateJobDescription(clientId, fromId, toId, speed, pedal, van, returnJob,
            weight, size,
            includeFuelSurcharge, direct, acceptedJobTypeId,
            ourRef, refA, refB, quantity, booked);
        finalDescription += description;
        finalDescription += $"\rTotal = {currentRateAmount:C}";
        finalDescription += $"\rTotal (+GST) = {currentRateAmount * (1 + gstRate):C}";

        if (currentRateAmount == amount) return Json(finalDescription);

        var fs = includeFuelSurcharge
            ? await jobRepository.FuelSurchargeInclusiveAmount(clientId, amount, fromId, toId, booked, size)
            : 0;
        var ppd = includeFuelSurcharge ? await jobRepository.PpdInclusiveAmount(clientId, amount) : 0;
        finalDescription += ($"\rSPECIAL PRICE = {(amount - fs - ppd):C}");
        if (fs <= 0) return Json(finalDescription);
        //strDescription = strDescription & vbCrLf & "Plus fuel surcharge = $" & Format(curFuelSurcharge, "0.00")
        finalDescription += $"\rPlus fuel surcharge = {fs:C}";
        finalDescription += $"\rPlus PPD = {ppd:C}";
        finalDescription += $"\rTOTAL = {amount:C}";
        finalDescription += $"\rTotal (+GST) = {amount * (1 + gstRate):C}";

        return Json(finalDescription);
    }

    public async Task<IActionResult> RateJob(int clientId, int fromId, int toId, int speed, bool pedal, bool van,
        bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
        string ourRef, string refA, string refB, int quantity, DateTime booked)
    {
        var rate = await jobRepository.RateJobAsync(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size,
            includeFuelSurcharge, direct, acceptedJobTypeId,
            ourRef, refA, refB, quantity, booked);
        return Json($"{rate:C}");
    }

    public async Task<IActionResult> PpdExclusiveAmount(int clientId, decimal amount)
    {
        var ppd = await jobRepository.PpdExclusiveAmount(clientId, amount);
        return Json(ppd);
    }

    public async Task<IActionResult> TruckItemsSummary(int jobId, int truckWeightLimit)
    {
        var summary = await jobRepository.TruckJobItemsAsync(jobId, truckWeightLimit);
        return Json(summary);
    }

    public async Task<IActionResult> UpdateDeliveryAddressNz([FromBody] UpdateAddressRequestNz request)
    {
        try
        {
            if (request is null)
                return BadRequest("Request Address Data Not Provided");

            await jobRepository.UpdateDeliveryAddressNzAsync(request);
            return Json("OK");
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured updating address for job {request.JobId}");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateDeliveryAddressUs([FromBody] UpdateAddressRequestUs request)
    {
        try
        {
            if (request is null)
                return BadRequest("Request Address Data Not Provided");

            await jobRepository.UpdateDeliveryAddressUsAsync(request);
            return Json("OK");
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured updating address for job {request.JobId}");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateBulkDeliveryAddress(int bulkJobId, string toSuburb, int toPostCode,
        string address,
        decimal deliveryLat, decimal deliveryLng, string despatcherName)
    {
        await jobRepository.UpdateBulkDeliveryAddressAsync(bulkJobId, toSuburb, toPostCode, address, deliveryLat,
            deliveryLng,
            despatcherName);
        return Json("OK");
    }

    public async Task<IActionResult> UpdateBookingDeliveryAddress(int jobId, int toSuburbId, string address,
        decimal deliveryLat, decimal deliveryLng, bool cbd, decimal rate, string despatcherName)
    {
        await jobRepository.UpdateBookingDeliveryAddressAsync(jobId, toSuburbId, address, deliveryLat, deliveryLng, cbd,
            rate,
            despatcherName);
        return Json("OK");
    }

    public async Task<IActionResult> UpdatePickupAddressNz([FromBody] UpdateAddressRequestNz request)
    {
        try
        {
            if (request is null)
                return BadRequest("Request Address Data Not Provided");

            await jobRepository.UpdatePickupAddressNzAsync(request);
            return Json("OK");
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured updating address for job {request.JobId}");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdatePickupAddressUs([FromBody] UpdateAddressRequestUs request)
    {
        try
        {
            if (request is null)
                return BadRequest("Request Address Data Not Provided");

            await jobRepository.UpdatePickupAddressUsAsync(request);
            return Json("OK");
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured updating address for job {request.JobId}");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateJobType(int jobId, int jobType, string despatcherName)
    {
        await jobRepository.UpdateJobTypeAsync(jobId, jobType, despatcherName);
        return Json("OK");
    }


    public async Task<IActionResult> UpdateBulkPickupAddress(int bulkJobId, string fromSuburb, int fromPostCode,
        string address,
        decimal pickupLat, decimal pickupLng, string despatcherName)
    {
        await jobRepository.UpdateBulkPickupAddressAsync(bulkJobId, fromSuburb, fromPostCode, address, pickupLat, pickupLng,
            despatcherName);
        return Json("OK");
    }


    public async Task<IActionResult> UpdateBookingPickupAddress(int jobId, int fromSuburbId, string address,
        decimal pickupLat, decimal pickupLng, bool cbd, decimal rate, string despatcherName)
    {
        await jobRepository.UpdateBookingPickupAddressAsync(jobId, fromSuburbId, address, pickupLat, pickupLng, cbd, rate,
            despatcherName);
        return Json("OK");
    }

    public async Task<IActionResult> UpdateJob(int jobId, string field, string value, decimal? rate,
        string despatcherName, int staffId)
    {
        try
        {
            await jobRepository.UpdateJobAsync(jobId, field, value, rate, despatcherName, staffId);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured updating field {field} with value {value} for job {jobId}");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateBulkJob(int bulkJobId, string field, string value, decimal? rate,
        string despatcherName, int staffId)
    {
        await jobRepository.UpdateBulkJobAsync(bulkJobId, field, value, rate, despatcherName, staffId);
        return Json("OK");
    }

    public async Task<IActionResult> ReleaseBulkJob(string jobNumber, DateTime bookDate)
    {
        await jobRepository.ReleaseBulkJobAsync(jobNumber, bookDate);
        return Json("OK");
    }

    public async Task<IActionResult> UpdateJobBooking(int jobId, string field, string value, decimal? rate,
        string despatcherName, int staffId)
    {
        await jobRepository.UpdateJobBookingAsync(jobId, field, value, rate, despatcherName, staffId);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddNote(int jobId, string note, string despatcher)
    {
        note = FormatNote(note);
        await jobRepository.AddNoteAsync(jobId, note, despatcher);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddBulkJobNote(int bulkJobId, string note, string despatcher)
    {
        note = FormatNote(note);
        await jobRepository.AddBulkJobNoteAsync(bulkJobId, note, despatcher);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddJobBookingNote(int jobId, string note, string despatcher)
    {
        note = FormatNote(note);
        await jobRepository.AddJobBookingNoteAsync(jobId, note, despatcher);
        return Json("OK");
    }

    private static string FormatNote(string note) => $"\n{note}";


    [HttpPost]
    public async Task<IActionResult> QuickCreateJob([FromBody] CreateJobRequest request)
    {
        try
        {
            if (!IsValidRequest(request))
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Bad Request" });

            var jobId = await jobRepository.QuickAddJobAsync(request.Job, request.StaffId.Value);

            //Check if jobId is valid before continuing
            if (jobId == 0) return StatusCode(StatusCodes.Status500InternalServerError, "Created Job Id is null");

            var notesList = GenerateNotesList(request.Job);
            await AddNotesToJob(notesList, jobId, request.DespatcherName);

            return Json(jobId);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
    }

    private static bool IsValidRequest(CreateJobRequest request) =>
        !(request?.Job == null || request.Job.ClientId == 0 || request.StaffId == null);

    private static List<string> GenerateNotesList(JobCreateViewModel job)
    {
        return new List<string>
        {
            FormatNote($"Job Notes: {job.JobNotes}"),
            FormatNote($"Pickup Notes: {job.PickupNotes}"),
            FormatNote($"Delivery Notes: {job.DeliveryNotes}")
        };
    }

    private async Task AddNotesToJob(List<string> notesList, int jobId, string despatcherName)
    {
        if (notesList != null)
        {
            foreach (var note in notesList)
                await AddNote(jobId, note, despatcherName);
        }
    }

    [HttpPost]
    public async Task<IActionResult> InterCourierCharge([FromBody] InterCourierChargeViewModel viewModel)
    {
        if (viewModel == null) throw new ArgumentNullException(nameof(viewModel), "ViewModel is null");

        await jobRepository.AddInterCourierChargeAsync(viewModel);
        return Json("OK");
    }


    [HttpPost]
    public async Task<IActionResult> ProcessUncheckDirect(int jobId, string despatcher, int staffId,
        string currentSpeed)
    {
        var jobData = await jobRepository.DirectToAsap(jobId);
        var settingData = await jobRepository.SettingsAsync();
        var emailMessage = FormatDelimMessage(settingData.UncheckDirectEmailMessage, "[", "]", jobData);
        await courierRepo.AddEventAsync(jobData.Number, jobData.ClientID ?? 0, jobData.Recipient, staffId, null,
            jobId, jobData.JobTypeID ?? 0, despatcher, "Direct job changed to ASAP", 42, null, null,
            jobData.CloseEvent);
        if (jobData.NotifyViaEmail)
        {
            SendEmail(jobData.ContactEmail, "noreply@urgent.co.nz", emailMessage,
                settingData.UncheckDirectEmailSubject ?? "");
        }

        var result = await jobRepository.UpdateFirstAvailableSpeed(jobId);

        var msg =
            $"Client advised by email that job changed from a Direct {currentSpeed} to ASAP {result.Name ?? currentSpeed}";
        var msgPhone =
            $" to be called and advised that job changed from a Direct {currentSpeed} to ASAP {result.Name ?? currentSpeed}";
        if (jobData.NotifyViaEmail)
        {
            await AddNote(jobId, msg, despatcher);
        }
        else
        {
            await AddNote(jobId, jobData.Contact + msgPhone, despatcher);
        }

        return Json("OK");
    }

    [HttpGet]
    public async Task<IActionResult> HasClientItemsAvailable(int clientId, int speedId)
    {
        var hasItems = await jobRepository.HasClientItemsAvailableAsync(clientId, speedId);
        return Json(hasItems);
    }

    [HttpGet]
    public async Task<IActionResult> GetAllClientItems(int clientId, int speedId, int jobId)
    {
        var clientItems = await jobRepository.GetClientItemsBySpeedAsync(clientId, speedId, jobId);
        return Json(clientItems);
    }

    [HttpPost]
    public async Task<IActionResult> AddClientItemsToJob(int jobId, [FromBody] ClientItemsModel itemsModel)
    {
        if (itemsModel != null)
            await jobRepository.AddClientsItemToJobAsync(jobId, itemsModel.ServiceIds, itemsModel.TotalCost);
        return Json("OK");
    }

    private static string FormatDelimMessage<T>(string format, string startDelim, string endDelim, T data)
    {
        var message = "";
        while (format?.Length > 0)
        {
            var c = Strings.Left(format, 1);
            format = Strings.Mid(format, 2);
            if (c == startDelim)
            {
                var fieldName = Strings.Left(format, Strings.InStr(format, endDelim) - 1);
                format = Strings.Mid(format, Strings.InStr(format, endDelim) + 1);
                var props = typeof(T).GetRuntimeProperties();
                var p = props.First(
                    x => string.Equals(x.Name, fieldName, StringComparison.CurrentCultureIgnoreCase));

                message += p.GetValue(data)?.ToString();
            }
            else
            {
                message += c;
            }
        }

        message = message.Replace("  ", " ");
        message = Strings.Trim(message);
        return message;
    }

    public async Task<IActionResult> SendPod(int jobId, string toEmail)
    {
        var selectedJob = await jobRepository.GetJobByIdAsync(jobId);

        if (selectedJob == null)
        {
            return NotFound();
        }

        Attachment att = new Attachment(new MemoryStream(selectedJob.PodPhoto), selectedJob.JobNo.ToString() + ".png");

        SendEmail(toEmail, Environment.GetEnvironmentVariable("FromAddress"), $"Hello, attached is the proof of delivery photo for job {selectedJob.JobNo}.", $"Delivery Photo for {selectedJob.JobNo}", att);

        return Json("OK");

    }
    private void SendEmail(string toAddress, string fromAddress, string body, string subject, Attachment attachment = null, string replyTo = null)
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
        smtp.Credentials = new NetworkCredential(Environment.GetEnvironmentVariable("SMTPUser"), Environment.GetEnvironmentVariable("SMTPPass"));
        smtp.Port = int.Parse(Environment.GetEnvironmentVariable("SMTP_Port"));
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
            } while (response.IsTruncated);
        }
        catch (AmazonS3Exception e)
        {

            Log.Error(e, $"{nameof(UploadFile)} Error encountered. Message:'{e.Message}'");
        }
        catch (Exception e)
        {
            Log.Error(e, $"{nameof(UploadFile)} Error encountered. Message:'{e.Message}'");
        }



        return result;
    }


    public async Task<IActionResult> IsFilesAttachedToJob(int jobId)
    {
        var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
        var tenantId = HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var key = $"JobAttachments/{jobId}-";
        Log.Debug($"Get S3 Object List for {key}");
        var s3List = await SearchFilesByPatternAsync(bucketName, key);
        Log.Debug($"Found {s3List.Count} objects for {key}");

        return Json(s3List.Count > 0);
    }

    public async Task<IActionResult> GetAttachedFiles(int jobId)
    {
        var s3Files = new List<S3FileInfo>();
        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var tenantId = HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
            var key = $"JobAttachments/{jobId}-";
            Log.Debug($"Get S3 Object List for {key}");
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
                var s3FileInfo = new S3FileInfo()
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
            Log.Error(e, $"Error {nameof(GetAttachedFiles)}: {e.Message}");
            return StatusCode(500, new { message = "Error retrieving files", error = e.Message });
        }

        return Ok(s3Files);
    }

    [HttpPost]
    public async Task<IActionResult> UploadFile([FromForm] FileUploadRequest request)
    {
        try
        {
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
            if (request.File != null)
            {
                await request.File.CopyToAsync(memoryStream);

                var byteArray = memoryStream.ToArray();

                var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
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
                    Log.Error(e, $"{nameof(UploadFile)} Error encountered when writing job file upload object to S3: ");

                }
                catch (Exception e)
                {
                    Log.Error(e, $"{nameof(UploadFile)} Error encountered when writing file upload object to S3: ");

                }
            }


            return Ok(new { message = "File uploaded successfully", fileName = request.File.FileName });
        }
        catch (Exception ex)
        {
            // Log the exception
            return StatusCode(500, ex.Message);
        }
    }


    public async Task<IActionResult> DownloadFile(int jobId, string key)
    {
        var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
        try
        {
            var request = new GetObjectRequest
            {
                BucketName = bucketName,
                Key = key
            };

            using var response = await s3Client.GetObjectAsync(request);
            if (response.HttpStatusCode == System.Net.HttpStatusCode.OK)
            {
                var originalFileName = response.Metadata["FileName"];
                var contentType = response.Headers.ContentType;

                // Read the stream into a memory stream to get the bytes
                using var ms = new MemoryStream();
                await response.ResponseStream.CopyToAsync(ms);
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
                return NotFound($"File {key} not found.");
            }
        }
        catch (AmazonS3Exception ex)
        {
            return ex.StatusCode == System.Net.HttpStatusCode.NotFound
                ? NotFound($"File {key} not found in bucket")
                : StatusCode(500, $"Error downloading file: {ex.Message}");
        }
    }


    public async Task<IActionResult> DeleteFile(int jobId, string key)
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
            Log.Error(ex, $"{nameof(DeleteFile)} AWS S3 error occurred while deleting object {key} from bucket {bucketName}. StatusCode: {ex.StatusCode}, ErrorCode: {ex.ErrorCode}");
        }
        catch (Exception ex)
        {
            Log.Error(ex, $"{nameof(DeleteFile)} An unexpected error occurred while deleting object {key} from bucket {bucketName}");
        }

        return Json("OK");

    }

    public class ClientItemsModel
    {
        public List<int> ServiceIds { get; set; }
        public decimal TotalCost { get; set; }
    }
}