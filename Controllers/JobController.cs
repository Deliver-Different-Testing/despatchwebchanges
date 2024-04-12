using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualBasic;
using RestSharp;
using RestSharp.Authenticators;
using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Reflection;
using System.Threading.Tasks;

namespace DespatchWeb.Controllers
{
    public class JobController(JobRepository jobRepository, CourierRepository courierRepo, ClientRepository clientRepo) : Controller
    {

        public async Task<IActionResult> Index(string status, string area, string order, string asc, bool isInternal,
            int cid, string clientIds)
        {
            //Security check to confirm these clients belong to this contact and have permissions set
            if (!isInternal && !string.IsNullOrEmpty(clientIds))
            {
                var clientContacts = await clientRepo.ClientContacts(cid);
                if (!clientContacts.Select(c => c.ID).Any(x => clientIds.Split(',').Any(y => y == x.ToString())))
                {
                    var empty = new List<Models.JobViewModel>();
                    return Json(empty);
                }
            }

            var result = await jobRepository.JobListAsync(status, area, order, asc, isInternal, clientIds);
            return Json(result);
        }

        public async Task<IActionResult> NationwideJobListNew(string status, string area, string order, string asc, bool isInternal,
            int cid, string clientIds)
        {
            //Security check to confirm these clients belong to this contact and have permissions set
            if (!isInternal && !string.IsNullOrEmpty(clientIds))
            {
                var clientContacts = await clientRepo.ClientContacts(cid);
                if (!clientContacts.Select(c => c.ID).Any(x => clientIds.Split(',').Any(y => y == x.ToString())))
                {
                    var empty = new List<Models.JobViewModel>();
                    return Json(empty);
                }
            }

            var result = await jobRepository.NationwideJobListAsync(status, area, order, asc, isInternal, clientIds, 1);
            return Json(result);
        }

        public async Task<IActionResult> NationwideJobListPOD(string status, string area, string order, string asc, bool isInternal,
            int cid, string clientIds)
        {
            //Security check to confirm these clients belong to this contact and have permissions set
            if (!isInternal && !string.IsNullOrEmpty(clientIds))
            {
                var clientContacts = await clientRepo.ClientContacts(cid);
                if (!clientContacts.Select(c => c.ID).Any(x => clientIds.Split(',').Any(y => y == x.ToString())))
                {
                    var empty = new List<Models.JobViewModel>();
                    return Json(empty);
                }
            }

            var result = await jobRepository.NationwideJobListAsync(status, area, order, asc, isInternal, clientIds, 2);
            return Json(result);
        }

        public async Task<IActionResult> NationwideJobListBookDelivery(string status, string area, string order, string asc, bool isInternal,
            int cid, string clientIds)
        {
            //Security check to confirm these clients belong to this contact and have permissions set
            if (!isInternal && !string.IsNullOrEmpty(clientIds))
            {
                var clientContacts = await clientRepo.ClientContacts(cid);
                if (!clientContacts.Select(c => c.ID).Any(x => clientIds.Split(',').Any(y => y == x.ToString())))
                {
                    var empty = new List<Models.JobViewModel>();
                    return Json(empty);
                }
            }

            var result = await jobRepository.NationwideJobListAsync(status, area, order, asc, isInternal, clientIds, 3);
            return Json(result);
        }

        public async Task<IActionResult> NationwideJobListReprice(string status, string area, string order, string asc, bool isInternal,
            int cid, string clientIds)
        {
            //Security check to confirm these clients belong to this contact and have permissions set
            if (!isInternal && !string.IsNullOrEmpty(clientIds))
            {
                var clientContacts = await clientRepo.ClientContacts(cid);
                if (!clientContacts.Select(c => c.ID).Any(x => clientIds.Split(',').Any(y => y == x.ToString())))
                {
                    var empty = new List<Models.JobViewModel>();
                    return Json(empty);
                }
            }

            var result = await jobRepository.NationwideJobListAsync(status, area, order, asc, isInternal, clientIds, 4);
            return Json(result);
        }

        [HttpPost]
        public async Task<IActionResult> AddPallet([FromBody] PalletInfo palletInfo, bool preBook, string despatcher)
        {
            await jobRepository.AddPalletInfo(palletInfo, preBook, despatcher);
            return Ok("OK");
        }

        [HttpPost]
        public async Task<IActionResult> EditPallet([FromBody] PalletInfo palletInfo, bool preBook, string despatcher)
        {
            await jobRepository.EditPalletInfo(palletInfo, preBook, despatcher);
            return Ok("OK");
        }

        [HttpPost]
        public async Task<IActionResult> DeletePallet([FromBody] PalletInfo palletInfo, bool preBook, string despatcher)
        {
            await jobRepository.DeletePalletInfo(palletInfo, preBook, despatcher);
            return Ok("OK");
        }


        public async Task<IActionResult> SendPrebookJob(int jobId)
        {
            await jobRepository.SendPrebookJob(jobId);
            return Ok("OK");
        }

        public async Task<IActionResult> VoidPrebookJob(int jobId, string despatcher, int staffId)
        {
            await jobRepository.VoidPrebookJob(jobId, despatcher, staffId);
            return Ok("OK");
        }

        public IActionResult Current(int courierId, bool done)
        {
            var result = jobRepository.CurrentJobList(courierId, done);
            return Json(result);
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
            var support = await jobRepository.GetSupportEvent(id);
            support.UcevDespatcher = dispatcher;
            var result = await jobRepository.UpdateSupportEvent(support);
            return Json(result > 0);
        }

        [HttpPost]
        public async Task<IActionResult> UnLockSupport(int id, string dispatcher)
        {
            var support = await jobRepository.GetSupportEvent(id);
            if (support.UcevDespatcher == dispatcher)
            {
                support.UcevDespatcher = "";
                var result = await jobRepository.UpdateSupportEvent(support);
                return Json(result > 0);
            }
            else
            {
                return Json(false);
            }

        }

        public async Task<IActionResult> Detail(int jobId)
        {
            var result = await jobRepository.JobDetail(jobId);
            return Json(result);
        }

        [HttpGet]
        public async Task<IActionResult> ScanJobDetailAsync(DateTime? runDate, string scan)
        {
            var data = await  jobRepository.ScanList(runDate, scan);
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
            var result = await jobRepository.PreBookDetail(preBookJobId);
            return Json(result);
        }

        public async Task<IActionResult> PreBookJobs()
        {
            var result = await jobRepository.PreBookJobList();
            return Json(result);
        }

        public IActionResult PODSearch(int? courierId, int? clientId, string wild, string job, DateTime fromDate, DateTime toDate,
            int pageIndex, int pageSize)
        {
            var result = jobRepository.PODSearch(courierId, wild ?? "", job ?? "", fromDate.ResetTimeToStartOfDay(),
                toDate.ResetTimeToEndOfDay(), clientId, pageIndex, pageSize);

            return Json(result);
        }

        public IActionResult ValidateSwapPOD(string job)
        {
            var fromDate = DateTime.Today;
            var result = jobRepository.PODSearch(null, "", job, fromDate.ResetTimeToStartOfDay(),
                fromDate.ResetTimeToEndOfDay(), null, 1, 5);
            if (result.Item1 == 0)
            {
                return Json(false);
            }
            else
            {
                return Json(result.Item2.First().ID);
            }

        }

        public async Task<IActionResult> SwapPOD(string job1, string job2)
        {
            await jobRepository.SwapPOD(job1, job2);
            return Json("OK");
        }

        public async Task<IActionResult> BulkSearch(int? courierId, int? clientId, string job, string wild, DateTime fromDate, DateTime toDate,
            int pageIndex, int pageSize)
        {
            var result = await jobRepository.BulkSearchAsync(courierId, job ?? "",wild ?? "", fromDate.ResetTimeToStartOfDay(),
                toDate.ResetTimeToEndOfDay(), clientId, pageIndex, pageSize);

            return Json(result);
        }

        public async Task<IActionResult> PreBookSearch(int? courierId, int? clientId, string wild, string job, DateTime fromDate, DateTime toDate,
            int pageIndex, int pageSize)
        {
            var result = await jobRepository.PreBookSearchAsync(courierId, wild ?? "", job ?? "",fromDate.ResetTimeToStartOfDay(),
                toDate.ResetTimeToEndOfDay(), clientId, pageIndex, pageSize);

            return Json(result);
        }

        [HttpPost]
        public async Task<IActionResult> LateCall(int lateType, int lateTime, int minutes, int pickupTime,
            int alertLatePickup, int deliveryTime, int alertLateDelivery, string jobNo, int clientId, string contact,
            int staffId, DateTime jobTime, int jobId, int jobType, string bookedSpeed, string notifiedSpeed,
            string despatcherName, bool calculationRequired)
        {
            var late = lateTime;
            var createEvent = false;
            var jobStatus = 0;


            if (lateType == 1 || lateType == 2)
            {
                switch (lateType)
                {
                    case 1:
                        jobStatus = 4;
                        if (alertLatePickup >= 0)
                        {
                            var maxAutoLate = await jobRepository.MaxAutoLatePickupAlert();
                            if (minutes < maxAutoLate)
                            {
                                if (lateTime > pickupTime)
                                {
                                    createEvent = true;
                                }
                            }
                            else
                            {
                                if ((lateTime - pickupTime) > alertLatePickup)
                                {
                                    createEvent = true;
                                }
                            }
                        }

                        break;
                    case 2:
                        jobStatus = 8;
                        late = lateTime + deliveryTime;
                        if (alertLateDelivery >= 0)
                        {
                            var maxAutoLateDelAlert = await jobRepository.MaxAutoLateDeliveryAlert();
                            if (minutes < maxAutoLateDelAlert)
                            {
                                createEvent = true;
                            }
                            else
                            {
                                if (late > alertLateDelivery)
                                {
                                    createEvent = true;
                                }
                            }
                        }

                        break;
                    default:
                        break;
                }

            }
            else
            {
                createEvent = true;
            }

            if (createEvent)
            {
                //Event_Insert Me.ucjbNumber, Me.ucjbClientID, Me.ucjbContact, intLateType, intLateTime, DateAdd("n", intLate, Me.ucjbTime), _
                //    lngUserID, 0, Null, "Late Call from Despatch", False, False, 2, Null, Null, Me.ucjbID, Null, Me.ucjbType, Date, Now
                await courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, null, jobId, jobType, null,
                    "Late Call from Despatch", lateType, lateTime, jobTime.AddMinutes(late));
            }

            await jobRepository.ResetLateEvent(jobId, lateType);

            if (lateType == 1)
            {
                await jobRepository.LatePickup(jobId, bookedSpeed, notifiedSpeed, lateTime, despatcherName,
                    calculationRequired);
            }
            else
            {
                await jobRepository.LateDelivery(jobId, bookedSpeed, notifiedSpeed, lateTime, despatcherName,
                    calculationRequired);
            }

            return Json("OK");
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
            var message =await jobRepository.UnSplitJob(jobId);
            return Json(message);
        }

        [HttpPost]
        public async Task<IActionResult> UpdatePODDetails(string jobNumber, int jobStatus, string podName, DateTime podTime)
        {
            await jobRepository.UpdatePODDetails(jobNumber, jobStatus, podName, podTime);
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
        public async Task<IActionResult> SendSMS(int courierId, int dispId, string despatcherName, string message)
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

            await courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes,eventType);

            return Json("OK");
        }

        public async Task<IActionResult> ExsalerateActivity(string eventName, string notes, int clientId, string jobNumber, string despatcherName)
        {
            var baseUrl = Environment.GetEnvironmentVariable("ExsalerateAPI");
            var un = Environment.GetEnvironmentVariable("ExsalerateAPIUsername");
            var pw = Environment.GetEnvironmentVariable("ExsalerateAPIPW");

            
            var rco = new RestClientOptions() { Authenticator = new HttpBasicAuthenticator(un, pw), BaseUrl = new Uri(baseUrl)};
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

            if (restResponse.StatusCode != System.Net.HttpStatusCode.OK)
            {
                var e = new ApplicationException($"Exsalerate Activity Failed {restResponse.Content} {Environment.NewLine} CurrentBody= {body}");
                throw e;
            }

            return Json("OK");
        }


        public IActionResult SuburbList()
        {
            var data = jobRepository.Suburbs();
            return Json(data);
        }

        public IActionResult SpeedList()
        {
            var data = jobRepository.Speeds();
            return Json(data);
        }

        public IActionResult ContactList(int clientId )
        {
            var data = jobRepository.Contacts(clientId);
            return Json(data);
        }

        public async Task<IActionResult> ContactDetailList(int clientId)
        {
            var data = await jobRepository.ContactDetailList(clientId);
            return Json(data);
        }

        public IActionResult LeaveList()
        {
            var data = jobRepository.LeaveParcelLocations();
            return Json(data);
        }

        public IActionResult UndeliverableList()
        {
            var data = jobRepository.UndeliverableLocations();
            return Json(data);
        }

        public IActionResult InternalStatusList()
        {
            var data = jobRepository.InternalStatusList();
            return Json(data);
        }

        public IActionResult EventTypeList()
        {
            var data = jobRepository.EventTypeList();
            return Json(data);
        }

        public async Task<IActionResult> TruckJobAmountBreakdown(int clientId, int fromId, int toId, double weight, int size,
            int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
            int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours, decimal gstRate)
        {
            var rate = await jobRepository.RateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp,
                dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours);
            var description = await jobRepository.RateTruckJobDescription(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp,
                dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours);
            description += ($"\rTotal = {rate:C}");
            description += ($"\rTotal (+GST) = {rate * (1+ gstRate):C}");
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

        public async Task<IActionResult> JobAmountBreakdown(int clientId, int fromId, int toId, int speed, bool pedal, bool van,
            bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
            string ourRef, string refA, string refB, int quantity, DateTime booked, decimal gstRate, decimal amount)
        {
            
            var currentRateAmount = await jobRepository.RateJob(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size,
                includeFuelSurcharge, direct, acceptedJobTypeId,
                ourRef, refA, refB, quantity, booked);
            var finalDescription = direct ? "DIRECT PRICE\r" : currentRateAmount != amount ? "NORMAL PRICE\r" : "";
            var description = await jobRepository.RateJobDescription(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size,
                includeFuelSurcharge, direct, acceptedJobTypeId,
                ourRef, refA, refB, quantity, booked);
            finalDescription += description;
            finalDescription += $"\rTotal = {currentRateAmount:C}";
            finalDescription += $"\rTotal (+GST) = {currentRateAmount * (1 + gstRate):C}";

            if (currentRateAmount != amount)
            {
                var fs = includeFuelSurcharge ? await jobRepository.FuelSurchargeInclusiveAmount(clientId, amount, fromId, toId, booked, size) : 0;
                var ppd = includeFuelSurcharge ? await jobRepository.PPDInclusiveAmount(clientId, amount) : 0; 
                finalDescription += ($"\rSPECIAL PRICE = {(amount - fs - ppd):C}" );
                if (fs > 0)
                {
                    //strDescription = strDescription & vbCrLf & "Plus fuel surcharge = $" & Format(curFuelSurcharge, "0.00")
                    finalDescription += $"\rPlus fuel surcharge = {fs:C}";
                    finalDescription += $"\rPlus PPD = {ppd:C}";
                    finalDescription += $"\rTOTAL = {amount:C}";
                    finalDescription += $"\rTotal (+GST) = {amount * (1 + gstRate):C}";
                }
            }

            return Json(finalDescription);
        }

        public async Task<IActionResult> RateJob(int clientId, int fromId, int toId, int speed, bool pedal, bool van,
            bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
            string ourRef, string refA, string refB, int quantity, DateTime booked)
        {
            var rate = await jobRepository.RateJob(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size,
                includeFuelSurcharge, direct, acceptedJobTypeId,
                ourRef, refA, refB, quantity, booked);
            return Json($"{rate:C}");
        }

        public async Task<IActionResult> PPDExclusiveAmount(int clientId, decimal amount)
        {
            var ppd = jobRepository.PPDExclusiveAmount(clientId, amount);
            return Json(ppd);
        }

        public async Task<IActionResult> TruckItemsSummary(int jobId, int truckWeightLimit)
        {
            var summary = await jobRepository.TruckJobItems(jobId, truckWeightLimit);
            return Json(summary);
        }

        public async Task<IActionResult> UpdateDeliveryAddress(int jobId, int toSuburbId, string address,
            decimal deliveryLat, decimal deliveryLng, bool cbd, decimal rate, string despatcherName)
        {
            await jobRepository.UpdateDeliveryAddress(jobId, toSuburbId, address, deliveryLat, deliveryLng, cbd, rate,
                despatcherName);
            return Json("OK");
        }

        public async Task<IActionResult> UpdateBulkDeliveryAddress(int bulkJobId, string toSuburb, int toPostCode, string address,
            decimal deliveryLat, decimal deliveryLng, string despatcherName)
        {
            await jobRepository.UpdateBulkDeliveryAddress(bulkJobId, toSuburb, toPostCode, address, deliveryLat, deliveryLng, despatcherName);
            return Json("OK");
        }

        public async Task<IActionResult> UpdateBookingDeliveryAddress(int jobId, int toSuburbId, string address,
            decimal deliveryLat, decimal deliveryLng, bool cbd, decimal rate, string despatcherName)
        {
            await jobRepository.UpdateBookingDeliveryAddress(jobId, toSuburbId, address, deliveryLat, deliveryLng, cbd, rate,
                despatcherName);
            return Json("OK");
        }

        public async Task<IActionResult> UpdatePickupAddress(int jobId, int fromSuburbId, string address,
            decimal pickupLat, decimal pickupLng, bool cbd, decimal rate, string despatcherName)
        {
            await jobRepository.UpdatePickupAddress(jobId, fromSuburbId, address, pickupLat, pickupLng, cbd, rate,
                despatcherName);
            return Json("OK");
        }

        public async Task<IActionResult> UpdateJobType(int jobId, int jobType, string despatcherName)
        {
            await jobRepository.UpdateJobType(jobId, jobType,despatcherName);
            return Json("OK");
        }


        public async Task<IActionResult> UpdateBulkPickupAddress(int bulkJobId, string fromSuburb, int fromPostCode, string address,
            decimal pickupLat, decimal pickupLng, string despatcherName)
        {
            await jobRepository.UpdateBulkPickupAddress(bulkJobId, fromSuburb, fromPostCode, address, pickupLat, pickupLng, despatcherName);
            return Json("OK");
        }


        public async Task<IActionResult> UpdateBookingPickupAddress(int jobId, int fromSuburbId, string address,
            decimal pickupLat, decimal pickupLng, bool cbd, decimal rate, string despatcherName)
        {
            await jobRepository.UpdateBookingPickupAddress(jobId, fromSuburbId, address, pickupLat, pickupLng, cbd, rate,
                despatcherName);
            return Json("OK");
        }

        public async Task<IActionResult> UpdateJob(int jobId, string field, string value, decimal? rate,
            string despatcherName, int staffId)
        {
            await jobRepository.UpdateJob(jobId, field, value, rate, despatcherName, staffId);
            return Json("OK");
        }

        public async Task<IActionResult> UpdateBulkJob(int bulkJobId, string field, string value, decimal? rate,
            string despatcherName, int staffId)
        {
            await jobRepository.UpdateBulkJob(bulkJobId, field, value, rate, despatcherName, staffId);
            return Json("OK");
        }

        public async Task<IActionResult> ReleaseBulkJob(string jobNumber, DateTime bookDate)
        {
            await jobRepository.ReleaseBulkJob(jobNumber, bookDate);
            return Json("OK");
        }

        public async Task<IActionResult> UpdateJobBooking(int jobId, string field, string value, decimal? rate,
            string despatcherName, int staffId)
        {
            await jobRepository.UpdateJobBooking(jobId, field, value, rate, despatcherName, staffId);
            return Json("OK");
        }

        [HttpPost]
        public async Task<IActionResult> AddNote(int jobId, string note, string despatcher)
        {
            await jobRepository.AddNote(jobId, note, despatcher);
            return Json("OK");
        }

        [HttpPost]
        public async Task<IActionResult> AddBulkJobNote(int bulkJobId, string note, string despatcher)
        {
            await jobRepository.AddBulkJobNote(bulkJobId, note, despatcher);
            return Json("OK");
        }

        [HttpPost]
        public async Task<IActionResult> AddJobBookingNote(int jobId, string note, string despatcher)
        {
            await jobRepository.AddJobBookingNote(jobId, note, despatcher);
            return Json("OK");
        }




        [HttpPost]
        public async Task<IActionResult> ProcessUncheckDirect(int jobId, string despatcher, int staffId,string currentSpeed)
        {
            var jobData = await jobRepository.DirectToASAP(jobId);
            var settingData = await jobRepository.Settings();
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

    

   

    private string FormatDelimMessage<T>(string format, string startDelim, string endDelim, T data)
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
                var p = props.First(x => String.Equals(x.Name, fieldName, StringComparison.CurrentCultureIgnoreCase));

                message += p?.GetValue(data)?.ToString();
            }
            else
            {
                message += c;
            }

        };

        message = message.Replace("  ", " ");
        message = Strings.Trim(message);
        return message;
    }

    public async Task<IActionResult> SendPOD(int jobId, string toEmail)
    {

        var selectedJob = await jobRepository.JobDetail(jobId);

        if (selectedJob == null)
        {
            return NotFound();
        }

        Attachment att = new Attachment(new MemoryStream(selectedJob.PODPhoto), selectedJob.JobNo.ToString() + ".png");

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
        message.Headers.Add("Message-ID", $"<{Guid.NewGuid()}@urgent.co.nz>");
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
}
}