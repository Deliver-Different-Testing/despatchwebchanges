using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace DespatchWeb.Controllers
{
    public class JobController : Controller
    {
        private JobRepository _jobRepo;
        private CourierRepository _courierRepo;
        private ClientRepository _clientRepo;
        private IConfiguration _configuration;

        public JobController(JobRepository jobRepository, CourierRepository courierRepo, ClientRepository clientRepo, IConfiguration configuration)
        {
            _jobRepo = jobRepository;
            _courierRepo = courierRepo;
            _clientRepo = clientRepo;
            _configuration = configuration;
        }
        public async Task<IActionResult> Index(string status, string area, string order, string asc, bool isInternal, int cid, string clientIds)
        {
            //Security check to confirm these clients belong to this contact and have permissions set
            if (!isInternal && !string.IsNullOrEmpty(clientIds))
            {
                var clientContacts = await _clientRepo.ClientContacts(cid);
                if (!clientContacts.Select(c => c.ID).Any(x=>clientIds.Split(',').Any(y=>y == x.ToString())))
                {
                    var empty =new List<Models.JobViewModel>();
                    return Json(empty);
                }
            }
            var result = _jobRepo.JobList(status, area, order, asc, isInternal, clientIds);
            return Json(result);
        }
        
        public IActionResult Current(int courierId, bool done)
        {
            var result = _jobRepo.CurrentJobList(courierId, done);
            return Json(result);
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
            var support = await _jobRepo.GetSupportEvent(id);
            support.UcevDespatcher = dispatcher;
            var result = await _jobRepo.UpdateSupportEvent(support);
            return Json(result > 0);
        }

        [HttpPost]
        public async Task<IActionResult> UnLockSupport(int id, string dispatcher)
        {
            var support = await _jobRepo.GetSupportEvent(id);
            if (support.UcevDespatcher == dispatcher)
            {
                support.UcevDespatcher = "";
                var result = await _jobRepo.UpdateSupportEvent(support);
                return Json(result > 0);
            }
            else
            {
                return Json(false);
            }
            
        }

        public async Task<IActionResult> Detail(int jobId)
        {
            var result = await _jobRepo.JobDetail(jobId);
            return Json(result);
        }

        public IActionResult PODSearch(int? courierId, int? clientId, string wild, DateTime fromDate, DateTime toDate, int pageIndex, int pageSize)
        {
            var result = _jobRepo.PODSearch(courierId, wild ?? "", fromDate.ResetTimeToStartOfDay(), toDate.ResetTimeToEndOfDay(), clientId, pageIndex, pageSize);
            return Json(result);
        }

        [HttpPost]
        public async Task<IActionResult> LateCall(int lateType, int lateTime, int minutes, int pickupTime, int alertLatePickup, int deliveryTime, int alertLateDelivery, string jobNo, int clientId, string contact, int staffId, DateTime jobTime, int jobId, int jobType, string bookedSpeed, string notifiedSpeed, string despatcherName, bool calculationRequired)
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
                        late = lateTime + deliveryTime;
                        if (alertLateDelivery >= 0)
                        {
                            var maxAutoLateDelAlert = await _jobRepo.MaxAutoLateDeliveryAlert();
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
                await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, null, jobId, jobType, null, "Late Call from Despatch", lateType, lateTime, jobTime.AddMinutes(late));
            }

            await _jobRepo.ResetLateEvent(jobId, lateType);

            if (lateType == 1)
            {
                await _jobRepo.LatePickup(jobId, bookedSpeed, notifiedSpeed, lateTime, despatcherName, calculationRequired);
            }
            else
            {
                await _jobRepo.LateDelivery(jobId, bookedSpeed, notifiedSpeed, lateTime, despatcherName, calculationRequired);
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
        public async Task<IActionResult> Transfer(int jobId, int courierId, int dispId)
        {
            await _jobRepo.TransferJob(jobId, courierId, dispId);
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

            await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, null, "Changed Price or Suburb", 35);

            return Json("OK");
        }

        [HttpPost]
        public async Task<IActionResult> AddOtherEvent(string jobNo, int clientId, string contact, int staffId, int? courierId, int jobId, int jobType, string despatcherName, string notes)
        {

            await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, null, notes, 66);

            return Json("OK");
        }


        public IActionResult SuburbList()
        {
            var data = _jobRepo.Suburbs();
            return Json(data);
        }

        public IActionResult SpeedList()
        {
            var data = _jobRepo.Speeds();
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

        public async Task<IActionResult> UpdatePickupAddress(int jobId, int fromSuburbId, string address, decimal pickupLat, decimal pickupLng, bool cbd, decimal rate)
        {
            await _jobRepo.UpdatePickupAddress(jobId, fromSuburbId, address, pickupLat, pickupLng, cbd, rate);
            return Json("OK");
        }

        public async Task<IActionResult> UpdateJob(int jobId, string field, string value, decimal? rate, string despatcherName, int staffId)
        {
            await _jobRepo.UpdateJob(jobId, field, value, rate, despatcherName, staffId);
            return Json("OK");
        }

        [HttpPost]
        public async Task<IActionResult> AddNote(int jobId, string note, string despatcher)
        {
            await _jobRepo.AddNote(jobId, note, despatcher);
            return Json("OK");
        }

        public async Task<IActionResult> SendPOD(int jobId, string toEmail)
        {

            var selectedJob = await _jobRepo.JobDetail(jobId);

            if (selectedJob == null)
            {
                return NotFound();
            }

            Attachment att = new Attachment(new MemoryStream(selectedJob.PODPhoto), selectedJob.JobNo.ToString() + ".png");

            SendEmail(toEmail, _configuration["FromAddress"], $"Hello, attached is the proof of delivery photo for job {selectedJob.JobNo}.", $"Delivery Photo for {selectedJob.JobNo}", att);

            return Json("OK");
        }
        private void SendEmail(string toAddress, string fromAddress, string body, string subject, Attachment attachment = null, string replyTo = null)
        {

            using (var message = new MailMessage
            {
                IsBodyHtml = true,
                From = new MailAddress(fromAddress),
                Subject = subject,
                Body = body,
                Priority = MailPriority.High

            })
            {
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

                using (var smtp = new SmtpClient
                {
                    Host = _configuration["SMTPServer"],
                    UseDefaultCredentials = false,
                    EnableSsl = true,
                    Credentials = new NetworkCredential(_configuration["SMTPUser"], _configuration["SMTPPass"]),
                    Port = int.Parse(_configuration["SMTP_Port"])
                })
                {
                    smtp.Send(message);
                }

            }


        }
    }
}