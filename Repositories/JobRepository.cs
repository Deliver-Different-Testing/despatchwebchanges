using DespatchWeb.Controllers;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Diagnostics;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Threading.Tasks;


namespace DespatchWeb.Repositories
{
    public class JobRepository(DespatchContext context)
    {
        public async Task<JobViewModel> PreBookDetail(int prebookId)
        {
            var pallets = context.TucJobBookingItems.Where(x => x.BookingId == prebookId).ToList();
            var jobQuery = (
                from j in context.TucJobBookings
                join c in context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
                from co in courierJoin.DefaultIfEmpty()
                join y in context.TucSuburbs on j.UcbkFrom equals y.UcsuId into fromJoin
                from yo in fromJoin.DefaultIfEmpty()
                join z in context.TucSuburbs on j.UcbkTo equals z.UcsuId into toJoin
                from zo in toJoin.DefaultIfEmpty()
                join t in context.TucJobTypes on j.UcbkSpeed.Value equals t.UcjtId into speedJoin
                from to in speedJoin.DefaultIfEmpty()
                join cl in context.TblClients on j.UcbkClientId equals cl.ClientId into clientJoin
                from client in clientJoin.DefaultIfEmpty()
                join con in context.TblContacts on j.LoggedInContactId equals con.ContactId into contactJoin
                from contact in contactJoin.DefaultIfEmpty()
                join sou in context.TucSources on j.SourceId equals sou.SourceId into sourceJoin
                from source in sourceJoin.DefaultIfEmpty()


                where (j.UcbkId == prebookId)
                select new JobViewModel()
                {
                    ID = j.UcbkId,
                    Time = j.UcbkTime,
                    BookedDate = j.UcbkDate,
                    Direct = j.Direct,
                    SizeID = j.UcbkSize,
                    Van = j.UcbkVan,
                    VanOK = j.VanOk,
                    Truck = j.Truck,
                    SaturdayDelivery = j.SaturdayDelivery,
                    Return = j.UcbkReturn,
                    Attention = j.UcbkAttention,
                    Done = j.UcbkDone,
                    PickupFrom = (short?)j.UcbkPickUpFrom,
                    JobNo = j.UcbkJobNumber,
                    Speed = to.ShortName,
                    SpeedName = to.UcjtName,
                    SpeedID = j.UcbkSpeed,
                    AcceptedJobTypeID = j.AcceptedJobTypeId,
                    NotifiedJobTypeID = j.NotifiedJobTypeId,
                    Source = source.Name,
                    Client = j.UcbkClientCode,
                    ClientID = j.UcbkClientId,
                    ClientName = client.Name,
                    JobType = (int)j.UcbkType,
                    From = yo.UcsuName,
                    FromSuburbID = (int)j.UcbkFrom,
                    fromSuburbName = yo.UcsuName,
                    FromPostCode = yo.PostCode,
                    FromAddress = j.UcbkFromAddr,
                    FromContactName = j.PickupFromContact,
                    FromContactNumber = j.PickupFromPhone,
                    To = zo.UcsuName,
                    ToSuburbID = (int)j.UcbkTo,
                    ToSuburbName = zo.UcsuName,
                    ToPostCode = zo.PostCode,
                    ToAddress = j.UcbkToAddr,
                    ToCity = zo.City,
                    Courier = co.Code,
                    ContactName = j.UcbkContact,
                    Phone = j.DeliverToPhone,
                    Weight = j.UcbkWeight,
                    Items = j.Quantity,
                    RefA = j.UcbkClientRefa,
                    RefB = j.UcbkClientRefb,
                    OurRef = j.UcbkOurRef,
                    Charge = $"{j.UcbkAmount:C}",
                    ClientNotes = client.UcclNotes,
                    InternalNotes = j.UcbkNotes,
                    PickUpLatitude = j.PickUpLatitude,
                    PickUpLongitude = j.PickUpLongitude,
                    DeliveryLatitude = j.DeliveryLatitude,
                    DeliveryLongitude = j.DeliveryLongitude,
                    CourierData = new CourierData()
                    {
                        Courier = co.Code + " " + co.FirstName + " " + co.Surname,
                        CourierID = co.CourierId
                    },

                    DGClass = j.Dgclass,
                    DGDocumentation = j.Dgdocument,
                    DeliverToContact = j.DeliverToContact,
                    TrackingMethod = j.TrackingMethod,
                    TrackingMobile = j.TrackingMobile,
                    TrackingEmail = j.TrackingEmail,
                    RatedManually = j.RatedManually,
                    OneOff = j.UcbkOneOff,
                    Active = j.UcbkActive,
                    InActiveBy = j.UcbkInActiveBy,
                    InActiveDate = j.UcbkInActiveDate,
                    FirstDue = j.UcbkFirstDue,
                    NextDue = j.UcbkNextDue,
                    LastDone = j.UcbkDateDone,
                    RestartDate = j.RestartDate,
                    StopDate = j.StopDate,
                    Days = j.UcbkDays,
                    PreBook = true,
                    Pedal = j.UcbkCbd,
                    Reprice = j.Reprice,
                    LoggedInContactName = $"{contact.Firstname} {contact.Surname ?? ""}",
                    PalletInfo = (
                        from pa in pallets
                        select new PalletInfo()
                        {
                            ID = pa.BookingId,
                            Quantity = pa.Items,
                            ItemID = pa.ItemId,
                            Weight = pa.Weight,
                            Length = pa.Length,
                            Depth = pa.Depth,
                            Height = pa.Height,
                            PU = pa.Pu,
                            DO = pa.Do,
                            DGClass = pa.Dgclass,
                            Notes = pa.Notes

                        }).ToList(),




                });
            var job = await jobQuery.FirstOrDefaultAsync();
            if (job != null)
            {
                job.Vehicle = new Vehicle()
                {
                    id = job.Van ? (short?)Enums.Vehicle.Van : job.SizeID,
                    label = job.Van ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (job.SizeID ?? (short)2))
                };
                job.Size = job.Vehicle;
                job.Date = job.BookedDate.Value.ToString("dd/MM/yyyy");
                job.Booked = DateTime.Parse(job.BookedDate.Value.ToString("yyyy-MM-dd") + " " +
                                            job.Time.Value.ToString("HH:mm:ss"));

            }

            return job;
        }


        public async Task<JobViewModel> JobDetail(int jobId)
        {
            var jobQuery = (
                from j in context.TblJobs
                join c in context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
                from co in courierJoin.DefaultIfEmpty()
                join y in context.TucSuburbs on j.FromSuburbId equals y.UcsuId into fromJoin
                from yo in fromJoin.DefaultIfEmpty()
                join z in context.TucSuburbs on j.ToSuburbId equals z.UcsuId into toJoin
                from zo in toJoin.DefaultIfEmpty()
                join t in context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
                from to in speedJoin.DefaultIfEmpty()
                join n in context.TucJobTypes on j.NotifiedJobTypeId equals n.UcjtId into notifiedSpeedJoin
                from no in notifiedSpeedJoin.DefaultIfEmpty()
                join o in context.TucJobTypes on j.AcceptedJobTypeId equals o.UcjtId into originalSpeedJoin
                from os in originalSpeedJoin.DefaultIfEmpty()
                join cl in context.TblClients on j.ClientId equals cl.ClientId into clientJoin
                from client in clientJoin.DefaultIfEmpty()
                join s in context.TucJobStatuses on j.Status equals s.UcjsId into statusJoin
                from status in statusJoin.DefaultIfEmpty()
                join l in context.TblJobLeaveNotHomes on j.LeaveNotHomeId equals l.LeaveNotHomeId into leaveNotHomeJoin
                from leave in leaveNotHomeJoin.DefaultIfEmpty()
                join u in context.TblUndeliverableLocations on j.UndeliverableLocationId equals u.UndeliverableLocationId into undeliverableLocationJoin
                from ud in undeliverableLocationJoin.DefaultIfEmpty()
                join b in context.TblBulkJobs on j.JobId equals b.JobId into bulkJoin
                from bj in bulkJoin.DefaultIfEmpty()
                join sc in context.TblBulkRunSchedules on bj.ScheduleId equals sc.BulkRunScheduleId into scheduleJoin
                from schedule in scheduleJoin.DefaultIfEmpty()
                join nationwide in context.TucJobNationwides on j.JobId equals nationwide.UcnwJobId into nationwideJoin
                from nw in nationwideJoin.DefaultIfEmpty()
                join con in context.TblContacts on j.LoggedInContactId equals con.ContactId into contactJoin
                from contact in contactJoin.DefaultIfEmpty()
                join sou in context.TucSources on j.SourceId equals sou.SourceId into sourceJoin
                from source in sourceJoin.DefaultIfEmpty()

                where (j.JobId == jobId)
                select new JobViewModel()
                {
                    ID = j.JobId,
                    JobRelationshipTypeID = j.JobRelationshipTypeId,
                    Time = j.Time,
                    BookedDate = j.Date,
                    Direct = j.Direct,
                    SizeID = j.Size,
                    Van = j.Van,
                    VanOK = j.VanOk,
                    Truck = j.Truck,
                    Attention = j.Attention,
                    SaturdayDelivery = j.SaturdayDelivery,
                    Return = j.Return,
                    Done = j.JobDone,
                    Void = j.Void,
                    PickupFrom = j.PickupFrom,
                    JobNo = j.Number,
                    Speed = to.ShortName,
                    SpeedID = j.Speed,
                    Notify = no.ShortName,
                    SpeedName = to.UcjtName,
                    Source = source.Name,
                    NotifiedName = no.UcjtName,
                    AcceptedName = os.UcjtName,
                    AcceptedJobTypeID = j.AcceptedJobTypeId,
                    NotifiedJobTypeID = j.NotifiedJobTypeId,
                    Client = j.ClientCode,
                    ClientID = j.ClientId,
                    ClientName = client.Name,
                    JobType = (int)j.Type,
                    From = yo.UcsuName,
                    FromSuburbID = j.FromSuburbId,
                    fromSuburbName = yo.UcsuName,
                    FromPostCode = yo.PostCode,  
                    FromAddress = j.FromAddress,
                    FromContactName = j.PickupFromContact,
                    FromContactNumber = j.PickupFromPhone,
                    To = zo.UcsuName,
                    ToSuburbID = j.ToSuburbId,
                    ToSuburbName = zo.UcsuName,
                    ToCity = zo.City,
                    ToPostCode = zo.PostCode,
                    ToAddress = j.ToAddress,
                    Courier = co.Code,
                    StatusID = j.Status,
                    Status = status.UcjsCode,
                    LP = j.LatePickUp,
                    LD = j.LateDelivery,
                    ContactName = j.Contact,
                    LoggedInContactName = $"{contact.Firstname ??  ""} {contact.Surname??""}",
                    Phone = j.DeliverToPhone,
                    SpeedAccepted = os.ShortName,
                    Weight = j.Weight,
                    Items = j.Quantity,
                    RefA = j.ClientReferenceA,
                    RefB = j.ClientReferenceB,
                    OurRef = j.OurRef,
                    SigNotRequired = leave.Name ?? "",
                    Charge = $"{j.Amount:C}",
                    DispatchTime = j.DispatchDate.HasValue ? DateTime.Parse(j.DispatchDate.Value.ToString("yyyy-MM-dd") + " " + j.DispatchTime.Value.ToString("HH:mm:ss")): j.DispatchDate,
                    PUTime = j.PickUpTime,
                    ClientNotes = client.UcclNotes,
                    InternalNotes = j.Notes,
                    //ChildNotes = j.ChildNotes,
                    PickUpLatitude = j.PickUpLatitude,
                    PickUpLongitude = j.PickUpLongitude,
                    DeliveryLatitude = j.DeliveryLatitude,
                    DeliveryLongitude = j.DeliveryLongitude,
                    //CourierLatitude = j.CourierLatitude,
                    //CourierLongitude = j.CourierLongitude,
                    //RunOrder = j.PickRunOrder,
                    CourierData = new CourierData()
                    {
                        Courier = co.Code + " " + co.FirstName + " " + co.Surname,
                        CourierID = co.CourierId
                    },
                    
                    //AllowDispatch = j.AllowDespatch,
                    //AllowSplit = j.AllowSplit,
                    DGClass = j.Dgclass,
                    DGDocumentation = j.Dgdocument,
                    //DisplaySplitJobDetail = j.DisplaySplitJobDetail == 1,
                    //TruckWeightLimit = j.TruckWeightLimit,
                    //TruckStartTime = j.TruckStartTime,
                    //TruckHours = j.TruckHours,
                    //PrivateRes = ((j.DeliverToPrivateBusiness ?? 0) == 1),
                    //PickupTime = j.PickUpTime,
                    CompletedTime = j.CompletedTime,
                    //AlertLatePickup = j.AlertLatePickUp,
                    //AlertLateDelivery = j.AlertLateDelivery,
                    //Minutes = j.Minutes,
                    DeliverToContact = j.DeliverToContact,
                    PODPhoto = j.DeliveryPhoto,
                    DeliverySignature =j.DeliverySignature,
                    PODName = j.Podname,
                    TrackingMethod = j.TrackingMethod,
                    TrackingMobile = j.TrackingMobile,
                    TrackingEmail = j.TrackingEmail,
                    UDStatus = ud.Name,
                    RatedManually = j.RatedManually,
                    Locked = (j.Locked ?? 0) == 1,
                    Invoiced = (j.InvoiceNo.HasValue && j.InvoiceNo.Value > 0),
                    PreBook = false,
                    Pedal = j.Cbd,
                    InternalStatusID = j.InternalStatus,
                    FollowupTime = j.FollowupTime,
                    Reprice = j.Reprice,
                    GstRate = j.Gstrate,
                    RootParentID = j.RootParentId,
                    ScheduleName = schedule.Name,
                    ConNote = nw.UcnwConNote,
                    AirportOnly = nw.UcnwAirportOnly,
                    HasNationwide = nw.UcnwJobId.HasValue,
                    StatusName = status.UcjsName

                });
            var job = await jobQuery.FirstOrDefaultAsync();
            if (job != null)
            {
                job.Vehicle = new Vehicle()
                {
                    id = job.Van ? (short?)Enums.Vehicle.Van : job.SizeID,
                    label = job.Van ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (job.SizeID ?? (short)2))
                };
                job.RelatedJobs = (
                    from rel in context.TblJobs.Where(r => 
                        job.RootParentID.HasValue && r.ParentId == job.RootParentID &&  r.ClientId == job.ClientID
                        ).OrderBy(t=>t.Date).ThenBy(x=>x.Time)
                    select new Size()
                    {
                        id = rel.JobId,
                        label = rel.Number
                    }
                ).ToList();
                job.PODPhotos = new List<byte[]>();
                if (job.PODPhoto != null)
                {
                    job.PODPhotos.Add(job.PODPhoto);
                }

                if (job.DeliverySignature != null)
                {
                    job.PODPhotos.Add(job.DeliverySignature);
                }

                job.PODPhotos.AddRange(
                    from del in context.DeliveryPhotos.Where(d => d.JobId == job.ID)
                    select del.Photo);
                job.Size = job.Vehicle;
                job.Date = job.BookedDate.Value.ToString("dd/MM/yyyy");
                job.Booked = DateTime.Parse(job.BookedDate.Value.ToString("yyyy-MM-dd") + " " +
                                            job.Time.Value.ToString("HH:mm:ss"));

            }

            return job;
        }

        public async Task<List<Size>> RelatedJobs(int parentId, int clientId)
        {
            var jobQuery = await (
                from j in context.TblJobs
                where (j.RootParentId == parentId && j.ClientId == clientId)
                orderby j.Date, j.Time
                select new Size()
                {
                    id = j.JobId,
                    label = j.Number
                }
            ).ToListAsync();
            return jobQuery;
        }

        public async Task<JobViewModel> BulkJobDetail(int bulkJobId)
        {
            var today = DateTime.Today.ResetTimeToStartOfDay();
            var jobQuery = (
                from j in context.TblBulkJobs
                join c in context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
                from co in courierJoin.DefaultIfEmpty()
                join t in context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
                from to in speedJoin.DefaultIfEmpty()
                join cl in context.TblClients on j.ClientId equals cl.ClientId into clientJoin
                from client in clientJoin.DefaultIfEmpty()
                join s in context.TucJobStatuses on j.JobStatus equals s.UcjsId into statusJoin
                from status in statusJoin.DefaultIfEmpty()
                join l in context.TblJobLeaveNotHomes on j.DeliverToLeaveId equals l.LeaveNotHomeId into leaveNotHomeJoin
                from leave in leaveNotHomeJoin.DefaultIfEmpty()
                join sc in context.TblBulkRunSchedules on j.ScheduleId equals sc.BulkRunScheduleId into scheduleJoin
                from schedule in scheduleJoin.DefaultIfEmpty()
                join con in context.TblContacts on j.LoggedInContactId equals con.ContactId into contactJoin
                from contact in contactJoin.DefaultIfEmpty()
                join sou in context.TucSources on j.SourceId equals sou.SourceId into sourceJoin
                from source in sourceJoin.DefaultIfEmpty()

                where (j.BulkJobId == bulkJobId)
                select new JobViewModel()
                {
                    ID = j.BulkJobId,
                    JobRelationshipTypeID = j.JobRelationshipTypeId,
                    Time = j.BookTime,
                    BookedDate = j.BookDate,
                    SizeID = j.Size,
                    Void = j.Void,
                    //PickupFrom = j.FromAddress,
                    JobNo = j.JobNumber,
                    Speed = to.ShortName,
                    SpeedName = to.UcjtName,
                    SpeedID = j.Speed,
                    Client = j.ClientCode,
                    ClientID = j.ClientId,
                    ClientName = client.Name,
                    From = j.FromSuburb,
                    fromSuburbName = j.FromSuburb,
                    FromPostCode = j.FromPostCode.ToString(),
                    FromAddress = j.FromAddress,
                    FromContactName = j.Contact,
                    To = j.ToSuburb,
                    ToSuburbName = j.ToSuburb,
                    ToPostCode = j.ToPostCode.ToString(),
                    ToAddress = j.ToAddress,
                    Courier = co.Code,
                    Status = status.UcjsCode,
                    ContactName = j.Contact,
                    Phone = j.DeliverToPhone,
                    Weight = (double?)j.Weight,
                    Items = j.Qty,
                    RefA = j.ClientRefa,
                    RefB = j.ClientRefb,
                    OurRef = j.OurRef,
                    SigNotRequired = leave.Name ?? "",
                    Charge = $"{j.Amount:C}",
                    InternalNotes = j.Notes,
                    PickUpLatitude = decimal.Parse(j.PickUpLatitude),
                    PickUpLongitude = decimal.Parse(j.PickUpLongitude),
                    DeliveryLatitude = decimal.Parse(j.DeliveryLatitude),
                    DeliveryLongitude = decimal.Parse(j.DeliveryLongitude),
                    CourierData = new CourierData()
                    {
                        Courier = co.Code + " " + co.FirstName + " " + co.Surname,
                        CourierID = co.CourierId
                    },

                    DeliverToContact = j.DeliverToContact,
                    TrackingMethod = j.TrackingMethod,
                    TrackingMobile = j.TrackingMobile,
                    TrackingEmail = j.TrackingEmail,
                    PreBook = false,
                    BulkJob = true,
                    Locked = (j.RunName ?? "").Length > 1 || j.BookDate < today,
                    RunName = j.RunName,
                    Done = j.Done,
                    ScheduleName = schedule.Name,
                    LoggedInContactName = $"{contact.Firstname} {contact.Surname ?? ""}",
                    Source = source.Name, 
                    StatusName = status.UcjsName

                });
            var jobList = await jobQuery.ToListWithNoLockAsync();
            var job = jobList.FirstOrDefault();
            if (job != null)
            {
                job.Vehicle = new Vehicle()
                {
                    id = job.Van ? (short?)Enums.Vehicle.Van : job.SizeID,
                    label = job.Van ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (job.SizeID ?? (short)2))
                };
                job.Size = job.Vehicle;
                job.Date = job.BookedDate.Value.ToString("dd/MM/yyyy");
                job.Booked = DateTime.Parse(job.BookedDate.Value.ToString("yyyy-MM-dd") + " " +
                                            job.Time.Value.ToString("HH:mm:ss"));

            }

            return job;
        }

        public async Task<Tuple<int, List<JobViewModel>>> BulkSearchAsync(Int32? courierId, string job, string wild, DateTime fromDate,
            DateTime toDate, Int32? clientId, Int32 pageIndex, Int32 pageSize)
        {
            var clientSet = clientId.HasValue;
            var courierSet = courierId.HasValue;
            var jobParam = $"%{job}%";
            var wildParam = $"%{wild}%";

            var jobsQuery = (
                from x in context.TblBulkJobs
                join c in context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
                from co in courierJoin.DefaultIfEmpty()
                
                join t in context.TucJobTypes on x.Speed equals t.UcjtId into speedJoin
                from to in speedJoin.DefaultIfEmpty()
                join s in context.TucJobStatuses on x.JobStatus equals s.UcjsId into statusJoin
                from status in statusJoin.DefaultIfEmpty()
                where (x.BookDate >= fromDate && x.BookDate <= toDate) && (!clientSet || x.ClientId == clientId) &&
                      (!courierSet || x.CourierId == courierId) &&
                      (job == "" || EF.Functions.Like(x.JobNumber.ToLower(), jobParam)) &&
                      (wild == "" || (EF.Functions.Like(x.FromAddress + " " + x.Contact + " " + x.FromSuburb + " " + x.ToAddress + " " + x.DeliverToContact + " " + x.ToSuburb + " " + (x.ClientRefa ?? "") + " " + (x.ClientRefb ?? "") + " " + (x.OurRef ?? "") + " " + x.JobNumber.ToLower(), wildParam)))
                select new JobViewModel()
                {
                    ID = x.BulkJobId,
                    Time = x.BookTime,
                    ClientID = x.ClientId,
                    Client = x.ClientCode,
                    From = x.FromSuburb,
                    //FromSuburbID = _context.,
                    To = x.ToSuburb,
                    //ToSuburbID = x.ToSuburbId,
                    JobNo = x.JobNumber,
                    FromAddress = x.FromAddress,
                    ToAddress = x.ToAddress,
                    Courier = co.Code,
                    StatusID = x.JobStatus,
                    Status = status.UcjsCode,
                    Speed = to.ShortName,
                    SpeedID = x.Speed,
                    PickUpLatitude =decimal.Parse(x.PickUpLatitude),
                    PickUpLongitude = decimal.Parse(x.PickUpLongitude),
                    DeliveryLatitude = decimal.Parse(x.DeliveryLatitude),
                    DeliveryLongitude = decimal.Parse(x.DeliveryLongitude),
                    BookedDate = x.BookDate
                    

                });
            var stopwatch = new Stopwatch();
            stopwatch.Start();
            var total = await jobsQuery.CountWithNoLockAsync();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            stopwatch.Reset();
            stopwatch.Start();
            var jobs = await jobsQuery
                .OrderBy(a => a.BookedDate).ThenBy(v => v.Time).Skip((pageIndex - 1) * pageSize).Take(pageSize).ToListWithNoLockAsync();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            stopwatch.Reset();
            stopwatch.Start();
            var jobList = jobs.Select(v => new JobViewModel()
            {
                ID = v.ID,
                Time = v.Time,
                ClientID = v.ClientID,
                Client = v.Client,
                From = v.From,
                FromSuburbID = v.FromSuburbID,
                To = v.To,
                ToSuburbID = v.ToSuburbID,
                JobNo = v.JobNo,
                FromAddress = v.FromAddress,
                ToAddress = v.ToAddress,
                Courier = v.Courier,
                StatusID = v.StatusID,
                Status = v.Status,
                Speed = v.Speed,
                PreBook = false,
                SpeedID = v.SpeedID,
                PickUpLatitude = v.PickUpLatitude,
                PickUpLongitude = v.PickUpLongitude,
                DeliveryLatitude = v.DeliveryLatitude,
                DeliveryLongitude = v.DeliveryLongitude,
                Booked = DateTime.Parse(v.BookedDate.Value.ToString("yyyy-MM-dd") + " " +
                                        v.Time.Value.ToString("HH:mm:ss"))


            }).ToList();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            return Tuple.Create(total, jobList);

        }

        public Tuple<int, List<JobViewModel>> PODSearch(Int32? courierId, string wild, string job, DateTime fromDate, DateTime toDate, Int32? clientId, Int32 pageIndex, Int32 pageSize)
        {
            var clientSet = clientId.HasValue;
            var courierSet = courierId.HasValue;
            var jobParam = $"%{job}%";
            var wildParam = $"%{wild}%";
            var jobsQuery = (
                from x in context.TblJobs
                join c in context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
                from co in courierJoin.DefaultIfEmpty()
                join y in context.TucSuburbs on x.FromSuburbId equals y.UcsuId into fromJoin
                from yo in fromJoin.DefaultIfEmpty()
                join z in context.TucSuburbs on x.ToSuburbId equals z.UcsuId into toJoin
                from zo in toJoin.DefaultIfEmpty()
                join t in context.TucJobTypes on x.Speed equals t.UcjtId into speedJoin
                from to in speedJoin.DefaultIfEmpty()
                join s in context.TucJobStatuses on x.Status equals s.UcjsId into statusJoin
                from status in statusJoin.DefaultIfEmpty()
                join nw in context.TucJobNationwides on x.JobId equals nw.UcnwJobId into nationwideJoin
                from nationwide in nationwideJoin.DefaultIfEmpty()
                where (x.Date >= fromDate && x.Date <= toDate) && (!clientSet || x.ClientId == clientId) &&
                      (!courierSet || x.CourierId == courierId) &&
                      (job == "" || EF.Functions.Like(x.Number.ToLower(), jobParam)) &&
                      (wild == "" || EF.Functions.Like(nationwide.UcnwConNote, wildParam) || (EF.Functions.Like(x.FromAddress + " " + x.PickupFromContact + " " + yo.UcsuName + " " + x.ToAddress + " " + x.DeliverToContact + " " + zo.UcsuName + " " + (x.ClientReferenceA ?? "") + " " + (x.ClientReferenceB ?? "") + " "  + (x.OurRef ?? "") + " " + x.Number.ToLower(), wildParam)))

                select new JobViewModel()
                {
                    ID = x.JobId,
                    Time = x.Time,
                    ClientID = x.ClientId,
                    Client = x.ClientCode,
                    From = yo.UcsuName,
                    FromSuburbID = x.FromSuburbId,
                    To = zo.UcsuName,
                    ToSuburbID = x.ToSuburbId,
                    JobNo = x.Number,
                    FromAddress = x.FromAddress,
                    ToAddress = x.ToAddress,
                    Courier = co.Code,
                    StatusID = x.Status,
                    Status = status.UcjsCode,
                    Speed = to.ShortName,
                    SpeedID = x.Speed,
                    PreBook = false,
                    PickUpLatitude = x.PickUpLatitude,
                    PickUpLongitude = x.PickUpLongitude,
                    DeliveryLatitude = x.DeliveryLatitude,
                    DeliveryLongitude = x.DeliveryLongitude,
                    BookedDate = x.Date


                });
            var stopwatch = new Stopwatch();
            stopwatch.Start();
            var total = jobsQuery.Count();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            stopwatch.Reset();
            stopwatch.Start();
            var jobs = jobsQuery
                .OrderBy(a => a.BookedDate).ThenBy(v=>v.Time).Skip((pageIndex - 1) * pageSize).Take(pageSize).ToList();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            stopwatch.Reset();
            stopwatch.Start();
            var jobList = jobs.Select(v => new JobViewModel()
            {
                ID = v.ID,
                Time = v.Time,
                ClientID = v.ClientID,
                Client = v.Client,
                From = v.From,
                FromSuburbID = v.FromSuburbID,
                To = v.To,
                ToSuburbID = v.ToSuburbID,
                JobNo = v.JobNo,
                FromAddress = v.FromAddress,
                ToAddress = v.ToAddress,
                Courier = v.Courier,
                StatusID = v.StatusID,
                Status = v.Status,
                Speed = v.Speed,
                SpeedID = v.SpeedID,
                PreBook = false,
                PickUpLatitude = v.PickUpLatitude,
                PickUpLongitude = v.PickUpLongitude,
                DeliveryLatitude = v.DeliveryLatitude,
                DeliveryLongitude = v.DeliveryLongitude,
                Booked = DateTime.Parse(v.BookedDate.Value.ToString("yyyy-MM-dd") + " " +
                                        v.Time.Value.ToString("HH:mm:ss"))


            }).ToList();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            return Tuple.Create(total, jobList);

        }

        public async Task<Tuple<int, List<JobViewModel>>> PreBookSearchAsync(Int32? courierId, string wild, string job, DateTime fromDate, DateTime toDate, Int32? clientId, Int32 pageIndex, Int32 pageSize)
        {
            var clientSet = clientId.HasValue;
            var courierSet = courierId.HasValue;
            var jobParam = $"%{job}%";
            var wildParam = $"%{wild}%";
            var jobsQuery = (
                from x in context.TucJobBookings
                join c in context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
                from co in courierJoin.DefaultIfEmpty()
                join y in context.TucSuburbs on x.UcbkFrom equals y.UcsuId into fromJoin
                from yo in fromJoin.DefaultIfEmpty()
                join z in context.TucSuburbs on x.UcbkTo equals z.UcsuId into toJoin
                from zo in toJoin.DefaultIfEmpty()
                join t in context.TucJobTypes on (int)x.UcbkSpeed equals t.UcjtId into speedJoin
                from to in speedJoin.DefaultIfEmpty()

                where (x.UcbkNextDue >= fromDate && x.UcbkNextDue <= toDate) && (!clientSet || x.UcbkClientId == clientId) &&
                      (!courierSet || x.CourierId == courierId) &&
                      (job == "" || EF.Functions.Like(x.UcbkJobNumber.ToLower(), jobParam)) &&
                      (wild == "" || (EF.Functions.Like(x.UcbkFromAddr + " " + x.PickupFromContact + " " + yo.UcsuName + " " + x.UcbkToAddr + " " + x.DeliverToContact + " " + zo.UcsuName + " " + (x.UcbkClientRefa ?? "") + " " + (x.UcbkClientRefa ?? "") + " " + (x.UcbkOurRef ?? "") + " " + x.UcbkJobNumber.ToLower(), wildParam)))

                select new JobViewModel()
                {
                    ID = x.UcbkId,
                    Time = x.UcbkTime,
                    ClientID = x.UcbkClientId,
                    Client = x.UcbkClientCode,
                    From = yo.UcsuName,
                    To = zo.UcsuName,
                    JobNo = x.UcbkJobNumber,
                    FromAddress = x.UcbkFromAddr,
                    ToAddress = x.UcbkToAddr,
                    Courier = co.Code,
                    Speed = to.ShortName,
                    PickUpLatitude = x.PickUpLatitude,
                    PickUpLongitude = x.PickUpLongitude,
                    DeliveryLatitude = x.DeliveryLatitude,
                    DeliveryLongitude = x.DeliveryLongitude,
                    BookedDate = x.UcbkNextDue,
                    FollowupTime = x.UcbkTime,
                    PreBook = true


                });
            var stopwatch = new Stopwatch();
            stopwatch.Start();
            var total = await jobsQuery.CountWithNoLockAsync();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            stopwatch.Reset();
            stopwatch.Start();
            var jobs = await jobsQuery
                .OrderBy(a => a.BookedDate).ThenBy(v => v.Time).Skip((pageIndex - 1) * pageSize).Take(pageSize).ToListWithNoLockAsync();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            stopwatch.Reset();
            stopwatch.Start();
            var jobList = jobs.Select(j => new JobViewModel()
            {
                
                ID = j.ID,
                Booked = DateTime.Parse(j.Booked.ToString("yyyy-MM-dd") + " " + j.Time.Value.ToString("HH:mm:ss")),
                Client = j.Client,
                FromAddress = j.FromAddress,
                ToAddress = j.ToAddress,
                JobNo = j.JobNo,
                ClientID = j.ClientID,
                Courier = j.Courier,
                Speed = j.Speed

            }).ToList();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            return Tuple.Create(total, jobList);

        }

        public async Task<List<JobViewModel>> PreBookJobList()
        {
            var jobs = await context.UvwBookingTodays
                .FromSqlRaw(
                    "SELECT * FROM uvwBookingToday WHERE ucbkDone=0  ORDER BY CONVERT(nvarchar(10), ucbkTime, 108), ucbkJobNumber")
                .ToListAsync();
            var jobList = (from j in jobs
                select new JobViewModel()
                {
                    ID = j.UcbkId,
                    Booked = DateTime.Parse(j.UcbkNextDue.Value.ToString("yyyy-MM-dd") + " " + j.UcbkTime.Value.ToString("HH:mm:ss")),
                    Client = j.UcbkClientCode,
                    FromAddress = j.UcbkFromAddr,
                    ToAddress = j.UcbkToAddr,
                    JobNo = j.UcbkJobNumber,
                    ClientID = j.UcbkClientId,
                    Courier = j.Code,
                    Speed = j.UcjtName
                }).ToList();
            return jobList;
        }

        public List<JobViewModel> CurrentJobList(Int32 courierId, bool done)
        {
            var jobs = context.DeswebQryDespatches.FromSqlRaw($"exec [DESWeb_qryCourierJobs] {courierId}, {done}").ToList();
            var list =
                (from j in jobs
                 select new JobViewModel()
                 {
                     ID = j.UcjbId,
                     RootParentID = j.RootParentId,
                     Time = j.UcjbTime,
                     Direct = j.Direct,
                     Van = j.UcjbVan,
                     VanOK = j.VanOk,
                     Truck = j.Truck,
                     SaturdayDelivery = j.SaturdayDelivery,
                     Return = j.UcjbReturn,
                     PickupFrom = j.UcjbPickUpFrom,
                     JobNo = j.UcjbNumber,
                     Speed = j.SpeedShortName,
                     SpeedName = j.SpeedName,
                     SpeedID = j.UcjbSpeed,
                     Notify = j.NotifiedSpeed,
                     NotifiedName = j.NotifiedName,
                     AcceptedJobTypeID = j.AcceptedJobTypeId,
                     AcceptedName = j.OriginalName,
                     NotifiedJobTypeID = j.NotifiedJobTypeId,
                     Vehicle = new Vehicle()
                     {
                         id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                         label = j.UcjbVan ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                     },
                     PalletInfo = (
                         from pa in  context.TucJobItems.Where(p => p.JobId == j.UcjbId)
                         select new PalletInfo()
                         {
                             ID = pa.JobId,
                             Quantity = pa.Items,
                             ItemID = pa.ItemId,
                             Weight = pa.Weight,
                             Length = pa.Length,
                             Depth = pa.Depth,
                             Height = pa.Height,
                             PU = pa.Pu,
                             DO = pa.Do,
                             DGClass = pa.Dgclass,
                             Notes = pa.Notes

                         }).ToList(),
                     //RelatedJobs = (
                     //    from rel in _context.TblJobs.Where(r => r.ParentId == j.RootParentId && r.JobId != j.RootParentId)
                     //    select new Size()
                     //    {
                     //        id = rel.JobId,
                     //        label = rel.Number
                     //    } 
                     //).ToList(),
                     Client = j.UcclCode,
                     ClientID = j.UcjbClientId,
                     ClientName = j.ClientName,
                     JobType = (int)(j.UcjbType ?? 0),
                     From = j.SuburbFrom,
                     FromSuburbID = j.FromSuburbId,
                     fromSuburbName = j.FromSuburbName,
                     FromPostCode = j.FromPostCode,
                     FromAddress = j.UcjbFromAddr,
                     FromContactName = j.PickupFromContact,
                     FromContactNumber = j.PickupFromPhone,
                     To = j.SuburbTo,
                     ToSuburbID = j.ToSuburbId,
                     ToSuburbName = j.ToSuburbName,
                     ToPostCode = j.ToPostCode,
                     ToAddress = j.UcjbToAddr,
                     ToCity = j.ToCity,
                     Courier = j.CourierCode,
                     Remain = j.RemainTime,
                     StatusID = j.UcjbStatus,
                     Status = j.UcjsCode,
                     LP = j.UcjbLatePick,
                     LD = j.UcjbLateDel,
                     ContactName = j.UcjbContact,
                     Phone = j.DeliverToPhone,
                     SpeedAccepted = j.OriginalSpeed,
                     Size = new Vehicle()
                     {
                         id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                         label = j.UcjbVan ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                     },
                     Weight = j.UcjbWeight,
                     Items = j.UcjbQty,
                     RefA = j.UcjbClientRefa,
                     RefB = j.UcjbClientRefb,
                     OurRef = j.UcjbOurRef,
                     SigNotRequired = j.SigNotRequired,
                     Charge = $"{j.UcjbAmount:C}",
                     Date = j.UcjbDate.ToString("dd/MM/yyyy"),
                     Booked = DateTime.Parse(j.UcjbDate.ToString("yyyy-MM-dd") + " " + j.UcjbTime.Value.ToString("HH:mm:ss")),
                     DispatchTime = j.UcjbDispTime,
                     PUTime = j.Putime,
                     ClientNotes = j.ClientNotes,
                     InternalNotes = j.JobNotes,
                     ChildNotes = j.ChildNotes,
                     PickUpLatitude = j.PickUpLatitude,
                     PickUpLongitude = j.PickUpLongitude,
                     DeliveryLatitude = j.DeliveryLatitude,
                     DeliveryLongitude = j.DeliveryLongitude,
                     CourierLatitude = j.CourierLatitude,
                     CourierLongitude = j.CourierLongitude,
                     RunOrder = j.PickRunOrder,
                     CourierData = new CourierData()
                     {
                         Courier = j.CourierCode + " " + j.CourierName,
                         CourierID = j.UcjbCourierId
                     },
                     AllowDispatch = j.AllowDespatch,
                     AllowSplit = j.AllowSplit,
                     DGClass = j.Dgclass,
                     DGDocumentation = j.Dgdocument,
                     DisplaySplitJobDetail = j.DisplaySplitJobDetail == 1,
                     TruckWeightLimit = j.TruckWeightLimit,
                     TruckStartTime = j.TruckStartTime,
                     TruckHours = j.TruckHours,
                     PrivateRes = ((j.DeliverToPrivateBusiness ?? 0) == 1),
                     PickupTime = j.PickupTime,
                     DeliveryTime = j.DeliveryTime,
                     AlertLatePickup = j.AlertLatePickUp,
                     AlertLateDelivery = j.AlertLateDelivery,
                     Minutes = j.Minutes,
                     DeliverToContact = j.DeliverToContact,
                     PODPhoto = j.DeliveryPhoto,
                     PODName = j.UcjbPodname,
                     CompletedTime = j.UcjbComplTime,
                     TrackingMethod = j.TrackingMethod,
                     TrackingMobile = j.TrackingMobile,
                     TrackingEmail = j.TrackingEmail,
                     UDStatus = j.Udstatus,
                     RatedManually = j.RatedManually,
                     Attention = j.UcjbAttention,
                     Pedal = j.UcjbCbd,
                     Locked = j.Locked ?? false,
                     Invoiced = false,
                     InternalStatusID = j.InternalStatus,
                     Reprice = j.Reprice,
                     FollowupTime = j.FollowupTime,
                     GstRate = j.Gstrate,
                     ScheduleName = j.ScheduleName,
                     LoggedInContactName = j.LoggedInContactName,
                     StatusName = j.StatusName

                 }).ToList();
            return list;
        }

        
        public async Task<List<JobViewModel>> JobListAsync(string status, string area, string order, string ascending, bool isInternal, string clientIds)
        {
            var orderToUse = "";
            if (isInternal == false && string.IsNullOrEmpty(clientIds))
            {
                return new List<JobViewModel>();
            }

            //ToDo verify clientids

            switch (order)
            {
                case "remain":
                    orderToUse = $"ucjbDispTime {ascending}, Remaintime {ascending}, ucjbtime {ascending}";
                    break;
                case "to":
                    orderToUse = $"SuburbTo {ascending}, ucjbTime {ascending}, SuburbFrom {ascending}, CourierCode {ascending}";
                    break;
                case "from":
                    orderToUse = $"SuburbFrom {ascending}, SuburbTo {ascending}, ucjbTime {ascending}, CourierCode {ascending}";
                    break;
                case "client":
                    orderToUse = $"ucclCode {ascending}, ucjbTime {ascending}, CourierCode {ascending}";
                    break;
                case "jobNo":
                    orderToUse = $"ucjbNumber {ascending}, ucjbTime {ascending}, CourierCode {ascending}";
                    break;
                case "status":
                    orderToUse = $"ucjbStatus {ascending}";
                    break;
                case "speed":
                    orderToUse = $"SpeedShortName {ascending}";
                    break;
                case "notify":
                    orderToUse = $"NotifiedSpeed {ascending}";
                    break;
                case "lp":
                    orderToUse = $"ucjbLatePick {ascending}";
                    break;
                case "ld":
                    orderToUse = $"ucjbLateDel {ascending}";
                    break;
                case "time":
                    orderToUse = $"ucjbTime {ascending}";
                    break;
                default:
                    orderToUse = $"RemainTime {ascending}";
                    break;
            }

            var areas = new List<string>() { "city", "truck", "main1", "main2", "central", "shore", "west", "deep shore", "shallow shore", "east mid", "deep west", "shallow west", "west mid", "other", "mangere", "deep south", "deep east", "parnell", "eden terrace", "regional" };
            var selectedAreas = area.Split(',').ToList();
            var whereToUse = "";
            if (isInternal)
            {
                var filter =
                    context.TblDespatchViews.Where(v =>
                            (v.ShowOnAssistDespatch ?? false) == true &&
                            (area != "all" && selectedAreas.Contains(v.Name)) ||
                            (area == "all" && areas.Contains(v.Name)))
                        .ToList();
                
                foreach (var w in filter)
                {
                    if (!string.IsNullOrEmpty(whereToUse))
                    {
                        whereToUse += " OR ";
                    }

                    whereToUse += $" ({w.WhereCondition}) ";
                }

                whereToUse = $"({whereToUse})";
            }

            

            if (!string.IsNullOrEmpty(whereToUse) && !string.IsNullOrEmpty(status) && status != "all")
            {
                whereToUse += " AND";
            }

            switch (status)
            {
                case "new":
                    whereToUse += " (ucjbCourierID is null OR ucjsCode = 'D' OR ucjsCode = 'N')";
                    break;
                case "nda":
                    whereToUse += " (ucjbCourierID is null OR ucjsCode = 'N' OR ucjsCode = 'D' OR ucjsCode = 'A' OR ucjsCode = 'LP' )";
                    break;
                case "active":
                    whereToUse += " ucjbJobDone = 0";
                    break;
                case "done":
                    whereToUse += " ucjbJobDone = 1";
                    break;
                case "all":
                    break;
                case "default":
                    break;
            }

            if (!string.IsNullOrEmpty(whereToUse))
            {
                whereToUse += " AND ";
            }
            whereToUse += " ucjbStatus <> 9";

            if (isInternal == false && !string.IsNullOrEmpty(clientIds))
            {


                if (!string.IsNullOrEmpty(whereToUse))
                {
                    whereToUse += " AND ";
                }

                whereToUse += $" ucjbClientID in ({clientIds})";
            }
            var s = $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {whereToUse} order by {orderToUse}";

            var jobs = await context.DeswebQryDespatches.FromSqlRaw(s).ToListWithNoLockAsync();
            //var pallets = _context.TucJobItems.ToList();


            var list = (from j in jobs
                        select new JobViewModel()
                        {
                            ID = j.UcjbId,
                            RootParentID = j.RootParentId,
                            Time = j.UcjbTime,
                            Direct = j.Direct,
                            Van = j.UcjbVan,
                            VanOK = j.VanOk,
                            Truck = j.Truck,
                            Return = j.UcjbReturn,
                            PickupFrom = j.UcjbPickUpFrom,
                            SaturdayDelivery = j.SaturdayDelivery,
                            JobNo = j.UcjbNumber,
                            Speed = j.SpeedShortName,
                            SpeedName = j.SpeedName,
                            SpeedID = j.UcjbSpeed,
                            Notify = j.NotifiedSpeed,
                            NotifiedName = j.NotifiedName,
                            AcceptedJobTypeID = j.AcceptedJobTypeId,
                            AcceptedName = j.OriginalName,
                            NotifiedJobTypeID = j.NotifiedJobTypeId,
                            Vehicle = new Vehicle()
                            {
                                id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                                label = j.UcjbVan ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                            },
                            Client = j.UcclCode,
                            ClientID = j.UcjbClientId,
                            ClientName = j.ClientName,
                            JobType = (int)(j.UcjbType ?? 0),
                            From = j.SuburbFrom,
                            FromContactName = j.PickupFromContact,
                            FromContactNumber = j.PickupFromPhone,
                            FromSuburbID = j.FromSuburbId,
                            fromSuburbName = j.FromSuburbName,
                            FromPostCode = j.FromPostCode,
                            FromAddress = j.UcjbFromAddr,
                            To = j.SuburbTo,
                            ToSuburbID = j.ToSuburbId,
                            ToSuburbName = j.ToSuburbName,
                            ToPostCode = j.ToPostCode,
                            ToAddress = j.UcjbToAddr,
                            ToCity = j.ToCity,
                            Courier = j.CourierCode,
                            Remain = j.RemainTime,
                            StatusID = j.UcjbStatus,
                            Status = j.UcjsCode,
                            LP = j.UcjbLatePick,
                            LD = j.UcjbLateDel,
                            ContactName = j.UcjbContact,
                            Phone = j.DeliverToPhone,
                            SpeedAccepted = j.OriginalSpeed,
                            Size = new Vehicle()
                            {
                                id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                                label = j.UcjbVan ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                            },
                            Weight = j.UcjbWeight,
                            Items = j.UcjbQty,
                            RefA = j.UcjbClientRefa,
                            RefB = j.UcjbClientRefb,
                            OurRef = j.UcjbOurRef,
                            SigNotRequired = j.SigNotRequired,
                            Charge = $"{j.UcjbAmount:C}",
                            Booked = DateTime.Parse(j.UcjbDate.ToString("yyyy-MM-dd") + " " + j.UcjbTime.Value.ToString("HH:mm:ss")),
                            Date = j.UcjbDate.ToString("dd/MM/yyyy"),
                            DispatchTime = j.UcjbDispTime,
                            PUTime = j.Putime,
                            ClientNotes = j.ClientNotes,
                            InternalNotes = j.JobNotes,
                            ChildNotes = j.ChildNotes,
                            PickUpLatitude = j.PickUpLatitude,
                            PickUpLongitude = j.PickUpLongitude,
                            DeliveryLatitude = j.DeliveryLatitude,
                            DeliveryLongitude = j.DeliveryLongitude,
                            PalletInfo = (
                                from pa in context.TucJobItems.Where(p => p.JobId == j.UcjbId)
                                select new PalletInfo()
                                {
                                    ID = pa.JobId,
                                    Quantity = pa.Items,
                                    ItemID = pa.ItemId,
                                    Weight = pa.Weight,
                                    Length = pa.Length,
                                    Depth = pa.Depth,
                                    Height = pa.Height,
                                    PU = pa.Pu,
                                    DO = pa.Do,
                                    DGClass = pa.Dgclass,
                                    Notes = pa.Notes

                                }).ToList(),
                            
                            CourierData = new CourierData()
                            {
                                Courier = string.IsNullOrEmpty(j.CourierCode) ? "" : j.CourierCode + " " + j.CourierName,
                                CourierID = j.UcjbCourierId
                            },
                            AllowDispatch = j.AllowDespatch,
                            AllowSplit = j.AllowSplit,
                            DGClass = j.Dgclass,
                            DGDocumentation = j.Dgdocument,
                            DisplaySplitJobDetail = j.DisplaySplitJobDetail == 1,
                            TruckWeightLimit = j.TruckWeightLimit,
                            TruckStartTime = j.TruckStartTime,
                            TruckHours = j.TruckHours,
                            PrivateRes = ((j.DeliverToPrivateBusiness ?? 0) == 1),
                            PickupTime = j.PickupTime,
                            DeliveryTime = j.DeliveryTime,
                            AlertLatePickup = j.AlertLatePickUp,
                            AlertLateDelivery = j.AlertLateDelivery,
                            Minutes = j.Minutes,
                            DeliverToContact = j.DeliverToContact,
                            PODPhoto = j.DeliveryPhoto,
                            PODName = j.UcjbPodname,
                            CompletedTime = j.UcjbComplTime.HasValue ? DateTime.Parse(j.UcjbComplTime.Value.ToString("yyyy-MM-dd") + " " + j.UcjbComplTime.Value.ToString("HH:mm")) : j.UcjbComplTime,
                            Done = j.UcjbJobDone,
                            TrackingMethod = j.TrackingMethod,
                            TrackingMobile = j.TrackingMobile,
                            TrackingEmail = j.TrackingEmail,
                            UDStatus = j.
                            Udstatus,
                            RatedManually = j.RatedManually,
                            PreBook = false,
                            Attention = j.UcjbAttention,
                            Pedal = j.UcjbCbd,
                            Locked = j.Locked ?? false,
                            Invoiced = false,
                            InternalStatusID = j.InternalStatus,
                            FollowupTime = j.FollowupTime,
                            Reprice = j.Reprice,
                            GstRate = j.Gstrate,
                            ScheduleName = j.ScheduleName,
                            LoggedInContactName = j.LoggedInContactName,
                            StatusName = j.StatusName



                        }).ToList();

            return list;

        }

        /// <summary>
        /// Main query for Nationwide job window panes. New =1, POD=2, BookDel=3, Reprice=4
        /// </summary>
        /// <param name="status"></param>
        /// <param name="area"></param>
        /// <param name="order"></param>
        /// <param name="ascending"></param>
        /// <param name="isInternal"></param>
        /// <param name="clientIds"></param>
        /// <param name="windowPane"></param>
        /// <returns></returns>
        public async Task<List<JobViewModel>> NationwideJobListAsync(string status, string area, string order, string ascending, bool isInternal, string clientIds, int windowPane)
        {
            var orderToUse = "";
            if (isInternal == false && string.IsNullOrEmpty(clientIds))
            {
                return new List<JobViewModel>();
            }

            //ToDo verify clientids

            switch (order)
            {
                case "courier":
                    orderToUse = $"Convert(int, CourierCode) {ascending}, ucjbtime {ascending}";
                    break;
                case "remain":
                    orderToUse = $"FollowupTime {ascending},  ucjbDispTime {ascending}, Remaintime {ascending}, ucjbtime {ascending}";
                    break;
                case "to":
                    orderToUse = $"SuburbTo {ascending}, ucjbTime {ascending}, SuburbFrom {ascending}, Convert(int, CourierCode) {ascending}";
                    break;
                case "from":
                    orderToUse = $"SuburbFrom {ascending}, SuburbTo {ascending}, ucjbTime {ascending}, Convert(int, CourierCode) {ascending}";
                    break;
                case "client":
                    orderToUse = $"ucclCode {ascending}, ucjbTime {ascending}, Convert(int, CourierCode) {ascending}";
                    break;
                case "jobNo":
                    orderToUse = $"ucjbNumber {ascending}, ucjbTime {ascending}, Convert(int, CourierCode) {ascending}";
                    break;
                case "status":
                    orderToUse = $"ucjbStatus {ascending}";
                    break;
                case "speed":
                    orderToUse = $"SpeedShortName {ascending}";
                    break;
                case "notify":
                    orderToUse = $"NotifiedSpeed {ascending}";
                    break;
                case "lp":
                    orderToUse = $"ucjbLatePick {ascending}";
                    break;
                case "ld":
                    orderToUse = $"ucjbLateDel {ascending}";
                    break;
                case "time":
                    orderToUse = $"ucjbTime {ascending}, Convert(int,CourierCode) {ascending}";
                    break;
                case "pod":
                    orderToUse = $"ucjbPODName {ascending}, Convert(int, CourierCode) {ascending}";
                    break;
                default:
                    orderToUse = $"FollowupTime {ascending}, ucjbDispTime {ascending}, ucjbTime {ascending}, Convert(int, CourierCode) {ascending}";
                    break;
            }

            var selectedAreas = area.Split(',').ToList();

           
            var whereToUse = "";
            List<int> selectedViews = new List<int>();
            foreach (var a in selectedAreas)
            {
                switch (a)
                {
                    case "mainfu":
                        selectedViews.AddRange(new List<int>(){ 11, 15, 3, 4, 18, 19 });
                        break;
                    case "nwakl":
                        selectedViews.Add(17);
                        break;
                    case "baggage":
                        selectedViews.Add(20);
                        break;
                    case "chch":
                        selectedViews.Add(4);
                        break;
                    case "int":
                        selectedViews.Add(15);
                        break;
                    case "nwother":
                        selectedViews.Add(18);
                        break;
                    case "sameday":
                        selectedViews.Add(11);
                        break;
                    case "wlg":
                        selectedViews.Add(3);
                        break;

                }
            }
           

            if (isInternal)
            {
                var filter =
                    context.TblDespatchViews.Where(v =>
                            (v.ShowOnJobFollowup ?? false) == true &&
                            (selectedViews.Contains(v.DespatchViewId)))
                        .ToList();

                foreach (var w in filter)
                {
                    if (!string.IsNullOrEmpty(whereToUse))
                    {
                        whereToUse += " OR ";
                    }

                    whereToUse += $" ({w.WhereCondition}) ";
                }

                whereToUse = $"({whereToUse})";
            }



            if (!string.IsNullOrEmpty(whereToUse) && !string.IsNullOrEmpty(status))
            {
                whereToUse += " AND ";
            }

            switch (status)
            {
                case "all":
                    whereToUse += windowPane == 4 ? " Reprice = 1" : " ucjbJobDone = 0";
                    break;
                case "active":
                    switch (windowPane)
                    {
                        case 1:
                            whereToUse += " ucjbJobDone = 0";
                            break;
                        case 2:
                            whereToUse += " ucjbJobDone = 0 AND FollowupTime < GETDATE()";
                            break;
                        case 3:
                            whereToUse += " ucjbJobDone = 0 AND FollowupTime < GETDATE()";
                            break;
                        case 4:
                            whereToUse += " Reprice = 1";
                            break;
                    }
                    
                    break;
                case "done":
                    whereToUse += windowPane == 4 ? " Reprice = 1" : " ucjbJobDone = 1";
                    break;
                
                case "default":
                    break;
            }

            if (!string.IsNullOrEmpty(whereToUse))
            {
                whereToUse += " AND ";
            }

            switch (windowPane)
            {
                case 1:
                    whereToUse += " (InternalStatus = 1 OR (InternalStatus is Null AND ucjbStatus <> 9))";
                    break;
                case 2:
                    whereToUse += " (InternalStatus = 3 OR ucjbStatus = 9)";
                    break;
                case 3:
                    whereToUse += " (InternalStatus = 2)";
                    break;
                case 4:
                    whereToUse += " (ucjbStatus = 6)";
                    break;


            }

            

            if (isInternal == false && !string.IsNullOrEmpty(clientIds))
            {


                if (!string.IsNullOrEmpty(whereToUse))
                {
                    whereToUse += " AND ";
                }

                whereToUse += $" ucjbClientID in ({clientIds})";
            }
            var s = $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {whereToUse} order by {orderToUse}";

            var jobs = await context.DeswebQryDespatches.FromSqlRaw(s).ToListWithNoLockAsync();
            var pallets = context.TucJobItems.ToList();


            var list = (from j in jobs
                        select new JobViewModel()
                        {
                            ID = j.UcjbId,
                            Time = j.UcjbTime,
                            Direct = j.Direct,
                            Van = j.UcjbVan,
                            VanOK = j.VanOk,
                            Truck = j.Truck,
                            Return = j.UcjbReturn,
                            PickupFrom = j.UcjbPickUpFrom,
                            SaturdayDelivery = j.SaturdayDelivery,
                            JobNo = j.UcjbNumber,
                            Speed = j.SpeedShortName,
                            SpeedName = j.SpeedName,
                            NotifiedName = j.NotifiedName,
                            AcceptedName = j.OriginalName,
                            SpeedID = j.UcjbSpeed,
                            Notify = j.NotifiedSpeed,
                            AcceptedJobTypeID = j.AcceptedJobTypeId,
                            NotifiedJobTypeID = j.NotifiedJobTypeId,
                            Vehicle = new Vehicle()
                            {
                                id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                                label = j.UcjbVan ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                            },
                            Client = j.UcclCode,
                            ClientID = j.UcjbClientId,
                            ClientName = j.ClientName,
                            JobType = (int)(j.UcjbType ?? 0),
                            From = j.SuburbFrom,
                            FromContactName = j.PickupFromContact,
                            FromContactNumber = j.PickupFromPhone,
                            FromSuburbID = j.FromSuburbId,
                            fromSuburbName = j.FromSuburbName,
                            FromPostCode = j.FromPostCode,
                            FromAddress = j.UcjbFromAddr,
                            To = j.SuburbTo,
                            ToSuburbID = j.ToSuburbId,
                            ToSuburbName = j.ToSuburbName,
                            ToPostCode = j.ToPostCode,
                            ToAddress = j.UcjbToAddr,
                            ToCity = j.ToCity,
                            Courier = j.CourierCode,
                            Remain = j.RemainTime,
                            StatusID = j.UcjbStatus,
                            Status = j.UcjsCode,
                            LP = j.UcjbLatePick,
                            LD = j.UcjbLateDel,
                            ContactName = j.UcjbContact,
                            Phone = j.DeliverToPhone,
                            SpeedAccepted = j.OriginalSpeed,
                            Size = new Vehicle()
                            {
                                id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                                label = j.UcjbVan ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                            },
                            Weight = j.UcjbWeight,
                            Items = j.UcjbQty,
                            RefA = j.UcjbClientRefa,
                            RefB = j.UcjbClientRefb,
                            OurRef = j.UcjbOurRef,
                            SigNotRequired = j.SigNotRequired,
                            Charge = $"{j.UcjbAmount:C}",
                            Booked = DateTime.Parse(j.UcjbDate.ToString("yyyy-MM-dd") + " " + j.UcjbTime.Value.ToString("HH:mm:ss")),
                            Date = j.UcjbDate.ToString("dd/MM/yyyy"),
                            DispatchTime = j.UcjbDispTime,
                            PUTime = j.Putime,
                            ClientNotes = j.ClientNotes,
                            InternalNotes = j.JobNotes,
                            ChildNotes = j.ChildNotes,
                            PickUpLatitude = j.PickUpLatitude,
                            PickUpLongitude = j.PickUpLongitude,
                            DeliveryLatitude = j.DeliveryLatitude,
                            DeliveryLongitude = j.DeliveryLongitude,
                            PalletInfo = (
                                from pa in pallets.Where(p => p.JobId == j.UcjbId)
                                select new PalletInfo()
                                {
                                    ID = pa.JobId,
                                    Quantity = pa.Items,
                                    ItemID = pa.ItemId,
                                    Weight = pa.Weight,
                                    Length = pa.Length,
                                    Depth = pa.Depth,
                                    Height = pa.Height,
                                    PU = pa.Pu,
                                    DO = pa.Do,
                                    DGClass = pa.Dgclass,
                                    Notes = pa.Notes

                                }).ToList(),
                            CourierData = new CourierData()
                            {
                                Courier = string.IsNullOrEmpty(j.CourierCode) ? "" : j.CourierCode + " " + j.CourierName,
                                CourierID = j.UcjbCourierId
                            },
                            AllowDispatch = j.AllowDespatch,
                            AllowSplit = j.AllowSplit,
                            DGClass = j.Dgclass,
                            DGDocumentation = j.Dgdocument,
                            DisplaySplitJobDetail = j.DisplaySplitJobDetail == 1,
                            TruckWeightLimit = j.TruckWeightLimit,
                            TruckStartTime = j.TruckStartTime,
                            TruckHours = j.TruckHours,
                            PrivateRes = ((j.DeliverToPrivateBusiness ?? 0) == 1),
                            PickupTime = j.PickupTime,
                            DeliveryTime = j.DeliveryTime,
                            AlertLatePickup = j.AlertLatePickUp,
                            AlertLateDelivery = j.AlertLateDelivery,
                            Minutes = j.Minutes,
                            DeliverToContact = j.DeliverToContact,
                            PODPhoto = j.DeliveryPhoto,
                            PODName = j.UcjbPodname,
                            CompletedTime = j.UcjbComplTime.HasValue ? DateTime.Parse(j.UcjbComplTime.Value.ToString("yyyy-MM-dd") + " " + j.UcjbComplTime.Value.ToString("HH:mm")) : j.UcjbComplTime,
                            Done = j.UcjbJobDone,
                            TrackingMethod = j.TrackingMethod,
                            TrackingMobile = j.TrackingMobile,
                            TrackingEmail = j.TrackingEmail,
                            UDStatus = j.
                            Udstatus,
                            RatedManually = j.RatedManually,
                            PreBook = false,
                            Attention = j.UcjbAttention,
                            Pedal = j.UcjbCbd,
                            Locked = j.Locked ?? false,
                            Invoiced = false,
                            InternalStatusID = j.InternalStatus,
                            Reprice = j.Reprice,
                            FollowupTime = j.FollowupTime,
                            RootParentID = j.RootParentId,
                            ScheduleName = j.ScheduleName,
                            ConNote = j.ConNote,
                            AirportOnly =j.AirportOnly,
                            HasNationwide = j.HasNationwide.HasValue,
                            LoggedInContactName = j.LoggedInContactName, 
                            StatusName = j.StatusName


                        }).ToList();

            return list;

        }


        public async Task<List<SupportViewModel>> SupportEvents(string channel)
        {
            var whereToUse = "";
            var orderToUse = "CASE WHEN ucevType = 1 THEN 1 WHEN ucevType = 2 THEN 2 ELSE 0 END, ucevTime";

            var channelItems = channel.Split(',');

            if (channelItems.Length == 3)
            {
                channel = "All";
            }
            else
            {
                foreach (var ch in channelItems)
                {
                    switch (ch)
                    {
                        case "Main":
                            var main = "(RemoteJob = 0 AND (RegionFromID = 2 OR RegionFromID = 3 Or RegionFromID = 10) AND (RegionToID = 1 OR RegionToID = 4 OR RegionToID = 10 OR (RegionToID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39,53,54))) or ((RegionFromID = 2 OR RegionFromID = 3) AND (RegionToID = 2 OR RegionToID = 3) And ucjbVan=1) AND (IsParentJob = 0) AND (Truck = 0 OR Truck is NULL OR (Truck = 1 AND VanOK = 1))) or (RemoteJob = 0 AND (RegionFromID = 4 OR RegionFromID = 10 OR (RegionFromID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39,53,54))) AND   (RegionToID < 5 OR RegionToID = 10 OR (RegionToID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39))) AND  NOT (RegionFromID = 10 AND (RegionToID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39))) AND (IsParentJob = 0) AND (Truck = 0 OR Truck is NULL OR (Truck = 1 AND VanOK = 1))) ";
                            if (string.IsNullOrEmpty(whereToUse))
                            {
                                whereToUse = main;
                            }
                            else
                            {
                                whereToUse += (" OR " + main);
                            }

                            break;
                        case "City":
                            var city = "((RemoteJob = 0 AND (RegionFromID = 2 OR RegionFromID = 3 Or RegionFromID = 10) AND (RegionToID = 2 OR RegionToID = 3 Or RegionToID = 10)) AND (IsParentJob = 0) AND (Truck = 0 OR Truck is NULL OR (Truck = 1 AND VanOK = 1))) or (RemoteJob = 0 AND RegionFromID = 3  AND RegionToID = 3  AND ucjbSize in(0,1) AND (Truck = 0 OR Truck is NULL))";
                            if (string.IsNullOrEmpty(whereToUse))
                            {
                                whereToUse = city;
                            }
                            else
                            {
                                whereToUse += (" OR " + city);
                            }
                            break;
                        case "Trucks":
                            var trucks = "(ucjbSpeed IN (45,109) OR Truck = 1) AND IsParentJob = 0";
                            if (string.IsNullOrEmpty(whereToUse))
                            {
                                whereToUse = trucks;
                            }
                            else
                            {
                                whereToUse += (" OR " + trucks);
                            }
                            break;
                        case "All":
                            break;
                    }
                }
            }

            

            var s = channel == "All" ? $"select * from DES_qrySupportEvents_CustomerAndCourier order by {orderToUse}" : $"select * from DES_qrySupportEvents_CustomerAndCourier where {whereToUse} order by {orderToUse}";

            var events = context.DesQrySupportEventsCustomerAndCouriers.FromSqlRaw(s).ToList();
            var evm = (from e in events
                       select new SupportViewModel()
                       {
                           EventType = e.UcevType,
                           Courier = e.Code,
                           Description = e.EventDescription,
                           JobNumber = e.UcevJobNumber,
                           LockedBy = e.UcevDespatcher,
                           Notes = e.UcevNotes,
                           RemainTime = e.RemainTime,
                           Staff = e.UcstWindowsLogonName,
                           TimeStamp = e.UcevTime,
                           JobId = e.UcevJobId,
                           EventId = e.UcevId
                       }).ToList();
            return evm;
        }

        public async Task<TucEvent> GetSupportEvent(int id)
        {
            var support = await context.TucEvents.FindAsync(id);
            return support;
        }

        public async Task<int> UpdateSupportEvent(TucEvent supportEvent)
        {
            context.Entry(supportEvent).State = EntityState.Modified;
            return await context.SaveChangesAsync();
        }

        public async Task CloseSupportEvent(int supportId, int staffId)
        {
            await context.LoadStoredProc("uspCompleteEvent")
                .WithSqlParam("@intEventID", supportId)
                .WithSqlParam("@intStaffID", staffId)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task DispatchSelectedJobs(int courierId, int dispId, string jobIds)
        {
            await context.LoadStoredProc("DESWEB_stpJob_AutoDespatchSelectedJobs")
              .WithSqlParam("@JobIDs", jobIds)
              .WithSqlParam("@CourierID", courierId)
              .WithSqlParam("@DispID", dispId)
              .ExecuteStoredNonQueryAsync();

            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {

                await context.LoadStoredProc("DES_stpJob_AutoDespatchChildJobs")
                .WithSqlParam("@JobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();

            }

        }

        public async Task SwapPOD(string job1, string job2)
        {
            await context.LoadStoredProc("DESWEB_qdfSwapPOD")
                .WithSqlParam("@ucjbNumber1", job1)
                .WithSqlParam("@ucjbNumber2", job2)
                .ExecuteStoredNonQueryAsync();


        }

        public async Task ReDispatchSelectedJobs(int courierId, int dispId, string jobIds)
        {

            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {

                await context.LoadStoredProc("uspRestoreJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();

            }

            await DispatchSelectedJobs(courierId, dispId, jobIds);
        }

        public async Task ReSendSelectedJobs(string jobIds)
        {

            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {

                await context.LoadStoredProc("uspReDespatchJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();

            }


        }

        public async Task< List<BulkScanDetail>> ScanList(DateTime? runDate, string scan)
        {
            var cmd = context.LoadStoredProc("DESWeb_stpScanDetail")
                .WithSqlParam("@RunDate", runDate)
                .WithSqlParam("@Scan", scan);
            var scans = new List<BulkScanDetail>();

            await cmd.ExecuteStoredProcAsync(h => { scans = h.ReadToList<BulkScanDetail>().ToList(); });
            return scans;
        }

        public async Task ReAssignSelectedJobs(string jobIds)
        {

            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {

                await context.LoadStoredProc("uspReassignJob")
                    .WithSqlParam("@intJobID", int.Parse(jid))
                    .ExecuteStoredNonQueryAsync();

            }


        }

        public async Task SetFirstJob(int jobId, int courierId)
        {
            await context.LoadStoredProc("DES_stpJob_AutoDespatchSelectedJobs_FSCourierID")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@CourierID", courierId)
                .ExecuteStoredNonQueryAsync();

        }


        public async Task TransferJob(int jobId, int courierId, int dispId)
        {
            await context.LoadStoredProc("DESWEB_stpJob_TransferJob")
                    .WithSqlParam("@JobID", jobId)
                    .WithSqlParam("@CourierID", courierId)
                    .WithSqlParam("@DispID", dispId)
                    .ExecuteStoredNonQueryAsync();

        }

        public async Task UpdatePODDetails(string jobNumber, int jobStatus, string podName, DateTime podTime )
        {
            await context.LoadStoredProc("DESWEB_qdfJob_UpdatePODDetails")
                .WithSqlParam("@ucjbNumber", jobNumber)
                .WithSqlParam("@ucjbJobDone", true)
                .WithSqlParam("@ucjbStatus", jobStatus)
                .WithSqlParam("@ucjbPODName", podName)
                .WithSqlParam("@ucjbComplTime", podTime)
                .ExecuteStoredNonQueryAsync();

        }

        public async Task ReSendAllJobs(int courierId)
        {
            await context.LoadStoredProc("uspReDespatchJobByCourierID")
                .WithSqlParam("@CourierID", courierId)
                .ExecuteStoredNonQueryAsync();

        }


        public async Task<int> MaxAutoLatePickupAlert()
        {
            DbParameter outputMaxParam = null;
            await context.LoadStoredProc("GEN_qdfSetting_GetMaxAutoLatePickupAlert")
             .WithSqlParam("@MaxAutoLatePickupAlert", (dbParam) =>
             {
                 dbParam.Direction = System.Data.ParameterDirection.Output;
                 dbParam.DbType = System.Data.DbType.Int32;
                 outputMaxParam = dbParam;
             })

             .ExecuteStoredNonQueryAsync();

            return (Int32)outputMaxParam.Value;
        }

        public async Task<int> MaxAutoLateDeliveryAlert()
        {
            DbParameter outputMaxParam = null;
            await context.LoadStoredProc("GEN_qdfSetting_GetMaxAutoLateDeliveryAlert")
             .WithSqlParam("@MaxAutoLateDeliveryAlert", (dbParam) =>
             {
                 dbParam.Direction = System.Data.ParameterDirection.Output;
                 dbParam.DbType = System.Data.DbType.Int32;
                 outputMaxParam = dbParam;
             })

             .ExecuteStoredNonQueryAsync();

            return (Int32)outputMaxParam.Value;
        }

        public async Task<decimal> PPDExclusiveAmount(int clientId, decimal amount)
        {
            DbParameter outputMaxParam = null;
            await context.LoadStoredProc("UTL_stpPPD_ExclusiveAmount")
                .WithSqlParam("@ClientID", clientId)
                .WithSqlParam("@Amount", amount)
                .WithSqlParam("@PPD", (dbParam) =>
                {
                    dbParam.Direction = System.Data.ParameterDirection.Output;
                    dbParam.DbType = System.Data.DbType.Currency;
                    outputMaxParam = dbParam;
                })

                .ExecuteStoredNonQueryAsync();

            return (decimal)outputMaxParam.Value;
        }

        public async Task<decimal> PPDInclusiveAmount(int clientId, decimal amount)
        {
            DbParameter outputMaxParam = null;
            await context.LoadStoredProc("UTL_stpPPD_ExclusiveAmount")
                .WithSqlParam("@ClientID", clientId)
                .WithSqlParam("@Amount", amount)
                .WithSqlParam("@PPD", (dbParam) =>
                {
                    dbParam.Direction = System.Data.ParameterDirection.Output;
                    dbParam.DbType = System.Data.DbType.Currency;
                    outputMaxParam = dbParam;
                })

                .ExecuteStoredNonQueryAsync();

            return (decimal)outputMaxParam.Value;
        }


        public async Task<decimal> FuelSurchargeInclusiveAmount(int clientId, decimal amount, int from, int to, DateTime booked, int size)
        {
            DbParameter outputMaxParam = null;
            await context.LoadStoredProc("UTL_stpFuelSurcharge_InclusiveAmount")
                .WithSqlParam("@ClientID", clientId)
                .WithSqlParam("@Date", booked)
                .WithSqlParam("@Size", size)
                .WithSqlParam("@Amount", amount)
                .WithSqlParam("@FromSuburbID", from)
                .WithSqlParam("@ToSuburbID", to)
                .WithSqlParam("@FuelSurcharge", (dbParam) =>
                {
                    dbParam.Direction = System.Data.ParameterDirection.Output;
                    dbParam.DbType = System.Data.DbType.Currency;
                    outputMaxParam = dbParam;
                })

                .ExecuteStoredNonQueryAsync();

            return (decimal)outputMaxParam.Value;
        }


        public async Task ResetLateEvent(int jobId, int eventType)
        {
            await context.LoadStoredProc("DESWEB_qdfLateCall_Reset")
              .WithSqlParam("@JobID", jobId)
              .WithSqlParam("@Type", eventType)
              .ExecuteStoredNonQueryAsync();
        }

        public async Task LatePickup(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher, bool calculationRequired)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateJobPickupLateCall")
              .WithSqlParam("@JobID", jobId)
              .WithSqlParam("@BookedSpeed", bookedSpeed)
              .WithSqlParam("@NotifiedSpeed", notifiedSpeed)
              .WithSqlParam("@Late", late)
              .WithSqlParam("@Despatcher", despatcher)
              .WithSqlParam("@CalculationRequired", calculationRequired)
              .ExecuteStoredNonQueryAsync();
        }

        public async Task LateDelivery(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher, bool calculationRequired)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateJobDeliveryLateCall")
              .WithSqlParam("@JobID", jobId)
              .WithSqlParam("@BookedSpeed", bookedSpeed)
              .WithSqlParam("@NotifiedSpeed", notifiedSpeed)
              .WithSqlParam("@Late", late)
              .WithSqlParam("@Despatcher", despatcher)
              .WithSqlParam("@CalculationRequired", calculationRequired)
              .ExecuteStoredNonQueryAsync();
        }

        public async Task RestoreSplitJobs(string jobIds)
        {
            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {
                await context.LoadStoredProc("DES_stpJob_SplitJobRestore")
                .WithSqlParam("@JobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
            }
        }

        public async Task RestoreJobs(string jobIds)
        {
            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {
                await context.LoadStoredProc("uspRestoreJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
            }
        }

        public async Task MessageCourier(int courierId, int dispId, string despatcher, string message)
        {
            await context.LoadStoredProc("DES_stpManualMessage_Insert")
                .WithSqlParam("@SendToID", courierId)
                .WithSqlParam("@StaffID", dispId)
                .WithSqlParam("@WindowsUser", despatcher)
                .WithSqlParam("@Message", message)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task VoidJob(int jobId)
        {
            await context.LoadStoredProc("DES_stpJob_Void")
                .WithSqlParam("@JobID", jobId)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task SplitJob(int jobId, string user)
        {
            await context.LoadStoredProc("DES_stpJob_SplitJob")
               .WithSqlParam("@JobID", jobId)
               .WithSqlParam("@PreBookJob", false)
               .WithSqlParam("@UserName", user)
               .ExecuteStoredNonQueryAsync();
        }

        public async Task<string> UnSplitJob(int jobId)
        {
            DbParameter messageOutput = null;
            await context.LoadStoredProc("DES_stpJob_UnSplit")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@Message", (dbParam) =>
                {
                    dbParam.Direction = System.Data.ParameterDirection.Output;
                    dbParam.DbType = System.Data.DbType.String;
                    dbParam.Size = 4000;
                    messageOutput = dbParam;
                })
                .ExecuteStoredNonQueryAsync();
            return (string)messageOutput.Value;
        }

        public async Task UpdateSplitJobAddress(int jobId, int toSuburbId, string address, decimal deliveryLat, decimal deliveryLng)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateSplitJobMeetingAddress")
               .WithSqlParam("@JobID", jobId)
               .WithSqlParam("@Suburb", toSuburbId)
               .WithSqlParam("@Address", address)
               .WithSqlParam("@DeliveryLatitude", deliveryLat)
               .WithSqlParam("@DeliveryLongitude", deliveryLng)
               .ExecuteStoredNonQueryAsync();
        }

        public async Task ReRateSplitJob(int jobId)
        {
            await context.LoadStoredProc("DES_stpJob_SplitJob_ReRate")
               .WithSqlParam("@ParentJobID", jobId)
               .WithSqlParam("@PreBookJob", false)
               .ExecuteStoredNonQueryAsync();
        }

        public async Task FinishSplitJobProcess(int jobId, string despatcher)
        {
            await context.LoadStoredProc("DES_stpJob_ColsolidateMarsInformation")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@Consolidate", false)
                .WithSqlParam("@UserName", despatcher)
                .ExecuteStoredNonQueryAsync();

            await context.LoadStoredProc("DES_stpJob_DisplayInDespatch")
                .WithSqlParam("@JobID", jobId)
                .ExecuteStoredNonQueryAsync();
        }

        public List<SuburbLookup> Suburbs()
        {
            var data = (from s in context.TucSuburbs
                        select s).Select(x => new SuburbLookup() { ID = x.UcsuId, Text = x.UcsuName, Alias = x.GoogleSuburbAlias });
            return data.ToList();
        }

        public List<Lookup> Speeds()
        {
            var data = (from s in context.DesQryAllJobTypes
                        select s).Select(x => new Lookup() { ID = x.JobTypeId, Text = x.Name });
            return data.ToList();
        }

        public List<Lookup> Contacts(int clientId)
        {
            var data = (from s in context.UtlQryContactLookups
                join cc in context.TblClientContacts on s.ContactId equals cc.ContactId into cjoin
                from co in cjoin
                where co.ClientId == clientId && s.Active == true
                select new Lookup() { ID = s.ContactId, Text = s.Name}).Distinct();
            return data.ToList();
        }

        public Task<List<ClientContactDetailViewModel>> ContactDetailList(int clientId)
        {
            var data = (from s in context.UtlQryContactLookups
                join cc in context.TblClientContacts on s.ContactId equals cc.ContactId into cjoin
                from co in cjoin
                where co.ClientId == clientId && s.Active == true
                select new ClientContactDetailViewModel() { ID = s.ContactId, FullName = $"{s.Firstname} {s.Surname}", Mobile = s.Mobile, DirectDial = s.DirectDial, Email = s.Email, JobTitle = s.JobTitle}).Distinct();
            return data.ToListAsync();
        }


        public List<Lookup> LeaveParcelLocations()
        {
            var data = (from l in context.TblJobLeaveNotHomes
                orderby l.Sequence
                select l).Select(x => new Lookup() { ID=x.LeaveNotHomeId, Text = x.Name});
            return data.ToList();
        }

        public List<UndeliverableLocation> UndeliverableLocations()
        {
            var data = (from u in context.TblUndeliverableLocations
                orderby u.Name
                select u).Select(x => new UndeliverableLocation() { ID = x.UndeliverableLocationId, Text = x.Name, JobStatusId =x.JobTypeId });
            return data.ToList();
        }

        public List<InternalStatus> InternalStatusList()
        {
            var data = (from u in context.TucJobInternalStatuses
                orderby u.Tcis
                select u).Select(x => new InternalStatus() { ID = x.Tcis, Text = x.TcisName, DefaultSchedule = x.DefaultSchedule, DefaultMins = x.DefaultMinutes});
            return data.ToList();
        }

        public List<Lookup> EventTypeList()
        {
            var data = (from u in context.TucEventTypes
                        where u.UcetGroup == "CS" || u.UcetGroup == "GE"
                        orderby u.UcetName
                        select u).Select(x => new Lookup() { ID = x.UcetId, Text = x.UcetName});
            return data.ToList();
        }


        public async Task<decimal> RateTruckJob(int clientId, int fromId, int toId, double weight, int size, int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
                                                int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours)
        {
            DbParameter outputDescriptionParam = null;
            DbParameter outputRateParam = null;

            await context.LoadStoredProc("DES_stpJob_Truck_Rate_Described")
               .WithSqlParam("@ClientID", clientId)
               .WithSqlParam("@FromSuburbID", fromId)
               .WithSqlParam("@ToSuburbID", toId)
               .WithSqlParam("@AverageWeight", weight)
               .WithSqlParam("@Size", size)
               .WithSqlParam("@Speed", speed)
               .WithSqlParam("@Quantity", qty)
               .WithSqlParam("@Booked", bookedDate)
               .WithSqlParam("@Pickup", pickUp)
               .WithSqlParam("@Dropoff", dropOff)
               .WithSqlParam("@PrivateRes", privateRes)
               .WithSqlParam("@OversizeItems", oversizeItems)
               .WithSqlParam("@OverWeightItems", overWeightItems)
               .WithSqlParam("@DangerousGoods", dGClass)
               .WithSqlParam("@TruckStartTime", truckStartTime)
               .WithSqlParam("@TruckHours", truckHours)
               .WithSqlParam("@Description", (dbParam) =>
               {
                   dbParam.Direction = System.Data.ParameterDirection.Output;
                   dbParam.DbType = System.Data.DbType.String;
                   dbParam.Size = 1000;
                   outputDescriptionParam = dbParam;
               })
               .WithSqlParam("@Rate", (dbParam) =>
               {
                   dbParam.Direction = System.Data.ParameterDirection.Output;
                   dbParam.DbType = System.Data.DbType.Currency;
                   outputRateParam = dbParam;
               })
               .ExecuteStoredNonQueryAsync();

            return (decimal)outputRateParam.Value;

        }

        public async Task<string> RateTruckJobDescription(int clientId, int fromId, int toId, double weight, int size, int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
                                                int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours)
        {
            DbParameter outputDescriptionParam = null;
            DbParameter outputRateParam = null;

            await context.LoadStoredProc("DES_stpJob_Truck_Rate_Described")
               .WithSqlParam("@ClientID", clientId)
               .WithSqlParam("@FromSuburbID", fromId)
               .WithSqlParam("@ToSuburbID", toId)
               .WithSqlParam("@AverageWeight", weight)
               .WithSqlParam("@Size", size)
               .WithSqlParam("@Speed", speed)
               .WithSqlParam("@Quantity", qty)
               .WithSqlParam("@Booked", bookedDate)
               .WithSqlParam("@Pickup", pickUp)
               .WithSqlParam("@Dropoff", dropOff)
               .WithSqlParam("@PrivateRes", privateRes)
               .WithSqlParam("@OversizeItems", oversizeItems)
               .WithSqlParam("@OverWeightItems", overWeightItems)
               .WithSqlParam("@DangerousGoods", dGClass)
               .WithSqlParam("@TruckStartTime", truckStartTime)
               .WithSqlParam("@TruckHours", truckHours)
               .WithSqlParam("@Description", (dbParam) =>
               {
                   dbParam.Direction = System.Data.ParameterDirection.Output;
                   dbParam.DbType = System.Data.DbType.String;
                   dbParam.Size = 1000;
                   outputDescriptionParam = dbParam;
               })
               .WithSqlParam("@Rate", (dbParam) =>
               {
                   dbParam.Direction = System.Data.ParameterDirection.Output;
                   dbParam.DbType = System.Data.DbType.Currency;
                   outputRateParam = dbParam;
               })
               .ExecuteStoredNonQueryAsync();

            return (string)outputDescriptionParam.Value;

        }

        public async Task<decimal> RateJob(int clientId, int fromId, int toId, int speed, bool pedal, bool van, bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
                                            string ourRef, string refA, string refB, int quantity, DateTime booked)
        {
            DbParameter outputRateParam = null;

            await context.LoadStoredProc("sp_RateJob2")
               .WithSqlParam("@intClientID", clientId)
               .WithSqlParam("@intFromID", fromId)
               .WithSqlParam("@intToID", toId)
               .WithSqlParam("@intSpeed", speed)
               .WithSqlParam("@bolPedal", pedal)
               .WithSqlParam("@bolVan", van)
               .WithSqlParam("@bolReturn", returnJob)
               .WithSqlParam("@intWeight", weight)
               .WithSqlParam("@curAmount", (dbParam) =>
               {
                   dbParam.Direction = System.Data.ParameterDirection.Output;
                   dbParam.DbType = System.Data.DbType.Currency;
                   outputRateParam = dbParam;
               })
               .WithSqlParam("@Size", size)
               .WithSqlParam("@IncludeFuelSurcharge", includeFuelSurcharge)
               .WithSqlParam("@OurRef", ourRef)
               .WithSqlParam("@ClientRefA", refA)
               .WithSqlParam("@ClientRefB", refB)
               .WithSqlParam("@Quantity", quantity)
               .WithSqlParam("@Booked", booked)

               .ExecuteStoredNonQueryAsync();

            return (decimal)outputRateParam.Value;
        }

        public async Task<string> RateJobDescription(int clientId, int fromId, int toId, int speed, bool pedal, bool van, bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
            string ourRef, string refA, string refB, int quantity, DateTime booked)
        {
            DbParameter outputDescriptionParam = null;
            DbParameter outputCourierParam = null;

            await context.LoadStoredProc("sp_RateJob_Described")
                .WithSqlParam("@intClientID", clientId)
                .WithSqlParam("@intFromID", fromId)
                .WithSqlParam("@intToID", toId)
                .WithSqlParam("@intSpeed", direct? acceptedJobTypeId : speed)
                .WithSqlParam("@bolPedal", pedal)
                .WithSqlParam("@bolVan", van)
                .WithSqlParam("@bolReturn", returnJob)
                .WithSqlParam("@intWeight", weight)
                .WithSqlParam("@strDescription", (dbParam) =>
               {
                   dbParam.Direction = System.Data.ParameterDirection.Output;
                   dbParam.DbType = System.Data.DbType.String;
                   dbParam.Size = 1000;
                   outputDescriptionParam = dbParam;
               })
                .WithSqlParam("@Size", size)
                .WithSqlParam("@IncludeFuelSurcharge", includeFuelSurcharge)
                .WithSqlParam("@OurRef", ourRef)
                .WithSqlParam("@ClientRefA", refA)
                .WithSqlParam("@ClientRefB", refB)
                .WithSqlParam("@Quantity", quantity)
                .WithSqlParam("@Booked", booked)
                .WithSqlParam("@CourierID", (dbParam) =>
                {
                    dbParam.Direction = System.Data.ParameterDirection.Output;
                    dbParam.DbType = System.Data.DbType.Int32;
                    outputCourierParam = dbParam;
                })


                .ExecuteStoredNonQueryAsync();

            return (string)(outputDescriptionParam.Value == DBNull.Value ? "" : outputDescriptionParam.Value);
        }

        public async Task<DirectToASAPViewModel> DirectToASAP(int jobId)
        {
            var result = new List<DirectToASAPViewModel>();
            await context.LoadStoredProc("DESWEB_stpJob_DirectToASAP")
                .WithSqlParam("@JobID", jobId)
                .ExecuteStoredProcAsync(handle => { result = handle.ReadToList<DirectToASAPViewModel>().ToList(); });
            return result.FirstOrDefault();
        }

        public async Task<UpdateFirstAvailableSpeedResult> UpdateFirstAvailableSpeed(int jobId)
        {
            DbParameter outputParam = null;
            DbParameter nameOutput = null;
            await context.LoadStoredProc("DESWEB_stpJob_UpdateFirstAvailableSpeed")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@JobTypeID", (dbParam) =>
                {
                    dbParam.Direction = System.Data.ParameterDirection.Output;
                    dbParam.DbType = System.Data.DbType.Int32;
                    outputParam = dbParam;
                })
                .WithSqlParam("@Name", (dbParam) =>
                {
                    dbParam.Direction = System.Data.ParameterDirection.Output;
                    dbParam.DbType = System.Data.DbType.String;
                    dbParam.Size = 50;
                    nameOutput = dbParam;
                })
                .ExecuteStoredNonQueryAsync();
            var updateReturn = new UpdateFirstAvailableSpeedResult()
            {
                JobTypeId = (int)outputParam.Value,
                Name = (string)nameOutput.Value
            };
            return updateReturn;
        }

        public async Task<SettingsViewModel> Settings()
        {
            var result = new List<SettingsViewModel>();
            await context.LoadStoredProc("DES_stpSettings")
                .ExecuteStoredProcAsync(handle => { result = handle.ReadToList<SettingsViewModel>().ToList(); });
            return result.FirstOrDefault();
        }

        public async Task AddPalletInfo(PalletInfo p, bool preBook, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpJobItems_Insert")
                .WithSqlParam("@JobID", p.ID)
                .WithSqlParam("@Items", p.Quantity)
                .WithSqlParam("@Weight", p.Weight)
                .WithSqlParam("@Depth", p.Depth)
                .WithSqlParam("@Length", p.Length)
                .WithSqlParam("@Height", p.Height)
                .WithSqlParam("@PU", p.PU)
                .WithSqlParam("@DO", p.DO)
                .WithSqlParam("@DGClass", p.DGClass)
                .WithSqlParam("@Notes", p.Notes)
                .WithSqlParam("@Prebook", preBook)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task EditPalletInfo(PalletInfo p, bool preBook, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpJobItems_Update")
                .WithSqlParam("@JobID", p.ID)
                .WithSqlParam("@ItemID", p.ItemID)
                .WithSqlParam("@Items", p.Quantity)
                .WithSqlParam("@Weight", p.Weight)
                .WithSqlParam("@Depth", p.Depth)
                .WithSqlParam("@Length", p.Length)
                .WithSqlParam("@Height", p.Height)
                .WithSqlParam("@PU", p.PU)
                .WithSqlParam("@DO", p.DO)
                .WithSqlParam("@DGClass", p.DGClass)
                .WithSqlParam("@Notes", p.Notes)
                .WithSqlParam("@Prebook", preBook)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task DeletePalletInfo(PalletInfo p, bool preBook, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpJobItems_Delete")
                .WithSqlParam("@JobID", p.ID)
                .WithSqlParam("@ItemID", p.ItemID)
                .WithSqlParam("@Prebook", preBook)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task SendPrebookJob(int jobId)
        {
            await context.LoadStoredProc("DES_stpJobBooking_InsertJobAndChildren")
                .WithSqlParam("@JobBookingID", jobId)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task VoidPrebookJob(int jobId, string despatcher, int staffId)
        {
            await context.LoadStoredProc("DESWEB_stpVoidPrebookJob")
                .WithSqlParam("@JobBookingID", jobId)
                .WithSqlParam("@Username", despatcher)
                .WithSqlParam("@StaffID", staffId)
                .ExecuteStoredNonQueryAsync();
        }

        

        public async Task<TruckItemsSummary> TruckJobItems(int jobId, int truckWeightLimit)
        {
            var result = new List<TruckItemsSummary>();
            await context.LoadStoredProc("qry_tucJobItems")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@TruckWeightLimit", truckWeightLimit)
                .ExecuteStoredProcAsync(handle => { result = handle.ReadToList<TruckItemsSummary>().ToList(); });
            return result.FirstOrDefault();
        }

        public async Task UpdateDeliveryAddress(int jobId, int toSuburbId, string address, decimal deliveryLat, decimal deliveryLng, bool cbd, decimal rate, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateJobDeliveryAddress")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@ToSuburb", toSuburbId)
                .WithSqlParam("@Address", address)
                .WithSqlParam("@DeliveryLatitude", deliveryLat)
                .WithSqlParam("@DeliveryLongitude", deliveryLng)
                .WithSqlParam("@CBD", cbd)
                .WithSqlParam("@Rate", rate)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();

        }

        public async Task UpdateBulkDeliveryAddress(int bulkJobId, string toSuburb, int toPostCode, string address, decimal deliveryLat, decimal deliveryLng, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateBulkJobDeliveryAddress")
                .WithSqlParam("@BulkJobID", bulkJobId)
                .WithSqlParam("@ToSuburb", toSuburb)
                .WithSqlParam("@ToPostCode", toPostCode)
                .WithSqlParam("@Address", address)
                .WithSqlParam("@DeliveryLatitude", deliveryLat)
                .WithSqlParam("@DeliveryLongitude", deliveryLng)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();

        }

        public async Task UpdatePickupAddress(int jobId, int fromSuburbId, string address, decimal pickupLat, decimal pickupLng, bool cbd, decimal rate, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateJobPickupAddress")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@FromSuburb", fromSuburbId)
                .WithSqlParam("@Address", address)
                .WithSqlParam("@PickupLatitude", pickupLat)
                .WithSqlParam("@PickupLongitude", pickupLng)
                .WithSqlParam("@CBD", cbd)
                .WithSqlParam("@Rate", rate)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();

        }

        public async Task UpdateJobType(int jobId, int jobType, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateJobType")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@JobType", jobType)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task UpdateBulkPickupAddress(int bulkJobId, string fromSuburb, int fromPostCode, string address, decimal pickupLat, decimal pickupLng, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateBulkJobPickupAddress")
                .WithSqlParam("@BulkJobID", bulkJobId)
                .WithSqlParam("@FromSuburb", fromSuburb)
                .WithSqlParam("@FromPostCode", fromPostCode)
                .WithSqlParam("@Address", address)
                .WithSqlParam("@PickupLatitude", pickupLat)
                .WithSqlParam("@PickupLongitude", pickupLng)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();

        }

        public async Task UpdateBookingDeliveryAddress(int jobId, int toSuburbId, string address, decimal deliveryLat, decimal deliveryLng, bool cbd, decimal rate, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateJobBookingDeliveryAddress")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@ToSuburb", toSuburbId)
                .WithSqlParam("@Address", address)
                .WithSqlParam("@DeliveryLatitude", deliveryLat)
                .WithSqlParam("@DeliveryLongitude", deliveryLng)
                .WithSqlParam("@CBD", cbd)
                .WithSqlParam("@Rate", rate)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();

        }

        public async Task UpdateBookingPickupAddress(int jobId, int fromSuburbId, string address, decimal pickupLat, decimal pickupLng, bool cbd, decimal rate, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateJobBookingPickupAddress")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@FromSuburb", fromSuburbId)
                .WithSqlParam("@Address", address)
                .WithSqlParam("@PickupLatitude", pickupLat)
                .WithSqlParam("@PickupLongitude", pickupLng)
                .WithSqlParam("@CBD", cbd)
                .WithSqlParam("@Rate", rate)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();

        }

        public async Task ReleaseBulkJob(string jobNumber, DateTime bookDate)
        {
            await context.LoadStoredProc("UTL_stpJob_tblBulkJob_ReleaseByJobNumber")
                .WithSqlParam("@JobNumber", jobNumber)
                .WithSqlParam("@DateTime", bookDate)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task UpdateJob(int jobId, string field, string value, decimal? rate, string despatcher, int staffId)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateJob")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@PropertyName", field)
                .WithSqlParam("@Value", value)
                .WithSqlParam("@Rate", rate)
                .WithSqlParam("@Username", despatcher)
                .WithSqlParam("@StaffID", staffId)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task UpdateBulkJob(int bulkJobId, string field, string value, decimal? rate, string despatcher, int staffId)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateBulkJob")
                .WithSqlParam("@BulkJobID", bulkJobId)
                .WithSqlParam("@PropertyName", field)
                .WithSqlParam("@Value", value)
                .WithSqlParam("@Rate", rate)
                .WithSqlParam("@Username", despatcher)
                .WithSqlParam("@StaffID", staffId)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task UpdateJobBooking(int jobId, string field, string value, decimal? rate, string despatcher, int staffId)
        {
            await context.LoadStoredProc("DESWEB_stpUpdateJobBooking")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@PropertyName", field)
                .WithSqlParam("@Value", value)
                .WithSqlParam("@Rate", rate)
                .WithSqlParam("@Username", despatcher)
                .WithSqlParam("@StaffID", staffId)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task AddNote(int jobId, string note, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpJob_AddNotes")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@Notes", note)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task AddBulkJobNote(int bulkJobId, string note, string despatcher)
        {
            await context.LoadStoredProc("DESWEB_stpBulkJob_AddNotes")
                .WithSqlParam("@BulkJobID", bulkJobId)
                .WithSqlParam("@Notes", note)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task AddJobBookingNote(int jobId, string note, string despatcher)
        {
            await context.LoadStoredProc("DES_stpJobBooking_AddNotes")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@Notes", note)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();
        }
    }
}
