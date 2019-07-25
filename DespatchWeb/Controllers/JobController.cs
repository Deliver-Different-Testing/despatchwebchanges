using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers
{
    public class JobController : Controller
    {
        private JobRepository _jobRepo;
        private CourierRepository _courierRepo;

        public JobController(JobRepository jobRepository, CourierRepository courierRepo)
        {
            _jobRepo = jobRepository;
            _courierRepo = courierRepo;

        }
        public IActionResult Index(string status, string area, string order, string asc)
        {
            var result = _jobRepo.JobList(status, area, order, asc);
            return Json(result);
        }

        public IActionResult Current(int courierId, bool done)
        {
            var result = _jobRepo.CurrentJobList(courierId, done);
            return Json(result);
        }

        [HttpPost]
        public async Task<IActionResult> LateCall(int lateType, int lateTime, int minutes, int pickupTime, int alertLatePickup, int deliveryTime, int alertLateDelivery, string jobNo, int clientId, string contact, int staffId, DateTime jobTime, int jobId, int jobType, string bookedSpeed, string notifiedSpeed, string despatcherName)
        {
            var intLate = lateTime;
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
                            var maxAutoLate = await _jobRepo.MaxAutoLatePickupAlert();
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
                        intLate = lateTime + deliveryTime;
                        if (alertLateDelivery >= 0)
                        {
                            var maxAutoLateDelAlert = await _jobRepo.MaxAutoLateDeliveryAlert();
                            if (minutes < maxAutoLateDelAlert)
                            {
                                createEvent = true;
                            }
                            else
                            {
                                if (intLate > alertLateDelivery)
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
                await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, null, jobId, jobType, null, "Late Call from Despatch", lateType, lateTime, jobTime.AddMinutes(intLate));
            }

            await _jobRepo.ResetLateEvent(jobId, lateType);

            if (lateType == 1)
            {
                await _jobRepo.LatePickup(jobId, bookedSpeed, notifiedSpeed, lateTime, despatcherName);
            }
            else
            {
                await _jobRepo.LateDelivery(jobId, bookedSpeed, notifiedSpeed, lateTime, despatcherName);
            }

            return Json("OK");
        }

        [HttpPost]
        public async Task<IActionResult> Allocate(int courierId, int dispId, string jobIds)
        {
            await _jobRepo.DispatchSelectedJobs(courierId, dispId, jobIds);
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

        public async Task<IActionResult> ReRateSplitJob(int jobId)
        {
            await _jobRepo.ReRateSplitJob(jobId);
            return Json("OK");
        }

        [HttpPost]
        public async Task<IActionResult> UpdateSplitJobAddress(int jobId, int toSuburbId, string address, decimal deliveryLat, decimal deliveryLng)
        {
            await _jobRepo.UpdateSplitJobAddress(jobId, toSuburbId, address, deliveryLat, deliveryLng);
            return Json("OK");
        }

        [HttpPost]
        public async Task<IActionResult> AddRestoreEvent(string jobNo, int clientId, string contact, int staffId, int courierId, int jobId, int jobType, string despatcherName)
        {

            await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, "Job Restored", 33);

            return Json("OK");
        }

        [HttpPost]
        public async Task<IActionResult> AddPriceSuburbChangeEvent(string jobNo, int clientId, string contact, int staffId, int? courierId, int jobId, int jobType, string despatcherName)
        {

            await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, "Changed Price or Suburb", 35);

            return Json("OK");
        }


        public IActionResult SuburbList()
        {
            var data = _jobRepo.Suburbs();
            return Json(data);
        }

        public async Task<IActionResult> RateTruckJob(int clientId, int fromId, int toId, double weight, int size, int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
                                          int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours)
        {
            var rate = await _jobRepo.RateTruckJob(clientId, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours);
            return Json($"{rate:C}");
        }

        public async Task<IActionResult> RateJob(int clientId, int fromId, int toId, int speed, bool pedal, bool van, bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
                                            string ourRef, string refA, string refB, int quantity, DateTime booked)
        {
            var rate = await _jobRepo.RateJob(clientId, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId,
                                             ourRef, refA, refB, quantity, booked);
            return Json($"{rate:C}");
        }

        public async Task<IActionResult> TruckItemsSummary(int jobId, int truckWeightLimit)
        {
            var summary = await _jobRepo.TruckJobItems(jobId, truckWeightLimit);
            return Json(summary);
        }

        public async Task<IActionResult> UpdateDeliveryAddress(int jobId, int toSuburbId, string address, decimal deliveryLat, decimal deliveryLng, bool cbd, decimal rate)
        {
            await _jobRepo.UpdateDeliveryAddress(jobId, toSuburbId, address, deliveryLat, deliveryLng, cbd, rate);
            return Json("OK");
        }

        public async Task<IActionResult> UpdateJob(int jobId, string field, string value, decimal rate)
        {
            await _jobRepo.UpdateJob(jobId, field, value, rate);
            return Json("OK");
        }
    }
}