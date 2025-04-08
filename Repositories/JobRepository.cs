using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.Controllers;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public class JobRepository(IMapper mapper, IDbContextFactory<DespatchContext> contextFactory, ITenantTimeService timeService)
    : BaseJobRepository(contextFactory, timeService), IJobRepository
{
    public async Task<List<Suggestion>> RelatedJobs(int parentId, int clientId)
    {
        return await Context
            .TucJobs.Where(j => j.ParentId == parentId && j.UcjbClientId == clientId)
            .OrderBy(j => j.UcjbDate)
            .ThenBy(j => j.UcjbTime)
            .Select(j => new Suggestion { Id = j.UcjbId, Text = j.UcjbNumber })
            .AsNoTracking()
            .ToListAsync();
    }

    /* Bulk Job Detail*/

    public async Task<JobViewModel> BulkJobDetail(int bulkJobId)
    {
        var today = DateTime.Today.ResetTimeToStartOfDay();

        return await (
            from j in Context.TblBulkJobs
            join c in Context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
            from to in speedJoin.DefaultIfEmpty()
            join cl in Context.TblClients on j.ClientId equals cl.ClientId into clientJoin
            from client in clientJoin.DefaultIfEmpty()
            join s in Context.TucJobStatuses on j.JobStatus equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join l in Context.TblJobLeaveNotHomes
                on j.DeliverToLeaveId equals l.LeaveNotHomeId
                into leaveNotHomeJoin
            from leave in leaveNotHomeJoin.DefaultIfEmpty()
            join sc in Context.TblBulkRunSchedules
                on j.ScheduleId equals sc.BulkRunScheduleId
                into scheduleJoin
            from schedule in scheduleJoin.DefaultIfEmpty()
            join con in Context.TblContacts
                on j.LoggedInContactId equals con.ContactId
                into contactJoin
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
                Booked = DateTime.Parse(
                    j.BookDate.ToString("yyyy-MM-dd") + " " + j.BookDate.ToString("HH:mm:ss")
                ),
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
                ToContactPhone = j.DeliverToPhone,
                Weight = (double?)j.Weight,
                Items = j.Qty,
                RefA = j.ClientRefa,
                RefB = j.ClientRefb,
                OurRef = j.OurRef,
                SigNotRequired = leave.Name ?? "",
                Charge = $"{j.Amount:C}",
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
            }
        ).FirstOrDefaultAsync();
    }

    public async Task<Tuple<int, List<JobViewModel>>> BulkSearchAsync(
        int? courierId,
        string job,
        string wild,
        DateTime fromDate,
        DateTime toDate,
        int? clientId,
        int pageIndex,
        int pageSize
    )
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";

        var jobsQuery =
            from x in Context.TblBulkJobs
            join c in Context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
            from courier in courierJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on x.Speed equals t.UcjtId into speedJoin
            from speed in speedJoin.DefaultIfEmpty()
            join s in Context.TucJobStatuses on x.JobStatus equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            where
                x.BookDate >= fromDate
                && x.BookDate <= toDate
                && (!clientSet || x.ClientId == clientId)
                && (!courierSet || x.CourierId == courierId)
                && (job == "" || EF.Functions.Like(x.JobNumber.ToLower(), jobParam))
                && (
                    wild == ""
                    || EF.Functions.Like(
                        x.FromAddress
                        + " "
                        + x.Contact
                        + " "
                        + x.FromSuburb
                        + " "
                        + x.ToAddress
                        + " "
                        + x.DeliverToContact
                        + " "
                        + x.ToSuburb
                        + " "
                        + (x.ClientRefa ?? "")
                        + " "
                        + (x.ClientRefb ?? "")
                        + " "
                        + (x.OurRef ?? "")
                        + " "
                        + x.JobNumber.ToLower(),
                        wildParam
                    )
                )
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
                    Longitude = decimal.Parse(x.PickUpLongitude)
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
                    Longitude = decimal.Parse(x.DeliveryLongitude)
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
                Booked = DateTime.Parse(
                    v.BookedDate.Value.ToString("yyyy-MM-dd")
                    + " "
                    + v.Time.Value.ToString("HH:mm:ss")
                )
            })
            .ToList();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        return Tuple.Create(total, jobList);
    }

    public async Task<Tuple<int, List<JobViewModel>>> PodSearch(
        int? courierId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        int? clientId,
        int pageIndex,
        int pageSize
    )
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";

        var jobsQuery =
            from j in Context.TblJobs
            join c in Context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join y in Context.TucSuburbs on j.FromSuburbId equals y.UcsuId into fromJoin
            from fs in fromJoin.DefaultIfEmpty()
            join z in Context.TucSuburbs on j.ToSuburbId equals z.UcsuId into toJoin
            from ts in toJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
            from speed in speedJoin.DefaultIfEmpty()
            join s in Context.TucJobStatuses on j.Status equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join nw in Context.TucJobNationwides on j.JobId equals nw.UcnwJobId into nationwideJoin
            from nationwide in nationwideJoin.DefaultIfEmpty()
            where
                j.Date >= fromDate
                && j.Date <= toDate
                && (!clientSet || j.ClientId == clientId)
                && (!courierSet || j.CourierId == courierId)
                && (job == "" || EF.Functions.Like(j.Number.ToLower(), jobParam))
                && (
                    wild == ""
                    || EF.Functions.Like(nationwide.UcnwFlightNo, wildParam)
                    || EF.Functions.Like(
                        j.FromAddress
                        + " "
                        + j.PickupFromContact
                        + " "
                        + fs.UcsuName
                        + " "
                        + j.ToAddress
                        + " "
                        + j.DeliverToContact
                        + " "
                        + ts.UcsuName
                        + " "
                        + (j.ClientReferenceA ?? "")
                        + " "
                        + (j.ClientReferenceB ?? "")
                        + " "
                        + (j.OurRef ?? "")
                        + " "
                        + j.Number.ToLower(),
                        wildParam
                    )
                )
            select new JobViewModel
            {
                Id = j.JobId,
                Time = j.Time,
                ClientId = j.ClientId,
                Client = j.ClientCode,
                From = fs.UcsuName,
                FromSuburbId = j.FromSuburbId,
                To = ts.UcsuName,
                ToSuburbId = j.ToSuburbId,
                JobNo = j.Number,
                FromAddress = j.FromAddress,
                ToAddress = j.ToAddress,
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
                    Longitude = j.PickUpLongitude
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
                    Longitude = j.DeliveryLongitude
                },
                Courier = co.Code,
                StatusId = j.Status,
                Status = status.UcjsCode,
                Speed = speed.ShortName,
                SpeedId = j.Speed,
                PreBook = false,
                PickUpLatitude = j.PickUpLatitude,
                PickUpLongitude = j.PickUpLongitude,
                DeliveryLatitude = j.DeliveryLatitude,
                DeliveryLongitude = j.DeliveryLongitude,
                BookedDate = j.Date,
                Booked = DateTime.Parse(
                    j.Date.Value.ToString("yyyy-MM-dd") + " " + j.Time.Value.ToString("HH:mm:ss")
                )
            };

        var orderedQuery = jobsQuery
            .OrderBy(a => a.BookedDate)
            .ThenBy(v => v.Time);

        var total = orderedQuery.Count();

        var jobs = await orderedQuery.Skip((pageIndex - 1) * pageSize).Take(pageSize).ToListAsync();

        return Tuple.Create(total, jobs);
    }

    public async Task UpdateManualPriceAsync(List<JobManualPriceModel> data)
    {
        if (
            data.Any(d =>
                d.Id <= 0
                || (
                    d.Amount > 0
                    && (
                        d.Ppd < 0
                        || d.Fuel < 0
                        || d.CourierPayment < 0
                        || d.CourierFuel < 0
                        || d.CourierBonus < 0
                        || d.Amount < d.Ppd + d.Fuel
                        || d.Amount < d.CourierPayment + d.CourierFuel + d.CourierBonus
                    )
                )
                || (
                    d.Amount < 0
                    && (
                        d.Ppd > 0
                        || d.Fuel > 0
                        || d.CourierPayment > 0
                        || d.CourierFuel > 0
                        || d.CourierBonus > 0
                        || d.Amount > d.Ppd + d.Fuel
                        || d.Amount > d.CourierPayment + d.CourierFuel + d.CourierBonus
                    )
                )
            )
        )
            throw new ArgumentException("Invalid Values.");

        var jobIds = data.Select(j => j.Id).Distinct().ToList();

        if (!jobIds.Any())
            return;

        var idData = await Context
            .TblJobs.Where(j =>
                jobIds.Contains(j.JobId)
                || (j.ParentId.HasValue && jobIds.Contains(j.ParentId.Value))
            )
            .Select(j => new { j.JobId, ParentId = j.ParentId ?? j.JobId })
            .ToListAsync();

        var ids = idData
            .Select(j => j.JobId)
            .Concat(idData.Select(j => j.ParentId))
            .Distinct()
            .ToList();

        var dbData = await Context
            .TucJobs.Where(j =>
                ids.Contains(j.UcjbId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value))
            )
            .ToListAsync();

        var dbDataArchive = await Context
            .TucJobArchives.Where(j =>
                ids.Contains(j.UcjbId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value))
            )
            .ToListAsync();

        foreach (var d in data)
        {
            var match =
                (dynamic)dbData.FirstOrDefault(j => j.UcjbId == d.Id)
                ?? dbDataArchive.FirstOrDefault(j => j.UcjbId == d.Id);

            ArgumentNullException.ThrowIfNull(match);

            match.UcjbAmount = Math.Round(d.Amount, 4, MidpointRounding.AwayFromZero);
            match.FuelSurchargeAmount = Math.Round(d.Fuel, 4, MidpointRounding.AwayFromZero);
            match.PpdexclusiveAmount = Math.Round(d.Ppd, 4, MidpointRounding.AwayFromZero);
            match.CourierPercentage = null;
            match.CourierPayment = Math.Round(d.CourierPayment, 4, MidpointRounding.AwayFromZero);
            match.CourierFuel = Math.Round(d.CourierFuel, 4, MidpointRounding.AwayFromZero);
            match.CourierBonus = Math.Round(d.CourierBonus, 4, MidpointRounding.AwayFromZero);
            match.RawBaseAmount =
                match.UcjbAmount - match.FuelSurchargeAmount - match.PpdexclusiveAmount;
        }

        var parentJobs = dbData
            .Select(j => new
            {
                j.UcjbId,
                ParentId = j.ParentId ?? j.UcjbId,
                j.UcjbAmount,
                j.FuelSurchargeAmount,
                j.PpdexclusiveAmount
            })
            .Concat(
                dbDataArchive.Select(j => new
                {
                    j.UcjbId,
                    ParentId = j.ParentId ?? j.UcjbId,
                    j.UcjbAmount,
                    j.FuelSurchargeAmount,
                    j.PpdexclusiveAmount
                })
            )
            .GroupBy(j => j.ParentId)
            .Where(x => x.Count() > 1)
            .ToList();

        foreach (var x in parentJobs)
        {
            var parentJob =
                (dynamic)dbData.FirstOrDefault(j => j.UcjbId == x.Key)
                ?? dbDataArchive.First(j => j.UcjbId == x.Key);
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

    public async Task<List<JobDownloadModel>> PodSearchDownloadAsync(
        int? courierId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        int? clientId
    )
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";

        var jobsQuery =
            from x in Context.TblJobs
            join y in Context.TucSuburbs on x.FromSuburbId equals y.UcsuId into fromJoin
            from yo in fromJoin.DefaultIfEmpty()
            join z in Context.TucSuburbs on x.ToSuburbId equals z.UcsuId into toJoin
            from zo in toJoin.DefaultIfEmpty()
            join nw in Context.TucJobNationwides on x.JobId equals nw.UcnwJobId into nationwideJoin
            from nationwide in nationwideJoin.DefaultIfEmpty()
            where
                x.Date >= fromDate
                && x.Date <= toDate
                && (!clientSet || x.ClientId == clientId)
                && (!courierSet || x.CourierId == courierId)
                && (job == "" || EF.Functions.Like(x.Number.ToLower(), jobParam))
                && (
                    wild == ""
                    || EF.Functions.Like(nationwide.UcnwConNote, wildParam)
                    || EF.Functions.Like(
                        x.FromAddress
                        + " "
                        + x.PickupFromContact
                        + " "
                        + yo.UcsuName
                        + " "
                        + x.ToAddress
                        + " "
                        + x.DeliverToContact
                        + " "
                        + zo.UcsuName
                        + " "
                        + (x.ClientReferenceA ?? "")
                        + " "
                        + (x.ClientReferenceB ?? "")
                        + " "
                        + (x.OurRef ?? "")
                        + " "
                        + x.Number.ToLower(),
                        wildParam
                    )
                )
            select new { x.JobId, x.ParentId };

        var jobIds = await jobsQuery.ToListAsync();

        var ids = jobIds.Select(j => j.JobId).ToList();

        var parentIds = jobIds
            .Where(j => j.ParentId.HasValue)
            .Select(j => j.ParentId.Value)
            .ToList();

        if (parentIds.Any())
            ids.AddRange(parentIds);

        ids = ids.Distinct().ToList();

        if (!ids.Any())
            return [];

        var query =
            from j in Context.TblJobs
            where ids.Contains(j.JobId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value))
            orderby j.Number
            select new JobDownloadModel
            {
                Id = j.JobId,
                ParentId = j.ParentId,
                JobNumber = j.Number,
                BookDate = DateTime.Parse(
                    $"{j.Date.Value.ToString("yyyy-MM-dd")} {j.Time.Value.ToString("HH:mm:ss")}"
                ),
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
            .Where(j =>
                j.Id != (j.ParentId ?? j.Id) || !result.Any(x => x.Id != j.Id && x.ParentId == j.Id)
            )
            .ToList();
    }

    public async Task<Tuple<int, List<JobViewModel>>> PreBookSearchAsync(
        int? courierId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        int? clientId,
        int pageIndex,
        int pageSize
    )
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";
        var jobsQuery =
            from x in Context.TucJobBookings
            join c in Context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join y in Context.TucSuburbs on x.UcbkFrom equals y.UcsuId into fromJoin
            from yo in fromJoin.DefaultIfEmpty()
            join z in Context.TucSuburbs on x.UcbkTo equals z.UcsuId into toJoin
            from zo in toJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on (int)x.UcbkSpeed equals t.UcjtId into speedJoin
            from to in speedJoin.DefaultIfEmpty()
            where
                x.UcbkNextDue >= fromDate
                && x.UcbkNextDue <= toDate
                && (!clientSet || x.UcbkClientId == clientId)
                && (!courierSet || x.CourierId == courierId)
                && (job == "" || EF.Functions.Like(x.UcbkJobNumber.ToLower(), jobParam))
                && (
                    wild == ""
                    || EF.Functions.Like(
                        x.UcbkFromAddr
                        + " "
                        + x.PickupFromContact
                        + " "
                        + yo.UcsuName
                        + " "
                        + x.UcbkToAddr
                        + " "
                        + x.DeliverToContact
                        + " "
                        + zo.UcsuName
                        + " "
                        + (x.UcbkClientRefa ?? "")
                        + " "
                        + (x.UcbkClientRefa ?? "")
                        + " "
                        + (x.UcbkOurRef ?? "")
                        + " "
                        + x.UcbkJobNumber.ToLower(),
                        wildParam
                    )
                )
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
            .OrderBy(a => a.BookedDate)
            .ThenBy(v => v.Time)
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        stopwatch.Reset();
        stopwatch.Start();
        var jobList = jobs.Select(j => new JobViewModel
            {
                Id = j.Id,
                Booked = DateTime.Parse(
                    j.Booked.ToString("yyyy-MM-dd") + " " + j.Time.Value.ToString("HH:mm:ss")
                ),
                Client = j.Client,
                FromAddress = j.FromAddress,
                ToAddress = j.ToAddress,
                JobNo = j.JobNo,
                ClientId = j.ClientId,
                Courier = j.Courier,
                Speed = j.Speed
            })
            .ToList();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        return Tuple.Create(total, jobList);
    }

    public async Task<List<PrebookListViewModel>> PreBookJobListAsync()
    {
        var prebooks = await Context
            .TucJobBookings.Where(j =>
                j.UcbkDate.Value.Date <= DateTime.Today && j.UcbkDone == false
            )
            .OrderBy(j => j.UcbkTime)
            .ThenBy(j => j.UcbkJobNumber)
            .Select(j => new PrebookListViewModel
            {
                Id = j.UcbkId,
                Booked = DateTime.Parse(
                    j.UcbkNextDue.Value.ToString("yyyy-MM-dd")
                    + " "
                    + j.UcbkTime.Value.ToString("HH:mm:ss")
                ),
                Client = j.UcbkClientCode,
                FromAddress = j.UcbkFromAddr,
                ToAddress = j.UcbkToAddr,
                JobNo = j.UcbkJobNumber,
                ClientId = j.UcbkClientId,
                Courier = j.Courier.Code,
                Speed = j.UcbkSpeedNavigation.UcjtName,
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
                    Longitude = j.PickUpLongitude
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
                    Longitude = j.DeliveryLongitude
                }
            })
            .AsNoTracking()
            .ToListAsync();

        return prebooks;
    }

    public async Task<List<DispatchJobViewModel>> CurrentJobList(int courierId, bool done)
    {
        return await Context
            .TucCouriers.Where(c => c.UccrId == courierId)
            .SelectMany(c => c.TucJobUcjbCouriers)
            .Where(j => j.UcjbJobDone == done)
            .Select(JobMappings.JobDispatchMapping)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<List<DispatchJobViewModel>> JobListAsync(
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds,
        ClearListEnvelopeViewModel clearListEnvelope = null)
    {
        if (isInternal == false && string.IsNullOrEmpty(clientIds))
            return [];

        return await DespatchQry(
            AppPage.Dispatch,
            queryParams.Order,
            queryParams.OrderDirection,
            isInternal,
            isUsTenant,
            clientIds,
            selectedViewIds,
            null,
            clearListEnvelope,
            queryParams.DateCutoff
        );
    }

    public async Task<TucEvent> GetSupportEventAsync(int eventId) => await Get<TucEvent>(eventId);

    public async Task<int> UpdateSupportEventAsync(TucEvent supportEvent)
    {
        Context.Entry(supportEvent).State = EntityState.Modified;
        return await Context.SaveChangesAsync();
    }

    public async Task CloseSupportEvent(int supportId, int staffId)
    {
        await Context.Procedures.uspCompleteEventAsync(supportId, staffId);
    }

    public async Task DispatchSelectedJobs(int courierId, int dispId, List<int> jobIds)
    {
        var jobIdsString = string.Join(",", jobIds);
        await Context.Procedures.DESWEB_stpJob_AutoDespatchSelectedJobsAsync(jobIdsString, courierId, dispId);

        foreach (var jobId in jobIds) await Context.Procedures.DES_stpJob_AutoDespatchChildJobsAsync(jobId);
    }

    public async Task SwapPod(string job1, string job2)
    {
        await Context
            .LoadStoredProc("DESWEB_qdfSwapPOD")
            .WithSqlParam("@ucjbNumber1", job1)
            .WithSqlParam("@ucjbNumber2", job2)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task ReDispatchSelectedJobs(int courierId, int dispId, List<int> jobIds)
    {
        foreach (var jobId in jobIds) await Context.Procedures.uspRestoreJobAsync(jobId);
        await DispatchSelectedJobs(courierId, dispId, jobIds);
    }

    public async Task ReSendSelectedJobs(string jobIds)
    {
        foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
        {
            await Context
                .LoadStoredProc("uspReDespatchJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task<List<BulkScanDetail>> ScanList(DateTime? runDate, string scan)
    {
        var cmd = Context
            .LoadStoredProc("DESWeb_stpScanDetail")
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
            await Context
                .LoadStoredProc("uspReassignJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
        }
    }

    public async Task SetFirstJob(int jobId, int courierId)
    {
        await Context
            .LoadStoredProc("DES_stpJob_AutoDespatchSelectedJobs_FSCourierID")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam("@CourierID", courierId)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task TransferJob(int jobId, int courierId, int dispId)
    {
        await Context
            .LoadStoredProc("DESWEB_stpJob_TransferJob")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam("@CourierID", courierId)
            .WithSqlParam("@DispID", dispId)
            .ExecuteStoredNonQueryAsync();
    }

   public async Task UpdatePodDetails(int jobId, int jobStatus, string podName, DateTime podTime)
   {
       // Find if job is in active or archive table
       var activeJob = await Context.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == jobId);
       var isArchived = activeJob == null;
       int? parentId;

       // Determine parent ID based on job location
       if (isArchived)
       {
           var archivedJob = await Context.TucJobArchives.FirstOrDefaultAsync(j => j.UcjbId == jobId);
           if (archivedJob == null)
           {
               // Job not found in either table
               return;
           }
           parentId = archivedJob.ParentId;
       }
       else
       {
           parentId = activeJob.ParentId;
       }

       // Check for uncompleted sibling jobs (child jobs with same parent)
       var hasUncompletedSiblings = await Context.TucJobs
           .AnyAsync(j => j.ParentId == parentId &&
                          j.UcjbId != jobId &&
                          j.UcjbId != parentId &&
                          j.UcjbJobDone == false &&
                          j.UcjbVoid == false);

       // Update job record with completion details
       await UpdateJobCompletionDetails(
           jobId,
           jobStatus,
           podName,
           podTime,
           isArchived);

       // Update parent job if all siblings are complete
       if (!hasUncompletedSiblings && parentId != null)
       {
           await UpdateParentJobCompletionDetails(
               parentId.Value,
               jobStatus,
               podName,
               podTime,
               isArchived);
       }

       await Context.SaveChangesAsync();
   }

   private async Task UpdateJobCompletionDetails(
       int jobId,
       int jobStatus,
       string podName,
       DateTime podTime,
       bool isArchived)
   {
       if (isArchived)
       {
           var archivedJob = await Context.TucJobArchives
               .FirstOrDefaultAsync(j => j.UcjbId == jobId && j.UcjbJobDone == false);

           if (archivedJob != null)
           {
               archivedJob.UcjbJobDone = true;
               archivedJob.UcjbStatus = jobStatus;
               archivedJob.UcjbPodname = podName;
               archivedJob.UcjbComplTime = podTime;
               archivedJob.InternalStatus = (int)InternalJobStatus.Reprice;
           }
       }
       else
       {
           var activeJob = await Context.TucJobs
               .FirstOrDefaultAsync(j => j.UcjbId == jobId && j.UcjbJobDone == false);

           if (activeJob != null)
           {
               activeJob.UcjbJobDone = true;
               activeJob.UcjbStatus = jobStatus;
               activeJob.UcjbPodname = podName;
               activeJob.UcjbComplTime = podTime;
               activeJob.InternalStatus = (int)InternalJobStatus.Reprice;
           }
       }
   }

   private async Task UpdateParentJobCompletionDetails(
       int parentId,
       int jobStatus,
       string podName,
       DateTime podTime,
       bool isArchived)
   {
       if (isArchived)
       {
           var parentJob = await Context.TucJobArchives
               .FirstOrDefaultAsync(j => j.UcjbId == parentId &&
                                         j.UcjbJobDone == false &&
                                         j.UcjbSpeed != 79);

           if (parentJob != null)
           {
               parentJob.UcjbJobDone = true;
               parentJob.UcjbStatus = jobStatus;
               parentJob.UcjbPodname = podName;
               parentJob.UcjbComplTime = podTime;
           }
       }
       else
       {
           var parentJob = await Context.TucJobs
               .FirstOrDefaultAsync(j => j.UcjbId == parentId &&
                                         j.UcjbJobDone == false &&
                                         j.UcjbSpeed != 79);

           if (parentJob != null)
           {
               parentJob.UcjbJobDone = true;
               parentJob.UcjbStatus = jobStatus;
               parentJob.UcjbPodname = podName;
               parentJob.UcjbComplTime = podTime;
           }
       }
   }

    public async Task ReSendAllJobs(int courierId)
    {
        await Context
            .LoadStoredProc("uspReDespatchJobByCourierID")
            .WithSqlParam("@CourierID", courierId)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task<int> MaxAutoLatePickupAlert()
    {
        DbParameter outputMaxParam = null;
        await Context
            .LoadStoredProc("GEN_qdfSetting_GetMaxAutoLatePickupAlert")
            .WithSqlParam(
                "@MaxAutoLatePickupAlert",
                dbParam =>
                {
                    dbParam.Direction = ParameterDirection.Output;
                    dbParam.DbType = DbType.Int32;
                    outputMaxParam = dbParam;
                }
            )
            .ExecuteStoredNonQueryAsync();

        return (int)outputMaxParam.Value;
    }

    public async Task<int> MaxAutoLateDeliveryAlert()
    {
        DbParameter outputMaxParam = null;
        await Context
            .LoadStoredProc("GEN_qdfSetting_GetMaxAutoLateDeliveryAlert")
            .WithSqlParam(
                "@MaxAutoLateDeliveryAlert",
                dbParam =>
                {
                    dbParam.Direction = ParameterDirection.Output;
                    dbParam.DbType = DbType.Int32;
                    outputMaxParam = dbParam;
                }
            )
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

    public async Task<decimal> FuelSurchargeInclusiveAmount(
        int clientId,
        decimal amount,
        int from,
        int to,
        DateTime booked,
        int size
    )
    {
        DbParameter outputMaxParam = null;
        await Context
            .LoadStoredProc("UTL_stpFuelSurcharge_InclusiveAmount")
            .WithSqlParam("@ClientID", clientId)
            .WithSqlParam("@Date", booked)
            .WithSqlParam("@Size", size)
            .WithSqlParam("@Amount", amount)
            .WithSqlParam("@FromSuburbID", from)
            .WithSqlParam("@ToSuburbID", to)
            .WithSqlParam(
                "@FuelSurcharge",
                dbParam =>
                {
                    dbParam.Direction = ParameterDirection.Output;
                    dbParam.DbType = DbType.Currency;
                    outputMaxParam = dbParam;
                }
            )
            .ExecuteStoredNonQueryAsync();

        return (decimal)outputMaxParam.Value;
    }

    public async Task ResetLateEvent(int jobId, int lateEventType)
    {
        var job = await Context.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == jobId);

        switch (lateEventType)
        {
            case (int)LateEventType.Pickup:
                job.LatePickupNotificationHasBeenSent = false;
                break;
            case (int)LateEventType.Delivery:
                job.LateDeliveryNotificationHasBeenSent = false;
                break;
        }

        await Context.SaveChangesAsync();
    }

    public async Task LatePickup(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        int staffId,
        bool calculationRequired
    )
    {
        var time = await Context.TucJobTypes
            .Where(jt => jt.ShortName == bookedSpeed || jt.ShortName == notifiedSpeed)
            .MaxAsync(jt => jt.PickupTime);

        // Get job information
        var job = await Context.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job);

            if(!job.UcjbTime.HasValue) return;

            var jobDateTime = job.UcjbDate.Add(job.UcjbTime.Value.TimeOfDay);
            var windowValue = job.UcjbLatePick ?? time;

            if(!windowValue.HasValue) return;

            var dueMins = (jobDateTime.AddMinutes((double)windowValue) - DateTime.Now).TotalMinutes;
            var latePick = job.UcjbLatePick;

            // Perform calculation if required
            if (calculationRequired)
            {
                var pickupEtaValue = late;
                late = (int)(pickupEtaValue - (int)dueMins + windowValue);

                // Return if latePick is already equal to late
                if (latePick.GetValueOrDefault(0) == late) return;
            }

            // Format pickup time
            var minsOver = late - time;

            await SaveNoteAsync(jobId: jobId, noteText: $"Late Pickup: {minsOver} mins over ETA", staffId: staffId);

            // Update job
        job.UcjbStatus = (int)JobStatus.LatePickup;
        job.UcjbLatePick = late;
        job.LatePickupNotificationHasBeenSent = false;

        await Context.SaveChangesAsync();
    }

    public async Task LateDelivery(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        int staffId,
        bool calculationRequired
    )
    {
        // Get the maximum delivery time for the specified speeds
        var time = await Context.TucJobTypes
            .Where(predicate: jt => jt.ShortName == bookedSpeed || jt.ShortName == notifiedSpeed)
            .MaxAsync(selector: jt => jt.DeliveryTime);

        // Get job information
        var job = Context.TucJobs.FirstOrDefault(predicate: j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(argument: job);

        if(!job.UcjbTime.HasValue) return;

        // Calculate DueMins, LateDel, and Window
        var jobDateTime = job.UcjbDate.Add(value: job.UcjbTime.Value.TimeOfDay);
        var windowValue = job.UcjbLateDel ?? time;

        if(!windowValue.HasValue) return;

        var dueMins = (jobDateTime.AddMinutes(value: (double)windowValue) - DateTime.Now).TotalMinutes;
        var lateDel = job.UcjbLateDel;

        // Perform calculation if required
        if (calculationRequired)
        {
            var deliveryEtaValue = late;
            late = (int)(deliveryEtaValue - (int)dueMins + windowValue);

            // Return if lateDel is already equal to late
            if (lateDel.GetValueOrDefault(defaultValue: 0) == late) return;
        }

        // Format delivery time
        var minsOver = late - time;

       await SaveNoteAsync(jobId: jobId, noteText: $"Late Delivery: {minsOver} mins over ETA", staffId: staffId);

        // Update job
        job.UcjbStatus = (int)JobStatus.LateDelivery;
        job.UcjbLateDel = late;
        job.LateDeliveryNotificationHasBeenSent = false;

        await Context.SaveChangesAsync();
    }

    public async Task RestoreSplitJobs(List<int> jobIds)
    {
        if (jobIds == null || jobIds.Count == 0)
            return;

        foreach (var jobId in jobIds) await Context.Procedures.DES_stpJob_SplitJobRestoreAsync(jobId);
    }

    public async Task RestoreJobs(List<int> jobIds)
    {
        if (jobIds == null || jobIds.Count == 0)
            return;

        foreach (var jobId in jobIds) await Context.Procedures.uspRestoreJobAsync(jobId);
    }

    public async Task MessageCourier(int courierId, int dispId, string despatcher, string message)
    {
        await Context
            .LoadStoredProc("DES_stpManualMessage_Insert")
            .WithSqlParam("@SendToID", courierId)
            .WithSqlParam("@StaffID", dispId)
            .WithSqlParam("@WindowsUser", despatcher)
            .WithSqlParam("@Message", message)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task VoidJob(int jobId)
    {
        await Context
            .LoadStoredProc("DES_stpJob_Void")
            .WithSqlParam("@JobID", jobId)
            .ExecuteStoredNonQueryAsync();
    }

    public async Task SplitJob(int jobId, string user)
    {
        await Context.Procedures.DES_stpJob_SplitJobAsync(jobId, false, user);
    }

    public async Task<string> UnSplitJob(int jobId)
    {
        DbParameter messageOutput = null;
        await Context
            .LoadStoredProc("DES_stpJob_UnSplit")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam(
                "@Message",
                dbParam =>
                {
                    dbParam.Direction = ParameterDirection.Output;
                    dbParam.DbType = DbType.String;
                    dbParam.Size = 4000;
                    messageOutput = dbParam;
                }
            )
            .ExecuteStoredNonQueryAsync();
        return (string)messageOutput.Value;
    }

    public async Task UpdateSplitJobAddress(
        int jobId,
        int toSuburbId,
        string address,
        decimal deliveryLat,
        decimal deliveryLng
    )
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
        await Context
            .LoadStoredProc("DES_stpJob_SplitJob_ReRate")
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

        await Context.Procedures.DES_stpJob_DisplayInDespatchAsync(jobId);
    }

    public async Task<List<SuburbLookup>> SuburbsAsync()
    {
        return await Context
            .TucSuburbs.Select(x => new SuburbLookup
            {
                ID = x.UcsuId,
                Text = x.UcsuName,
                Alias = x.GoogleSuburbAlias
            })
            .ToListAsync();
    }

    public async Task<List<Suggestion>> SpeedsAsync()
    {
        return await Context
            .DesQryAllJobTypes.Select(x => new Suggestion { Id = x.JobTypeId, Text = x.Name })
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<List<Suggestion>> ContactsAsync(int clientId)
    {
        return await Context
            .UtlQryContactLookups.Join(
                Context.TblClientContacts,
                s => s.ContactId,
                cc => cc.ContactId,
                (s, cc) => new { s, cc }
            )
            .Where(x => x.cc.ClientId == clientId && x.s.Active)
            .Select(x => new Suggestion { Id = x.s.ContactId, Text = x.s.Name })
            .Distinct()
            .AsNoTracking()
            .ToListAsync();
    }

    public Task<List<ClientContactDetailViewModel>> ContactDetailList(int clientId)
    {
        var data = (
            from s in Context.UtlQryContactLookups
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
            }
        ).Distinct();
        return data.ToListAsync();
    }

    public async Task<List<Lookup>> LeaveParcelLocationsAsync()
    {
        return await Context
            .TblJobLeaveNotHomes.OrderBy(l => l.Sequence)
            .Select(x => new Lookup { ID = x.LeaveNotHomeId, Text = x.Name })
            .ToListAsync();
    }

    public async Task<List<UndeliverableLocation>> UndeliverableLocationsAsync()
    {
        return await Context
            .TblUndeliverableLocations.OrderBy(u => u.Name)
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
        return await Context
            .TucJobInternalStatuses.Where(x => x.Tcis != (int)InternalJobStatus.OvernightCp
                                               && x.Tcis != (int)InternalJobStatus.ActionRequired)
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

    public async Task<List<Suggestion>> GetStatusListAsync()
    {
        return await Context
            .TucJobStatuses.OrderBy(s => s.UcjsId)
            .Select(s => new Suggestion { Id = s.UcjsId, Text = s.UcjsName })
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<List<Suggestion>> EventTypeListAsync()
    {
        return await Context
            .TucEventTypes.Where(u => u.UcetGroup == "CS" || u.UcetGroup == "GE")
            .OrderBy(u => u.UcetName)
            .Select(x => new Suggestion { Id = x.UcetId, Text = x.UcetName })
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<decimal> RateTruckJob(
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
        DbParameter outputRateParam = null;

        await Context
            .LoadStoredProc("DES_stpJob_Truck_Rate_Described")
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
            .WithSqlParam(
                "@Description",
                dbParam =>
                {
                    dbParam.Direction = ParameterDirection.Output;
                    dbParam.DbType = DbType.String;
                    dbParam.Size = 1000;
                    _ = dbParam;
                }
            )
            .WithSqlParam(
                "@Rate",
                dbParam =>
                {
                    dbParam.Direction = ParameterDirection.Output;
                    dbParam.DbType = DbType.Currency;
                    outputRateParam = dbParam;
                }
            )
            .ExecuteStoredNonQueryAsync();

        return (decimal)outputRateParam.Value;
    }

    public async Task<string> RateTruckJobDescription(
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
        DbParameter outputDescriptionParam = null;
        DbParameter outputRateParam = null;

        await Context
            .LoadStoredProc("DES_stpJob_Truck_Rate_Described")
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
            .WithSqlParam(
                "@Description",
                dbParam =>
                {
                    dbParam.Direction = ParameterDirection.Output;
                    dbParam.DbType = DbType.String;
                    dbParam.Size = 1000;
                    outputDescriptionParam = dbParam;
                }
            )
            .WithSqlParam(
                "@Rate",
                dbParam =>
                {
                    dbParam.Direction = ParameterDirection.Output;
                    dbParam.DbType = DbType.Currency;
                    outputRateParam = dbParam;
                }
            )
            .ExecuteStoredNonQueryAsync();

        return (string)outputDescriptionParam.Value;
    }

    public async Task<List<ChargeViewModel>> GetJobPriceBreakdownAsync(int jobId)
    {
        var effectiveJobId = await GetJobRelationshipInfoAsync(jobId);

        return await Context.PricingBreakdowns
            .Where(p => p.JobId == effectiveJobId)
            .Select(p => new ChargeViewModel
            {
                ChargeId = p.PricingBreakdownId,
                Amount = p.ChargeAmount,
                Name = p.ChargeName,
                JobId = p.JobId,
                PrebookJobId = p.PrebookJobId
            })
            .AsNoTracking()
            .ToListAsync();
    }


    public async Task<int> AddJobPriceBreakdownAsync(ChargeViewModel viewModel)
    {
        var item = new PricingBreakdown
        {
            ChargeAmount = viewModel.Amount,
            ChargeName = viewModel.Name,
            JobId = viewModel.JobId,
            PrebookJobId = viewModel.PrebookJobId
        };

        var note = $"Added price component: {viewModel.Name} for ${viewModel.Amount:F2}";
        var isPrebook = viewModel.PrebookJobId.HasValue;
        if (isPrebook)
            await SetPrebookJobAsManuallyPriceAsync(viewModel.PrebookJobId.Value, note);
        else if (viewModel.JobId != null) await SetJobAsManuallyPriceAsync(viewModel.JobId.Value, note);

        await Context.PricingBreakdowns.AddAsync(item);
        await Context.SaveChangesAsync();

        return item.PricingBreakdownId;
    }

    public async Task UpdateJobPriceBreakdownAsync(ChargeViewModel viewModel)
    {
        var breakdown = Context.PricingBreakdowns.FirstOrDefault(p => p.PricingBreakdownId == viewModel.ChargeId);
        if (breakdown == null) return;

        breakdown.ChargeAmount = viewModel.Amount;
        breakdown.ChargeName = viewModel.Name;

        var note = $"Updated price breakdown: {viewModel.Name} charge amount changed to {viewModel.Amount:C}";

        var isPrebook = breakdown.PrebookJobId.HasValue;
        if (isPrebook)
            await SetPrebookJobAsManuallyPriceAsync(breakdown.PrebookJobId.Value, note);
        else if (breakdown.JobId != null) await SetJobAsManuallyPriceAsync(breakdown.JobId.Value, note);

        Context.Update(breakdown);
        await Context.SaveChangesAsync();
    }

    public async Task DeleteJobPriceBreakdownAsync(int chargeId)
    {
        var breakdown = await Context.PricingBreakdowns
            .FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
        if (breakdown == null) return;

        var note = $"Deleted {chargeId} - {breakdown.ChargeName} - {breakdown.ChargeAmount}";

        var isPrebook = breakdown.PrebookJobId.HasValue;
        if (isPrebook)
            await SetPrebookJobAsManuallyPriceAsync(breakdown.PrebookJobId.Value, note);
        else if (breakdown.JobId != null) await SetJobAsManuallyPriceAsync(breakdown.JobId.Value, note);

        Context.PricingBreakdowns.Remove(breakdown);
        await Context.SaveChangesAsync();
    }

    private async Task SetJobAsManuallyPriceAsync(int jobId, string note)
    {
        var job = await Context.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == jobId);
        job.RatedManually = true;

        // Add note of pricing changes
        job.InternalNotes += $"\n{note}";

        Context.Update(job);
    }

    private async Task SetPrebookJobAsManuallyPriceAsync(int prebookJobId, string note)
    {
        var job = await Context.TucJobBookings.FirstOrDefaultAsync(j => j.UcbkId == prebookJobId);
        job.RatedManually = true;

        // Add note of pricing changes
        job.InternalNotes += $"\n{note}";

        Context.Update(job);
    }

    /// <inheritdoc />
    public Task<string> RateJobDescription(
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
        throw new NotImplementedException();
    }

    public async Task<DirectToASAPViewModel> DirectToAsap(int jobId)
    {
        var result = new List<DirectToASAPViewModel>();
        await Context
            .LoadStoredProc("DESWEB_stpJob_DirectToASAP")
            .WithSqlParam("@JobID", jobId)
            .ExecuteStoredProcAsync(handle => { result = handle.ReadToList<DirectToASAPViewModel>().ToList(); });
        return result.FirstOrDefault();
    }

    public async Task<UpdateFirstAvailableSpeedResult> UpdateFirstAvailableSpeed(int jobId)
    {
        DbParameter outputParam = null;
        DbParameter nameOutput = null;
        await Context
            .LoadStoredProc("DESWEB_stpJob_UpdateFirstAvailableSpeed")
            .WithSqlParam("@JobID", jobId)
            .WithSqlParam(
                "@JobTypeID",
                dbParam =>
                {
                    dbParam.Direction = ParameterDirection.Output;
                    dbParam.DbType = DbType.Int32;
                    outputParam = dbParam;
                }
            )
            .WithSqlParam(
                "@Name",
                dbParam =>
                {
                    dbParam.Direction = ParameterDirection.Output;
                    dbParam.DbType = DbType.String;
                    dbParam.Size = 50;
                    nameOutput = dbParam;
                }
            )
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
            p.Id,
            p.Quantity,
            p.Weight,
            p.Length,
            p.Height,
            p.Depth,
            p.Pu,
            p.Do,
            p.DgClass,
            p.Notes,
            preBook,
            despatcher
        );
    }

    public async Task EditPalletInfoAsync(PalletInfo p, bool preBook, string despatcher)
    {
        await Context.Procedures.DESWEB_stpJobItems_UpdateAsync(
            p.Id,
            p.ItemId,
            p.Quantity,
            p.Weight,
            p.Length,
            p.Height,
            p.Depth,
            p.Pu,
            p.Do,
            p.DgClass,
            p.Notes,
            preBook,
            despatcher
        );
    }

    public async Task DeletePalletInfoAsync(PalletInfo p, bool preBook, string despatcher)
    {
        await Context.Procedures.DESWEB_stpJobItems_DeleteAsync(
            p.Id,
            p.ItemId,
            preBook,
            despatcher
        );
    }

    public async Task SendPrebookJobAsync(int jobId)
    {
        await Context.Procedures.DES_stpJobBooking_InsertJobAndChildrenAsync(jobId);
    }

    public async Task VoidPrebookJobAsync(int jobId, string despatcher, int staffId)
    {
        await Context.Procedures.DESWEB_stpVoidPrebookJobAsync(jobId, despatcher, staffId);
    }

    public async Task<TruckItemsSummary> TruckJobItemsAsync(int jobId, int truckWeightLimit)
    {
        var result = await Context.Procedures.qry_tucJobItemsAsync(jobId, truckWeightLimit);
        return result
            .Select(item => new TruckItemsSummary
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
            await SaveNoteAsync(request.JobId, note, request.DespatcherName);
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
            await SaveNoteAsync(request.JobId, note, request.DespatcherName);
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured updating the delivery address for job {request.JobId}");
            throw;
        }
    }

    public async Task UpdateBulkDeliveryAddressAsync(
        int bulkJobId,
        string toSuburb,
        int toPostCode,
        string address,
        decimal deliveryLat,
        decimal deliveryLng,
        string despatcher
    )
    {
        await Context.Procedures.DESWEB_stpUpdateBulkJobDeliveryAddressAsync(
            bulkJobId,
            toSuburb,
            toPostCode,
            address,
            deliveryLat,
            deliveryLng,
            despatcher
        );
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
            await SaveNoteAsync(request.JobId, note, request.DespatcherName);
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
            await SaveNoteAsync(request.JobId, note, request.DespatcherName);
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

    public async Task UpdateBulkPickupAddressAsync(
        int bulkJobId,
        string fromSuburb,
        int fromPostCode,
        string address,
        decimal pickupLat,
        decimal pickupLng,
        string despatcher
    )
    {
        await Context.Procedures.DESWEB_stpUpdateBulkJobPickupAddressAsync(
            bulkJobId,
            fromSuburb,
            fromPostCode,
            address,
            pickupLat,
            pickupLng,
            despatcher
        );
    }

    public async Task UpdateBookingDeliveryAddressAsync(
        int jobId,
        int toSuburbId,
        string address,
        decimal deliveryLat,
        decimal deliveryLng,
        bool cbd,
        decimal rate,
        string despatcher
    )
    {
        await Context.Procedures.DESWEB_stpUpdateJobBookingDeliveryAddressAsync(
            jobId,
            toSuburbId,
            address,
            deliveryLat,
            deliveryLng,
            cbd,
            rate,
            despatcher
        );
    }

    public async Task UpdateBookingPickupAddressAsync(
        int jobId,
        int fromSuburbId,
        string address,
        decimal pickupLat,
        decimal pickupLng,
        bool cbd,
        decimal rate,
        string despatcher
    )
    {
        await Context.Procedures.DESWEB_stpUpdateJobBookingPickupAddressAsync(
            jobId,
            fromSuburbId,
            address,
            pickupLat,
            pickupLng,
            cbd,
            rate,
            despatcher
        );
    }

    public async Task ReleaseBulkJobAsync(string jobNumber, DateTime bookDate)
    {
        await Context.Procedures.UTL_stpJob_tblBulkJob_ReleaseByJobNumberAsync(jobNumber, bookDate);
    }

    public async Task UpdateJobAsync(
        int jobId,
        string field,
        string value,
        decimal? rate,
        string userName,
        int staffId
    )
    {
        try
        {
            // Update either active or archived job
            var isActiveJob = Context.TucJobs.Any(j => j.UcjbId == jobId);
            if (isActiveJob)
                await UpdateTucJob(jobId, field, value, staffId);
            else
                await UpdateTucJobArchive(jobId, field, value, staffId);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured updating Job {jobId}", jobId);
            throw;
        }
    }

    public async Task UpdateBulkJobAsync(
        int bulkJobId,
        string field,
        string value,
        decimal? rate,
        string despatcher,
        int staffId
    )
    {
        await Context.Procedures.DESWEB_stpUpdateBulkJobAsync(
            bulkJobId,
            field,
            value,
            rate,
            despatcher,
            staffId
        );
    }

    public async Task UpdateJobBookingAsync(
        int jobId,
        string field,
        string value,
        decimal? rate,
        string despatcher,
        int staffId
    )
    {
        await Context.Procedures.DESWEB_stpUpdateJobBookingAsync(
            jobId,
            field,
            value,
            rate,
            despatcher,
            staffId
        );
    }

    public async Task<int> QuickAddJobAsync(JobCreateViewModel request, int staffId)
    {
        // Generate request number
        var jobNumber = await GenerateJobNumberAsync(staffId, request.SpeedId);

        // Create new job
        var job = new TucJob
        {
            UcjbClientId = request.ClientId,
            UcjbNumber = jobNumber,

            // Pick Up Address
            PickupAddressLine1 = request.PickUpAddress?.AddressLine1,
            PickupAddressLine2 = request.PickUpAddress?.AddressLine2,
            PickupAddressLine3 = request.PickUpAddress?.AddressLine3,
            PickupAddressLine4 = request.PickUpAddress?.AddressLine4,
            PickupAddressLine5 = request.PickUpAddress?.AddressLine5,
            PickupAddressLine6 = request.PickUpAddress?.AddressLine6,
            PickupAddressLine7 = request.PickUpAddress?.AddressLine7,
            PickupAddressLine8 = request.PickUpAddress?.AddressLine8,

            // Pick Up Coordinates
            PickUpLatitude = request.FromLat,
            PickUpLongitude = request.FromLong,

            // Delivery Address
            DeliveryAddressLine1 = request.DeliveryAddress?.AddressLine1,
            DeliveryAddressLine2 = request.DeliveryAddress?.AddressLine2,
            DeliveryAddressLine3 = request.DeliveryAddress?.AddressLine3,
            DeliveryAddressLine4 = request.DeliveryAddress?.AddressLine4,
            DeliveryAddressLine5 = request.DeliveryAddress?.AddressLine5,
            DeliveryAddressLine6 = request.DeliveryAddress?.AddressLine6,
            DeliveryAddressLine7 = request.DeliveryAddress?.AddressLine7,
            DeliveryAddressLine8 = request.DeliveryAddress?.AddressLine8,

            // Delivery Coordinates
            DeliveryLatitude = request.ToLat,
            DeliveryLongitude = request.ToLong,

            // Auckland CBD (Could be removed later)
            UcjbCbd = IsCbdLocation(request.ToLat, request.ToLong),

            // Details
            PickupFromContact = request.FromContactName,
            UcjbDate = request.Date,
            UcjbVoid = request.Void,
            UcjbVan = request.Van,
            UcjbAttention = request.Attention,
            DeliverToContact = request.DeliverToContact,
            UcjbPodname = request.PodName,
            Truck = request.Truck,
            VanOk = request.VanOk,
            Reprice = request.Reprice,
            UcjbAmount = request.Charge,
            UcjbSpeed = request.SpeedId,

            // References
            UcjbClientRefa = request.RefA,
            UcjbClientRefb = request.RefB,

            // Manual
            RatedManually = true,
            UcjbType = (int)JobType.AllServices,
            UcjbLocked = true,
            SourceId = 13,
            UcjbStatus = 6,
            UcjbJobDone = true,
            ProofOfDelivery = 0,
            WhenPodnotificationSent = DateTime.Now,
            UcjbReturn = false,
            UcjbPaged = false
        };

        await Context.TucJobs.AddAsync(job);
        await Context.SaveChangesAsync();

        return job.UcjbId;
    }

    public async Task AddInterCourierChargeAsync(InterCourierChargeViewModel viewModel)
    {
        try
        {
            var note = $"From # {viewModel.FromCourierId} To # {viewModel.ToCourierId}";
            var currentTime = timeService.GetCurrentTenantTime();

            var fromJobNumber = await GenerateJobNumberAsync(viewModel.StaffId, (int)JobType.AllServices);
            var toJobNumber = await GenerateJobNumberAsync(viewModel.StaffId, (int)JobType.AllServices);

            var fromJob = CreateJobEntry(
                fromJobNumber,
                viewModel.FromCourierId,
                viewModel.Amount,
                viewModel.Reference,
                $"To # {viewModel.ToCourierId}",
                "ICC",
                note,
                currentTime,
                viewModel.StaffId
            );
            await Context.TucJobs.AddAsync(fromJob);

            var toJob = CreateJobEntry(
                toJobNumber,
                viewModel.ToCourierId,
                viewModel.Amount,
                viewModel.Reference,
                $"From # {viewModel.FromCourierId}",
                "",
                note,
                currentTime,
                viewModel.StaffId
            );
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
        return await Context
            .TblClientAvailableSpeeds.Where(cas =>
                cas.ClientId == clientId && cas.SpeedId == speedId
            )
            .SelectMany(cas =>
                cas.TblClientAvailableSpeedItems.Where(casi => casi.Active)
                    .Select(casi => casi.ClientItem)
            )
            .AnyAsync();
    }

    public async Task<PaginatedResponse<ClientItemsViewModel>> GetClientItemsBySpeedAsync(
        int clientId,
        int speedId,
        int jobId
    )
    {
        var job = await GetJobInfo(jobId);
        var clientItemIds = GetClientItemIds(job?.ClientItemIds);
        var clientItemsQuery = BuildClientItemsQuery(clientId, speedId, clientItemIds);
        return await CreatePagedList(clientItemsQuery);
    }

    public async Task AddClientsItemToJobAsync(
        int jobId,
        List<int> clientItemIds,
        decimal totalCost
    )
    {
        var clientItemsString =
            clientItemIds is null || clientItemIds.Count == 0
                ? string.Empty
                : string.Join(",", clientItemIds);

        var job = new TucJob
        {
            UcjbId = jobId,
            ClientItemIds = clientItemsString,
            UcjbAmount = totalCost
        };

        Context.TucJobs.Attach(job);
        Context.Entry(job).Property(x => x.ClientItemIds).IsModified = true;
        Context.Entry(job).Property(x => x.UcjbAmount).IsModified = true;
        await Context.SaveChangesAsync();
    }

    public async Task<IList<OpenJobResponse>> GetOpenJobsAsync(
        DateTime? startDate = null,
        DateTime? endDate = null,
        string regions = null,
        string speeds = null
    )
    {
        try
        {
            var query = Context.TucJobs.Where(j =>
                j.UcjbStatus != (int)JobStatus.Completed && j.UcjbStatus != (int)JobStatus.Rejected
            );

            // Apply date range filter
            if (startDate.HasValue)
                query = query.Where(j => j.UcjbDate >= startDate);
            if (endDate.HasValue)
                query = query.Where(j => j.UcjbDate <= endDate);

            // Apply region filter if provided
            if (!string.IsNullOrWhiteSpace(regions))
            {
                var regionIds = regions.Split(',').Select(int.Parse).ToList();

                query = query.Where(j =>
                    j.TblBulkJobs.Any(b => regionIds.Contains(b.Region.BulkRegionId))
                );
            }

            // Apply speed filter if provided
            if (!string.IsNullOrWhiteSpace(speeds))
            {
                var speedIds = speeds.Split(',').Select(int.Parse).ToList();

                query = query.Where(j => speedIds.Contains(j.UcjbSpeedNavigation.UcjtId));
            }

            // Order
            query = query.OrderBy(j => j.PickUpTime.Value);

            var openJobs = await query
                .Select(j => new OpenJobResponse
                {
                    JobId = j.UcjbId,
                    Reference = j.UcjbNumber,
                    Status = j.UcjbStatusNavigation.UcjsName,
                    PickupTime = j.PickUpTime ?? DateTime.Today,
                    PickupName = j.PickupFromContact,
                    PickupAddress = AddressFormatter.FormatWithCityStateZip(
                        new AddressFormatter.Address(
                            j.PickupAddressLine1,
                            j.PickupAddressLine2,
                            j.PickupAddressLine3,
                            j.PickupAddressLine4,
                            j.PickupAddressLine5,
                            j.PickupAddressLine6,
                            j.PickupAddressLine7,
                            j.PickupAddressLine8
                        )
                    ),
                    DeliveryTime = j.RequiredDeliveryTime ?? DateTime.Today,
                    DeliveryName = j.DeliverToContact,
                    DeliveryAddress = AddressFormatter.FormatWithCityStateZip(
                        new AddressFormatter.Address(
                            j.DeliveryAddressLine1,
                            j.DeliveryAddressLine2,
                            j.DeliveryAddressLine3,
                            j.DeliveryAddressLine4,
                            j.DeliveryAddressLine5,
                            j.DeliveryAddressLine6,
                            j.DeliveryAddressLine7,
                            j.DeliveryAddressLine8
                        )
                    ),
                    DriverName = j.UcjbCourier.UccrName,
                    CompletedToday = j.UcjbCourier.TucJobUcjbCouriers.Count(dj =>
                        dj.UcjbStatus == (int)JobStatus.Completed
                        && dj.UcjbComplTime.HasValue
                        && dj.UcjbComplTime.Value.Date == DateTime.Today
                    ),
                    LastCompleted = j
                        .UcjbCourier.TucJobUcjbCouriers.Where(dj =>
                            dj.UcjbStatus == (int)JobStatus.Completed && dj.UcjbComplTime.HasValue
                        )
                        .OrderByDescending(dj => dj.UcjbComplTime)
                        .Select(dj => dj.UcjbComplTime)
                        .FirstOrDefault(),
                    Quantity = j.UcjbQty ?? 0,
                    PackageType = j.AcceptedJobType.UcjtName,
                    Mileage =
                        j.PickUpLatitude.HasValue
                        && j.PickUpLongitude.HasValue
                        && j.DeliveryLatitude.HasValue
                        && j.DeliveryLongitude.HasValue
                            ? DistanceCalculator.CalculateDistance(
                                new AddressCoordinates(
                                    j.PickUpLatitude.Value,
                                    j.PickUpLongitude.Value
                                ),
                                new AddressCoordinates(
                                    j.DeliveryLatitude.Value,
                                    j.DeliveryLongitude.Value
                                )
                            )
                            : 0
                })
                .AsNoTracking()
                .ToListAsync();

            return openJobs;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting open jobs");
            throw;
        }
    }

    public async Task<DriverStats> GetDriverStatsAsync(int courierId)
    {
        try
        {
            var stats = await Context
                .TucCouriers.Where(d => d.UccrId == courierId)
                .Select(d => new DriverStats
                {
                    DriverName = d.UccrName,
                    CompletedToday = d.TucJobUcjbCouriers.Count(j =>
                        j.UcjbStatus == (int)JobStatus.Completed
                        && j.UcjbComplTime.HasValue
                        && j.UcjbComplTime.Value.Date == timeService.GetCurrentTenantTime()
                    ),
                    LastCompleted = d
                        .TucJobUcjbCouriers.Where(j =>
                            j.UcjbStatus == (int)JobStatus.Completed && j.UcjbComplTime.HasValue
                        )
                        .OrderByDescending(j => j.UcjbComplTime)
                        .Select(j => j.UcjbComplTime)
                        .FirstOrDefault()
                })
                .AsNoTracking()
                .FirstOrDefaultAsync();

            return stats;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting driver stats for {CourierId}", courierId);
            throw;
        }
    }

    private static bool IsCbdLocation(decimal latitude, decimal longitude) =>
        latitude is >= -37.81897m and <= -37.80647m && longitude is >= 144.95573m and <= 144.97737m;

    private async Task UpdateTucJob(int jobId, string field, string value, int staffId)
    {
        var job = await Context
            .TucJobs.Where(j => j.UcjbId == jobId)
            .Include(j => j.TucJobNationwides)
            .Include(j => j.UcjbClient)
            .Include(j => j.Contact)
            .Include(j => j.InternalStatusNavigation)
            .Include(j => j.UndeliverableLocation)
            .Include(j => j.InverseParent)
            .Include(j => j.Parent)
            .ThenInclude(j => j.InverseParent)
            .Include(j => j.NotifiedJobType)
            .Include(j => j.UcjbSpeedNavigation)
            .Include(j => j.DeliverToLeave)
            .FirstOrDefaultAsync();

        if (job == null)
            throw new ArgumentException("Job not found");

        var updateNote = string.Empty;

        // Update the correct field prop
        switch (field)
        {
            case "ConNote":
                job.Connote = value;
                break;
            case "AirportOnly":
                var airportOnly = bool.Parse(value);
                job.TucJobNationwides.First().UcnwAirportOnly = airportOnly;
                updateNote = $"Changed AirportOnly to {(airportOnly ? "Yes" : "No")}";
                break;
            case "Time":
                job.UcjbTime = DateTime.Parse(value);
                break;
            case "Date":
                job.UcjbDate = DateTime.Parse(value);
                break;
            case "Size":
                job.UcjbSize = int.Parse(value);
                updateNote = $"Changed Size to {job.UcjbSize}";
                break;
            case "Items":
                job.UcjbQty = short.Parse(value);
                break;
            case "SpeedID":
                job.UcjbSpeed = short.Parse(value);
                updateNote = $"Changed Speed to {job.UcjbSpeedNavigation?.UcjtName}";
                break;
            case "AcceptedJobTypeID" when !job.UcjbJobDone:
                job.UcjbSpeed = short.Parse(value);
                break;
            case "Weight":
                var weight = short.Parse(value);

                // Update parent job if it exists
                if (job.ParentId != null)
                {
                    job.Parent.UcjbWeight = weight;

                    // Update all other child jobs of the parent
                    if (job.Parent.InverseParent.Count != 0)
                    {
                        foreach (var siblingJob in job.Parent.InverseParent)
                            siblingJob.UcjbWeight = weight;
                    }
                }
                // If no parent, update this job and its children
                else
                {
                    // Update current job
                    job.UcjbWeight = weight;

                    // Update child jobs
                    if (job.InverseParent != null && job.InverseParent.Count != 0)
                    {
                        foreach (var childJob in job.InverseParent)
                            childJob.UcjbWeight = weight;
                    }
                }

                break;
            case "ClientID":
                job.UcjbClientId = int.Parse(value);
                job.UcjbClientCode = job.UcjbClient.UcclCode;
                updateNote = $"Changed Client to {job.UcjbClient?.UcclCode}";
                break;
            case "ClientCode":
                job.UcjbClientCode = value[..Math.Min(value.Length, 5)];
                break;
            case "ContactID":
                var contactId = int.Parse(value);
                job.ContactId = contactId;
                job.UcjbContact = job.Contact?.UserName;
                updateNote = $"Changed Contact to {job.Contact?.UserName}";
                break;
            case "Pedal":
                job.UcjbCbd = bool.Parse(value);
                break;
            case "Attention":
                job.UcjbAttention = bool.Parse(value);
                break;
            case "Reprice":
                job.Reprice = bool.Parse(value);
                break;
            case "Truck":
                job.Truck = bool.Parse(value);
                job.UcjbVan = false; // Set van to false when truck is selected
                break;
            case "Van":
                job.UcjbVan = bool.Parse(value);
                job.Truck = false; // Set truck to false when van is selected
                break;
            case "VanOK":
                job.VanOk = bool.Parse(value);
                break;
            case "InternalStatusID":
                var internalStatusId = int.Parse(value);
                job.InternalStatus = internalStatusId;

                // Handle followup time
                if (!new[]
                    {
                        (int)InternalJobStatus.NewJobs,
                        (int)InternalJobStatus.Reprice
                    }.Contains(internalStatusId))
                {
                    // Safely handle DefaultMinutes when InternalStatusNavigation is null
                    var defaultMinutes = job.InternalStatusNavigation?.DefaultMinutes ?? 0;
                    job.FollowupTime = timeService.GetCurrentTenantTime().AddMinutes(defaultMinutes);
                }
                else
                {
                    job.FollowupTime = null;
                }

                job.UcjbStatus = internalStatusId switch
                {
                    // Handle status changes
                    3 when job.UcjbStatus != 9 => 9,
                    1 when job.UcjbStatus != 1 => 1,
                    4 when job.UcjbStatus != 6 => 6,
                    _ => job.UcjbStatus
                };

                // Safely handle TcisName when InternalStatusNavigation is null
                updateNote = job.InternalStatusNavigation != null
                    ? $"Changed Job Follow Up to {job.InternalStatusNavigation.TcisName}"
                    : $"Changed Job Follow Up to status {internalStatusId}";
                break;
            case "Status":
                job.UcjbStatus = int.Parse(value);
                break;
            case "RefA":
                job.UcjbClientRefa = value[..Math.Min(value.Length, 20)];
                break;
            case "RefB":
                job.UcjbClientRefb = value[..Math.Min(value.Length, 15)];
                break;
            case "OurRef":
                job.UcjbOurRef = value[..Math.Min(value.Length, 20)];
                break;
            case "FromContactName":
                job.PickupFromContact = value[..Math.Min(value.Length, 100)];
                break;
            case "ToContactName":
                job.DeliverToContact = value[..Math.Min(value.Length, 100)];
                break;
            case "FromContactPhone":
                job.PickupFromPhone = value[..Math.Min(value.Length, 100)];
                break;
            case "ToContactPhone":
                job.DeliverToPhone = value[..Math.Min(value.Length, 100)];
                break;
            case "DeliverToLeaveID":
                var leaveId = int.Parse(value);
                job.DeliverToLeaveId = leaveId;
                job.DeliverToPrivateBusiness = leaveId == 1 ? null : 1;
                updateNote = $"Changed Leave Parcel to {job.DeliverToLeave?.Name}";
                break;
            case "UndeliverableLocationID":
                job.UndeliverableLocationId = int.Parse(value);
                job.UcjbStatus = (int)JobStatus.Undeliverable;
                job.UcjbJobDone = true;
                job.UcjbComplTime = timeService.GetCurrentTenantTime();
                job.UcjbPodname =
                    job.UndeliverableLocation != null
                        ? job.UndeliverableLocation.Podname
                        : string.Empty;
                updateNote = $"Changed Undeliverable Location to {job.UndeliverableLocation?.Name}";
                break;
            case "Delivered":
                var delivered = bool.Parse(value);
                job.UcjbJobDone = delivered;
                if (delivered)
                {
                    job.UcjbStatus = (int)JobStatus.Completed;
                    job.UcjbComplTime = timeService.GetCurrentTenantTime();
                }

                break;
            case "CompletedTime":
                job.UcjbComplTime = DateTime.Parse(value);
                break;
            case "DGClass":
                job.Dgclass = int.Parse(value);
                break;
            case "DGDocumentation":
                var dgDoc = bool.Parse(value);
                job.Dgdocument = dgDoc;
                updateNote = $"Changed DGDocumentation to {(dgDoc ? "Yes" : "No")}";
                break;
            case "TrackingMethod":
                var trackingMethodId = int.Parse(value);
                job.TrackingMethod = trackingMethodId;
                updateNote = $"Changed Tracking Method to {GetTrackingName(trackingMethodId)}";
                break;
            case "Direct":
                job.Direct = bool.Parse(value);
                break;
            case "Void":
                job.UcjbVoid = bool.Parse(value);
                break;
            case "TrackingMobile":
                job.TrackingMobile = value[..Math.Min(value.Length, 100)];
                break;
            case "TrackingEmail":
                job.TrackingEmail = value[..Math.Min(value.Length, 100)];
                break;
            case "PODName":
            case "PodName":
                job.UcjbPodname = value[..Math.Min(value.Length, 100)];
                break;
            case "Amount":
                job.UcjbAmount = decimal.Parse(value);
                break;
            case "NotifiedJobTypeID":
                var notifiedJobTypeId = short.Parse(value);
                job.NotifiedJobTypeId = notifiedJobTypeId;

                if (
                    notifiedJobTypeId > job.NotifiedJobTypeId
                    && job.ContactId != null
                    && job.NotifiedJobType.UcjtName == "Email"
                    && job.Contact?.HasEmail == true
                    && !string.IsNullOrEmpty(job.Contact.UcctEmail)
                )
                {
                    job.SpeedChangeNotificationHasBeenSent = false;
                    job.WhenSpeedChangeNotificationSent = null;
                }
                else
                {
                    job.SpeedChangeNotificationHasBeenSent = true;
                }

                break;
            case "AcceptedJobTypeID":
                job.AcceptedJobTypeId = short.Parse(value);
                break;
            case "Locked":
                job.UcjbLocked = bool.Parse(value);
                break;
            case "PuTime":
                job.PickUpTime = DateTime.Parse(value);
                break;
            case "DeliverBy":
                job.DeliverByTime = DateTime.Parse(value);
                break;
            case "BookedTime":
                job.UcjbDate = DateTime.Parse(value);
                break;
        }

        if (!string.IsNullOrEmpty(updateNote))
            await SaveNoteAsync(jobId, updateNote, staffId);

        // Add additional notes for undeliverable location
        if (field == "UndeliverableLocationID" && job.UndeliverableLocation?.Message != null)
            await SaveNoteAsync(jobId, job.UndeliverableLocation.Message, staffId);

        Context.TucJobs.Update(job);
        await Context.SaveChangesAsync();
    }

    private async Task UpdateTucJobArchive(int jobId, string field, string value, int staffId)
    {
        var archive = await Context
            .TucJobArchives.Join(
                Context.TucClients,
                job => job.UcjbClientId,
                client => client.UcclId,
                (job, client) => new { job, client }
            )
            .Join(
                Context.TucClientContacts,
                j => j.job.ContactId,
                contact => contact.UcctId,
                (j, contact) =>
                    new
                    {
                        j.job,
                        j.client,
                        contact
                    }
            )
            .Join(
                Context.TucJobInternalStatuses,
                j => j.job.InternalStatus,
                status => status.Tcis,
                (j, status) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        status
                    }
            )
            .Join(
                Context.TblUndeliverableLocations,
                j => j.job.UndeliverableLocationId,
                loc => loc.UndeliverableLocationId,
                (j, loc) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        loc
                    }
            )
            .Join(
                Context.TucJobTypes,
                j => j.job.NotifiedJobTypeId,
                type => type.UcjtId,
                (j, type) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        j.loc,
                        type
                    }
            )
            .Join(
                Context.TucJobTypes,
                j => j.job.UcjbSpeed,
                speed => speed.UcjtId,
                (j, speed) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        j.loc,
                        j.type,
                        speed
                    }
            )
            .Join(
                Context.TblJobLeaveNotHomes,
                j => j.job.DeliverToLeaveId,
                leave => leave.LeaveNotHomeId,
                (j, leave) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        j.loc,
                        j.type,
                        j.speed,
                        leave
                    }
            )
            .GroupJoin(
                Context.TucJobArchives,
                j => j.job.ParentId,
                parent => parent.UcjbId,
                (j, parent) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        j.loc,
                        j.type,
                        j.speed,
                        j.leave,
                        parent
                    }
            )
            .Select(j => new
            {
                j.job,
                j.client,
                j.contact,
                j.status,
                j.loc,
                j.type,
                j.speed,
                j.leave,
                parent = j.parent.FirstOrDefault(),
                parentId = j.parent.Select(p => p.UcjbId).FirstOrDefault()
            })
            .GroupJoin(
                Context.TucJobArchives,
                j => j.parentId == 0 ? j.job.UcjbId : j.parentId,
                child => child.ParentId,
                (j, children) =>
                    new
                    {
                        j.job,
                        j.client,
                        j.contact,
                        j.status,
                        j.loc,
                        j.type,
                        j.speed,
                        j.leave,
                        j.parent,
                        children
                    }
            )
            .GroupJoin(
                Context.TucJobNationwides,
                j => j.job.UcjbId,
                nationwide => nationwide.UcnwJobId,
                (j, nationwide) =>
                    new
                    {
                        Job = j.job,
                        UcjbClient = j.client,
                        Contact = j.contact,
                        InternalStatusNavigation = j.status,
                        UndeliverableLocation = j.loc,
                        NotifiedJobType = j.type,
                        SpeedNavigation = j.speed,
                        DeliverToLeave = j.leave,
                        Parent = j.parent,
                        InverseParent = j.children,
                        Nationwide = nationwide.FirstOrDefault()
                    }
            )
            .Where(j => j.Job.UcjbId == jobId)
            .FirstOrDefaultAsync();

        if (archive == null)
            throw new ArgumentException("Job not found");

        var updateNote = string.Empty;

        // Update the correct field prop
        switch (field)
        {
            case "ConNote":
                archive.Job.Connote = value;
                break;
            case "AirportOnly":
                var airportOnly = bool.Parse(value);
                archive.Nationwide.UcnwAirportOnly = airportOnly;
                updateNote = $"Changed AirportOnly to {(airportOnly ? "Yes" : "No")}";
                break;
            case "Time":
                archive.Job.UcjbTime = DateTime.Parse(field);
                break;
            case "Date":
                archive.Job.UcjbDate = DateTime.Parse(field);
                break;
            case "Size":
                archive.Job.UcjbSize = short.Parse(field);
                break;
            case "Items":
                archive.Job.UcjbQty = short.Parse(value);
                break;
            case "SpeedID":
                archive.Job.UcjbSpeed = short.Parse(value);
                updateNote = $"Changed Speed to {archive.SpeedNavigation?.UcjtName}";
                break;
            case "AcceptedJobTypeID" when !archive.Job.UcjbJobDone:
                archive.Job.UcjbSpeed = short.Parse(value);
                break;
            case "Weight":
                var weight = float.Parse(value);
                if (archive.Job.ParentId != null)
                {
                    archive.Parent.UcjbWeight = weight;

                    // Update all sibling jobs (including current job)
                    if (archive.InverseParent.Any())
                    {
                        foreach (var siblingJob in archive.InverseParent)
                        {
                            siblingJob.UcjbWeight = weight;
                        }
                    }
                }
                else
                {
                    // This is a parent job, update it and all its children
                    archive.Job.UcjbWeight = weight;
                    if (archive.InverseParent.Any())
                    {
                        foreach (var childJob in archive.InverseParent)
                        {
                            childJob.UcjbWeight = weight;
                        }
                    }
                }

                break;
            case "ClientID":
                archive.Job.UcjbClientId = int.Parse(value);
                archive.Job.UcjbClientCode = archive.UcjbClient.UcclCode;
                updateNote = $"Changed Client to {archive.UcjbClient?.UcclCode}";
                break;
            case "ClientCode":
                archive.Job.UcjbClientCode = value[..Math.Min(value.Length, 5)];
                break;
            case "ContactID":
                var contactId = int.Parse(value);
                archive.Job.ContactId = contactId;
                archive.Job.UcjbContact = archive.Contact.UserName;
                break;
            case "Pedal":
                archive.Job.UcjbCbd = bool.Parse(value);
                break;
            case "Attention":
                archive.Job.UcjbAttention = bool.Parse(value);
                break;
            case "Reprice":
                archive.Job.Reprice = bool.Parse(value);
                break;
            case "Truck":
                archive.Job.Truck = bool.Parse(value);
                archive.Job.UcjbVan = false; // Set van to false when truck is selected
                break;
            case "Van":
                archive.Job.UcjbVan = bool.Parse(value);
                archive.Job.Truck = false; // Set truck to false when van is selected
                break;
            case "VanOK":
                archive.Job.VanOk = bool.Parse(value);
                break;
            case "InternalStatusID":
                var internalStatusId = int.Parse(value);
                archive.Job.InternalStatus = internalStatusId;

                // Handle followup time
                if (
                    !new[]
                    {
                        (int)InternalJobStatus.NewJobs,
                        (int)InternalJobStatus.Reprice
                    }.Contains(internalStatusId)
                )
                    archive.Job.FollowupTime = timeService.GetCurrentTenantTime().AddMinutes(
                        archive.InternalStatusNavigation.DefaultMinutes ?? 0
                    );
                else
                    archive.Job.FollowupTime = null;

                archive.Job.UcjbStatus = internalStatusId switch
                {
                    // Handle status changes
                    3 when archive.Job.UcjbStatus != 9 => 9,
                    1 when archive.Job.UcjbStatus != 1 => 1,
                    4 when archive.Job.UcjbStatus != 6 => 6,
                    _ => archive.Job.UcjbStatus
                };
                updateNote =
                    $"Changed Job Follow Up to {archive.InternalStatusNavigation.TcisName}";
                break;
            case "Status":
                archive.Job.UcjbStatus = int.Parse(value);
                break;
            case "RefA":
                archive.Job.UcjbClientRefa = value[..Math.Min(value.Length, 20)];
                break;
            case "RefB":
                archive.Job.UcjbClientRefb = value[..Math.Min(value.Length, 15)];
                break;
            case "OurRef":
                archive.Job.UcjbOurRef = value[..Math.Min(value.Length, 20)];
                break;
            case "FromContactName":
                archive.Job.PickUpFromContact = value[..Math.Min(value.Length, 100)];
                break;
            case "ToContactName":
                archive.Job.DeliverToContact = value[..Math.Min(value.Length, 100)];
                break;
            case "FromContactPhone":
                archive.Job.PickUpFromPhone = value[..Math.Min(value.Length, 100)];
                break;
            case "ToContactPhone":
                archive.Job.DeliverToPhone = value[..Math.Min(value.Length, 100)];
                break;
            case "DeliverToLeaveID":
                var leaveId = int.Parse(value);
                archive.Job.DeliverToLeaveId = leaveId;
                archive.Job.DeliverToPrivateBusiness = leaveId == 1 ? null : 1;
                updateNote = $"Changed Leave Parcel to {archive.DeliverToLeave?.Name}";
                break;
            case "UndeliverableLocationID":
                archive.Job.UndeliverableLocationId = int.Parse(value);
                archive.Job.UcjbStatus = (int)JobStatus.Undeliverable;
                archive.Job.UcjbJobDone = true;
                archive.Job.UcjbComplTime = timeService.GetCurrentTenantTime();
                archive.Job.UcjbPodname =
                    archive.UndeliverableLocation != null
                        ? archive.UndeliverableLocation.Podname
                        : string.Empty;
                updateNote =
                    $"Changed Undeliverable Location to {archive.UndeliverableLocation?.Name}";
                break;
            case "Delivered":
                var delivered = bool.Parse(value);
                archive.Job.UcjbJobDone = delivered;
                if (delivered)
                {
                    archive.Job.UcjbStatus = 6;
                    archive.Job.UcjbComplTime = timeService.GetCurrentTenantTime();
                }

                break;
            case "CompletedTime":
                archive.Job.UcjbComplTime = DateTime.Parse(value);
                break;
            case "DGClass":
                archive.Job.Dgclass = int.Parse(value);
                break;
            case "DGDocumentation":
                var dgDoc = bool.Parse(value);
                archive.Job.Dgdocument = dgDoc;
                updateNote = $"Changed DGDocumentation to {(dgDoc ? "Yes" : "No")}";
                break;
            case "TrackingMethod":
                var trackingMethodId = int.Parse(value);
                archive.Job.TrackingMethod = trackingMethodId;
                updateNote = $"Changed Tracking Method to {GetTrackingName(trackingMethodId)}";
                break;
            case "Direct":
                archive.Job.Direct = bool.Parse(value);
                break;
            case "Void":
                archive.Job.UcjbVoid = bool.Parse(value);
                break;
            case "TrackingMobile":
                archive.Job.TrackingMobile = value[..Math.Min(value.Length, 100)];
                break;
            case "TrackingEmail":
                archive.Job.TrackingEmail = value[..Math.Min(value.Length, 100)];
                break;
            case "PODName":
                archive.Job.UcjbPodname = value[..Math.Min(value.Length, 100)];
                break;
            case "Amount":
                archive.Job.UcjbAmount = decimal.Parse(value);
                break;
            case "NotifiedJobTypeID":
                var notifiedJobTypeId = short.Parse(value);
                archive.Job.NotifiedJobTypeId = notifiedJobTypeId;

                if (
                    notifiedJobTypeId > archive.Job.NotifiedJobTypeId
                    && archive.Job.ContactId != null
                    && archive.NotifiedJobType.UcjtName == "Email"
                    && archive.Contact?.HasEmail == true
                    && !string.IsNullOrEmpty(archive.Contact.UcctEmail)
                )
                {
                    archive.Job.SpeedChangeNotificationHasBeenSent = false;
                    archive.Job.WhenSpeedChangeNotificationSent = null;
                }
                else
                {
                    archive.Job.SpeedChangeNotificationHasBeenSent = true;
                }

                break;
            case "AcceptedJobTypeID":
                archive.Job.AcceptedJobTypeId = short.Parse(value);
                break;
            case "Locked":
                archive.Job.UcjbLocked = int.Parse(value);
                break;
            case "PuTime":
                archive.Job.PickUpTime = DateTime.Parse(value);
                break;
            case "PodName":
                archive.Job.UcjbPodname = value[..Math.Min(value.Length, 100)];
                break;
            case "DeliverBy":
                archive.Job.DeliverByTime = DateTime.Parse(value);
                break;
            case "BookedTime":
                archive.Job.UcjbDate = DateTime.Parse(value);
                break;
        }

        if (!string.IsNullOrEmpty(updateNote)) await SaveNoteAsync(jobId, updateNote, staffId);

        // Add additional notes for undeliverable location
        if (field == "UndeliverableLocationID" && archive.UndeliverableLocation?.Message != null)
            await SaveNoteAsync(jobId, archive.UndeliverableLocation.Message, staffId);

        Context.Update(archive.Job);
        await Context.SaveChangesAsync();
    }

    private static string GetTrackingName(int trackingMethodId)
    {
        return trackingMethodId switch
        {
            1 => "Email",
            2 => "Mobile",
            3 => "Email & Mobile",
            _ => string.Empty
        };
    }

    private async Task<JobInfo> GetJobInfo(int jobId)
    {
        return await Context
            .TucJobs.Where(j => j.UcjbId == jobId)
            .Select(j => new JobInfo { ClientItemIds = j.ClientItemIds, IsVan = j.UcjbSize == 3 })
            .FirstOrDefaultAsync();
    }

    private static IEnumerable<int> GetClientItemIds(string clientItemIdsString)
    {
        if (string.IsNullOrEmpty(clientItemIdsString))
            return [];

        return clientItemIdsString
            .Split(',')
            .Where(s => !string.IsNullOrEmpty(s))
            .Select(int.Parse);
    }

    private IQueryable<ClientItemsViewModel> BuildClientItemsQuery(
        int clientId,
        int speedId,
        IEnumerable<int> clientItemIds
    )
    {
        return Context
            .TblClientAvailableSpeeds.Where(cas =>
                cas.ClientId == clientId && cas.SpeedId == speedId
            )
            .SelectMany(cas =>
                cas.TblClientAvailableSpeedItems.Where(casi => casi.Active)
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
                    })
            );
    }

    private static async Task<PaginatedResponse<ClientItemsViewModel>> CreatePagedList(
        IQueryable<ClientItemsViewModel> query
    )
    {
        var count = await query.CountAsync();
        var items = await query.ToListAsync();

        return new PaginatedResponse<ClientItemsViewModel> { Items = items, Total = count };
    }

    private async Task<decimal> CalculateAmountAsync(int clientId, decimal amount)
    {
        var outputParam = new OutputParameter<decimal?>();
        await Context.Procedures.UTL_stpPPD_ExclusiveAmountAsync(clientId, amount, outputParam);

        return outputParam.Value ?? 0m;
    }

    private static TucJob CreateJobEntry(
        string jobNumber,
        int courierId,
        decimal amount,
        string reference,
        string clientRefB,
        string ourRef,
        string note,
        DateTime currentTime,
        int staffId
    )
    {
        return new TucJob
        {
            UcjbNumber = jobNumber,
            UcjbDate = currentTime,
            UcjbTime = currentTime,
            UcjbType = (int)JobType.AllServices,
            UcjbClientId = 911,
            UcjbContact = $"Courier {courierId}",
            UcjbChargeType = 3,
            UcjbAmount = amount,
            UcjbSpeed = 1,
            PickupAddressLine1 = note,
        DeliveryAddressLine1 = "ToSP",
        UcjbSize = 1,
            UcjbQty = 1,
            UcjbCbd = false,
            UcjbKm = 0,
            UcjbFlightDetails = "FD",
            UcjbWeight = 1,
            UcjbCourierId = courierId,
            UcjbClientRefa = reference[..Math.Min(reference.Length, 20)],
            UcjbClientRefb = clientRefB[..Math.Min(clientRefB.Length, 15)],
            UcjbOurRef = ourRef[..Math.Min(ourRef.Length, 20)],
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

    private async Task<string> GenerateJobNumberAsync(
        int staffId,
        int jobTypeId,
        CancellationToken cancellationToken = default
    )
    {
        var jobNumberOutput = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await Context.Procedures.NET_stpJob_Insert_JobNumberAsync(
            staffId,
            jobTypeId,
            jobNumberOutput,
            returnValue,
            cancellationToken
        );

        return jobNumberOutput.Value;
    }

    public async Task<JobLateCallDto> GetJobForLateCallAsync(int jobId)
    {
        var job = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(JobMappings.JobLateCallMapping)
            .FirstOrDefaultAsync();

        return job;
    }
}
