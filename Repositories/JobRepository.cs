using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.Controllers;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Serilog;
using Vehicle = DespatchWeb.Models.Vehicle;

namespace DespatchWeb.Repositories;

public class JobRepository(IMapper mapper, IDbContextFactory<DespatchContext> contextFactory) : BaseJobRepository(contextFactory),  IJobRepository
{
    
    public async Task<JobViewModel> PreBookDetailAsync(int prebookId)
    {
        return await Context.TucJobBookings
            .Where(jb => jb.UcbkId == prebookId)
            .Select(jb => new JobViewModel
            {
                Id = jb.UcbkId,
                Time = jb.UcbkTime,
                BookedDate = jb.UcbkDate,
                Date = jb.UcbkDate != null ? jb.UcbkDate.Value.ToString("dd/MM/yyyy") : null,
                Booked = jb.UcbkDate != null && jb.UcbkTime != null
                    ? DateTime.Parse(jb.UcbkDate.Value.ToString("yyyy-MM-dd") + " " +
                                     jb.UcbkTime.Value.ToString("HH:mm:ss"))
                    : DateTime.MinValue,
                Direct = jb.Direct,
                SizeId = jb.UcbkSize,
                Van = jb.UcbkVan,
                VanOk = jb.VanOk,
                Truck = jb.Truck,
                SaturdayDelivery = jb.SaturdayDelivery,
                Return = jb.UcbkReturn,
                Attention = jb.UcbkAttention,
                Done = jb.UcbkDone,
                PickupFrom = (short?)jb.UcbkPickUpFrom,
                JobNo = jb.UcbkJobNumber,
                Speed = jb.UcbkSpeedNavigation != null ? jb.UcbkSpeedNavigation.ShortName : null,
                SpeedName = jb.UcbkSpeedNavigation != null ? jb.UcbkSpeedNavigation.UcjtName : null,
                SpeedId = jb.UcbkSpeed,
                AcceptedJobTypeId = jb.AcceptedJobTypeId,
                NotifiedJobTypeId = jb.NotifiedJobTypeId,
                Source = jb.Source != null ? jb.Source.Name : null,
                Client = jb.UcbkClientCode,
                ClientId = jb.UcbkClientId,
                ClientName = jb.UcbkClient != null ? jb.UcbkClient.UcclName : null,
                JobType = (int)jb.UcbkType,
                PickupAddress = new AddressViewModel
                {
                    AddressLine1 = jb.PickupAddressLine1,
                    AddressLine2 = jb.PickupAddressLine2,
                    AddressLine3 = jb.PickupAddressLine3,
                    AddressLine4 = jb.PickupAddressLine4,
                    AddressLine5 = jb.PickupAddressLine5,
                    AddressLine6 = jb.PickupAddressLine6,
                    AddressLine7 = jb.PickupAddressLine7,
                    AddressLine8 = jb.PickupAddressLine8,
                    Latitude = jb.PickUpLatitude,
                    Longitude = jb.PickUpLongitude,
                },
                DeliveryAddress = new AddressViewModel
                {
                    AddressLine1 = jb.DeliveryAddressLine1,
                    AddressLine2 = jb.DeliveryAddressLine2,
                    AddressLine3 = jb.DeliveryAddressLine3,
                    AddressLine4 = jb.DeliveryAddressLine4,
                    AddressLine5 = jb.DeliveryAddressLine5,
                    AddressLine6 = jb.DeliveryAddressLine6,
                    AddressLine7 = jb.DeliveryAddressLine7,
                    AddressLine8 = jb.DeliveryAddressLine8,
                    Latitude = jb.DeliveryLatitude,
                    Longitude = jb.DeliveryLongitude,
                },
                FromContactName = jb.PickupFromContact,
                FromContactNumber = jb.PickupFromPhone,
                Courier = jb.Courier != null ? jb.Courier.Code : null,
                ContactName = jb.UcbkContact,
                Phone = jb.DeliverToPhone,
                Weight = jb.UcbkWeight,
                Items = jb.Quantity,
                RefA = jb.UcbkClientRefa,
                RefB = jb.UcbkClientRefb,
                OurRef = jb.UcbkOurRef,
                Charge = jb.UcbkAmount != null ? $"{jb.UcbkAmount:C}" : null,
                ClientNotes = jb.UcbkClient != null ? jb.UcbkClient.UcclNotes : null,
                InternalNotes = jb.UcbkNotes,
                CourierData = new CourierData
                {
                    Courier = jb.Courier != null
                        ? jb.Courier.Code + " " + jb.Courier.UccrName + " " + jb.Courier.UccrSurname
                        : null,
                    CourierId = jb.Courier != null ? jb.Courier.UccrId : null
                },
                DgClass = jb.Dgclass,
                DgDocumentation = jb.Dgdocument,
                DeliverToContact = jb.DeliverToContact,
                TrackingMethod = jb.TrackingMethod,
                TrackingMobile = jb.TrackingMobile,
                TrackingEmail = jb.TrackingEmail,
                RatedManually = jb.RatedManually,
                OneOff = jb.UcbkOneOff,
                Active = jb.UcbkActive,
                InActiveBy = jb.UcbkInActiveBy,
                InActiveDate = jb.UcbkInActiveDate,
                FirstDue = jb.UcbkFirstDue,
                NextDue = jb.UcbkNextDue,
                LastDone = jb.UcbkDateDone,
                RestartDate = jb.RestartDate,
                StopDate = jb.StopDate,
                Days = jb.UcbkDays,
                PreBook = true,
                Pedal = jb.UcbkCbd,
                Reprice = jb.Reprice,
                LoggedInContactName = jb.LoggedInContact.UccoName,
                PalletInfo = jb.TucJobBookingItems.Select(i => new PalletInfo
                {
                    Id = i.BookingId,
                    Quantity = i.Items,
                    ItemId = i.ItemId,
                    Weight = i.Weight,
                    Length = i.Length,
                    Depth = i.Depth,
                    Height = i.Height,
                    Pu = i.Pu,
                    Do = i.Do,
                    DgClass = i.Dgclass,
                    Notes = i.Notes
                }).ToList()
            }).FirstOrDefaultAsync();
    }

    public async Task<List<Size>> RelatedJobs(int parentId, int clientId)
    {
        return await Context.TucJobs
            .Where(j => j.ParentId == parentId && j.UcjbClientId == clientId)
            .OrderBy(j => j.UcjbDate)
            .ThenBy(j => j.UcjbTime)
            .Select(j => new Size
            {
                Id = j.UcjbId,
                Label = j.UcjbNumber
            }).AsNoTracking().ToListAsync();
    }

    /* Bulk Job Detail*/

    public async Task<JobViewModel> BulkJobDetail(int bulkJobId)
    {
        var today = DateTime.Today.ResetTimeToStartOfDay();

        return await (from j in Context.TblBulkJobs
            join c in Context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
            from to in speedJoin.DefaultIfEmpty()
            join cl in Context.TblClients on j.ClientId equals cl.ClientId into clientJoin
            from client in clientJoin.DefaultIfEmpty()
            join s in Context.TucJobStatuses on j.JobStatus equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join l in Context.TblJobLeaveNotHomes on j.DeliverToLeaveId equals l.LeaveNotHomeId into leaveNotHomeJoin
            from leave in leaveNotHomeJoin.DefaultIfEmpty()
            join sc in Context.TblBulkRunSchedules on j.ScheduleId equals sc.BulkRunScheduleId into scheduleJoin
            from schedule in scheduleJoin.DefaultIfEmpty()
            join con in Context.TblContacts on j.LoggedInContactId equals con.ContactId into contactJoin
            from contact in contactJoin.DefaultIfEmpty()
            join sou in Context.TucSources on j.SourceId equals sou.SourceId into sourceJoin
            from source in sourceJoin.DefaultIfEmpty()
            where j.BulkJobId == bulkJobId
            select new JobViewModel
            {
                Id = j.BulkJobId,
                JobRelationshipTypeId = j.JobRelationshipTypeId,
                Time = j.BookTime,
                BookedDate = j.BookDate,
                Date = j.BookDate.ToString("dd/MM/yyyy"),
                Booked =
                    DateTime.Parse(j.BookDate.ToString("yyyy-MM-dd") + " " +
                                   j.BookDate.ToString("HH:mm:ss")),
                Void = j.Void,
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
            }).FirstOrDefaultAsync();
    }

    public async Task<Tuple<int, List<JobViewModel>>> BulkSearchAsync(int? courierId, string job, string wild,
        DateTime fromDate,
        DateTime toDate, int? clientId, int pageIndex, int pageSize)
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";

        var jobsQuery = from x in Context.TblBulkJobs
            join c in Context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
            from courier in courierJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on x.Speed equals t.UcjtId into speedJoin
            from speed in speedJoin.DefaultIfEmpty()
            join s in Context.TucJobStatuses on x.JobStatus equals s.UcjsId into statusJoin
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
        var total = await jobsQuery.CountAsync();
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

        var jobsQuery = from x in Context.TblJobs
            join c in Context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join y in Context.TucSuburbs on x.FromSuburbId equals y.UcsuId into fromJoin
            from yo in fromJoin.DefaultIfEmpty()
            join z in Context.TucSuburbs on x.ToSuburbId equals z.UcsuId into toJoin
            from zo in toJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on x.Speed equals t.UcjtId into speedJoin
            from to in speedJoin.DefaultIfEmpty()
            join s in Context.TucJobStatuses on x.Status equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join nw in Context.TucJobNationwides on x.JobId equals nw.UcnwJobId into nationwideJoin
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

    public async Task UpdateManualPriceAsync(List<JobManualPriceModel> data)
    {
        if (data.Any(d =>
                d.Id <= 0
                ||
                (d.Amount > 0 && (d.Ppd < 0 || d.Fuel < 0 || d.CourierPayment < 0 || d.CourierFuel < 0 ||
                                  d.CourierBonus < 0 || d.Amount < (d.Ppd + d.Fuel) ||
                                  d.Amount < (d.CourierPayment + d.CourierFuel + d.CourierBonus)))
                ||
                (d.Amount < 0 && (d.Ppd > 0 || d.Fuel > 0 || d.CourierPayment > 0 || d.CourierFuel > 0 ||
                                  d.CourierBonus > 0 || d.Amount > (d.Ppd + d.Fuel) ||
                                  d.Amount > (d.CourierPayment + d.CourierFuel + d.CourierBonus)))
            ))
            throw new ArgumentException("Invalid Values.");

        var jobIds = data.Select(j => j.Id).Distinct().ToList();

        if (!jobIds.Any())
            return;

        var idData = await Context.TblJobs
            .Where(j => jobIds.Contains(j.JobId) || (j.ParentId.HasValue && jobIds.Contains(j.ParentId.Value)))
            .Select(j => new { j.JobId, ParentId = j.ParentId ?? j.JobId })
            .ToListAsync();

        var ids = idData
            .Select(j => j.JobId)
            .Concat(idData.Select(j => j.ParentId))
            .Distinct()
            .ToList();

        var dbData = await Context.TucJobs
            .Where(j => ids.Contains(j.UcjbId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value)))
            .ToListAsync();

        var dbDataArchive = await Context.TucJobArchives
            .Where(j => ids.Contains(j.UcjbId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value)))
            .ToListAsync();

        foreach (var d in data)
        {
            dynamic match = (dynamic)dbData.FirstOrDefault(j => j.UcjbId == d.Id) ??
                            (dynamic)dbDataArchive.FirstOrDefault(j => j.UcjbId == d.Id);

            if (match == null)
                throw new ArgumentException("Id not found.", "Id");

            match.UcjbAmount = Math.Round(d.Amount, 4, MidpointRounding.AwayFromZero);
            match.FuelSurchargeAmount = Math.Round(d.Fuel, 4, MidpointRounding.AwayFromZero);
            match.PpdexclusiveAmount = Math.Round(d.Ppd, 4, MidpointRounding.AwayFromZero);
            match.CourierPercentage = null;
            match.CourierPayment = Math.Round(d.CourierPayment, 4, MidpointRounding.AwayFromZero);
            match.CourierFuel = Math.Round(d.CourierFuel, 4, MidpointRounding.AwayFromZero);
            match.CourierBonus = Math.Round(d.CourierBonus, 4, MidpointRounding.AwayFromZero);
            match.RawBaseAmount = match.UcjbAmount - match.FuelSurchargeAmount - match.PpdexclusiveAmount;
        }

        var parentJobs = dbData
            .Select(j => new
            {
                j.UcjbId, ParentId = j.ParentId ?? j.UcjbId, j.UcjbAmount, j.FuelSurchargeAmount, j.PpdexclusiveAmount
            })
            .Concat(dbDataArchive.Select(j => new
            {
                j.UcjbId, ParentId = j.ParentId ?? j.UcjbId, j.UcjbAmount, j.FuelSurchargeAmount, j.PpdexclusiveAmount
            }))
            .GroupBy(j => j.ParentId)
            .Where(x => x.Count() > 1)
            .ToList();

        foreach (var x in parentJobs)
        {
            dynamic parentJob = (dynamic)dbData.FirstOrDefault(j => j.UcjbId == x.Key) ??
                                (dynamic)dbDataArchive.First(j => j.UcjbId == x.Key);
            var childJobs = x.Where(j => j.UcjbId != parentJob.UcjbId).ToList();

            if (!childJobs.Any())
                continue;

            parentJob.UcjbAmount = childJobs.Sum(j => j.UcjbAmount ?? 0);
            parentJob.FuelSurchargeAmount = childJobs.Sum(j => j.FuelSurchargeAmount);
            parentJob.PpdexclusiveAmount = childJobs.Sum(j => j.PpdexclusiveAmount ?? 0);
            parentJob.RawBaseAmount =
                parentJob.UcjbAmount - parentJob.FuelSurchargeAmount - parentJob.PpdexclusiveAmount;
        }

        foreach (var d in dbData)
        {
            d.UcjbLocked = true;
        }

        foreach (var d in dbDataArchive)
        {
            d.UcjbLocked = 1;
        }

        await Context.SaveChangesAsync();
    }

    public async Task<List<JobDownloadModel>> PodSearchDownloadAsync(int? courierId, string wild, string job,
        DateTime fromDate,
        DateTime toDate, int? clientId)
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";

        var jobsQuery = from x in Context.TblJobs
            join y in Context.TucSuburbs on x.FromSuburbId equals y.UcsuId into fromJoin
            from yo in fromJoin.DefaultIfEmpty()
            join z in Context.TucSuburbs on x.ToSuburbId equals z.UcsuId into toJoin
            from zo in toJoin.DefaultIfEmpty()
            join nw in Context.TucJobNationwides on x.JobId equals nw.UcnwJobId into nationwideJoin
            from nationwide in nationwideJoin.DefaultIfEmpty()
            where x.Date >= fromDate && x.Date <= toDate && (!clientSet || x.ClientId == clientId) &&
                  (!courierSet || x.CourierId == courierId) &&
                  (job == "" || EF.Functions.Like(x.Number.ToLower(), jobParam)) &&
                  (wild == "" || EF.Functions.Like(nationwide.UcnwConNote, wildParam) || EF.Functions.Like(
                      x.FromAddress + " " + x.PickupFromContact + " " + yo.UcsuName + " " + x.ToAddress + " " +
                      x.DeliverToContact + " " + zo.UcsuName + " " + (x.ClientReferenceA ?? "") + " " +
                      (x.ClientReferenceB ?? "") + " " + (x.OurRef ?? "") + " " + x.Number.ToLower(), wildParam))
            select new { x.JobId, x.ParentId };

        var jobIds = await jobsQuery.ToListAsync();

        var ids = jobIds
            .Select(j => j.JobId)
            .ToList();

        var parentIds = jobIds
            .Where(j => j.ParentId.HasValue)
            .Select(j => j.ParentId.Value)
            .ToList();

        if (parentIds.Any())
            ids.AddRange(parentIds);

        ids = ids.Distinct().ToList();

        if (ids == null || !ids.Any())
            return new List<JobDownloadModel>();

        var query = from j in Context.TblJobs
            where ids.Contains(j.JobId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value))
            orderby j.Number
            select new JobDownloadModel
            {
                Id = j.JobId,
                ParentId = j.ParentId,
                JobNumber = j.Number,
                BookDate = DateTime.Parse($"{j.Date.Value.ToString("yyyy-MM-dd")} {j.Time.Value.ToString("HH:mm:ss")}"),
                Amount = j.Amount,
                Fuel = j.FuelSurchargeAmount,
                Ppd = j.Ppdexclusiveamount,
                CourierPayment = j.CourierPayment,
                CourierFuel = j.CourierFuel,
                CourierBonus = j.CourierBonus,
                Quantity = j.Quantity,
                Weight = j.Weight,
                Size = j.Size,
                PickupAddressLine1 = j.PickupAddressLine1,
                PickupAddressLine2 = j.PickupAddressLine2,
                PickupAddressLine3 = j.PickupAddressLine3,
                PickupAddressLine4 = j.PickupAddressLine4,
                PickupAddressLine5 = j.PickupAddressLine5,
                PickupAddressLine6 = j.PickupAddressLine6,
                PickupAddressLine7 = j.PickupAddressLine7,
                PickupAddressLine8 = j.PickupAddressLine8,
                DeliveryAddressLine1 = j.DeliveryAddressLine1,
                DeliveryAddressLine2 = j.DeliveryAddressLine2,
                DeliveryAddressLine3 = j.DeliveryAddressLine3,
                DeliveryAddressLine4 = j.DeliveryAddressLine4,
                DeliveryAddressLine5 = j.DeliveryAddressLine5,
                DeliveryAddressLine6 = j.DeliveryAddressLine6,
                DeliveryAddressLine7 = j.DeliveryAddressLine7,
                DeliveryAddressLine8 = j.DeliveryAddressLine8,
                ClientReferenceA = j.ClientReferenceA,
                ClientReferenceB = j.ClientReferenceB,
                ClientReferenceC = j.ClientReferenceC
            };

        var result = await query.ToListAsync();

        //Return single jobs and child jobs only, ignore parent of child jobs
        return result
            .Where(j => j.Id != (j.ParentId ?? j.Id) || !result.Any(x => x.Id != j.Id && x.ParentId == j.Id))
            .ToList();
    }

    public async Task<Tuple<int, List<JobViewModel>>> PreBookSearchAsync(int? courierId, string wild, string job,
        DateTime fromDate, DateTime toDate, int? clientId, int pageIndex, int pageSize)
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";
        var jobsQuery = from x in Context.TucJobBookings
            join c in Context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join y in Context.TucSuburbs on x.UcbkFrom equals y.UcsuId into fromJoin
            from yo in fromJoin.DefaultIfEmpty()
            join z in Context.TucSuburbs on x.UcbkTo equals z.UcsuId into toJoin
            from zo in toJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on (int)x.UcbkSpeed equals t.UcjtId into speedJoin
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
        var total = await jobsQuery.CountAsync();
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
        var jobs = await Context.UvwBookingTodays
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
        return await Context.TucCouriers
            .Where(c => c.UccrId == courierId)
            .SelectMany(c => c.TucJobUcjbCouriers)
            .Where(j => j.UcjbJobDone == done)
            .Select(j => new JobViewModel
            {
                ClientId = j.UcjbClientId,
                Id = j.UcjbId,
                JobNo = j.UcjbNumber,
                Time = j.UcjbTime,
                RootParentId = j.RootParentId,
                Date = j.UcjbDate.ToString("MM/dd/yyyy"),
                Booked =
                    DateTime.Parse(j.UcjbDate.ToString("yyyy-MM-dd") + " " + j.UcjbTime.Value.ToString("HH:mm:ss")),
                DispatchTime = j.UcjbDispTime,
                CreatedDate = j.UcjbDate,
                ScheduleName = j.ScheduleName,

                PickupTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.PickupTime : null,
                DeliveryTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.DeliveryTime : null,

                // Courier
                Courier = j.UcjbCourier != null ? j.UcjbCourier.Code : null,
                CourierData = j.UcjbCourier != null
                    ? new CourierData
                    {
                        Courier = string.IsNullOrEmpty(j.UcjbCourier.Code)
                            ? string.Empty
                            : j.UcjbCourier.Code + " " + j.UcjbCourier.UccrName,
                        CourierId = j.UcjbCourierId,
                        CourierMobile = j.UcjbCourier.UccrMobile,
                        CourierName = j.UcjbCourier.UccrName + " " + j.UcjbCourier.UccrSurname
                    }
                    : null,
                AssignedCourier = j.UcjbCourier != null
                    ? new Suggestion
                    {
                        Id = j.UcjbCourier.UccrId,
                        Text = j.UcjbCourier.UccrName + " " + j.UcjbCourier.UccrSurname
                    }
                    : null,

                // Address information
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

                // Airport information
                ToAirportId = j.ToAirportId,
                FromAirportId = j.FromAirportId,

                // Assigned flight information
                AssignedFlight = j.TucJobNationwides.Select(nj => new AssignedFlight
                {
                    ExpectedArrival = nj.UcnwEta,
                    ExpectedDeparture = nj.UcnwEtd,
                    FlightNumber = nj.UcnwFlightNo,
                    Notes = nj.UcnwNotes
                }).FirstOrDefault(),

                // Assigned agent
                AssignedAgent = j.Agent != null
                    ? new AgentViewModel
                    {
                        AgentId = j.Agent.UcagId,
                        AgentName = j.Agent.UcagName,
                        AgentRanking = j.Agent.Ranking != null ? j.Agent.Ranking.AgentRankingName : null
                    }
                    : null,

                // Notes
                ClientNotes = j.UcjbClient != null ? j.UcjbClient.UcclNotes : null,
                InternalNotes = j.UcjbNotes,

                // Suburb information
                From = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : "Unknown",
                FromSuburbName = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : null,
                FromPostCode = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.PostCode : null,
                FromAddress = j.UcjbFromAddr,
                To = j.UcjbToNavigation != null ? j.UcjbToNavigation.UcsuName : "Unknown",
                ToSuburbName = j.UcjbToNavigation != null ? j.UcjbToNavigation.UcsuName : null,
                ToPostCode = j.UcjbToNavigation != null ? j.UcjbToNavigation.PostCode : null,
                ToCity = j.UcjbToNavigation != null ? j.UcjbToNavigation.City : null,

                // Region information
                FromSuburbId = j.UcjbFromNavigation.UcsuId,
                ToSuburbId = j.UcjbToNavigation.UcsuId,

                // Delivery details
                PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
                Return = j.UcjbReturn,
                SaturdayDelivery = j.SaturdayDelivery,
                Remain = CalculateRemainTime(j, j.UcjbSpeedNavigation),
                CompletedTime = j.UcjbComplTime,


                // Location data
                PickUpLatitude = j.PickUpLatitude,
                PickUpLongitude = j.PickUpLongitude,
                DeliveryLatitude = j.DeliveryLatitude,
                DeliveryLongitude = j.DeliveryLongitude,

                // Client information
                Client = j.UcjbClientCode,
                ClientName = j.UcjbClient.UcclName,
                Phone = j.DeliverToPhone,
                PodName = j.UcjbPodname,
                PuTime = j.PickUpTime,

                // Job characteristics
                Weight = j.UcjbWeight,
                ToAddress = j.UcjbToAddr,
                JobType = (int)(j.UcjbType ?? 0),
                Direct = j.Direct,
                Van = j.UcjbVan,
                VanOk = j.VanOk,
                Truck = j.Truck,
                DgClass = j.Dgclass,
                DgDocumentation = j.Dgdocument,

                // Job status and details
                Done = j.UcjbJobDone,
                AlertLatePickup = j.UcjbClient.AlertLatePickUp,
                AlertLateDelivery = j.UcjbClient.AlertLateDelivery,
                Lp = j.UcjbLatePick,
                Ld = j.UcjbLateDel,
                Items = j.UcjbQty,

                PickupFrom = j.UcjbPickUpFrom,
                Notify = j.NotifiedJobType.UcjtName,
                FromContactName = j.PickupFromContact,
                FromContactNumber = j.PickupFromPhone,

                // Speed and job type information
                Speed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : null,
                SpeedName = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.UcjtName : null,
                NotifiedName = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
                AcceptedName = j.AcceptedJobType != null ? j.AcceptedJobType.UcjtName : null,
                SpeedId = j.UcjbSpeed,
                NotifiedJobTypeId = j.NotifiedJobTypeId,
                AcceptedJobTypeId = j.AcceptedJobTypeId,

                // References and amounts
                RefA = j.UcjbClientRefa,
                RefB = j.UcjbClientRefb,
                Charge = $"{j.UcjbAmount:C}",
                OurRef = j.UcjbOurRef,

                // Status
                StatusId = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsId : 0,
                Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
                StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
                InternalStatusId = j.InternalStatus,

                // Size
                Size = j.UcjbSizeNavigation != null
                    ? new Suggestion
                    {
                        Id = j.UcjbSizeNavigation.VehicleSizeId,
                        Text = j.UcjbSizeNavigation.VehicleName
                    }
                    : null,

                // Job items
                PalletInfo = j.TucJobItems.Select(i => new PalletInfo
                {
                    Id = i.JobId,
                    Quantity = i.Items,
                    ItemId = i.ItemId,
                    Weight = i.Weight,
                    Length = i.Length,
                    Depth = i.Depth,
                    Height = i.Height,
                    Pu = i.Pu,
                    Do = i.Do,
                    DgClass = i.Dgclass,
                    Notes = i.Notes
                }).ToList()
            }).AsNoTracking().ToListAsync();
    }

    public async Task<List<JobViewModel>> JobListAsync(string order,
        string ascending, bool isInternal, string clientIds, List<int> selectedViewIds,
        ClearListEnvelopeViewModel clearListEnvelope = null, DispatchStatus status = DispatchStatus.Nda)
    {
        if (isInternal == false && string.IsNullOrEmpty(clientIds))
            return new List<JobViewModel>();

        return await DespatchQry(AppPage.Dispatch, status, order, ascending, isInternal, clientIds, selectedViewIds,
            null,
            clearListEnvelope);
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

        var events = await Context.DesQrySupportEventsCustomerAndCouriers.FromSqlRaw(s).ToListAsync();
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

    public async Task<TucEvent> GetSupportEventAsync(int eventId) => await Get<TucEvent>(eventId);

    public async Task<int> UpdateSupportEventAsync(TucEvent supportEvent)
    {
        Context.Entry(supportEvent).State = EntityState.Modified;
        return await Context.SaveChangesAsync();
    }

    public async Task CloseSupportEvent(int supportId, int staffId)
    {
        await Context.LoadStoredProc("uspCompleteEvent")
            .WithSqlParam("@intEventID", supportId)
            .WithSqlParam("@intStaffID", staffId)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task DispatchSelectedJobs(int courierId, int dispId, string jobIds)
    {
        await Context.LoadStoredProc("DESWEB_stpJob_AutoDespatchSelectedJobs")
            .WithSqlParam("@JobIDs", jobIds)
            .WithSqlParam("@CourierID", courierId)
            .WithSqlParam("@DispID", dispId)
            .ExecuteStoredNonQueryAsync();

        foreach (var jid in jobIds.Split(",").ToList()
                     .Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            await Context.LoadStoredProc("DES_stpJob_AutoDespatchChildJobs")
                .WithSqlParam("@JobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task SwapPod(string job1, string job2)
    {
        await Context.LoadStoredProc("DESWEB_qdfSwapPOD")
            .WithSqlParam("@ucjbNumber1", job1)
            .WithSqlParam("@ucjbNumber2", job2)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task ReDispatchSelectedJobs(int courierId, int dispId, string jobIds)
    {
        foreach (var jid in jobIds.Split(",").ToList()
                     .Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            await Context.LoadStoredProc("uspRestoreJob")
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
            await Context.LoadStoredProc("uspReDespatchJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task<List<BulkScanDetail>> ScanList(DateTime? runDate, string scan)
    {
        var cmd = Context.LoadStoredProc("DESWeb_stpScanDetail")
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
            await Context.LoadStoredProc("uspReassignJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task SetFirstJob(int jobId, int courierId)
    {
        await Context.LoadStoredProc("DES_stpJob_AutoDespatchSelectedJobs_FSCourierID")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam("@CourierID", courierId)
            .ExecuteStoredNonQueryAsync();
    }


    public async Task TransferJob(int jobId, int courierId, int dispId)
    {
        await Context.LoadStoredProc("DESWEB_stpJob_TransferJob")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam("@CourierID", courierId)
            .WithSqlParam("@DispID", dispId)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task UpdatePodDetails(string jobNumber, int jobStatus, string podName, DateTime podTime)
    {
        await Context.LoadStoredProc("DESWEB_qdfJob_UpdatePODDetails")
            .WithSqlParam("@ucjbNumber", jobNumber)
            .WithSqlParam("@ucjbJobDone", true)
            .WithSqlParam("@ucjbStatus", jobStatus)
            .WithSqlParam("@ucjbPODName", podName)
            .WithSqlParam("@ucjbComplTime", podTime)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task ReSendAllJobs(int courierId)
    {
        await Context.LoadStoredProc("uspReDespatchJobByCourierID")
            .WithSqlParam("@CourierID", courierId)
            .ExecuteStoredNonQueryAsync();
    }


    public async Task<int> MaxAutoLatePickupAlert()
    {
        DbParameter outputMaxParam = null;
        await Context.LoadStoredProc("GEN_qdfSetting_GetMaxAutoLatePickupAlert")
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
        await Context.LoadStoredProc("GEN_qdfSetting_GetMaxAutoLateDeliveryAlert")
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
        await Context.LoadStoredProc("UTL_stpFuelSurcharge_InclusiveAmount")
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
        await Context.LoadStoredProc("DESWEB_qdfLateCall_Reset")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam("@Type", eventType)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task LatePickup(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher,
        bool calculationRequired)
    {
        await Context.LoadStoredProc("DESWEB_stpUpdateJobPickupLateCall")
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
        await Context.LoadStoredProc("DESWEB_stpUpdateJobDeliveryLateCall")
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
            await Context.LoadStoredProc("DES_stpJob_SplitJobRestore")
                .WithSqlParam("@JobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task RestoreJobs(string jobIds)
    {
        foreach (var jid in jobIds.Split(",").ToList()
                     .Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            await Context.LoadStoredProc("uspRestoreJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task MessageCourier(int courierId, int dispId, string despatcher, string message)
    {
        await Context.LoadStoredProc("DES_stpManualMessage_Insert")
            .WithSqlParam("@SendToID", courierId)
            .WithSqlParam("@StaffID", dispId)
            .WithSqlParam("@WindowsUser", despatcher)
            .WithSqlParam("@Message", message)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task VoidJob(int jobId)
    {
        await Context.LoadStoredProc("DES_stpJob_Void")
            .WithSqlParam("@JobID", jobId)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task SplitJob(int jobId, string user)
    {
        await Context.Procedures.DES_stpJob_SplitJobAsync(
            jobId,
            false,
            user
        );
    }

    public async Task<string> UnSplitJob(int jobId)
    {
        DbParameter messageOutput = null;
        await Context.LoadStoredProc("DES_stpJob_UnSplit")
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
        await Context.Procedures.DESWEB_stpUpdateSplitJobMeetingAddressAsync(
            jobId,
            toSuburbId,
            address,
            deliveryLat,
            deliveryLng
        );
    }

    public async Task ReRateSplitJob(int jobId)
    {
        await Context.LoadStoredProc("DES_stpJob_SplitJob_ReRate")
            .WithSqlParam("@ParentJobID", jobId)
            .WithSqlParam("@PreBookJob", false)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task FinishSplitJobProcess(int jobId, string despatcher)
    {
        await Context.Procedures.DES_stpJob_ColsolidateMarsInformationAsync(
            jobId,
            false,
            despatcher,
            null
        );

        await Context.Procedures.DES_stpJob_DisplayInDespatchAsync(
            jobId
        );
    }

    public async Task<List<SuburbLookup>> SuburbsAsync()
    {
        return await Context.TucSuburbs
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
        return await Context.DesQryAllJobTypes
            .Select(x => new Lookup
            {
                ID = x.JobTypeId,
                Text = x.Name
            })
            .ToListAsync();
    }

    public async Task<List<Lookup>> ContactsAsync(int clientId)
    {
        return await Context.UtlQryContactLookups
            .Join(Context.TblClientContacts,
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
        var data = (from s in Context.UtlQryContactLookups
            join cc in Context.TblClientContacts on s.ContactId equals cc.ContactId into cjoin
            from co in cjoin
            where co.ClientId == clientId && s.Active == true
            select new ClientContactDetailViewModel
            {
                ID = s.ContactId,
                FullName = $"{s.Firstname} {s.Surname}",
                Mobile = s.Mobile,
                DirectDial = s.DirectDial,
                Email = s.Email,
                JobTitle = s.JobTitle
            }).Distinct();
        return data.ToListAsync();
    }


    public async Task<List<Lookup>> LeaveParcelLocationsAsync()
    {
        return await Context.TblJobLeaveNotHomes
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
        return await Context.TblUndeliverableLocations
            .OrderBy(u => u.Name)
            .Select(x => new UndeliverableLocation
            {
                ID = x.UndeliverableLocationId,
                Text = x.Name,
                JobStatusId = x.JobTypeId
            })
            .ToListAsync();
    }

    public async Task<List<InternalStatus>> GetInternalStatusListAsync()
    {
        return await Context.TucJobInternalStatuses
            .Where(x => x.Tcis != 5) // Ignore Overnight CP. Better solution is needed
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
        return await Context.TucEventTypes
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

        await Context.LoadStoredProc("DES_stpJob_Truck_Rate_Described")
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

        await Context.LoadStoredProc("DES_stpJob_Truck_Rate_Described")
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

        await Context.Procedures.sp_RateJob2Async(
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

    public async Task<List<ChargeViewModel>> GetJobPriceBreakdownAsync(int jobId)
    {
        return await Context.PricingBreakdowns
            .Where(p => p.JobId == jobId)
            .Select(p => new ChargeViewModel
            {
                ChargeId = p.PricingBreakdownId,
                Amount = p.ChargeAmount,
                Name = p.ChargeName
            }).AsNoTracking().ToListAsync();
    }

    /// <inheritdoc />
    public Task<string> RateJobDescription(int clientId, int fromId, int toId, int speed, bool pedal, bool van,
        bool returnJob, int weight,
        int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId, string ourRef, string refA,
        string refB,
        int quantity, DateTime booked)
    {
        throw new NotImplementedException();
    }

    public async Task<DirectToASAPViewModel> DirectToAsap(int jobId)
    {
        var result = new List<DirectToASAPViewModel>();
        await Context.LoadStoredProc("DESWEB_stpJob_DirectToASAP")
            .WithSqlParam("@JobID", jobId)
            .ExecuteStoredProcAsync(handle => { result = handle.ReadToList<DirectToASAPViewModel>().ToList(); });
        return result.FirstOrDefault();
    }

    public async Task<UpdateFirstAvailableSpeedResult> UpdateFirstAvailableSpeed(int jobId)
    {
        DbParameter outputParam = null;
        DbParameter nameOutput = null;
        await Context.LoadStoredProc("DESWEB_stpJob_UpdateFirstAvailableSpeed")
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
        var result = await Context.Procedures.DES_stpSettingsAsync();
        var settingsResult = result.FirstOrDefault();

        return settingsResult == null
            ? new SettingsViewModel()
            : mapper.Map<SettingsViewModel>(settingsResult);
    }

    public async Task AddPalletInfoAsync(PalletInfo p, bool preBook, string despatcher)
    {
        await Context.Procedures.DESWEB_stpJobItems_InsertAsync(
            p.Id, p.Quantity, p.Weight, p.Length, p.Height, p.Depth,
            p.Pu, p.Do, p.DgClass, p.Notes, preBook, despatcher);
    }

    public async Task EditPalletInfoAsync(PalletInfo p, bool preBook, string despatcher)
    {
        await Context.Procedures.DESWEB_stpJobItems_UpdateAsync(
            p.Id, p.ItemId, p.Quantity, p.Weight, p.Length, p.Height,
            p.Depth,
            p.Pu, p.Do, p.DgClass, p.Notes, preBook, despatcher);
    }

    public async Task DeletePalletInfoAsync(PalletInfo p, bool preBook, string despatcher)
    {
        await Context.Procedures.DESWEB_stpJobItems_DeleteAsync(p.Id, p.ItemId, preBook,
            despatcher);
    }

    public async Task SendPrebookJobAsync(int jobId)
    {
        await Context.Procedures.DES_stpJobBooking_InsertJobAndChildrenAsync(jobId);
    }

    public async Task VoidPrebookJobAsync(int jobId, string despatcher, int staffId)
    {
        await Context.Procedures.DESWEB_stpVoidPrebookJobAsync(jobId, despatcher,
            staffId);
    }

    public async Task<TruckItemsSummary> TruckJobItemsAsync(int jobId, int truckWeightLimit)
    {
        var result = await Context.Procedures.qry_tucJobItemsAsync(jobId, truckWeightLimit);
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

    public async Task UpdateDeliveryAddressNzAsync(UpdateAddressRequestNz request)
    {
        try
        {
            var job = await Get<TucJob>(request.JobId);

            // Coordinates
            job.DeliveryLatitude = request.Latitude;
            job.DeliveryLongitude = request.Longitude;

            job.UcjbToAddr = request.Address;
            job.UcjbTo = request.SuburbId;
            job.UcjbAmount = request.Rate;
            job.UcjbCbd = request.Cbd;

            await Context.SaveChangesAsync();

            // Record change in note
            var note = $" Changed Delivery Address to {request.Address}";
            await AddNoteAsync(request.JobId, note, request.DespatcherName);
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured updating the delivery address for job {request.JobId}");
            throw;
        }
    }

    public async Task UpdateDeliveryAddressUsAsync(UpdateAddressRequestUs request)
    {
        try
        {
            var address = request.Address;
            var job = await Get<TucJob>(request.JobId);

            // Coordinates
            job.DeliveryLatitude = address.Latitude;
            job.DeliveryLongitude = address.Longitude;

            // Address Lines
            job.DeliveryAddressLine1 = address.AddressLine1;
            job.DeliveryAddressLine2 = address.AddressLine2;
            job.DeliveryAddressLine3 = address.AddressLine3;
            job.DeliveryAddressLine4 = address.AddressLine4;
            job.DeliveryAddressLine5 = address.AddressLine5;
            job.DeliveryAddressLine6 = address.AddressLine6;
            job.DeliveryAddressLine7 = address.AddressLine7;

            // Amount
            job.UcjbAmount = request.Rate;

            await Context.SaveChangesAsync();

            // Record change in note
            var note = $" Changed Delivery Address to {request.Address.FullAddress}";
            await AddNoteAsync(request.JobId, note, request.DespatcherName);
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured updating the delivery address for job {request.JobId}");
            throw;
        }
    }

    public async Task UpdateBulkDeliveryAddressAsync(int bulkJobId, string toSuburb, int toPostCode, string address,
        decimal deliveryLat, decimal deliveryLng, string despatcher)
    {
        await Context.Procedures.DESWEB_stpUpdateBulkJobDeliveryAddressAsync(bulkJobId, toSuburb,
            toPostCode, address,
            deliveryLat, deliveryLng, despatcher);
    }

    public async Task UpdatePickupAddressNzAsync(UpdateAddressRequestNz request)
    {
        try
        {
            var job = await Get<TucJob>(request.JobId);

            // Coordinates
            job.PickUpLatitude = request.Latitude;
            job.PickUpLongitude = request.Longitude;
            job.UcjbFromAddr = request.Address;
            job.UcjbFrom = request.SuburbId;
            job.UcjbAmount = request.Rate;
            job.UcjbCbd = request.Cbd;

            await Context.SaveChangesAsync();

            // Record change in note
            var note = $" Changed Pickup Address to {request.Address}";
            await AddNoteAsync(request.JobId, note, request.DespatcherName);
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured updating the Pickup address for job {request.JobId}");
            throw;
        }
    }

    public async Task UpdatePickupAddressUsAsync(UpdateAddressRequestUs request)
    {
        try
        {
            var address = request.Address;
            var job = await Get<TucJob>(request.JobId);

            // Coordinates
            job.PickUpLatitude = address.Latitude;
            job.PickUpLongitude = address.Longitude;

            // Address Lines
            job.PickupAddressLine1 = address.AddressLine1;
            job.PickupAddressLine2 = address.AddressLine2;
            job.PickupAddressLine3 = address.AddressLine3;
            job.PickupAddressLine4 = address.AddressLine4;
            job.PickupAddressLine5 = address.AddressLine5;
            job.PickupAddressLine6 = address.AddressLine6;
            job.PickupAddressLine7 = address.AddressLine7;

            // Amount
            job.UcjbAmount = request.Rate;

            await Context.SaveChangesAsync();

            // Record change in note
            var note = $" Changed Pickup Address to {request.Address.FullAddress}";
            await AddNoteAsync(request.JobId, note, request.DespatcherName);
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured updating the Pickup address for job {request.JobId}");
            throw;
        }
    }

    public async Task UpdateJobTypeAsync(int jobId, int jobType, string despatcher)
    {
        await Context.Procedures.DESWEB_stpUpdateJobTypeAsync(jobId, jobType, despatcher);
    }

    public async Task UpdateBulkPickupAddressAsync(int bulkJobId, string fromSuburb, int fromPostCode, string address,
        decimal pickupLat, decimal pickupLng, string despatcher)
    {
        await Context.Procedures.DESWEB_stpUpdateBulkJobPickupAddressAsync(bulkJobId,
            fromSuburb, fromPostCode,
            address, pickupLat, pickupLng, despatcher);
    }

    public async Task UpdateBookingDeliveryAddressAsync(int jobId, int toSuburbId, string address, decimal deliveryLat,
        decimal deliveryLng, bool cbd, decimal rate, string despatcher)
    {
        await Context.Procedures.DESWEB_stpUpdateJobBookingDeliveryAddressAsync(jobId, toSuburbId,
            address,
            deliveryLat, deliveryLng, cbd, rate, despatcher);
    }

    public async Task UpdateBookingPickupAddressAsync(int jobId, int fromSuburbId, string address, decimal pickupLat,
        decimal pickupLng, bool cbd, decimal rate, string despatcher)
    {
        await Context.Procedures.DESWEB_stpUpdateJobBookingPickupAddressAsync(jobId, fromSuburbId,
            address, pickupLat, pickupLng, cbd, rate,
            despatcher);
    }

    public async Task ReleaseBulkJobAsync(string jobNumber, DateTime bookDate)
    {
        await Context.Procedures.UTL_stpJob_tblBulkJob_ReleaseByJobNumberAsync(
            jobNumber,
            bookDate);
    }

    public async Task UpdateJobAsync(int jobId, string field, string value, decimal? rate, string despatcher,
        int staffId)
    {
        await Context.Procedures.DESWEB_stpUpdateJobAsync(
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
        await Context.Procedures.DESWEB_stpUpdateBulkJobAsync(
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
        await Context.Procedures.DESWEB_stpUpdateJobBookingAsync(
            jobId,
            field,
            value,
            rate,
            despatcher,
            staffId);
    }

    public async Task AddNoteAsync(int jobId, string note, string despatcher)
    {
        await Context.Procedures.DESWEB_stpJob_AddNotesAsync(
            jobId,
            note,
            despatcher);
    }

    public async Task AddBulkJobNoteAsync(int bulkJobId, string note, string despatcher)
    {
        await Context.Procedures.DESWEB_stpBulkJob_AddNotesAsync(
            bulkJobId,
            note,
            despatcher);
    }

    public async Task AddJobBookingNoteAsync(int jobId, string note, string despatcher)
    {
        await Context.Procedures.DES_stpJobBooking_AddNotesAsync(
            jobId,
            note,
            despatcher);
    }

    public async Task<int> QuickAddJobAsync(JobCreateViewModel job, int staffId)
    {
        var jobId = new OutputParameter<int?>();

        await Context.Procedures.DESWEB_stpQuickCreateJobAsync(
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
        try
        {
            var note = $"From # {viewModel.FromCourierId} To # {viewModel.ToCourierId}";
            var currentTime = DateTime.Now;

            var fromJobNumber = new OutputParameter<string>();
            await Context.Procedures.NET_stpJob_Insert_JobNumberAsync(viewModel.StaffId, 1, fromJobNumber);
            var toJobNumber = new OutputParameter<string>();
            await Context.Procedures.NET_stpJob_Insert_JobNumberAsync(viewModel.StaffId, 1, toJobNumber);

            var fromJob = CreateJobEntry(
                jobNumber: fromJobNumber.Value,
                courierId: viewModel.FromCourierId,
                amount: viewModel.Amount,
                reference: viewModel.Reference,
                clientRefB: $"To # {viewModel.ToCourierId}",
                ourRef: "ICC",
                note: note,
                currentTime: currentTime,
                staffId: viewModel.StaffId);
            await Context.TucJobs.AddAsync(fromJob);

            var toJob = CreateJobEntry(
                jobNumber: toJobNumber.Value,
                courierId: viewModel.ToCourierId,
                amount: viewModel.Amount,
                reference: viewModel.Reference,
                clientRefB: $"From # {viewModel.FromCourierId}",
                ourRef: "",
                note: note,
                currentTime: currentTime,
                staffId: viewModel.StaffId);
            await Context.TucJobs.AddAsync(toJob);

            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured adding a new inter-courier job");
            throw;
        }
    }


    public async Task<bool> HasClientItemsAvailableAsync(int clientId, int speedId)
    {
        return await Context.TblClientAvailableSpeeds
            .Where(cas => cas.ClientId == clientId && cas.SpeedId == speedId)
            .SelectMany(cas => cas.TblClientAvailableSpeedItems
                .Where(casi => casi.Active)
                .Select(casi => casi.ClientItem))
            .AnyAsync();
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

        Context.TucJobs.Attach(job);
        Context.Entry(job).Property(x => x.ClientItemIds).IsModified = true;
        Context.Entry(job).Property(x => x.UcjbAmount).IsModified = true;
        await Context.SaveChangesAsync();
    }

    private async Task<List<Size>> GetRelatedJobsAsync(int? rootParentId, int clientId)
    {
        if (!rootParentId.HasValue) return new List<Size>();

        return await Context.TblJobs
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

        photos.AddRange(await Context.DeliveryPhotos
            .Where(d => d.JobId == jobId)
            .Select(del => del.Photo)
            .ToListAsync());

        return photos;
    }

    private async Task<JobInfo> GetJobInfo(int jobId)
    {
        return await Context.TucJobs
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
        return Context.TblClientAvailableSpeeds
            .Where(cas => cas.ClientId == clientId && cas.SpeedId == speedId)
            .SelectMany(cas => cas.TblClientAvailableSpeedItems
                .Where(casi => casi.Active)
                .Select(casi => new ClientItemsViewModel
                {
                    ItemId = casi.ClientItem.ItemId,
                    ClientId = casi.ClientItem.ClientId,
                    Name = casi.ClientItem.Name,
                    Description = casi.ClientItem.Description,
                    PerItem = casi.ClientItem.PerItem,
                    Rate = casi.ClientItem.Rate,
                    OnlyVan = casi.ClientItem.OnlyVan,
                    Selected = clientItemIds.Contains(casi.ClientItem.ItemId)
                }));
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
        await Context.Procedures.UTL_stpPPD_ExclusiveAmountAsync(
            clientId,
            amount,
            outputParam
        );

        return outputParam.Value ?? 0m;
    }

    private TucJob CreateJobEntry(string jobNumber, int courierId, decimal amount, string reference, string clientRefB,
        string ourRef,
        string note, DateTime currentTime, int staffId)
    {
        return new TucJob
        {
            UcjbNumber = jobNumber,
            UcjbDate = currentTime,
            UcjbTime = currentTime,
            UcjbType = 1,
            UcjbClientId = 911,
            UcjbContact = $"Courier {courierId}",
            UcjbChargeType = 3,
            UcjbAmount = amount,
            UcjbSpeed = 1,
            UcjbFrom = 1,
            UcjbFromAddr = note,
            UcjbTo = 1,
            UcjbToAddr = "ToSP",
            UcjbSize = 1,
            UcjbQty = 1,
            UcjbCbd = false,
            UcjbKm = 0,
            UcjbFlightDetails = "FD",
            UcjbWeight = 1,
            UcjbCourierId = courierId,
            UcjbClientRefa = reference,
            UcjbClientRefb = clientRefB,
            UcjbOurRef = ourRef,
            UcjbOpId = staffId,
            UcjbVan = false,
            Truck = false,
            UcjbReturn = false,
            UcjbVoid = false,
            UcjbAttention = false,
            UcjbPickUpFrom = 0,
            UcjbPaged = true,
            UcjbClientCode = "ZZZ!!",
            UcjbRefJobId = 0,
            UcjbNotes = "",
            UcjbStatus = 6,
            UcjbComplTime = currentTime,
            UcjbPodname = $"Courier {courierId}",
            UcjbJobDone = true,
            ProofOfDelivery = 0,
            SourceId = 13,
            Reprice = false,
            FuelSurchargeAmount = 0,
            DeliverToPrivateBusiness = 0,
            UcjbDispTime = currentTime
        };
    }
}