using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualBasic;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Mail;
using System.Reflection;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Http;
using Serilog;

namespace DespatchWeb.Controllers;

    public class JobController(IJobRepository jobRepository, ICourierRepository courierRepo, IClientRepository clientRepo, IAmazonS3 s3Client, HttpClient httpClient ) : Controller
    {

        public async Task<IActionResult> Index([FromQuery] JobQueryParams queryParams, bool isInternal,
            int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
        {
            try
            {
                if (!isInternal) await ValidateClientAccess(cid, clientIds);

                // Get jobs
                var result = await jobRepository.JobListAsync(queryParams.Status, queryParams.Order,
                    queryParams.Asc, isInternal, clientIds, despatchViewIds);
                return Json(result);
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized("You don't have permission to access these clients.");
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        public async Task<IActionResult> NationwideJobListNew([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        if (!isInternal) await ValidateClientAccess(cid, clientIds);

        var result = await jobRepository.NationwideJobListAsync(queryParams?.Status, queryParams?.Order,
            queryParams?.Asc, isInternal, clientIds, NationwideWindowPanel.JobList, despatchViewIds);
        return Json(result);
    }

    public async Task<IActionResult> NationwideJobListPod([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        if (!isInternal) await ValidateClientAccess(cid, clientIds);

        var result = await jobRepository.NationwideJobListAsync(queryParams?.Status, queryParams?.Order,
            queryParams?.Asc, isInternal, clientIds, NationwideWindowPanel.Pod, despatchViewIds);
        return Json(result);
    }

    public async Task<IActionResult> NationwideJobListBookDelivery([FromQuery] JobQueryParams queryParams,
        bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        if (!isInternal) await ValidateClientAccess(cid, clientIds);

        var result = await jobRepository.NationwideJobListAsync(queryParams?.Status, queryParams?.Order,
            queryParams?.Asc, isInternal, clientIds, NationwideWindowPanel.BookDelivery, despatchViewIds);
        return Json(result);
    }

    public async Task<IActionResult> NationwideJobListReprice([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        if (!isInternal) await ValidateClientAccess(cid, clientIds);

        var result = await jobRepository.NationwideJobListAsync(queryParams?.Status, queryParams?.Order,
            queryParams?.Asc, isInternal, clientIds, NationwideWindowPanel.Reprice, despatchViewIds);
        return Json(result);
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
            Console.WriteLine(e);
            throw;
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

    public async Task<IActionResult> Detail(int jobId)
    {
        var result = await jobRepository.JobDetailAsync(jobId);
        return Json(result);
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
        var data = await jobRepository.InternalStatusListAsync();
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

    public async Task<IActionResult> UpdateDeliveryAddress(int jobId, int toSuburbId, string address,
        decimal deliveryLat, decimal deliveryLng, bool cbd, decimal rate, string despatcherName)
    {
        await jobRepository.UpdateDeliveryAddressAsync(jobId, toSuburbId, address, deliveryLat, deliveryLng, cbd, rate,
            despatcherName);
        return Json("OK");
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

    public async Task<IActionResult> UpdatePickupAddress(int jobId, int fromSuburbId, string address,
        decimal pickupLat, decimal pickupLng, bool cbd, decimal rate, string despatcherName)
    {
        await jobRepository.UpdatePickupAddressAsync(jobId, fromSuburbId, address, pickupLat, pickupLng, cbd, rate,
            despatcherName);
        return Json("OK");
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

            // Get the new job detail to update the frontend
            var jobDetail = await jobRepository.JobDetailAsync(jobId);
            return Json(jobDetail);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
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

                message += p?.GetValue(data)?.ToString();
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

        var selectedJob = await jobRepository.JobDetailAsync(jobId);

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

    private async Task ValidateClientAccess(int contactId, string clientIds)
    {
        if (string.IsNullOrEmpty(clientIds)) return;

        var clientContacts = await clientRepo.ClientContactsAsync(contactId);
        var requestedClientIds = clientIds.Split(',').Select(int.Parse).ToHashSet();

        var hasAccess = clientContacts?
            .Select(c => c.ID)
            .Any(x => requestedClientIds.Contains(x)) ?? false;

        if (!hasAccess) throw new UnauthorizedAccessException();
    }

    public class ClientItemsModel
    {
        public List<int> ServiceIds { get; set; }
        public decimal TotalCost { get; set; }
    }
}
