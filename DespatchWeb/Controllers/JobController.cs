using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using ExcelDataReader;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.VisualBasic;
using Mindscape.Raygun4Net.AspNetCore;
using Newtonsoft.Json;
using RestSharp;
using RestSharp.Authenticators;

namespace DespatchWeb.Controllers;

public class JobController : Controller
{
    private readonly IClientAccessValidatorService _clientAccessValidator;
    private readonly IConfiguration _configuration;
    private readonly ICourierRepository _courierRepo;
    private readonly IWebHostEnvironment _hostingEnvironment;
    private readonly IJobRepository _jobRepo;
    private readonly ILogger<JobController> _logger;

    public JobController(IJobRepository jobRepository, ICourierRepository courierRepo,
        IClientAccessValidatorService clientAccessValidator,
        IConfiguration configuration,
        IWebHostEnvironment hostingEnvironment, ILogger<JobController> logger)
    {
        _jobRepo = jobRepository;
        _courierRepo = courierRepo;
        _clientAccessValidator = clientAccessValidator;
        _configuration = configuration;
        _hostingEnvironment = hostingEnvironment;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Index([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        // Validate Client Access
        if (!isInternal) await _clientAccessValidator.ValidateClientAccess(cid, clientIds);

        // Get jobs
        var result = await _jobRepo.JobListAsync(queryParams.Status, queryParams.Order,
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
            if (!isInternal) await _clientAccessValidator.ValidateClientAccess(cid, clientIds);

            // Get jobs
            var result = await _jobRepo.JobListAsync(queryParams.Status, queryParams.Order,
                queryParams.Asc, isInternal, clientIds, despatchViewIds, clearListEnvelopeViewModel);
            return Json(result);
        }
        catch (Exception e)
        {
            _logger.LogError(e, $"an error occured geting jobs by clear list");
            return StatusCode(StatusCodes.Status500InternalServerError, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddPallet([FromBody] PalletInfo palletInfo, bool preBook, string despatcher)
    {
        await _jobRepo.AddPalletInfoAsync(palletInfo, preBook, despatcher);
        return Ok("OK");
    }

    [HttpPost]
    public async Task<IActionResult> EditPallet([FromBody] PalletInfo palletInfo, bool preBook, string despatcher)
    {
        await _jobRepo.EditPalletInfoAsync(palletInfo, preBook, despatcher);
        return Ok("OK");
    }

    [HttpPost]
    public async Task<IActionResult> DeletePallet([FromBody] PalletInfo palletInfo, bool preBook, string despatcher)
    {
        await _jobRepo.DeletePalletInfoAsync(palletInfo, preBook, despatcher);
        return Ok("OK");
    }


    public async Task<IActionResult> SendPrebookJob(int jobId)
    {
        await _jobRepo.SendPrebookJobAsync(jobId);
        return Ok("OK");
    }

    public async Task<IActionResult> VoidPrebookJob(int jobId, string despatcher, int staffId)
    {
        await _jobRepo.VoidPrebookJobAsync(jobId, despatcher, staffId);
        return Ok("OK");
    }

    public async Task<IActionResult> Current(int courierId, bool done)
    {
        try
        {
            var result = await _jobRepo.CurrentJobList(courierId, done);
            return Json(result);
        }
        catch (Exception e)
        {
            var message = $"An error occured getting current jobs courier {courierId}";
            _logger.LogError(e, message);
            return StatusCode(StatusCodes.Status500InternalServerError, message);
        }
    }

    public async Task<IActionResult> Supports(string channel)
    {
        var result = await _jobRepo.SupportEvents(channel);
        return Json(result);
    }

    [HttpPost]
    public async Task<IActionResult> CloseSupport(int supportId, int staffId)
    {
        await _jobRepo.CloseSupportEvent(supportId, staffId);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> LockSupport(int id, string dispatcher)
    {
        var support = await _jobRepo.GetSupportEventAsync(id);
        support.UcevDespatcher = dispatcher;
        var result = await _jobRepo.UpdateSupportEventAsync(support);
        return Json(result > 0);
    }

    [HttpPost]
    public async Task<IActionResult> UnLockSupport(int id, string dispatcher)
    {
        var support = await _jobRepo.GetSupportEventAsync(id);
        if (support.UcevDespatcher != dispatcher) return Json(false);
        support.UcevDespatcher = "";
        var result = await _jobRepo.UpdateSupportEventAsync(support);
        return Json(result > 0);
    }

    public async Task<IActionResult> Detail(int jobId)
    {
        var result = await _jobRepo.GetJobByIdAsync(jobId);

        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> ScanJobDetailAsync(DateTime? runDate, string scan)
    {
        var data = await _jobRepo.ScanList(runDate, scan);
        return Json(data);
    }

    public async Task<IActionResult> Related(int parentId, int clientId)
    {
        var result = await _jobRepo.RelatedJobs(parentId, clientId);
        return Json(result);
    }

    public async Task<IActionResult> BulkDetail(int bulkJobId)
    {
        var result = await _jobRepo.BulkJobDetail(bulkJobId);
        return Json(result);
    }

    public async Task<IActionResult> PreBookDetail(int preBookJobId)
    {
        var result = await _jobRepo.PreBookDetailAsync(preBookJobId);
        return Json(result);
    }

    public async Task<IActionResult> PreBookJobs()
    {
        var result = await _jobRepo.PreBookJobList();
        return Json(result);
    }

    public async Task<IActionResult> PodSearch(int? courierId, int? clientId, string wild, string job,
        DateTime fromDate,
        DateTime toDate,
        int pageIndex, int pageSize)
    {
        var result = await _jobRepo.PodSearch(courierId, wild ?? "", job ?? "", fromDate.ResetTimeToStartOfDay(),
            toDate.ResetTimeToEndOfDay(), clientId, pageIndex, pageSize);

        return Json(result);
    }

    public async Task<IActionResult> PodSearchDownload(int? courierId, int? clientId, string wild, string job,
        DateTime fromDate,
        DateTime toDate)
    {
        try
        {
            var data = await _jobRepo.PodSearchDownloadAsync(courierId, wild ?? "", job ?? "",
                fromDate.ResetTimeToStartOfDay(),
                toDate.ResetTimeToEndOfDay(), clientId);

            var formatField = (object x) =>
            {
                string formatted = x
                                       ?.ToString()
                                       ?.Replace("\"", "\"\"")
                                       ?.Replace("\n", "\\n")
                                   ?? string.Empty;

                return formatted.Contains("\"") || formatted.Contains(",")
                    ? $"\"{formatted}\""
                    : formatted;
            };

            string folderPath = Path.Combine(_hostingEnvironment.ContentRootPath, _configuration["DownloadDirectory"]);
            folderPath = Path.Combine(folderPath, DateTime.Now.ToString("yyyyMM"));
            // Create the folder if it doesn't exist
            if (!Directory.Exists(folderPath))
                Directory.CreateDirectory(folderPath);

            var filename = $"Jobs {DateTime.Now.ToString("yyyyMMddHHmmssfff")}.csv";
            string filePath = Path.Combine(folderPath, filename);


            using (var stream = new MemoryStream())
            {
                using (var writer = new StreamWriter(stream, Encoding.UTF8))
                {
                    writer.WriteLine(
                        "Id,JobNumber,BookDate,Amount,Fuel,Ppd,CourierPayment,CourierFuel,CourierBonus,Quantity,Weight,Size,PickupAddressLine1,PickupAddressLine2,PickupAddressLine3,PickupAddressLine4,PickupAddressLine5,PickupAddressLine6,PickupAddressLine7,PickupAddressLine8,DeliveryAddressLine1,DeliveryAddressLine2,DeliveryAddressLine3,DeliveryAddressLine4,DeliveryAddressLine5,DeliveryAddressLine6,DeliveryAddressLine7,DeliveryAddressLine8,ClientReferenceA,ClientReferenceB,ClientReferenceC");
                    foreach (var x in data)
                    {
                        writer.WriteLine(
                            $"{x.Id},{formatField(x.JobNumber)},{x.BookDate.ToString("yyyy-MM-dd HH:mm:ss")},{x.Amount},{x.Fuel},{x.Ppd},{x.CourierPayment},{x.CourierFuel},{x.CourierBonus},{x.Quantity},{x.Weight},{x.Size},{formatField(x.PickupAddressLine1)},{formatField(x.PickupAddressLine2)},{formatField(x.PickupAddressLine3)},{formatField(x.PickupAddressLine4)},{formatField(x.PickupAddressLine5)},{formatField(x.PickupAddressLine6)},{formatField(x.PickupAddressLine7)},{formatField(x.PickupAddressLine8)},{formatField(x.DeliveryAddressLine1)},{formatField(x.DeliveryAddressLine2)},{formatField(x.DeliveryAddressLine3)},{formatField(x.DeliveryAddressLine4)},{formatField(x.DeliveryAddressLine5)},{formatField(x.DeliveryAddressLine6)},{formatField(x.DeliveryAddressLine7)},{formatField(x.DeliveryAddressLine8)},{formatField(x.ClientReferenceA)},{formatField(x.ClientReferenceB)},{formatField(x.ClientReferenceC)}");
                    }
                }

                var bytes = stream.ToArray();
                //stream.Position = 0;
                System.IO.File.WriteAllBytes(filePath, bytes);

                //stream.Position = 0;
                return File(bytes, "text/csv", filename);
            }
        }
        catch (Exception e)
        {
            throw;
        }
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || string.IsNullOrWhiteSpace(file.FileName) ||
            !new[] { ".xls", ".xlsx", ".csv" }.Contains(file.FileName.Trim()
                .Substring(file.FileName.Trim().LastIndexOf(".")).Trim().ToLower()))
            return BadRequest("Invalid file format.");

        string folderPath = Path.Combine(_hostingEnvironment.ContentRootPath, _configuration["UploadDirectory"]);
        folderPath = Path.Combine(folderPath, DateTime.Now.ToString("yyyyMM"));
        // Create the folder if it doesn't exist
        if (!Directory.Exists(folderPath))
            Directory.CreateDirectory(folderPath);

        string fileExtension = file.FileName.Trim().ToLower().Substring(file.FileName.Trim().LastIndexOf("."));
        string filePath = Path.Combine(folderPath, $"Jobs {DateTime.Now.ToString("yyyyMMddHHmmssfff")}{fileExtension}");

        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        string sResult = null;
        using (FileStream stream = System.IO.File.Create(filePath))
        {
            await file.CopyToAsync(stream);
            using (var reader = (fileExtension == ".csv"
                       ? ExcelReaderFactory.CreateCsvReader(stream)
                       : ExcelReaderFactory.CreateReader(stream)))
            {
                var output = reader.AsDataSet(new ExcelDataSetConfiguration()
                {
                    ConfigureDataTable = (_) => new ExcelDataTableConfiguration()
                    {
                        UseHeaderRow = true
                    }
                }).Tables[0]; //Only ready from the first sheet

                sResult = JsonConvert.SerializeObject(output);
            }
        }

        var result = JsonConvert.DeserializeObject<List<JobManualPriceModel>>(sResult);

        if (!result.Any())
            return Ok();

        await _jobRepo.UpdateManualPriceAsync(result);

        return Ok();
    }

    public async Task<IActionResult> ValidateSwapPod(string job)
    {
        var fromDate = DateTime.Today;
        var result = await _jobRepo.PodSearch(null, "", job, fromDate.ResetTimeToStartOfDay(),
            fromDate.ResetTimeToEndOfDay(), null, 1, 5);

        return result.Item1 == 0 ? Json(false) : Json(result.Item2.First().Id);
    }

    public async Task<IActionResult> SwapPod(string job1, string job2)
    {
        await _jobRepo.SwapPod(job1, job2);
        return Json("OK");
    }

    public async Task<IActionResult> BulkSearch(int? courierId, int? clientId, string job, string wild,
        DateTime fromDate, DateTime toDate,
        int pageIndex, int pageSize)
    {
        var result = await _jobRepo.BulkSearchAsync(courierId, job ?? "", wild ?? "",
            fromDate.ResetTimeToStartOfDay(),
            toDate.ResetTimeToEndOfDay(), clientId, pageIndex, pageSize);

        return Json(result);
    }

    public async Task<IActionResult> PreBookSearch(int? courierId, int? clientId, string wild, string job,
        DateTime fromDate, DateTime toDate,
        int pageIndex, int pageSize)
    {
        var result = await _jobRepo.PreBookSearchAsync(courierId, wild ?? "", job ?? "",
            fromDate.ResetTimeToStartOfDay(),
            toDate.ResetTimeToEndOfDay(), clientId, pageIndex, pageSize);

        return Json(result);
    }

    [HttpPost]
    public async Task<IActionResult> LateCall([FromBody] LateCallRequest request)
    {
        var (createEvent, _, late) = await DetermineLateStatus(request);

        if (createEvent) await CreateLateEvent(request, late);

        await _jobRepo.ResetLateEvent(request.JobId, request.LateType);

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

        var maxAutoLate = await _jobRepo.MaxAutoLatePickupAlert();
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

        var maxAutoLateDelAlert = await _jobRepo.MaxAutoLateDeliveryAlert();
        createEvent = request.Minutes < maxAutoLateDelAlert || late > request.AlertLateDelivery;

        return (createEvent, jobStatus, late);
    }

    private async Task CreateLateEvent(LateCallRequest request, int late)
    {
        await _courierRepo.AddEventAsync(
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
            await _jobRepo.LatePickup(
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
            await _jobRepo.LateDelivery(
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
        await _jobRepo.DispatchSelectedJobs(courierId, dispId, jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> ReAllocate(int courierId, int dispId, string jobIds)
    {
        await _jobRepo.ReDispatchSelectedJobs(courierId, dispId, jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> ReSendSelected(string jobIds)
    {
        await _jobRepo.ReSendSelectedJobs(jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> ReAssignSelected(string jobIds)
    {
        await _jobRepo.ReAssignSelectedJobs(jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> Transfer(int jobId, int courierId, int dispId)
    {
        await _jobRepo.TransferJob(jobId, courierId, dispId);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> SetFirstJob(int jobId, int courierId)
    {
        await _jobRepo.SetFirstJob(jobId, courierId);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> Void(int jobId)
    {
        await _jobRepo.VoidJob(jobId);
        return Json("OK");
    }


    [HttpPost]
    public async Task<IActionResult> ReSendAll(int courierId)
    {
        await _jobRepo.ReSendAllJobs(courierId);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> RestoreSplitJobs(int courierId, int dispId, string jobIds)
    {
        await _jobRepo.RestoreSplitJobs(jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> RestoreJobs(int courierId, int dispId, string jobIds)
    {
        await _jobRepo.RestoreJobs(jobIds);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> SplitJob(int jobId, string despatcherName)
    {
        await _jobRepo.SplitJob(jobId, despatcherName);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> UnSplitJob(int jobId)
    {
        var message = await _jobRepo.UnSplitJob(jobId);
        return Json(message);
    }

    [HttpPost]
    public async Task<IActionResult> UpdatePodDetails(string jobNumber, int jobStatus, string podName,
        DateTime podTime)
    {
        await _jobRepo.UpdatePodDetails(jobNumber, jobStatus, podName, podTime);
        return Json("OK");
    }


    public async Task<IActionResult> ReRateSplitJob(int jobId)
    {
        await _jobRepo.ReRateSplitJob(jobId);
        return Json("OK");
    }

    public async Task<IActionResult> FinishSplitJobProcess(int jobId, string despatcherName)
    {
        await _jobRepo.FinishSplitJobProcess(jobId, despatcherName);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> SendSms(int courierId, int dispId, string despatcherName, string message)
    {
        await _jobRepo.MessageCourier(courierId, dispId, despatcherName, message);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> UpdateSplitJobAddress(int jobId, int toSuburbId, string address,
        decimal deliveryLat, decimal deliveryLng)
    {
        await _jobRepo.UpdateSplitJobAddress(jobId, toSuburbId, address, deliveryLat, deliveryLng);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddRestoreEvent(string jobNo, int clientId, string contact, int staffId,
        int courierId, int jobId, int jobType, string despatcherName)
    {
        await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType,
            despatcherName, "Job Restored", 33);

        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddPriceSuburbChangeEvent(string jobNo, int clientId, string contact,
        int staffId, int? courierId, int jobId, int jobType, string despatcherName)
    {
        await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, null,
            "Changed Price or Suburb", 35);

        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddOtherEvent(string jobNo, int clientId, string contact, int staffId,
        int? courierId, int jobId, int jobType, string despatcherName, string notes)
    {
        await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, null, notes,
            66);

        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddEvent(string jobNo, int clientId, string contact, int staffId,
        int? courierId, int jobId, int jobType, string despatcherName, string notes, int eventType)
    {
        await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType,
            despatcherName, notes, eventType);

        return Json("OK");
    }

    public async Task<IActionResult> ExsalerateActivity(string eventName, string notes, int clientId,
        string jobNumber, string despatcherName)
    {
        var baseUrl = _configuration["ExsalerateAPI"];
        var un = _configuration["ExsalerateAPIUsername"];
        var pw = _configuration["ExsalerateAPIPW"];


        var rco = new RestClientOptions()
            { Authenticator = new HttpBasicAuthenticator(un, pw), BaseUrl = new Uri(baseUrl) };
        var client = new RestClient(rco);

        var body = new ExsalerateActivity()
        {
            SiteOwnerID = 11,
            CustomerRefCode = clientId.ToString(),
            Subject = $"Dispatch:{despatcherName} {eventName}",
            ActivityType = eventName,
            Description = $"Job Number: {jobNumber} - {notes}"
        };

        var request = new RestRequest("activity", Method.Post).AddJsonBody(body);


        var restResponse = await client.PostAsync(request);

        if (restResponse.StatusCode != HttpStatusCode.OK)
        {
            var e = new ApplicationException(
                $"Exsalerate Activity Failed {restResponse.Content} {Environment.NewLine} CurrentBody= {body}");
            var key = _configuration["RaygunSettings:ApiKey"];
            var rc = new RaygunClient(key).SendInBackground(e);
        }

        return Json("OK");
    }


    public async Task<IActionResult> SuburbList()
    {
        var data = await _jobRepo.SuburbsAsync();
        return Json(data);
    }

    public async Task<IActionResult> SpeedList()
    {
        var data = await _jobRepo.SpeedsAsync();
        return Json(data);
    }

    public async Task<IActionResult> ContactList(int clientId)
    {
        var data = await _jobRepo.ContactsAsync(clientId);
        return Json(data);
    }

    public async Task<IActionResult> ContactDetailList(int clientId)
    {
        var data = await _jobRepo.ContactDetailList(clientId);
        return Json(data);
    }

    public async Task<IActionResult> LeaveList()
    {
        var data = await _jobRepo.LeaveParcelLocationsAsync();
        return Json(data);
    }

    public async Task<IActionResult> UndeliverableList()
    {
        var data = await _jobRepo.UndeliverableLocationsAsync();
        return Json(data);
    }

    public async Task<IActionResult> InternalStatusList()
    {
        var data = await _jobRepo.GetInternalStatusListAsync();
        return Json(data);
    }

    public async Task<IActionResult> EventTypeList()
    {
        var data = await _jobRepo.EventTypeListAsync();
        return Json(data);
    }

    public async Task<IActionResult> TruckJobAmountBreakdown(int clientId, int fromId, int toId, double weight,
        int size,
        int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
        int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours, decimal gstRate)
    {
        var rate = await _jobRepo.RateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp,
            dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours);
        var description = await _jobRepo.RateTruckJobDescription(clientId, fromId, toId, weight, size, speed, qty,
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
        var rate = await _jobRepo.RateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp,
            dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours);
        return Json($"{rate:C}");
    }

    public async Task<IActionResult> JobAmountBreakdown(int clientId, int fromId, int toId, int speed, bool pedal,
        bool van,
        bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
        string ourRef, string refA, string refB, int quantity, DateTime booked, decimal gstRate, decimal amount)
    {
        var currentRateAmount = await _jobRepo.RateJobAsync(clientId, fromId, toId, speed, pedal, van, returnJob,
            weight,
            size,
            includeFuelSurcharge, direct, acceptedJobTypeId,
            ourRef, refA, refB, quantity, booked);
        var finalDescription = direct ? "DIRECT PRICE\r" : currentRateAmount != amount ? "NORMAL PRICE\r" : "";
        var description = await _jobRepo.RateJobDescription(clientId, fromId, toId, speed, pedal, van, returnJob,
            weight, size,
            includeFuelSurcharge, direct, acceptedJobTypeId,
            ourRef, refA, refB, quantity, booked);
        finalDescription += description;
        finalDescription += $"\rTotal = {currentRateAmount:C}";
        finalDescription += $"\rTotal (+GST) = {currentRateAmount * (1 + gstRate):C}";

        if (currentRateAmount == amount) return Json(finalDescription);

        var fs = includeFuelSurcharge
            ? await _jobRepo.FuelSurchargeInclusiveAmount(clientId, amount, fromId, toId, booked, size)
            : 0;
        var ppd = includeFuelSurcharge ? await _jobRepo.PpdInclusiveAmount(clientId, amount) : 0;
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
        var rate = await _jobRepo.RateJobAsync(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size,
            includeFuelSurcharge, direct, acceptedJobTypeId,
            ourRef, refA, refB, quantity, booked);
        return Json($"{rate:C}");
    }

    public async Task<IActionResult> PpdExclusiveAmount(int clientId, decimal amount)
    {
        var ppd = await _jobRepo.PpdExclusiveAmount(clientId, amount);
        return Json(ppd);
    }

    public async Task<IActionResult> TruckItemsSummary(int jobId, int truckWeightLimit)
    {
        var summary = await _jobRepo.TruckJobItemsAsync(jobId, truckWeightLimit);
        return Json(summary);
    }

    public async Task<IActionResult> UpdateDeliveryAddressNz([FromBody] UpdateAddressRequestNz request)
    {
        try
        {
            if (request is null)
                return BadRequest("Request Address Data Not Provided");

            await _jobRepo.UpdateDeliveryAddressNzAsync(request);
            return Json("OK");
        }
        catch (Exception e)
        {
            _logger.LogError(e, $"An error occured updating address for job {request.JobId}");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateDeliveryAddressUs([FromBody] UpdateAddressRequestUs request)
    {
        try
        {
            if (request is null)
                return BadRequest("Request Address Data Not Provided");

            await _jobRepo.UpdateDeliveryAddressUsAsync(request);
            return Json("OK");
        }
        catch (Exception e)
        {
            _logger.LogError(e, $"An error occured updating address for job {request.JobId}");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateBulkDeliveryAddress(int bulkJobId, string toSuburb, int toPostCode,
        string address,
        decimal deliveryLat, decimal deliveryLng, string despatcherName)
    {
        await _jobRepo.UpdateBulkDeliveryAddressAsync(bulkJobId, toSuburb, toPostCode, address, deliveryLat,
            deliveryLng,
            despatcherName);
        return Json("OK");
    }

    public async Task<IActionResult> UpdateBookingDeliveryAddress(int jobId, int toSuburbId, string address,
        decimal deliveryLat, decimal deliveryLng, bool cbd, decimal rate, string despatcherName)
    {
        await _jobRepo.UpdateBookingDeliveryAddressAsync(jobId, toSuburbId, address, deliveryLat, deliveryLng, cbd,
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

            await _jobRepo.UpdatePickupAddressNzAsync(request);
            return Json("OK");
        }
        catch (Exception e)
        {
            _logger.LogError(e, $"An error occured updating address for job {request.JobId}");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdatePickupAddressUs([FromBody] UpdateAddressRequestUs request)
    {
        try
        {
            if (request is null)
                return BadRequest("Request Address Data Not Provided");

            await _jobRepo.UpdatePickupAddressUsAsync(request);
            return Json("OK");
        }
        catch (Exception e)
        {
            _logger.LogError(e, $"An error occured updating address for job {request.JobId}");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateJobType(int jobId, int jobType, string despatcherName)
    {
        await _jobRepo.UpdateJobTypeAsync(jobId, jobType, despatcherName);
        return Json("OK");
    }


    public async Task<IActionResult> UpdateBulkPickupAddress(int bulkJobId, string fromSuburb, int fromPostCode,
        string address,
        decimal pickupLat, decimal pickupLng, string despatcherName)
    {
        await _jobRepo.UpdateBulkPickupAddressAsync(bulkJobId, fromSuburb, fromPostCode, address, pickupLat, pickupLng,
            despatcherName);
        return Json("OK");
    }


    public async Task<IActionResult> UpdateBookingPickupAddress(int jobId, int fromSuburbId, string address,
        decimal pickupLat, decimal pickupLng, bool cbd, decimal rate, string despatcherName)
    {
        await _jobRepo.UpdateBookingPickupAddressAsync(jobId, fromSuburbId, address, pickupLat, pickupLng, cbd, rate,
            despatcherName);
        return Json("OK");
    }

    public async Task<IActionResult> UpdateJob(int jobId, string field, string value, decimal? rate,
        string despatcherName, int staffId)
    {
        try
        {
            await _jobRepo.UpdateJobAsync(jobId, field, value, rate, despatcherName, staffId);
            return Ok();
        }
        catch (Exception e)
        {
            _logger.LogError(e, $"An error occured updating field {field} with value {value} for job {jobId}");
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }

    public async Task<IActionResult> UpdateBulkJob(int bulkJobId, string field, string value, decimal? rate,
        string despatcherName, int staffId)
    {
        await _jobRepo.UpdateBulkJobAsync(bulkJobId, field, value, rate, despatcherName, staffId);
        return Json("OK");
    }

    public async Task<IActionResult> ReleaseBulkJob(string jobNumber, DateTime bookDate)
    {
        await _jobRepo.ReleaseBulkJobAsync(jobNumber, bookDate);
        return Json("OK");
    }

    public async Task<IActionResult> UpdateJobBooking(int jobId, string field, string value, decimal? rate,
        string despatcherName, int staffId)
    {
        await _jobRepo.UpdateJobBookingAsync(jobId, field, value, rate, despatcherName, staffId);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddNote(int jobId, string note, string despatcher)
    {
        note = FormatNote(note);
        await _jobRepo.AddNoteAsync(jobId, note, despatcher);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddBulkJobNote(int bulkJobId, string note, string despatcher)
    {
        note = FormatNote(note);
        await _jobRepo.AddBulkJobNoteAsync(bulkJobId, note, despatcher);
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> AddJobBookingNote(int jobId, string note, string despatcher)
    {
        note = FormatNote(note);
        await _jobRepo.AddJobBookingNoteAsync(jobId, note, despatcher);
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

            var jobId = await _jobRepo.QuickAddJobAsync(request.Job, request.StaffId.Value);

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

        await _jobRepo.AddInterCourierChargeAsync(viewModel);
        return Json("OK");
    }


    [HttpPost]
    public async Task<IActionResult> ProcessUncheckDirect(int jobId, string despatcher, int staffId,
        string currentSpeed)
    {
        var jobData = await _jobRepo.DirectToAsap(jobId);
        var settingData = await _jobRepo.SettingsAsync();
        var emailMessage = FormatDelimMessage(settingData.UncheckDirectEmailMessage, "[", "]", jobData);
        await _courierRepo.AddEventAsync(jobData.Number, jobData.ClientID ?? 0, jobData.Recipient, staffId, null,
            jobId, jobData.JobTypeID ?? 0, despatcher, "Direct job changed to ASAP", 42, null, null,
            jobData.CloseEvent);
        if (jobData.NotifyViaEmail)
        {
            SendEmail(jobData.ContactEmail, "noreply@urgent.co.nz", emailMessage,
                settingData.UncheckDirectEmailSubject ?? "");
        }

        var result = await _jobRepo.UpdateFirstAvailableSpeed(jobId);

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
        var hasItems = await _jobRepo.HasClientItemsAvailableAsync(clientId, speedId);
        return Json(hasItems);
    }

    [HttpGet]
    public async Task<IActionResult> GetAllClientItems(int clientId, int speedId, int jobId)
    {
        var clientItems = await _jobRepo.GetClientItemsBySpeedAsync(clientId, speedId, jobId);
        return Json(clientItems);
    }

    [HttpPost]
    public async Task<IActionResult> AddClientItemsToJob(int jobId, [FromBody] ClientItemsModel itemsModel)
    {
        if (itemsModel != null)
            await _jobRepo.AddClientsItemToJobAsync(jobId, itemsModel.ServiceIds, itemsModel.TotalCost);
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
        var selectedJob = await _jobRepo.GetJobByIdAsync(jobId);

        if (selectedJob == null)
        {
            return NotFound();
        }

        var att = new Attachment(new MemoryStream(selectedJob.PodPhoto), selectedJob.JobNo + ".png");

        SendEmail(toEmail, _configuration["FromAddress"],
            $"Hello, attached is the proof of delivery photo for job {selectedJob.JobNo}.",
            $"Delivery Photo for {selectedJob.JobNo}", att);

        return Json("OK");
    }

    private void SendEmail(string toAddress, string fromAddress, string body, string subject,
        Attachment attachment = null, string replyTo = null)
    {
        using var message = new MailMessage();
        message.IsBodyHtml = true;
        message.From = new MailAddress(fromAddress);
        message.Subject = subject;
        message.Body = body;
        message.Priority = MailPriority.High;
        message.To.Add(toAddress);
        message.Headers.Add("Message-ID", $"<{Guid.NewGuid()}@urgent.co.nz>");
        if (attachment != null)
        {
            message.Attachments.Add(attachment);
        }

        if (!string.IsNullOrEmpty(replyTo))
        {
            message.ReplyToList.Add(new MailAddress(replyTo));
        }

        using var smtp = new SmtpClient
        {
            Host = _configuration["SMTPServer"],
            UseDefaultCredentials = false,
            EnableSsl = true,
            Credentials = new NetworkCredential(_configuration["SMTPUser"], _configuration["SMTPPass"]),
            Port = int.Parse(_configuration["SMTP_Port"])
        };
        smtp.Send(message);
    }

    [HttpGet]
    public async Task<IActionResult> IsFilesAttachedToJob(int jobId)
    {
        return Json(false);
    }

    [HttpGet]
    public async Task<IActionResult> GetAttachedFiles(int jobId)
    {
        return Json("OK");
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

            return Ok(new { message = "File uploaded successfully", fileName = request.File.FileName });
        }
        catch (Exception ex)
        {
            // Log the exception
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> DownloadFile(int jobId, string fileName)
    {
        return Json("OK");
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteFile(int jobId, string fileName)
    {
        return Json("OK");
    }

    [HttpPost]
    public async Task<IActionResult> UpdateNote(int jobId, string note)
    {
        _logger.LogInformation("Request received to update note for job {JobId}", jobId);

        if (jobId <= 0)
        {
            _logger.LogWarning("Invalid jobId received: {JobId}", jobId);
            return BadRequest(new { message = "Invalid job ID" });
        }

        if (string.IsNullOrWhiteSpace(note))
        {
            _logger.LogWarning("Empty note value received for job {JobId}", jobId);
            return BadRequest(new { message = "Note cannot be empty" });
        }

        try
        {
            await _jobRepo.UpdateJobNoteAsync(jobId, note);
            _logger.LogInformation("Successfully updated note for job {JobId}", jobId);
            return Ok(new { message = "Note updated successfully" });
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogError(ex, "Job not found for ID {JobId}", jobId);
            return StatusCode(500, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating note for job {JobId}. Error: {ErrorMessage}", jobId, ex.Message);
            return StatusCode(500, new { message = "An unexpected error occurred while updating the note" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateConnote(int jobId, string conNote)
    {
        _logger.LogInformation("Request received to update connote for job {JobId} with value {NewConnote}", jobId,
            conNote);

        if (jobId <= 0)
        {
            _logger.LogWarning("Invalid jobId received: {JobId}", jobId);
            return BadRequest(new { message = "Invalid job ID" });
        }

        if (string.IsNullOrWhiteSpace(conNote))
        {
            _logger.LogWarning("Empty connote value received for job {JobId}", jobId);
            return BadRequest(new { message = "Connote value cannot be empty" });
        }

        try
        {
            await _jobRepo.UpdateJobConnoteAsync(jobId, conNote);
            _logger.LogInformation("Successfully updated connote for job {JobId}", jobId);
            return Ok(new { message = "Connote updated successfully" });
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogError(ex, "Job not found for ID {JobId}", jobId);
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating connote for job {JobId}. Error: {ErrorMessage}", jobId, ex.Message);
            return StatusCode(500, new { message = "An unexpected error occurred while updating the connote" });
        }
    }

    public class ClientItemsModel
    {
        public List<int> ServiceIds { get; set; }
        public decimal TotalCost { get; set; }
    }
}
