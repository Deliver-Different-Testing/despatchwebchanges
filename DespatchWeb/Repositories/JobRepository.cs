using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.Controllers;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class JobRepository : IJobRepository
{
    private readonly DespatchContext _context;
    private readonly IMapper _mapper;

    public JobRepository(DespatchContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<JobViewModel> PreBookDetailAsync(int prebookId)
    {
        var pallets = await _context.TucJobBookingItems.Where(x => x.BookingId == prebookId).ToListAsync();
        var jobQuery = from jobBooking in _context.TucJobBookings
            join c in _context.TblCouriers on jobBooking.CourierId equals c.CourierId into courierJoin
            from courier in courierJoin.DefaultIfEmpty()
            join y in _context.TucSuburbs on jobBooking.UcbkFrom equals y.UcsuId into fromJoin
            from yo in fromJoin.DefaultIfEmpty()
            join z in _context.TucSuburbs on jobBooking.UcbkTo equals z.UcsuId into toJoin
            from zo in toJoin.DefaultIfEmpty()
            join t in _context.TucJobTypes on jobBooking.UcbkSpeed.Value equals t.UcjtId into speedJoin
            from to in speedJoin.DefaultIfEmpty()
            join cl in _context.TblClients on jobBooking.UcbkClientId equals cl.ClientId into clientJoin
            from client in clientJoin.DefaultIfEmpty()
            join con in _context.TblContacts on jobBooking.LoggedInContactId equals con.ContactId into contactJoin
            from contact in contactJoin.DefaultIfEmpty()
            join sou in _context.TucSources on jobBooking.SourceId equals sou.SourceId into sourceJoin
            from source in sourceJoin.DefaultIfEmpty()
            where jobBooking.UcbkId == prebookId
            select new JobViewModel
            {
                Id = jobBooking.UcbkId,
                Time = jobBooking.UcbkTime,
                BookedDate = jobBooking.UcbkDate,
                Direct = jobBooking.Direct,
                SizeId = jobBooking.UcbkSize,
                Van = jobBooking.UcbkVan,
                VanOk = jobBooking.VanOk,
                Truck = jobBooking.Truck,
                SaturdayDelivery = jobBooking.SaturdayDelivery,
                Return = jobBooking.UcbkReturn,
                Attention = jobBooking.UcbkAttention,
                Done = jobBooking.UcbkDone,
                PickupFrom = (short?)jobBooking.UcbkPickUpFrom,
                JobNo = jobBooking.UcbkJobNumber,
                Speed = to.ShortName,
                SpeedName = to.UcjtName,
                SpeedId = jobBooking.UcbkSpeed,
                AcceptedJobTypeId = jobBooking.AcceptedJobTypeId,
                NotifiedJobTypeId = jobBooking.NotifiedJobTypeId,
                Source = source.Name,
                Client = jobBooking.UcbkClientCode,
                ClientId = jobBooking.UcbkClientId,
                ClientName = client.Name,
                JobType = (int)jobBooking.UcbkType,
                PickupAddress = new AddressViewModel
                {
                    AddressLine1 = jobBooking.PickupAddressLine1,
                    AddressLine2 = jobBooking.PickupAddressLine2,
                    AddressLine3 = jobBooking.PickupAddressLine3,
                    AddressLine4 = jobBooking.PickupAddressLine4,
                    AddressLine5 = jobBooking.PickupAddressLine5,
                    AddressLine6 = jobBooking.PickupAddressLine6,
                    AddressLine7 = jobBooking.PickupAddressLine7,
                    AddressLine8 = jobBooking.PickupAddressLine8,
                    Latitude = jobBooking.PickUpLatitude,
                    Longitude = jobBooking.PickUpLongitude,
                },
                DeliveryAddress = new AddressViewModel
                {
                    AddressLine1 = jobBooking.DeliveryAddressLine1,
                    AddressLine2 = jobBooking.DeliveryAddressLine2,
                    AddressLine3 = jobBooking.DeliveryAddressLine3,
                    AddressLine4 = jobBooking.DeliveryAddressLine4,
                    AddressLine5 = jobBooking.DeliveryAddressLine5,
                    AddressLine6 = jobBooking.DeliveryAddressLine6,
                    AddressLine7 = jobBooking.DeliveryAddressLine7,
                    AddressLine8 = jobBooking.DeliveryAddressLine8,
                    Latitude = jobBooking.DeliveryLatitude,
                    Longitude = jobBooking.DeliveryLongitude,
                },
                FromContactName = jobBooking.PickupFromContact,
                FromContactNumber = jobBooking.PickupFromPhone,
                Courier = courier.Code,
                ContactName = jobBooking.UcbkContact,
                Phone = jobBooking.DeliverToPhone,
                Weight = jobBooking.UcbkWeight,
                Items = jobBooking.Quantity,
                RefA = jobBooking.UcbkClientRefa,
                RefB = jobBooking.UcbkClientRefb,
                OurRef = jobBooking.UcbkOurRef,
                Charge = $"{jobBooking.UcbkAmount:C}",
                ClientNotes = client.UcclNotes,
                InternalNotes = jobBooking.UcbkNotes,

                CourierData = new CourierData
                {
                    Courier = courier.Code + " " + courier.FirstName + " " + courier.Surname,
                    CourierId = courier.CourierId
                },
                DgClass = jobBooking.Dgclass,
                DgDocumentation = jobBooking.Dgdocument,
                DeliverToContact = jobBooking.DeliverToContact,
                TrackingMethod = jobBooking.TrackingMethod,
                TrackingMobile = jobBooking.TrackingMobile,
                TrackingEmail = jobBooking.TrackingEmail,
                RatedManually = jobBooking.RatedManually,
                OneOff = jobBooking.UcbkOneOff,
                Active = jobBooking.UcbkActive,
                InActiveBy = jobBooking.UcbkInActiveBy,
                InActiveDate = jobBooking.UcbkInActiveDate,
                FirstDue = jobBooking.UcbkFirstDue,
                NextDue = jobBooking.UcbkNextDue,
                LastDone = jobBooking.UcbkDateDone,
                RestartDate = jobBooking.RestartDate,
                StopDate = jobBooking.StopDate,
                Days = jobBooking.UcbkDays,
                PreBook = true,
                Pedal = jobBooking.UcbkCbd,
                Reprice = jobBooking.Reprice,
                LoggedInContactName = $"{contact.Firstname} {contact.Surname ?? ""}",
                PalletInfo = (
                    from pa in pallets
                    select new PalletInfo
                    {
                        Id = pa.BookingId,
                        Quantity = pa.Items,
                        ItemId = pa.ItemId,
                        Weight = pa.Weight,
                        Length = pa.Length,
                        Depth = pa.Depth,
                        Height = pa.Height,
                        Pu = pa.Pu,
                        Do = pa.Do,
                        DgClass = pa.Dgclass,
                        Notes = pa.Notes
                    }).ToList(),
            };

        var job = await jobQuery.FirstOrDefaultAsync();
        if (job == null) return job;
        job.Vehicle = new Vehicle
        {
            Id = job.Van ? (short?)Enums.Vehicle.Van : job.SizeId,
            Label = job.Van ? "Van" : Enum.GetName(typeof(Enums.Vehicle), job.SizeId ?? 2)
        };
        job.Size = job.Vehicle;
        job.Date = job.BookedDate?.ToString("dd/MM/yyyy");
        job.Booked = DateTime.Parse(job.BookedDate?.ToString("yyyy-MM-dd") + " " +
                                    job.Time?.ToString("HH:mm:ss"));

        return job;
    }

/* Job Detail */
    public async Task<JobViewModel> JobDetailAsync(int jobId)
    {
        var jobQuery = from tblJob in _context.TblJobs
            join c in _context.TblCouriers on tblJob.CourierId equals c.CourierId into courierJoin
            from courier in courierJoin.DefaultIfEmpty()
            join y in _context.TucSuburbs on tblJob.FromSuburbId equals y.UcsuId into fromJoin
            from fromSuburb in fromJoin.DefaultIfEmpty()
            join z in _context.TucSuburbs on tblJob.ToSuburbId equals z.UcsuId into toJoin
            from toSuburb in toJoin.DefaultIfEmpty()
            join t in _context.TucJobTypes on tblJob.Speed equals t.UcjtId into speedJoin
            from speed in speedJoin.DefaultIfEmpty()
            join n in _context.TucJobTypes on tblJob.NotifiedJobTypeId equals n.UcjtId into notifiedSpeedJoin
            from notifiedSpeed in notifiedSpeedJoin.DefaultIfEmpty()
            join o in _context.TucJobTypes on tblJob.AcceptedJobTypeId equals o.UcjtId into originalSpeedJoin
            from originalSpeed in originalSpeedJoin.DefaultIfEmpty()
            join cl in _context.TblClients on tblJob.ClientId equals cl.ClientId into clientJoin
            from client in clientJoin.DefaultIfEmpty()
            join s in _context.TucJobStatuses on tblJob.Status equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join l in _context.TblJobLeaveNotHomes on tblJob.LeaveNotHomeId equals l.LeaveNotHomeId into
                leaveNotHomeJoin
            from leave in leaveNotHomeJoin.DefaultIfEmpty()
            join u in _context.TblUndeliverableLocations on tblJob.UndeliverableLocationId equals
                u.UndeliverableLocationId into undeliverableLocationJoin
            from undeliverableLocation in undeliverableLocationJoin.DefaultIfEmpty()
            join b in _context.TblBulkJobs on tblJob.JobId equals b.JobId into bulkJoin
            from bulkJob in bulkJoin.DefaultIfEmpty()
            join sc in _context.TblBulkRunSchedules on bulkJob.ScheduleId equals sc.BulkRunScheduleId into scheduleJoin
            from schedule in scheduleJoin.DefaultIfEmpty()
            join nationwide in _context.TucJobNationwides on tblJob.JobId equals nationwide.UcnwJobId into
                nationwideJoin
            from nationwide in nationwideJoin.DefaultIfEmpty()
            join con in _context.TblContacts on tblJob.LoggedInContactId equals con.ContactId into contactJoin
            from contact in contactJoin.DefaultIfEmpty()
            join sou in _context.TucSources on tblJob.SourceId equals sou.SourceId into sourceJoin
            from source in sourceJoin.DefaultIfEmpty()
            join st in _context.TucStaffs on tblJob.DispatcherId equals st.UcstId into staffJoin
            from staff in staffJoin.DefaultIfEmpty()
            where tblJob.JobId == jobId
            select new JobViewModel
            {
                Id = tblJob.JobId,
                JobRelationshipTypeId = tblJob.JobRelationshipTypeId,
                Time = tblJob.Time,
                BookedDate = tblJob.Date,
                Direct = tblJob.Direct,
                SizeId = tblJob.Size,
                Van = tblJob.Van,
                VanOk = tblJob.VanOk,
                Truck = tblJob.Truck,
                Attention = tblJob.Attention,
                SaturdayDelivery = tblJob.SaturdayDelivery,
                Return = tblJob.Return,
                Done = tblJob.JobDone,
                Void = tblJob.Void,
                PickupFrom = tblJob.PickupFrom,
                JobNo = tblJob.Number,
                Speed = speed.ShortName,
                SpeedId = tblJob.Speed,
                Notify = notifiedSpeed.ShortName,
                Source = source.Name,
                SpeedName = speed.UcjtName,
                AcceptedJobTypeId = tblJob.AcceptedJobTypeId,
                NotifiedJobTypeId = tblJob.NotifiedJobTypeId,
                Client = tblJob.ClientCode,
                ClientId = tblJob.ClientId,
                ClientName = client.Name,
                JobType = tblJob.Type.HasValue ? (int)tblJob.Type : 0,
                PickupAddress = new AddressViewModel
                {
                    AddressLine1 = tblJob.PickupAddressLine1,
                    AddressLine2 = tblJob.PickupAddressLine2,
                    AddressLine3 = tblJob.PickupAddressLine3,
                    AddressLine4 = tblJob.PickupAddressLine4,
                    AddressLine5 = tblJob.PickupAddressLine5,
                    AddressLine6 = tblJob.PickupAddressLine6,
                    AddressLine7 = tblJob.PickupAddressLine7,
                    AddressLine8 = tblJob.PickupAddressLine8,
                    Latitude = tblJob.PickUpLatitude,
                    Longitude = tblJob.PickUpLongitude,
                },
                FromContactName = tblJob.PickupFromContact,
                FromContactNumber = tblJob.PickupFromPhone,
                DeliveryAddress = new AddressViewModel
                {
                    AddressLine1 = tblJob.DeliveryAddressLine1,
                    AddressLine2 = tblJob.DeliveryAddressLine2,
                    AddressLine3 = tblJob.DeliveryAddressLine3,
                    AddressLine4 = tblJob.DeliveryAddressLine4,
                    AddressLine5 = tblJob.DeliveryAddressLine5,
                    AddressLine6 = tblJob.DeliveryAddressLine6,
                    AddressLine7 = tblJob.DeliveryAddressLine7,
                    AddressLine8 = tblJob.DeliveryAddressLine8,
                    Latitude = tblJob.DeliveryLatitude,
                    Longitude = tblJob.DeliveryLongitude,
                },
                From = fromSuburb.UcsuName,
                FromSuburbId = tblJob.FromSuburbId,
                FromSuburbName = fromSuburb.UcsuName,
                FromPostCode = fromSuburb.PostCode,
                FromAddress = tblJob.FromAddress,
                To = toSuburb.UcsuName,
                ToSuburbId = tblJob.ToSuburbId,
                ToSuburbName = toSuburb.UcsuName,
                ToCity = toSuburb.City,
                ToPostCode = toSuburb.PostCode,
                ToAddress = tblJob.ToAddress,
                Courier = courier.Code,
                StatusId = tblJob.Status,
                Status = status.UcjsCode,
                Lp = tblJob.LatePickUp,
                Ld = tblJob.LateDelivery,
                ContactName = tblJob.Contact,
                LoggedInContactName = $"{contact.Firstname ?? ""} {contact.Surname ?? ""}",
                Phone = tblJob.DeliverToPhone,
                Weight = tblJob.Weight,
                Items = tblJob.Quantity,
                RefA = tblJob.ClientReferenceA,
                RefB = tblJob.ClientReferenceB,
                OurRef = tblJob.OurRef,
                SigNotRequired = leave.Name ?? "",
                Charge = $"{tblJob.Amount:C}",
                DispatchTime = tblJob.DispatchDate.HasValue
                    ? DateTime.Parse(tblJob.DispatchDate.Value.ToString("yyyy-MM-dd") + " " +
                                     tblJob.DispatchTime.Value.ToString("HH:mm:ss"))
                    : tblJob.DispatchDate,
                PuTime = tblJob.PickUpTime,
                ClientNotes = client.UcclNotes,
                InternalNotes = tblJob.Notes,
                RunName = tblJob.RunName,
                CourierData = new CourierData
                {
                    Courier = courier.Code + " " + courier.FirstName + " " + courier.Surname,
                    CourierId = courier.CourierId,
                    CourierName = courier.FirstName + " " + courier.Surname,
                    CourierMobile = courier.Mobile
                },
                DgClass = tblJob.Dgclass,
                DgDocumentation = tblJob.Dgdocument,
                CompletedTime = tblJob.CompletedTime,
                DeliverToContact = tblJob.DeliverToContact,
                PodPhoto = tblJob.DeliveryPhoto,
                DeliverySignature = tblJob.DeliverySignature,
                PodName = tblJob.Podname,
                TrackingMethod = tblJob.TrackingMethod,
                TrackingMobile = tblJob.TrackingMobile,
                TrackingEmail = tblJob.TrackingEmail,
                UdStatus = undeliverableLocation.Name,
                RatedManually = tblJob.RatedManually,
                Locked = (tblJob.Locked ?? 0) == 1,
                Invoiced = tblJob.InvoiceNo.HasValue && tblJob.InvoiceNo.Value > 0,
                PreBook = false,
                Pedal = tblJob.Cbd,
                InternalStatusId = tblJob.InternalStatus,
                FollowupTime = tblJob.FollowupTime,
                Reprice = tblJob.Reprice,
                GstRate = tblJob.Gstrate,
                RootParentId = tblJob.RootParentId,
                ScheduleName = schedule.Name,
                ConNote = nationwide.UcnwConNote,
                AirportOnly = nationwide.UcnwAirportOnly,
                HasNationwide = nationwide.UcnwJobId.HasValue,
                StatusName = status.UcjsName,
                DispatcherName = $"{staff.UcstFirstName ?? string.Empty} {staff.UcstLastName ?? string.Empty}",
                CreatedDate = tblJob.Date
            };

        var job = await jobQuery.FirstOrDefaultAsync();
        if (job == null) return null;

        job.Vehicle = new Vehicle
        {
            Id = job.Van ? (short?)Enums.Vehicle.Van : job.SizeId,
            Label = job.Van ? "Van" : Enum.GetName(typeof(Enums.Vehicle), job.SizeId ?? 2)
        };

        job.RelatedJobs = await GetRelatedJobsAsync(job.RootParentId, job.ClientId ??= 0);
        job.PodPhotos = await GetPodPhotosAsync(job.Id, job.PodPhoto,
            job.DeliverySignature);

        job.Size = job.Vehicle;

        if (job.BookedDate == null) return job;
        job.Date = job.BookedDate.Value.ToString("dd/MM/yyyy");

        if (job.Time != null)
            job.Booked = DateTime.Parse(job.BookedDate.Value.ToString("yyyy-MM-dd") + " " +
                                        job.Time.Value.ToString("HH:mm:ss"));

        return job;
    }

    public async Task<List<Size>> RelatedJobs(int parentId, int clientId)
    {
        var relatedJobs = await (
            from j in _context.TblJobs
            where j.RootParentId == parentId && j.ClientId == clientId
            orderby j.Date, j.Time
            select new Size
            {
                Id = j.JobId,
                Label = j.Number
            }
        ).ToListAsync();
        return relatedJobs;
    }

    /* Bulk Job Detail*/

    public async Task<JobViewModel> BulkJobDetail(int bulkJobId)
    {
        var today = DateTime.Today.ResetTimeToStartOfDay();
        var jobQuery = from j in _context.TblBulkJobs
            join c in _context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join t in _context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
            from to in speedJoin.DefaultIfEmpty()
            join cl in _context.TblClients on j.ClientId equals cl.ClientId into clientJoin
            from client in clientJoin.DefaultIfEmpty()
            join s in _context.TucJobStatuses on j.JobStatus equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join l in _context.TblJobLeaveNotHomes on j.DeliverToLeaveId equals l.LeaveNotHomeId into leaveNotHomeJoin
            from leave in leaveNotHomeJoin.DefaultIfEmpty()
            join sc in _context.TblBulkRunSchedules on j.ScheduleId equals sc.BulkRunScheduleId into scheduleJoin
            from schedule in scheduleJoin.DefaultIfEmpty()
            join con in _context.TblContacts on j.LoggedInContactId equals con.ContactId into contactJoin
            from contact in contactJoin.DefaultIfEmpty()
            join sou in _context.TucSources on j.SourceId equals sou.SourceId into sourceJoin
            from source in sourceJoin.DefaultIfEmpty()
            where j.BulkJobId == bulkJobId
            select new JobViewModel
            {
                Id = j.BulkJobId,
                JobRelationshipTypeId = j.JobRelationshipTypeId,
                Time = j.BookTime,
                BookedDate = j.BookDate,
                SizeId = j.Size,
                Void = j.Void,
                //PickupFrom = j.FromAddress,
                JobNo = j.JobNumber,
                Speed = to.ShortName,
                SpeedName = to.UcjtName,
                SpeedId = j.Speed,
                Client = j.ClientCode,
                ClientId = j.ClientId,
                ClientName = client.Name,
                From = j.FromSuburb,
                FromSuburbName = j.FromSuburb,
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
                CourierData = new CourierData
                {
                    Courier = co.Code + " " + co.FirstName + " " + co.Surname,
                    CourierId = co.CourierId
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
            };
        var jobList = await jobQuery.ToListAsync();
        var job = jobList.FirstOrDefault();

        if (job == null) return job;
        job.Vehicle = new Vehicle
        {
            Id = job.Van ? (short?)Enums.Vehicle.Van : job.SizeId,
            Label = job.Van ? "Van" : Enum.GetName(typeof(Enums.Vehicle), job.SizeId ?? 2)
        };
        job.Size = job.Vehicle;
        job.Date = job.BookedDate.Value.ToString("dd/MM/yyyy");
        job.Booked = DateTime.Parse(job.BookedDate.Value.ToString("yyyy-MM-dd") + " " +
                                    job.Time.Value.ToString("HH:mm:ss"));

        return job;
    }

    public async Task<Tuple<int, List<JobViewModel>>> BulkSearchAsync(int? courierId, string job, string wild,
        DateTime fromDate,
        DateTime toDate, int? clientId, int pageIndex, int pageSize)
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";

        var jobsQuery = from x in _context.TblBulkJobs
            join c in _context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
            from courier in courierJoin.DefaultIfEmpty()
            join t in _context.TucJobTypes on x.Speed equals t.UcjtId into speedJoin
            from speed in speedJoin.DefaultIfEmpty()
            join s in _context.TucJobStatuses on x.JobStatus equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            where x.BookDate >= fromDate && x.BookDate <= toDate && (!clientSet || x.ClientId == clientId) &&
                  (!courierSet || x.CourierId == courierId) &&
                  (job == "" || EF.Functions.Like(x.JobNumber.ToLower(), jobParam)) &&
                  (wild == "" || EF.Functions.Like(
                      x.FromAddress + " " + x.Contact + " " + x.FromSuburb + " " + x.ToAddress + " " +
                      x.DeliverToContact + " " + x.ToSuburb + " " + (x.ClientRefa ?? "") + " " + (x.ClientRefb ?? "") +
                      " " + (x.OurRef ?? "") + " " + x.JobNumber.ToLower(), wildParam))
            select new JobViewModel
            {
                Id = x.BulkJobId,
                Time = x.BookTime,
                ClientId = x.ClientId,
                Client = x.ClientCode,
                PickupAddress = new AddressViewModel
                {
                    AddressLine1 = x.PickupAddressLine1,
                    AddressLine2 = x.PickupAddressLine2,
                    AddressLine3 = x.PickupAddressLine3,
                    AddressLine4 = x.PickupAddressLine4,
                    AddressLine5 = x.PickupAddressLine5,
                    AddressLine6 = x.PickupAddressLine6,
                    AddressLine7 = x.PickupAddressLine7,
                    AddressLine8 = x.PickupAddressLine8,
                    Latitude = decimal.Parse(x.PickUpLatitude),
                    Longitude = decimal.Parse(x.PickUpLongitude),
                },
                DeliveryAddress = new AddressViewModel
                {
                    AddressLine1 = x.DeliveryAddressLine1,
                    AddressLine2 = x.DeliveryAddressLine2,
                    AddressLine3 = x.DeliveryAddressLine3,
                    AddressLine4 = x.DeliveryAddressLine4,
                    AddressLine5 = x.DeliveryAddressLine5,
                    AddressLine6 = x.DeliveryAddressLine6,
                    AddressLine7 = x.DeliveryAddressLine7,
                    AddressLine8 = x.DeliveryAddressLine8,
                    Latitude = decimal.Parse(x.DeliveryLatitude),
                    Longitude = decimal.Parse(x.DeliveryLongitude),
                },
                JobNo = x.JobNumber,
                Courier = courier.Code,
                StatusId = x.JobStatus,
                Status = status.UcjsCode,
                Speed = speed.ShortName,
                SpeedId = x.Speed,
                BookedDate = x.BookDate
            };

        var stopwatch = new Stopwatch();
        stopwatch.Start();
        var total = await jobsQuery.CountWithNoLockAsync();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        stopwatch.Reset();
        stopwatch.Start();

        var jobs = await jobsQuery
            .OrderBy(a => a.BookedDate)
            .ThenBy(v => v.Time)
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        stopwatch.Reset();
        stopwatch.Start();
        var jobList = jobs.Select(v => new JobViewModel
        {
            Id = v.Id,
            Time = v.Time,
            ClientId = v.ClientId,
            Client = v.Client,
            PickupAddress = v.PickupAddress,
            DeliveryAddress = v.DeliveryAddress,
            JobNo = v.JobNo,
            Courier = v.Courier,
            StatusId = v.StatusId,
            Status = v.Status,
            Speed = v.Speed,
            PreBook = false,
            SpeedId = v.SpeedId,
            Booked = DateTime.Parse(v.BookedDate.Value.ToString("yyyy-MM-dd") + " " +
                                    v.Time.Value.ToString("HH:mm:ss"))
        }).ToList();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        return Tuple.Create(total, jobList);
    }

    public async Task<Tuple<int, List<JobViewModel>>> PodSearch(int? courierId, string wild, string job,
        DateTime fromDate,
        DateTime toDate, int? clientId, int pageIndex, int pageSize)
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";

        var jobsQuery = from x in _context.TblJobs
            join c in _context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join y in _context.TucSuburbs on x.FromSuburbId equals y.UcsuId into fromJoin
            from yo in fromJoin.DefaultIfEmpty()
            join z in _context.TucSuburbs on x.ToSuburbId equals z.UcsuId into toJoin
            from zo in toJoin.DefaultIfEmpty()
            join t in _context.TucJobTypes on x.Speed equals t.UcjtId into speedJoin
            from to in speedJoin.DefaultIfEmpty()
            join s in _context.TucJobStatuses on x.Status equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join nw in _context.TucJobNationwides on x.JobId equals nw.UcnwJobId into nationwideJoin
            from nationwide in nationwideJoin.DefaultIfEmpty()
            where x.Date >= fromDate && x.Date <= toDate && (!clientSet || x.ClientId == clientId) &&
                  (!courierSet || x.CourierId == courierId) &&
                  (job == "" || EF.Functions.Like(x.Number.ToLower(), jobParam)) &&
                  (wild == "" || EF.Functions.Like(nationwide.UcnwConNote, wildParam) || EF.Functions.Like(
                      x.FromAddress + " " + x.PickupFromContact + " " + yo.UcsuName + " " + x.ToAddress + " " +
                      x.DeliverToContact + " " + zo.UcsuName + " " + (x.ClientReferenceA ?? "") + " " +
                      (x.ClientReferenceB ?? "") + " " + (x.OurRef ?? "") + " " + x.Number.ToLower(), wildParam))
            select new JobViewModel
            {
                Id = x.JobId,
                Time = x.Time,
                ClientId = x.ClientId,
                Client = x.ClientCode,
                From = yo.UcsuName,
                FromSuburbId = x.FromSuburbId,
                To = zo.UcsuName,
                ToSuburbId = x.ToSuburbId,
                JobNo = x.Number,
                FromAddress = x.FromAddress,
                ToAddress = x.ToAddress,
                Courier = co.Code,
                StatusId = x.Status,
                Status = status.UcjsCode,
                Speed = to.ShortName,
                SpeedId = x.Speed,
                PreBook = false,
                PickUpLatitude = x.PickUpLatitude,
                PickUpLongitude = x.PickUpLongitude,
                DeliveryLatitude = x.DeliveryLatitude,
                DeliveryLongitude = x.DeliveryLongitude,
                BookedDate = x.Date,
                Booked = DateTime.Parse(x.Date.Value.ToString("yyyy-MM-dd") + " " +
                                        x.Time.Value.ToString("HH:mm:ss"))
            };

        var orderedQuery = jobsQuery.OrderBy(a => a.BookedDate).ThenBy(v => v.Time);

        var total = orderedQuery.Count();

        var jobs = await orderedQuery
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Tuple.Create(total, jobs);
    }

    public async Task<Tuple<int, List<JobViewModel>>> PreBookSearchAsync(int? courierId, string wild, string job,
        DateTime fromDate, DateTime toDate, int? clientId, int pageIndex, int pageSize)
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";
        var jobsQuery = from x in _context.TucJobBookings
            join c in _context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join y in _context.TucSuburbs on x.UcbkFrom equals y.UcsuId into fromJoin
            from yo in fromJoin.DefaultIfEmpty()
            join z in _context.TucSuburbs on x.UcbkTo equals z.UcsuId into toJoin
            from zo in toJoin.DefaultIfEmpty()
            join t in _context.TucJobTypes on (int)x.UcbkSpeed equals t.UcjtId into speedJoin
            from to in speedJoin.DefaultIfEmpty()
            where x.UcbkNextDue >= fromDate && x.UcbkNextDue <= toDate &&
                  (!clientSet || x.UcbkClientId == clientId) &&
                  (!courierSet || x.CourierId == courierId) &&
                  (job == "" || EF.Functions.Like(x.UcbkJobNumber.ToLower(), jobParam)) &&
                  (wild == "" || EF.Functions.Like(
                      x.UcbkFromAddr + " " + x.PickupFromContact + " " + yo.UcsuName + " " + x.UcbkToAddr + " " +
                      x.DeliverToContact + " " + zo.UcsuName + " " + (x.UcbkClientRefa ?? "") + " " +
                      (x.UcbkClientRefa ?? "") + " " + (x.UcbkOurRef ?? "") + " " + x.UcbkJobNumber.ToLower(),
                      wildParam))
            select new JobViewModel
            {
                Id = x.UcbkId,
                Time = x.UcbkTime,
                ClientId = x.UcbkClientId,
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
            };
        var stopwatch = new Stopwatch();
        stopwatch.Start();
        var total = await jobsQuery.CountWithNoLockAsync();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        stopwatch.Reset();
        stopwatch.Start();
        var jobs = await jobsQuery
            .OrderBy(a => a.BookedDate).ThenBy(v => v.Time)
            .Skip((pageIndex - 1) * pageSize).Take(pageSize)
            .ToListAsync();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        stopwatch.Reset();
        stopwatch.Start();
        var jobList = jobs.Select(j => new JobViewModel
        {
            Id = j.Id,
            Booked = DateTime.Parse(j.Booked.ToString("yyyy-MM-dd") + " " +
                                    j.Time.Value.ToString("HH:mm:ss")),
            Client = j.Client,
            FromAddress = j.FromAddress,
            ToAddress = j.ToAddress,
            JobNo = j.JobNo,
            ClientId = j.ClientId,
            Courier = j.Courier,
            Speed = j.Speed
        }).ToList();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        return Tuple.Create(total, jobList);
    }

    public async Task<List<JobViewModel>> PreBookJobList()
    {
        var jobs = await _context.UvwBookingTodays
            .FromSqlRaw(
                "SELECT * FROM uvwBookingToday WHERE ucbkDone=0  ORDER BY CONVERT(nvarchar(10), ucbkTime, 108), ucbkJobNumber")
            .ToListAsync();
        var jobList = (from j in jobs
            select new JobViewModel
            {
                Id = j.UcbkId,
                Booked = DateTime.Parse(j.UcbkNextDue.Value.ToString("yyyy-MM-dd") + " " +
                                        j.UcbkTime.Value.ToString("HH:mm:ss")),
                Client = j.UcbkClientCode,
                FromAddress = j.UcbkFromAddr,
                ToAddress = j.UcbkToAddr,
                JobNo = j.UcbkJobNumber,
                ClientId = j.UcbkClientId,
                Courier = j.Code,
                Speed = j.UcjtName
            }).ToList();
        return jobList;
    }

    public async Task<List<JobViewModel>> CurrentJobList(int courierId, bool done)
    {
        var jobs = await GetJobsQuery(_context, courierId, done).ToListAsync();
        var jobViewModels = _mapper.Map<List<JobViewModel>>(jobs);

        var jobIds = jobViewModels.Select(j => j.Id).ToList();
        var palletInfoItems = await _context.TucJobItems
            .Where(p => jobIds.Contains(p.JobId))
            .Select(p => new
            {
                p.JobId,
                PalletInfo = new PalletInfo
                {
                    Id = p.JobId,
                    Quantity = p.Items,
                    ItemId = p.ItemId,
                    Weight = p.Weight,
                    Length = p.Length,
                    Depth = p.Depth,
                    Height = p.Height,
                    Pu = p.Pu,
                    Do = p.Do,
                    DgClass = p.Dgclass,
                    Notes = p.Notes
                }
            })
            .ToListAsync();

        var palletInfoDict = palletInfoItems
            .GroupBy(p => p.JobId)
            .ToDictionary(g => g.Key,
                g => g.Select(p => p.PalletInfo).ToList());

        foreach (var job in jobViewModels)
        {
            job.PalletInfo = palletInfoDict.TryGetValue(job.Id, out var palletInfo)
                ? palletInfo
                : new List<PalletInfo>();
        }

        return jobViewModels;

        static IQueryable<DeswebQryDespatch> GetJobsQuery(DespatchContext context, int cId, bool isDone)
        {
            return context.DeswebQryDespatches.FromSqlRaw($"exec [DESWeb_qryCourierJobs] {cId}, {isDone}");
        }
    }

    public async Task<List<JobViewModel>> JobListAsync(string status, string order,
        string ascending, bool isInternal, string clientIds, List<int> selectedViewIds)
    {
        if (isInternal == false && string.IsNullOrEmpty(clientIds))
            return new List<JobViewModel>();

        if (selectedViewIds != null && !selectedViewIds.Any()) return new List<JobViewModel>();
        var viewFilters = await _context.TblDespatchViews
            .Where(dv => selectedViewIds.Contains(dv.DespatchViewId))
            .Select(dv => dv.WhereCondition)
            .ToListAsync();

        // Filters
        var orderByClause = GetOrderByClause(order, ascending);
        var whereClause = BuildWhereClause(isInternal, viewFilters, status, clientIds);

        var sql =
            $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {whereClause} order by {orderByClause}";

        var jobs = await _context.DeswebQryDespatches
            .FromSqlRaw(sql)
            .AsNoTracking()
            .ToListAsync();

        var list = jobs.Select(j => new JobViewModel
        {
            Id = j.UcjbId,
            RootParentId = j.RootParentId,
            Time = j.UcjbTime,
            Direct = j.Direct,
            Van = j.UcjbVan,
            VanOk = j.VanOk,
            Truck = j.Truck,
            Return = j.UcjbReturn,
            PickupFrom = j.UcjbPickUpFrom,
            SaturdayDelivery = j.SaturdayDelivery,
            JobNo = j.UcjbNumber,
            Speed = j.SpeedShortName,
            SpeedName = j.SpeedName,
            SpeedId = j.UcjbSpeed,
            Notify = j.NotifiedSpeed,
            NotifiedName = j.NotifiedName,
            AcceptedJobTypeId = j.AcceptedJobTypeId,
            AcceptedName = j.OriginalName,
            NotifiedJobTypeId = j.NotifiedJobTypeId,
            Vehicle = new Vehicle
            {
                Id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                Label = j.UcjbVan ? "Van" :
                    j.UcjbSize.HasValue ? Enum.GetName(typeof(Enums.Vehicle), (int)j.UcjbSize) : null
            },
            Client = j.UcclCode,
            ClientId = j.UcjbClientId,
            ClientName = j.ClientName,
            JobType = (int)(j.UcjbType ?? 0),
            PickupAddress = new AddressViewModel
            {
                AddressLine1 = j.PickupAddressLine1,
                AddressLine2 = j.PickupAddressLine2,
                AddressLine3 = j.PickupAddressLine3,
                AddressLine4 = j.PickupAddressLine4,
                AddressLine5 = j.PickupAddressLine5,
                AddressLine6 = j.PickupAddressLine6,
                AddressLine7 = j.PickupAddressLine7,
                AddressLine8 = j.PickupAddressLine8,
                Latitude = j.PickUpLatitude,
                Longitude = j.PickUpLongitude,
            },
            DeliveryAddress = new AddressViewModel
            {
                AddressLine1 = j.DeliveryAddressLine1,
                AddressLine2 = j.DeliveryAddressLine2,
                AddressLine3 = j.DeliveryAddressLine3,
                AddressLine4 = j.DeliveryAddressLine4,
                AddressLine5 = j.DeliveryAddressLine5,
                AddressLine6 = j.DeliveryAddressLine6,
                AddressLine7 = j.DeliveryAddressLine7,
                AddressLine8 = j.DeliveryAddressLine8,
                Latitude = j.DeliveryLatitude,
                Longitude = j.DeliveryLongitude,
            },
            From = j.SuburbFrom,
            FromContactName = j.PickupFromContact,
            FromContactNumber = j.PickupFromPhone,
            FromSuburbId = j.FromSuburbId,
            FromSuburbName = j.FromSuburbName,
            FromPostCode = j.FromPostCode,
            FromAddress = j.UcjbFromAddr,
            To = j.SuburbTo,
            ToSuburbId = j.ToSuburbId,
            ToSuburbName = j.ToSuburbName,
            ToPostCode = j.ToPostCode,
            ToAddress = j.UcjbToAddr,
            ToCity = j.ToCity,
            Courier = j.CourierCode,
            Remain = j.RemainTime,
            StatusId = j.UcjbStatus,
            Status = j.UcjsCode,
            Lp = j.UcjbLatePick,
            Ld = j.UcjbLateDel,
            ContactName = j.UcjbContact,
            Phone = j.DeliverToPhone,
            SpeedAccepted = j.OriginalSpeed,
            Size = new Vehicle
            {
                Id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                Label = j.UcjbVan ? "Van" :
                    j.UcjbSize.HasValue ? Enum.GetName(typeof(Enums.Vehicle), (int)j.UcjbSize) : null
            },
            Weight = j.UcjbWeight,
            Items = j.UcjbQty,
            RefA = j.UcjbClientRefa,
            RefB = j.UcjbClientRefb,
            OurRef = j.UcjbOurRef,
            SigNotRequired = j.SigNotRequired,
            Charge = j.UcjbAmount.HasValue ? $"{j.UcjbAmount:C}" : null,
            Booked = j.UcjbTime.HasValue
                ? DateTime.Parse(j.UcjbDate.ToString("yyyy-MM-dd") + " " + j.UcjbTime.Value.ToString("HH:mm:ss"))
                : DateTime.Now,
            Date = j.UcjbDate.ToString("dd/MM/yyyy"),
            DispatchTime = j.UcjbDispTime,
            PuTime = j.Putime,
            ClientNotes = j.ClientNotes,
            InternalNotes = j.JobNotes,
            ChildNotes = j.ChildNotes,
            PickUpLatitude = j.PickUpLatitude,
            PickUpLongitude = j.PickUpLongitude,
            DeliveryLatitude = j.DeliveryLatitude,
            DeliveryLongitude = j.DeliveryLongitude,
            PalletInfo = (
                from pa in _context.TucJobItems.Where(p => p.JobId == j.UcjbId)
                select new PalletInfo
                {
                    Id = pa.JobId,
                    Quantity = pa.Items,
                    ItemId = pa.ItemId,
                    Weight = pa.Weight,
                    Length = pa.Length,
                    Depth = pa.Depth,
                    Height = pa.Height,
                    Pu = pa.Pu,
                    Do = pa.Do,
                    DgClass = pa.Dgclass,
                    Notes = pa.Notes
                }).ToList(),
            CourierData = new CourierData
            {
                Courier = string.IsNullOrEmpty(j.CourierCode) ? "" : j.CourierCode + " " + j.CourierName,
                CourierId = j.UcjbCourierId
            },
            AllowDispatch = j.AllowDespatch,
            AllowSplit = j.AllowSplit,
            DgClass = j.Dgclass,
            DgDocumentation = j.Dgdocument,
            DisplaySplitJobDetail = j.DisplaySplitJobDetail == 1,
            TruckWeightLimit = j.TruckWeightLimit,
            TruckStartTime = j.TruckStartTime,
            TruckHours = j.TruckHours,
            PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
            PickupTime = j.PickupTime,
            DeliveryTime = j.DeliveryTime,
            AlertLatePickup = j.AlertLatePickUp,
            AlertLateDelivery = j.AlertLateDelivery,
            Minutes = j.Minutes,
            DeliverToContact = j.DeliverToContact,
            PodPhoto = j.DeliveryPhoto,
            PodName = j.UcjbPodname,
            CompletedTime = j.UcjbComplTime.HasValue
                ? DateTime.Parse(j.UcjbComplTime?.ToString("yyyy-MM-dd") + " " +
                                 j.UcjbComplTime?.ToString("HH:mm"))
                : j.UcjbComplTime,
            Done = j.UcjbJobDone,
            TrackingMethod = j.TrackingMethod,
            TrackingMobile = j.TrackingMobile,
            TrackingEmail = j.TrackingEmail,
            UdStatus = j.Udstatus,
            RatedManually = j.RatedManually,
            PreBook = false,
            Attention = j.UcjbAttention,
            Pedal = j.UcjbCbd,
            Locked = j.Locked ?? false,
            Invoiced = false,
            InternalStatusId = j.InternalStatus,
            FollowupTime = j.FollowupTime,
            Reprice = j.Reprice,
            GstRate = j.Gstrate,
            ScheduleName = j.ScheduleName,
            LoggedInContactName = j.LoggedInContactName,
            StatusName = j.StatusName,
            FromAirportId = j.FromAirportId,
            ToAirportId = j.ToAirportId
        }).ToList();

        return list;
    }

    public async Task<List<JobViewModel>> NationwideJobListAsync(string status,
        string order, string ascending, bool isInternal, string clientIds, int windowPane, List<int> selectedViewIds)
    {
        if (isInternal == false && string.IsNullOrEmpty(clientIds))
            return new List<JobViewModel>();

        if (selectedViewIds != null && !selectedViewIds.Any()) return new List<JobViewModel>();

        var viewFilters = await _context.TblDespatchViews
            .Where(dv => selectedViewIds.Contains(dv.DespatchViewId))
            .Select(dv => dv.WhereCondition)
            .ToListAsync();

        // Filters
        var orderByClause = GetOrderByClause(order, ascending);
        var whereClause = BuildWhereClause(isInternal, viewFilters, status, clientIds);
        var sql =
            $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {whereClause} order by {orderByClause}";

        var jobs = await _context.DeswebQryDespatches.FromSqlRaw(sql).ToListWithNoLockAsync();
        var list = jobs.Select(j => new JobViewModel
        {
            Id = j.UcjbId,
            Time = j.UcjbTime,
            Direct = j.Direct,
            Van = j.UcjbVan,
            VanOk = j.VanOk,
            Truck = j.Truck,
            Return = j.UcjbReturn,
            PickupFrom = j.UcjbPickUpFrom,
            SaturdayDelivery = j.SaturdayDelivery,
            JobNo = j.UcjbNumber,
            Speed = j.SpeedShortName,
            SpeedName = j.SpeedName,
            NotifiedName = j.NotifiedName,
            AcceptedName = j.OriginalName,
            SpeedId = j.UcjbSpeed,
            Notify = j.NotifiedSpeed,
            AcceptedJobTypeId = j.AcceptedJobTypeId,
            NotifiedJobTypeId = j.NotifiedJobTypeId,
            Vehicle = new Vehicle
            {
                Id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                Label = j.UcjbVan
                    ? "Van"
                    : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
            },
            Client = j.UcclCode,
            ClientId = j.UcjbClientId,
            ClientName = j.ClientName,
            JobType = (int)(j.UcjbType ?? 0),
            FromContactName = j.PickupFromContact,
            FromContactNumber = j.PickupFromPhone,
            PickupAddress = new AddressViewModel
            {
                AddressLine1 = j.PickupAddressLine1,
                AddressLine2 = j.PickupAddressLine2,
                AddressLine3 = j.PickupAddressLine3,
                AddressLine4 = j.PickupAddressLine4,
                AddressLine5 = j.PickupAddressLine5,
                AddressLine6 = j.PickupAddressLine6,
                AddressLine7 = j.PickupAddressLine7,
                AddressLine8 = j.PickupAddressLine8,
                Latitude = j.PickUpLatitude,
                Longitude = j.PickUpLongitude,
            },
            DeliveryAddress = new AddressViewModel
            {
                AddressLine1 = j.DeliveryAddressLine1,
                AddressLine2 = j.DeliveryAddressLine2,
                AddressLine3 = j.DeliveryAddressLine3,
                AddressLine4 = j.DeliveryAddressLine4,
                AddressLine5 = j.DeliveryAddressLine5,
                AddressLine6 = j.DeliveryAddressLine6,
                AddressLine7 = j.DeliveryAddressLine7,
                AddressLine8 = j.DeliveryAddressLine8,
                Latitude = j.DeliveryLatitude,
                Longitude = j.DeliveryLongitude,
            },
            From = j.SuburbFrom,
            FromSuburbId = j.FromSuburbId,
            FromSuburbName = j.FromSuburbName,
            FromPostCode = j.FromPostCode,
            FromAddress = j.UcjbFromAddr,
            To = j.SuburbTo,
            ToSuburbId = j.ToSuburbId,
            ToSuburbName = j.ToSuburbName,
            ToPostCode = j.ToPostCode,
            ToAddress = j.UcjbToAddr,
            ToCity = j.ToCity,
            Courier = j.CourierCode,
            Remain = j.RemainTime,
            StatusId = j.UcjbStatus,
            Status = j.UcjsCode,
            Lp = j.UcjbLatePick,
            Ld = j.UcjbLateDel,
            ContactName = j.UcjbContact,
            Phone = j.DeliverToPhone,
            SpeedAccepted = j.OriginalSpeed,
            Size = new Vehicle
            {
                Id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                Label = j.UcjbVan
                    ? "Van"
                    : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
            },
            Weight = j.UcjbWeight,
            Items = j.UcjbQty,
            RefA = j.UcjbClientRefa,
            RefB = j.UcjbClientRefb,
            OurRef = j.UcjbOurRef,
            SigNotRequired = j.SigNotRequired,
            Charge = $"{j.UcjbAmount:C}",
            Booked = j.UcjbTime.HasValue
                ? DateTime.Parse(j.UcjbDate.ToString("yyyy-MM-dd") + " " + j.UcjbTime.Value.ToString("HH:mm:ss"))
                : DateTime.Now,
            Date = j.UcjbDate.ToString("dd/MM/yyyy"),
            DispatchTime = j.UcjbDispTime,
            PuTime = j.Putime,
            ClientNotes = j.ClientNotes,
            InternalNotes = j.JobNotes,
            ChildNotes = j.ChildNotes,
            PalletInfo = (
                from pa in _context.TucJobItems.Where(p => p.JobId == j.UcjbId)
                select new PalletInfo
                {
                    Id = pa.JobId,
                    Quantity = pa.Items,
                    ItemId = pa.ItemId,
                    Weight = pa.Weight,
                    Length = pa.Length,
                    Depth = pa.Depth,
                    Height = pa.Height,
                    Pu = pa.Pu,
                    Do = pa.Do,
                    DgClass = pa.Dgclass,
                    Notes = pa.Notes
                }).ToList(),
            CourierData = new CourierData
            {
                Courier = string.IsNullOrEmpty(j.CourierCode) ? "" : j.CourierCode + " " + j.CourierName,
                CourierId = j.UcjbCourierId
            },
            AllowDispatch = j.AllowDespatch,
            AllowSplit = j.AllowSplit,
            DgClass = j.Dgclass,
            DgDocumentation = j.Dgdocument,
            DisplaySplitJobDetail = j.DisplaySplitJobDetail == 1,
            TruckWeightLimit = j.TruckWeightLimit,
            TruckStartTime = j.TruckStartTime,
            TruckHours = j.TruckHours,
            PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
            PickupTime = j.PickupTime,
            DeliveryTime = j.DeliveryTime,
            AlertLatePickup = j.AlertLatePickUp,
            AlertLateDelivery = j.AlertLateDelivery,
            Minutes = j.Minutes,
            DeliverToContact = j.DeliverToContact,
            PodPhoto = j.DeliveryPhoto,
            PodName = j.UcjbPodname,
            CompletedTime = j.UcjbComplTime.HasValue
                ? DateTime.Parse(j.UcjbComplTime?.ToString("yyyy-MM-dd") + " " +
                                 j.UcjbComplTime?.ToString("HH:mm"))
                : j.UcjbComplTime,
            Done = j.UcjbJobDone,
            TrackingMethod = j.TrackingMethod,
            TrackingMobile = j.TrackingMobile,
            TrackingEmail = j.TrackingEmail,
            UdStatus = j.Udstatus,
            RatedManually = j.RatedManually,
            PreBook = false,
            Attention = j.UcjbAttention,
            Pedal = j.UcjbCbd,
            Locked = j.Locked ?? false,
            Invoiced = false,
            InternalStatusId = j.InternalStatus,
            Reprice = j.Reprice,
            FollowupTime = j.FollowupTime,
            RootParentId = j.RootParentId,
            ScheduleName = j.ScheduleName,
            ConNote = j.ConNote,
            AirportOnly = j.AirportOnly,
            HasNationwide = j.HasNationwide.HasValue,
            LoggedInContactName = j.LoggedInContactName,
            StatusName = j.StatusName
        }).ToList();


        return list;
    }


    public async Task<List<SupportViewModel>> SupportEvents(string channel)
    {
        var whereToUse = "";
        const string orderToUse = "CASE WHEN ucevType = 1 THEN 1 WHEN ucevType = 2 THEN 2 ELSE 0 END, ucevTime";

        var channelItems = channel?.Split(',');

        if (channelItems is { Length: 3 })
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
                        const string main =
                            "(RemoteJob = 0 AND (RegionFromID = 2 OR RegionFromID = 3 Or RegionFromID = 10) AND (RegionToID = 1 OR RegionToID = 4 OR RegionToID = 10 OR (RegionToID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39,53,54))) or ((RegionFromID = 2 OR RegionFromID = 3) AND (RegionToID = 2 OR RegionToID = 3) And ucjbVan=1) AND (IsParentJob = 0) AND (Truck = 0 OR Truck is NULL OR (Truck = 1 AND VanOK = 1))) or (RemoteJob = 0 AND (RegionFromID = 4 OR RegionFromID = 10 OR (RegionFromID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39,53,54))) AND   (RegionToID < 5 OR RegionToID = 10 OR (RegionToID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39))) AND  NOT (RegionFromID = 10 AND (RegionToID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39))) AND (IsParentJob = 0) AND (Truck = 0 OR Truck is NULL OR (Truck = 1 AND VanOK = 1))) ";
                        if (string.IsNullOrEmpty(whereToUse))
                        {
                            whereToUse = main;
                        }
                        else
                        {
                            whereToUse += " OR " + main;
                        }

                        break;
                    case "City":
                        const string city =
                            "((RemoteJob = 0 AND (RegionFromID = 2 OR RegionFromID = 3 Or RegionFromID = 10) AND (RegionToID = 2 OR RegionToID = 3 Or RegionToID = 10)) AND (IsParentJob = 0) AND (Truck = 0 OR Truck is NULL OR (Truck = 1 AND VanOK = 1))) or (RemoteJob = 0 AND RegionFromID = 3  AND RegionToID = 3  AND ucjbSize in(0,1) AND (Truck = 0 OR Truck is NULL))";
                        if (string.IsNullOrEmpty(whereToUse))
                        {
                            whereToUse = city;
                        }
                        else
                        {
                            whereToUse += " OR " + city;
                        }

                        break;
                    case "Trucks":
                        const string trucks = "(ucjbSpeed IN (45,109) OR Truck = 1) AND IsParentJob = 0";
                        if (string.IsNullOrEmpty(whereToUse))
                        {
                            whereToUse = trucks;
                        }
                        else
                        {
                            whereToUse += " OR " + trucks;
                        }

                        break;
                    case "All":
                        break;
                }
            }
        }


        var s = channel == "All"
            ? $"select * from DES_qrySupportEvents_CustomerAndCourier order by {orderToUse}"
            : $"select * from DES_qrySupportEvents_CustomerAndCourier where {whereToUse} order by {orderToUse}";

        var events = await _context.DesQrySupportEventsCustomerAndCouriers.FromSqlRaw(s).ToListAsync();
        var evm = (from e in events
            select new SupportViewModel
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

    public async Task<TucEvent> GetSupportEventAsync(int id)
    {
        var support = await _context.TucEvents.FindAsync(id);
        return support;
    }

    public async Task<int> UpdateSupportEventAsync(TucEvent supportEvent)
    {
        _context.Entry(supportEvent).State = EntityState.Modified;
        return await _context.SaveChangesAsync();
    }

    public async Task CloseSupportEvent(int supportId, int staffId)
    {
        await _context.LoadStoredProc("uspCompleteEvent")
            .WithSqlParam("@intEventID", supportId)
            .WithSqlParam("@intStaffID", staffId)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task DispatchSelectedJobs(int courierId, int dispId, string jobIds)
    {
        await _context.LoadStoredProc("DESWEB_stpJob_AutoDespatchSelectedJobs")
            .WithSqlParam("@JobIDs", jobIds)
            .WithSqlParam("@CourierID", courierId)
            .WithSqlParam("@DispID", dispId)
            .ExecuteStoredNonQueryAsync();

        foreach (var jid in jobIds.Split(",").ToList()
                     .Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            await _context.LoadStoredProc("DES_stpJob_AutoDespatchChildJobs")
                .WithSqlParam("@JobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task SwapPod(string job1, string job2)
    {
        await _context.LoadStoredProc("DESWEB_qdfSwapPOD")
            .WithSqlParam("@ucjbNumber1", job1)
            .WithSqlParam("@ucjbNumber2", job2)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task ReDispatchSelectedJobs(int courierId, int dispId, string jobIds)
    {
        foreach (var jid in jobIds.Split(",").ToList()
                     .Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            await _context.LoadStoredProc("uspRestoreJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }

        await DispatchSelectedJobs(courierId, dispId, jobIds);
    }

    public async Task ReSendSelectedJobs(string jobIds)
    {
        foreach (var jid in jobIds.Split(",").ToList()
                     .Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            await _context.LoadStoredProc("uspReDespatchJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task<List<BulkScanDetail>> ScanList(DateTime? runDate, string scan)
    {
        var cmd = _context.LoadStoredProc("DESWeb_stpScanDetail")
            .WithSqlParam("@RunDate", runDate)
            .WithSqlParam("@Scan", scan);
        var scans = new List<BulkScanDetail>();

        await cmd.ExecuteStoredProcAsync(h => { scans = h.ReadToList<BulkScanDetail>().ToList(); });
        return scans;
    }

    public async Task ReAssignSelectedJobs(string jobIds)
    {
        foreach (var jid in jobIds.Split(",").ToList()
                     .Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            await _context.LoadStoredProc("uspReassignJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task SetFirstJob(int jobId, int courierId)
    {
        await _context.LoadStoredProc("DES_stpJob_AutoDespatchSelectedJobs_FSCourierID")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam("@CourierID", courierId)
            .ExecuteStoredNonQueryAsync();
    }


    public async Task TransferJob(int jobId, int courierId, int dispId)
    {
        await _context.LoadStoredProc("DESWEB_stpJob_TransferJob")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam("@CourierID", courierId)
            .WithSqlParam("@DispID", dispId)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task UpdatePodDetails(string jobNumber, int jobStatus, string podName, DateTime podTime)
    {
        await _context.LoadStoredProc("DESWEB_qdfJob_UpdatePODDetails")
            .WithSqlParam("@ucjbNumber", jobNumber)
            .WithSqlParam("@ucjbJobDone", true)
            .WithSqlParam("@ucjbStatus", jobStatus)
            .WithSqlParam("@ucjbPODName", podName)
            .WithSqlParam("@ucjbComplTime", podTime)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task ReSendAllJobs(int courierId)
    {
        await _context.LoadStoredProc("uspReDespatchJobByCourierID")
            .WithSqlParam("@CourierID", courierId)
            .ExecuteStoredNonQueryAsync();
    }


    public async Task<int> MaxAutoLatePickupAlert()
    {
        DbParameter outputMaxParam = null;
        await _context.LoadStoredProc("GEN_qdfSetting_GetMaxAutoLatePickupAlert")
            .WithSqlParam("@MaxAutoLatePickupAlert", (dbParam) =>
            {
                dbParam.Direction = System.Data.ParameterDirection.Output;
                dbParam.DbType = System.Data.DbType.Int32;
                outputMaxParam = dbParam;
            })
            .ExecuteStoredNonQueryAsync();

        return (int)outputMaxParam.Value;
    }

    public async Task<int> MaxAutoLateDeliveryAlert()
    {
        DbParameter outputMaxParam = null;
        await _context.LoadStoredProc("GEN_qdfSetting_GetMaxAutoLateDeliveryAlert")
            .WithSqlParam("@MaxAutoLateDeliveryAlert", (dbParam) =>
            {
                dbParam.Direction = System.Data.ParameterDirection.Output;
                dbParam.DbType = System.Data.DbType.Int32;
                outputMaxParam = dbParam;
            })
            .ExecuteStoredNonQueryAsync();

        return (int)outputMaxParam.Value;
    }

    public async Task<decimal> PpdExclusiveAmount(int clientId, decimal amount)
    {
        return await CalculateAmountAsync(clientId, amount);
    }

    public async Task<decimal> PpdInclusiveAmount(int clientId, decimal amount)
    {
        return await CalculateAmountAsync(clientId, amount);
    }


    public async Task<decimal> FuelSurchargeInclusiveAmount(int clientId, decimal amount, int from, int to,
        DateTime booked, int size)
    {
        DbParameter outputMaxParam = null;
        await _context.LoadStoredProc("UTL_stpFuelSurcharge_InclusiveAmount")
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
        await _context.LoadStoredProc("DESWEB_qdfLateCall_Reset")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam("@Type", eventType)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task LatePickup(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher,
        bool calculationRequired)
    {
        await _context.LoadStoredProc("DESWEB_stpUpdateJobPickupLateCall")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam("@BookedSpeed", bookedSpeed)
            .WithSqlParam("@NotifiedSpeed", notifiedSpeed)
            .WithSqlParam("@Late", late)
            .WithSqlParam("@Despatcher", despatcher)
            .WithSqlParam("@CalculationRequired", calculationRequired)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task LateDelivery(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher,
        bool calculationRequired)
    {
        await _context.LoadStoredProc("DESWEB_stpUpdateJobDeliveryLateCall")
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
        foreach (var jid in jobIds.Split(",").ToList()
                     .Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            await _context.LoadStoredProc("DES_stpJob_SplitJobRestore")
                .WithSqlParam("@JobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task RestoreJobs(string jobIds)
    {
        foreach (var jid in jobIds.Split(",").ToList()
                     .Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            await _context.LoadStoredProc("uspRestoreJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task MessageCourier(int courierId, int dispId, string despatcher, string message)
    {
        await _context.LoadStoredProc("DES_stpManualMessage_Insert")
            .WithSqlParam("@SendToID", courierId)
            .WithSqlParam("@StaffID", dispId)
            .WithSqlParam("@WindowsUser", despatcher)
            .WithSqlParam("@Message", message)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task VoidJob(int jobId)
    {
        await _context.LoadStoredProc("DES_stpJob_Void")
            .WithSqlParam("@JobID", jobId)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task SplitJob(int jobId, string user)
    {
        await _context.Procedures.DES_stpJob_SplitJobAsync(
            jobId,
            false,
            user
        );
    }

    public async Task<string> UnSplitJob(int jobId)
    {
        DbParameter messageOutput = null;
        await _context.LoadStoredProc("DES_stpJob_UnSplit")
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

    public async Task UpdateSplitJobAddress(int jobId, int toSuburbId, string address, decimal deliveryLat,
        decimal deliveryLng)
    {
        await _context.Procedures.DESWEB_stpUpdateSplitJobMeetingAddressAsync(
            jobId,
            toSuburbId,
            address,
            deliveryLat,
            deliveryLng
        );
    }

    public async Task ReRateSplitJob(int jobId)
    {
        await _context.LoadStoredProc("DES_stpJob_SplitJob_ReRate")
            .WithSqlParam("@ParentJobID", jobId)
            .WithSqlParam("@PreBookJob", false)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task FinishSplitJobProcess(int jobId, string despatcher)
    {
        await _context.Procedures.DES_stpJob_ColsolidateMarsInformationAsync(
            jobId,
            false,
            despatcher,
            null
        );

        await _context.Procedures.DES_stpJob_DisplayInDespatchAsync(
            jobId
        );
    }

    public async Task<List<SuburbLookup>> SuburbsAsync()
    {
        return await _context.TucSuburbs
            .Select(x => new SuburbLookup
            {
                ID = x.UcsuId,
                Text = x.UcsuName,
                Alias = x.GoogleSuburbAlias
            })
            .ToListAsync();
    }

    public async Task<List<Lookup>> SpeedsAsync()
    {
        return await _context.DesQryAllJobTypes
            .Select(x => new Lookup
            {
                ID = x.JobTypeId,
                Text = x.Name
            })
            .ToListAsync();
    }

    public async Task<List<Lookup>> ContactsAsync(int clientId)
    {
        return await _context.UtlQryContactLookups
            .Join(_context.TblClientContacts,
                s => s.ContactId,
                cc => cc.ContactId,
                (s, cc) => new { s, cc })
            .Where(x => x.cc.ClientId == clientId && x.s.Active)
            .Select(x => new Lookup
            {
                ID = x.s.ContactId,
                Text = x.s.Name
            })
            .Distinct()
            .ToListAsync();
    }

    public Task<List<ClientContactDetailViewModel>> ContactDetailList(int clientId)
    {
        var data = (from s in _context.UtlQryContactLookups
            join cc in _context.TblClientContacts on s.ContactId equals cc.ContactId into cjoin
            from co in cjoin
            where co.ClientId == clientId && s.Active == true
            select new ClientContactDetailViewModel
            {
                ID = s.ContactId, FullName = $"{s.Firstname} {s.Surname}", Mobile = s.Mobile, DirectDial = s.DirectDial,
                Email = s.Email, JobTitle = s.JobTitle
            }).Distinct();
        return data.ToListAsync();
    }


    public async Task<List<Lookup>> LeaveParcelLocationsAsync()
    {
        return await _context.TblJobLeaveNotHomes
            .OrderBy(l => l.Sequence)
            .Select(x => new Lookup
            {
                ID = x.LeaveNotHomeId,
                Text = x.Name
            })
            .ToListAsync();
    }

    public async Task<List<UndeliverableLocation>> UndeliverableLocationsAsync()
    {
        return await _context.TblUndeliverableLocations
            .OrderBy(u => u.Name)
            .Select(x => new UndeliverableLocation
            {
                ID = x.UndeliverableLocationId,
                Text = x.Name,
                JobStatusId = x.JobTypeId
            })
            .ToListAsync();
    }

    public async Task<List<InternalStatus>> InternalStatusListAsync()
    {
        return await _context.TucJobInternalStatuses
            .OrderBy(u => u.Tcis)
            .Select(x => new InternalStatus
            {
                ID = x.Tcis,
                Text = x.TcisName,
                DefaultSchedule = x.DefaultSchedule,
                DefaultMins = x.DefaultMinutes
            })
            .ToListAsync();
    }

    public async Task<List<Lookup>> EventTypeListAsync()
    {
        return await _context.TucEventTypes
            .Where(u => u.UcetGroup == "CS" || u.UcetGroup == "GE")
            .OrderBy(u => u.UcetName)
            .Select(x => new Lookup
            {
                ID = x.UcetId,
                Text = x.UcetName
            })
            .ToListAsync();
    }


    public async Task<decimal> RateTruckJob(int clientId, int fromId, int toId, double weight, int size, int speed,
        int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
        int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours)
    {
        DbParameter outputDescriptionParam = null;
        DbParameter outputRateParam = null;

        await _context.LoadStoredProc("DES_stpJob_Truck_Rate_Described")
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

    public async Task<string> RateTruckJobDescription(int clientId, int fromId, int toId, double weight, int size,
        int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
        int overWeightItems, int dGClass, DateTime truckStartTime, double truckHours)
    {
        DbParameter outputDescriptionParam = null;
        DbParameter outputRateParam = null;

        await _context.LoadStoredProc("DES_stpJob_Truck_Rate_Described")
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

    public async Task<decimal> RateJobAsync(int clientId, int fromId, int toId, int speed, bool pedal, bool van,
        bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
        string ourRef, string refA, string refB, int quantity, DateTime booked)
    {
        var curAmount = new OutputParameter<decimal?>();

        await _context.Procedures.sp_RateJob2Async(
            clientId,
            fromId,
            toId,
            speed,
            pedal,
            van,
            returnJob,
            weight,
            size,
            includeFuelSurcharge,
            ourRef,
            refA,
            refB,
            quantity,
            booked,
            curAmount
        );

        return curAmount.Value ?? 0;
    }

    public async Task<string> RateJobDescription(int clientId, int fromId, int toId, int speed, bool pedal, bool van,
        bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
        string ourRef, string refA, string refB, int quantity, DateTime booked)
    {
        DbParameter outputDescriptionParam = null;
        DbParameter outputCourierParam = null;

        await _context.LoadStoredProc("sp_RateJob_Described")
            .WithSqlParam("@intClientID", clientId)
            .WithSqlParam("@intFromID", fromId)
            .WithSqlParam("@intToID", toId)
            .WithSqlParam("@intSpeed", direct ? acceptedJobTypeId : speed)
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

    public async Task<DirectToASAPViewModel> DirectToAsap(int jobId)
    {
        var result = new List<DirectToASAPViewModel>();
        await _context.LoadStoredProc("DESWEB_stpJob_DirectToASAP")
            .WithSqlParam("@JobID", jobId)
            .ExecuteStoredProcAsync(handle => { result = handle.ReadToList<DirectToASAPViewModel>().ToList(); });
        return result.FirstOrDefault();
    }

    public async Task<UpdateFirstAvailableSpeedResult> UpdateFirstAvailableSpeed(int jobId)
    {
        DbParameter outputParam = null;
        DbParameter nameOutput = null;
        await _context.LoadStoredProc("DESWEB_stpJob_UpdateFirstAvailableSpeed")
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
        var updateReturn = new UpdateFirstAvailableSpeedResult
        {
            JobTypeId = (int)outputParam.Value,
            Name = (string)nameOutput.Value
        };
        return updateReturn;
    }

    public async Task<SettingsViewModel> SettingsAsync()
    {
        var result = await _context.Procedures.DES_stpSettingsAsync();
        var settingsResult = result.FirstOrDefault();

        return settingsResult == null
            ? new SettingsViewModel()
            : _mapper.Map<SettingsViewModel>(settingsResult);
    }

    public async Task AddPalletInfoAsync(PalletInfo p, bool preBook, string despatcher)
    {
        await _context.Procedures.DESWEB_stpJobItems_InsertAsync(
            p.Id, p.Quantity, p.Weight, p.Length, p.Height, p.Depth,
            p.Pu, p.Do, p.DgClass, p.Notes, preBook, despatcher);
    }

    public async Task EditPalletInfoAsync(PalletInfo p, bool preBook, string despatcher)
    {
        await _context.Procedures.DESWEB_stpJobItems_UpdateAsync(
            p.Id, p.ItemId, p.Quantity, p.Weight, p.Length, p.Height,
            p.Depth,
            p.Pu, p.Do, p.DgClass, p.Notes, preBook, despatcher);
    }

    public async Task DeletePalletInfoAsync(PalletInfo p, bool preBook, string despatcher)
    {
        await _context.Procedures.DESWEB_stpJobItems_DeleteAsync(p.Id, p.ItemId, preBook,
            despatcher);
    }

    public async Task SendPrebookJobAsync(int jobId)
    {
        await _context.Procedures.DES_stpJobBooking_InsertJobAndChildrenAsync(jobId);
    }

    public async Task VoidPrebookJobAsync(int jobId, string despatcher, int staffId)
    {
        await _context.Procedures.DESWEB_stpVoidPrebookJobAsync(jobId, despatcher,
            staffId);
    }

    public async Task<TruckItemsSummary> TruckJobItemsAsync(int jobId, int truckWeightLimit)
    {
        var result = await _context.Procedures.qry_tucJobItemsAsync(jobId, truckWeightLimit);
        return result.Select(item => new TruckItemsSummary
            {
                intQuantity = item.intQuantity,
                intWeight = item.intWeight,
                TotalWeight = item.totalWeight,
                intPU = item.intPU,
                intDO = item.intDO,
                intOverSizeItems = item.intOversizeItems,
                intOverWeightItems = item.intOverWeightItems,
                DGClass = item.DGClass
            })
            .FirstOrDefault() ?? new TruckItemsSummary();
    }

    public async Task UpdateDeliveryAddressAsync(int jobId, int toSuburbId, string address, decimal deliveryLat,
        decimal deliveryLng, bool cbd, decimal rate, string despatcher)
    {
        await _context.Procedures.DESWEB_stpUpdateJobDeliveryAddressAsync(jobId, toSuburbId,
            address, deliveryLat,
            deliveryLng, cbd, rate, despatcher);
    }

    public async Task UpdateBulkDeliveryAddressAsync(int bulkJobId, string toSuburb, int toPostCode, string address,
        decimal deliveryLat, decimal deliveryLng, string despatcher)
    {
        await _context.Procedures.DESWEB_stpUpdateBulkJobDeliveryAddressAsync(bulkJobId, toSuburb,
            toPostCode, address,
            deliveryLat, deliveryLng, despatcher);
    }

    public async Task UpdatePickupAddressAsync(int jobId, int fromSuburbId, string address, decimal pickupLat,
        decimal pickupLng, bool cbd, decimal rate, string despatcher)
    {
        await _context.Procedures.DESWEB_stpUpdateJobPickupAddressAsync(jobId, fromSuburbId,
            address, pickupLat,
            pickupLng, cbd, rate, despatcher);
    }

    public async Task UpdateJobTypeAsync(int jobId, int jobType, string despatcher)
    {
        await _context.Procedures.DESWEB_stpUpdateJobTypeAsync(jobId, jobType, despatcher);
    }

    public async Task UpdateBulkPickupAddressAsync(int bulkJobId, string fromSuburb, int fromPostCode, string address,
        decimal pickupLat, decimal pickupLng, string despatcher)
    {
        await _context.Procedures.DESWEB_stpUpdateBulkJobPickupAddressAsync(bulkJobId,
            fromSuburb, fromPostCode,
            address, pickupLat, pickupLng, despatcher);
    }

    public async Task UpdateBookingDeliveryAddressAsync(int jobId, int toSuburbId, string address, decimal deliveryLat,
        decimal deliveryLng, bool cbd, decimal rate, string despatcher)
    {
        await _context.Procedures.DESWEB_stpUpdateJobBookingDeliveryAddressAsync(jobId, toSuburbId,
            address,
            deliveryLat, deliveryLng, cbd, rate, despatcher);
    }

    public async Task UpdateBookingPickupAddressAsync(int jobId, int fromSuburbId, string address, decimal pickupLat,
        decimal pickupLng, bool cbd, decimal rate, string despatcher)
    {
        await _context.Procedures.DESWEB_stpUpdateJobBookingPickupAddressAsync(jobId, fromSuburbId,
            address, pickupLat, pickupLng, cbd, rate,
            despatcher);
    }

    public async Task ReleaseBulkJobAsync(string jobNumber, DateTime bookDate)
    {
        await _context.Procedures.UTL_stpJob_tblBulkJob_ReleaseByJobNumberAsync(
            jobNumber,
            bookDate);
    }

    public async Task UpdateJobAsync(int jobId, string field, string value, decimal? rate, string despatcher,
        int staffId)
    {
        await _context.Procedures.DESWEB_stpUpdateJobAsync(
            jobId,
            field,
            value,
            rate,
            despatcher,
            staffId);
    }


    public async Task UpdateBulkJobAsync(int bulkJobId, string field, string value, decimal? rate, string despatcher,
        int staffId)
    {
        await _context.Procedures.DESWEB_stpUpdateBulkJobAsync(
            bulkJobId,
            field,
            value,
            rate,
            despatcher,
            staffId);
    }

    public async Task UpdateJobBookingAsync(int jobId, string field, string value, decimal? rate, string despatcher,
        int staffId)
    {
        await _context.Procedures.DESWEB_stpUpdateJobBookingAsync(
            jobId,
            field,
            value,
            rate,
            despatcher,
            staffId);
    }

    public async Task AddNoteAsync(int jobId, string note, string despatcher)
    {
        await _context.Procedures.DESWEB_stpJob_AddNotesAsync(
            jobId,
            note,
            despatcher);
    }

    public async Task AddBulkJobNoteAsync(int bulkJobId, string note, string despatcher)
    {
        await _context.Procedures.DESWEB_stpBulkJob_AddNotesAsync(
            bulkJobId,
            note,
            despatcher);
    }

    public async Task AddJobBookingNoteAsync(int jobId, string note, string despatcher)
    {
        await _context.Procedures.DES_stpJobBooking_AddNotesAsync(
            jobId,
            note,
            despatcher);
    }

    public async Task<int> QuickAddJobAsync(JobCreateViewModel job, int staffId)
    {
        var jobId = new OutputParameter<int?>();

        await _context.Procedures.DESWEB_stpQuickCreateJobAsync(
            job.ClientId,
            job.PickUpAddress?.AddressLine1,
            job.PickUpAddress?.AddressLine2,
            job.PickUpAddress?.AddressLine3,
            job.PickUpAddress?.AddressLine4,
            job.PickUpAddress?.AddressLine5,
            job.PickUpAddress?.AddressLine6,
            job.PickUpAddress?.AddressLine7,
            job.PickUpAddress?.AddressLine8,
            job.FromLat,
            job.FromLong,
            job.DeliveryAddress?.AddressLine1,
            job.DeliveryAddress?.AddressLine2,
            job.DeliveryAddress?.AddressLine3,
            job.DeliveryAddress?.AddressLine4,
            job.DeliveryAddress?.AddressLine5,
            job.DeliveryAddress?.AddressLine6,
            job.DeliveryAddress?.AddressLine7,
            job.DeliveryAddress?.AddressLine8,
            job.ToLat,
            job.ToLong,
            job.FromContactName,
            job.Date,
            job.Void,
            job.Van,
            job.Attention,
            job.DeliverToContact,
            job.PodName,
            job.Truck,
            job.VanOk,
            job.Reprice,
            job.Charge,
            job.SpeedId,
            staffId,
            job.RefA,
            job.RefB,
            jobId);

        return jobId.Value ?? 0;
    }

    public async Task AddInterCourierChargeAsync(InterCourierChargeViewModel viewModel)
    {
        await _context.Procedures.DESWEB_stpCreateInterCourierJobsAsync(
            viewModel?.FromCourierId,
            viewModel?.ToCourierId,
            viewModel?.Amount,
            viewModel?.Reference,
            viewModel?.StaffId
        );
    }

    public async Task<bool> HasClientItemsAvailableAsync(int clientId, int speedId)
    {
        var query =
            from cas in _context.TblClientAvailableSpeeds
            where cas.ClientId == clientId && cas.SpeedId == speedId
            join casi in _context.TblClientAvailableSpeedItems on cas.Id equals casi.ClientAvailableSpeedId
            where casi.Active
            join ci in _context.TucClientItems on casi.ClientItemId equals ci.ItemId
            select ci;

        var count = await query.CountAsync();

        return count > 0;
    }

    public async Task<PagedList<ClientItemsViewModel>> GetClientItemsBySpeedAsync(int clientId, int speedId,
        int jobId)
    {
        var job = await GetJobInfo(jobId);
        var clientItemIds = GetClientItemIds(job?.ClientItemIds);
        var clientItemsQuery =
            BuildClientItemsQuery(clientId, speedId, clientItemIds);
        return await CreatePagedList(clientItemsQuery);
    }

    public async Task AddClientsItemToJobAsync(int jobId, List<int> clientItemIds, decimal totalCost)
    {
        var clientItemsString = clientItemIds is null || !clientItemIds.Any()
            ? string.Empty
            : string.Join(",", clientItemIds);

        var job = new TucJob { UcjbId = jobId, ClientItemIds = clientItemsString, UcjbAmount = totalCost };

        _context.TucJobs.Attach(job);
        _context.Entry(job).Property(x => x.ClientItemIds).IsModified = true;
        _context.Entry(job).Property(x => x.UcjbAmount).IsModified = true;
        await _context.SaveChangesAsync();
    }


    public async Task<(string toAirport, string fromAirport)> GetAirportCodesByJobIdAsync(int jobId)
    {
        var airportCodes = await _context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new
            {
                ToAirport = j.ToAirport.AirportCode,
                FromAirport = j.FromAirport.AirportCode
            })
            .FirstOrDefaultAsync();

        return (airportCodes?.ToAirport, airportCodes?.FromAirport);
    }


    private static string GetOrderByClause(string order, string ascending)
    {
        var ascDesc = ascending != null && ascending.Equals("asc", StringComparison.OrdinalIgnoreCase) ? "ASC" : "DESC";

        return order?.ToLowerInvariant() switch
        {
            "remain" => $"ucjbDispTime {ascDesc}, RemainTime {ascDesc}, ucjbTime {ascDesc}",
            "to" => $"SuburbTo {ascDesc}, ucjbTime {ascDesc}, SuburbFrom {ascDesc}, CourierCode {ascDesc}",
            "from" => $"SuburbFrom {ascDesc}, SuburbTo {ascDesc}, ucjbTime {ascDesc}, CourierCode {ascDesc}",
            "client" => $"ucclCode {ascDesc}, ucjbTime {ascDesc}, CourierCode {ascDesc}",
            "jobno" => $"ucjbNumber {ascDesc}, ucjbTime {ascDesc}, CourierCode {ascDesc}",
            "status" => $"ucjbStatus {ascDesc}",
            "speed" => $"SpeedShortName {ascDesc}",
            "notify" => $"NotifiedSpeed {ascDesc}",
            "lp" => $"ucjbLatePick {ascDesc}",
            "ld" => $"ucjbLateDel {ascDesc}",
            "time" => $"ucjbTime {ascDesc}",
            _ => $"RemainTime {ascDesc}"
        };
    }

    private static string BuildWhereClause(bool isInternal, List<string> viewFilters, string status, string clientIds)
    {
        var whereClauses = new List<string>();

        switch (isInternal)
        {
            // Handle internal/external logic
            case true:
            {
                if (viewFilters != null && viewFilters.Any()) whereClauses.Add($"({string.Join(" OR ", viewFilters)})");
                break;
            }
            default:
            {
                if (!string.IsNullOrEmpty(clientIds)) whereClauses.Add($"ucjbClientID IN ({clientIds})");
                break;
            }
        }

        // Handle status
        switch (status?.ToLower())
        {
            case "new":
                whereClauses.Add("(ucjbCourierID IS NULL OR ucjsCode = 'D' OR ucjsCode = 'N')");
                break;
            case "nda":
                whereClauses.Add(
                    "(ucjbCourierID IS NULL OR ucjsCode = 'N' OR ucjsCode = 'D' OR ucjsCode = 'A' OR ucjsCode = 'LP')");
                break;
            case "active":
                whereClauses.Add("ucjbJobDone = 0");
                break;
            case "done":
                whereClauses.Add("ucjbJobDone = 1");
                break;
            case "all":
                // No additional filter for "all"
                break;
        }

        // Always exclude status 9
        whereClauses.Add("ucjbStatus <> 9");

        // Combine all where clauses
        return string.Join(" AND ", whereClauses);
    }

    private async Task<List<Size>> GetRelatedJobsAsync(int? rootParentId, int clientId)
    {
        if (!rootParentId.HasValue) return new List<Size>();

        return await _context.TblJobs
            .Where(r => r.ParentId == rootParentId && r.ClientId == clientId)
            .OrderBy(t => t.Date)
            .ThenBy(x => x.Time)
            .Select(rel => new Size
            {
                Id = rel.JobId,
                Label = rel.Number
            })
            .ToListAsync();
    }

    private async Task<List<byte[]>> GetPodPhotosAsync(int jobId, byte[] podPhoto, byte[] deliverySignature)
    {
        var photos = new List<byte[]>();
        if (podPhoto != null) photos.Add(podPhoto);
        if (deliverySignature != null) photos.Add(deliverySignature);

        photos.AddRange(await _context.DeliveryPhotos
            .Where(d => d.JobId == jobId)
            .Select(del => del.Photo)
            .ToListAsync());

        return photos;
    }

    private async Task<JobInfo> GetJobInfo(int jobId)
    {
        return await _context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new JobInfo
            {
                ClientItemIds = j.ClientItemIds,
                IsVan = j.UcjbSize == 3
            })
            .FirstOrDefaultAsync();
    }

    private static IEnumerable<int> GetClientItemIds(string clientItemIdsString)
    {
        if (string.IsNullOrEmpty(clientItemIdsString))
            return Enumerable.Empty<int>();

        return clientItemIdsString.Split(',')
            .Where(s => !string.IsNullOrEmpty(s))
            .Select(int.Parse);
    }

    private IQueryable<ClientItemsViewModel> BuildClientItemsQuery(int clientId, int speedId,
        IEnumerable<int> clientItemIds)
    {
        var query =
            from cas in _context.TblClientAvailableSpeeds
            where cas.ClientId == clientId && cas.SpeedId == speedId
            join casi in _context.TblClientAvailableSpeedItems on cas.Id equals casi.ClientAvailableSpeedId
            where casi.Active
            join ci in _context.TucClientItems on casi.ClientItemId equals ci.ItemId
            where ci.ClientId == clientId
            orderby ci.Name
            select new ClientItemsViewModel
            {
                ItemId = ci.ItemId,
                ClientId = ci.ClientId,
                Name = ci.Name,
                Description = ci.Description,
                PerItem = ci.PerItem,
                Rate = ci.Rate,
                OnlyVan = ci.OnlyVan,
                Selected = clientItemIds.Contains(ci.ItemId)
            };

        return query;
    }

    private static async Task<PagedList<ClientItemsViewModel>> CreatePagedList(IQueryable<ClientItemsViewModel> query)
    {
        var count = await query.CountAsync();
        var items = await query.ToListAsync();

        return new PagedList<ClientItemsViewModel>
        {
            Items = items,
            TotalCount = count
        };
    }

    private async Task<decimal> CalculateAmountAsync(int clientId, decimal amount)
    {
        var outputParam = new OutputParameter<decimal?>();
        await _context.Procedures.UTL_stpPPD_ExclusiveAmountAsync(
            clientId,
            amount,
            outputParam
        );

        return outputParam.Value ?? 0m;
    }
}