using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;
using System.Linq.Dynamic.Core;
using Microsoft.EntityFrameworkCore;
using DespatchWebContextExtensions;
using Remotion.Linq.Clauses;
using System.Data.Common;
using System.Diagnostics;
using System.Threading;
using Remotion.Linq.Parsing.Structure.IntermediateModel;

namespace DespatchWeb.Repositories
{
    public class JobRepository
    {
        private readonly DespatchWebDataContext _context;

        public JobRepository(DespatchWebDataContext context)
        {
            _context = context;
        }

        public async Task<JobViewModel> JobDetail(int jobId)
        {
            var jobQuery = (
                from j in _context.TblJobs
                join c in _context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
                from co in courierJoin.DefaultIfEmpty()
                join y in _context.TucSuburbs on j.FromSuburbId equals y.UcsuId into fromJoin
                from yo in fromJoin.DefaultIfEmpty()
                join z in _context.TucSuburbs on j.ToSuburbId equals z.UcsuId into toJoin
                from zo in toJoin.DefaultIfEmpty()
                join t in _context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
                from to in speedJoin.DefaultIfEmpty()
                join n in _context.TucJobTypes on j.NotifiedJobTypeId equals n.UcjtId into notifiedSpeedJoin
                from no in notifiedSpeedJoin.DefaultIfEmpty()
                join o in _context.TucJobTypes on j.AcceptedJobTypeId equals o.UcjtId into originalSpeedJoin
                from os in originalSpeedJoin.DefaultIfEmpty()
                join cl in _context.TblClients on j.ClientId equals cl.ClientId into clientJoin
                from client in clientJoin.DefaultIfEmpty()
                join s in _context.TucJobStatuses on j.Status equals s.UcjsId into statusJoin
                from status in statusJoin.DefaultIfEmpty()
                join l in _context.TblJobLeaveNotHomes on j.LeaveNotHomeId equals l.LeaveNotHomeId into leaveNotHomeJoin
                from leave in leaveNotHomeJoin.DefaultIfEmpty()

                where (j.JobId == jobId)
                select new JobViewModel()
                {
                    ID = j.JobId,
                    Time = j.Time,
                    Direct = j.Direct,
                    Van = j.Van,
                    Truck = j.Truck,
                    SaturdayDelivery = j.SaturdayDelivery,
                    Return = j.Return,
                    Done = j.JobDone,
                    Void = j.Void,
                    PickupFrom = j.PickupFrom,
                    JobNo = j.Number,
                    Speed = to.ShortName,
                    SpeedID = j.Speed,
                    Notify = no.ShortName,
                    AcceptedJobTypeID = j.AcceptedJobTypeId,
                    NotifiedJobTypeID = j.NotifiedJobTypeId,
                    Vehicle = new Vehicle()
                    {
                        id = j.Van ? (short?)Enums.Vehicle.Van : j.Size,
                        label = j.Van ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (j.Size ?? (short)2))
                    },
                    Client = j.ClientCode,
                    ClientID = j.ClientId,
                    ClientName = client.Name,
                    JobType = (int)j.Type,
                    From = yo.UcsuName,
                    FromSuburbID = j.FromSuburbId,
                    fromSuburbName = yo.UcsuName,
                    FromAddress = j.FromAddress,
                    FromContactName = j.PickupFromContact,
                    FromContactNumber = j.PickupFromPhone,
                    To = zo.UcsuName,
                    ToSuburbID = j.ToSuburbId,
                    ToSuburbName = zo.UcsuName,
                    ToAddress = j.ToAddress,
                    Courier = co.Code,
                    StatusID = j.Status,
                    Status = status.UcjsCode,
                    LP = j.LatePickUp,
                    LD = j.LateDelivery,
                    ContactName = j.DeliverToContact,
                    Phone = j.DeliverToPhone,
                    SpeedAccepted = os.ShortName,
                    Size = new Vehicle()
                    {
                        id = j.Van ? (short?)Enums.Vehicle.Van : j.Size,
                        label = j.Van ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (j.Size ?? (short)2))
                    },
                    Weight = j.Weight,
                    Items = j.Quantity,
                    RefA = j.ClientReferenceA,
                    RefB = j.ClientReferenceB,
                    OurRef = j.OurRef,
                    SigNotRequired = leave.Name ?? "",
                    Charge = $"{j.Amount:C}",
                    // Date = j.Date.ToString("dd/MM/yyyy"),
                    Booked = DateTime.Parse(j.Date.Value.ToString("yyyy-MM-dd") + " " + j.Time.Value.ToString("HH:mm:ss")),
                    DispatchTime = j.DispatchDate.HasValue ? DateTime.Parse(j.DispatchDate.Value.ToString("yyyy-MM-dd") + " " + j.DispatchTime.Value.ToString("HH:mm:ss")): j.DispatchDate,
                    PUTime = j.PickUpTime,
                    ClientNotes = j.ClientNotes,
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
                    //DGClass = j.Dgclass,
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
                    PODPhoto = j.DeliveryPhoto ?? j.DeliverySignature,
                    PODName = j.Podname

                });
            return await jobQuery.FirstOrDefaultAsync();
        }

        public Tuple<int, List<JobViewModel>> PODSearch(Int32? courierId, string wild, DateTime fromDate, DateTime toDate, Int32? clientId, Int32 pageIndex, Int32 pageSize)
        {
            var clientSet = clientId.HasValue;
            var courierSet = courierId.HasValue;
            var wildParam = $"%{wild}%";
            var jobsQuery = (
                from x in _context.TblJobs
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
                where (x.Date >= fromDate && x.Date <= toDate) && (!clientSet || x.ClientId == clientId) &&
                      (!courierSet || x.CourierId == courierId) && 
                      (wild == "" ||(EF.Functions.Like(x.FromAddress + " " + yo.UcsuName + " " + x.ToAddress + " " + zo.UcsuName + " " + (x.ClientReferenceA ?? "") + " " + (x.ClientReferenceB ?? "") + " "  + (x.OurRef ?? "") + " " + x.Number.ToLower(), wildParam)))

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
                    PickUpLatitude = x.PickUpLatitude,
                    PickUpLongitude = x.PickUpLongitude,
                    DeliveryLatitude = x.DeliveryLatitude,
                    DeliveryLongitude = x.DeliveryLongitude,
                    Booked = DateTime.Parse(x.Date.Value.ToString("yyyy-MM-dd") + " " + x.Time.Value.ToString("HH:mm:ss")),

                });
            var stopwatch = new Stopwatch();
            stopwatch.Start();
            var total = jobsQuery.Count();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            stopwatch.Reset();
            stopwatch.Start();
            var jobs = jobsQuery
                .OrderBy(a => a.Booked).Skip((pageIndex - 1) * pageSize).Take(pageSize).ToList();
            stopwatch.Stop();
            Console.WriteLine(stopwatch.ElapsedMilliseconds);
            return Tuple.Create(total, jobs);

        }
        public List<JobViewModel> CurrentJobList(Int32 courierId, bool done)
        {
            var jobs = _context.DeswebQryDespatches.FromSql($"exec [DESWeb_qryCourierJobs] {courierId}, {done}").ToList();
            var list =
                (from j in jobs
                 select new JobViewModel()
                 {
                     ID = j.UcjbId,
                     Time = j.UcjbTime,
                     Direct = j.Direct,
                     Van = j.UcjbVan,
                     Truck = j.Truck,
                     SaturdayDelivery = j.SaturdayDelivery,
                     Return = j.UcjbReturn,
                     PickupFrom = j.UcjbPickUpFrom,
                     JobNo = j.UcjbNumber,
                     Speed = j.SpeedShortName,
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
                     JobType = (int)j.UcjbType,
                     From = j.SuburbFrom,
                     FromSuburbID = j.FromSuburbId,
                     fromSuburbName = j.FromSuburbName,
                     FromAddress = j.UcjbFromAddr,
                     FromContactName = j.PickupFromContact,
                     FromContactNumber = j.PickupFromPhone,
                     To = j.SuburbTo,
                     ToSuburbID = j.ToSuburbId,
                     ToSuburbName = j.ToSuburbName,
                     ToAddress = j.UcjbToAddr,
                     Courier = j.CourierCode,
                     Remain = j.RemainTime,
                     StatusID = j.UcjbStatus,
                     Status = j.UcjsCode,
                     LP = j.UcjbLatePick,
                     LD = j.UcjbLateDel,
                     ContactName = j.UcjbContact,
                     Phone = j.UcjbContactPhone,
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
                     PODPhoto = j.DeliveryPhoto

                 }).ToList();
            return list;
        }

        public List<JobViewModel> JobList(string status, string area, string order, string ascending, bool isInternal, string clientIds)
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
                    _context.TblDespatchViews.Where(v =>
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

            var jobs = _context.DeswebQryDespatches.FromSql(s).ToList();
            var pallets = _context.TucJobItems.ToList();


            var list = (from j in jobs
                        select new JobViewModel()
                        {
                            ID = j.UcjbId,
                            Time = j.UcjbTime,
                            Direct = j.Direct,
                            Van = j.UcjbVan,
                            Truck = j.Truck,
                            Return = j.UcjbReturn,
                            PickupFrom = j.UcjbPickUpFrom,
                            SaturdayDelivery = j.SaturdayDelivery,
                            JobNo = j.UcjbNumber,
                            Speed = j.SpeedShortName,
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
                            FromAddress = j.UcjbFromAddr,
                            To = j.SuburbTo,
                            ToSuburbID = j.ToSuburbId,
                            ToSuburbName = j.ToSuburbName,
                            ToAddress = j.UcjbToAddr,
                            Courier = j.CourierCode,
                            Remain = j.RemainTime,
                            StatusID = j.UcjbStatus,
                            Status = j.UcjsCode,
                            LP = j.UcjbLatePick,
                            LD = j.UcjbLateDel,
                            ContactName = j.UcjbContact,
                            Phone = j.UcjbContactPhone,
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
                                select new Palletinfo()
                                {
                                    ID = pa.JobId,
                                    Quantity = pa.Items,
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
                            PODPhoto = j.DeliveryPhoto



                        }).ToList();

            return list;

        }

        public async Task<List<SupportViewModel>> SupportEvents(string channel)
        {
            var whereToUse = "";
            var orderToUse = "CASE WHEN ucevType = 1 THEN 1 WHEN ucevType = 2 THEN 2 ELSE 0 END, ucevTime";
            switch (channel)
            {
                case "Main":
                    whereToUse =
                        "(RemoteJob = 0 AND (RegionFromID = 2 OR RegionFromID = 3 Or RegionFromID = 10) AND (RegionToID = 1 OR RegionToID = 4 OR RegionToID = 10 OR (RegionToID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39,53,54))) or ((RegionFromID = 2 OR RegionFromID = 3) AND (RegionToID = 2 OR RegionToID = 3) And ucjbVan=1) AND (IsParentJob = 0) AND (Truck = 0 OR Truck is NULL OR (Truck = 1 AND VanOK = 1))) or (RemoteJob = 0 AND (RegionFromID = 4 OR RegionFromID = 10 OR (RegionFromID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39,53,54))) AND   (RegionToID < 5 OR RegionToID = 10 OR (RegionToID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39))) AND  NOT (RegionFromID = 10 AND (RegionToID = 5 AND ucjbSpeed IN (1,2,3,4,10,20,25,29,39))) AND (IsParentJob = 0) AND (Truck = 0 OR Truck is NULL OR (Truck = 1 AND VanOK = 1))) or ((ucjbSpeed IN(45) OR Truck = 1) AND IsParentJob = 0)";
                    break;
                case "City":
                    whereToUse =
                        "((RemoteJob = 0 AND (RegionFromID = 2 OR RegionFromID = 3 Or RegionFromID = 10) AND (RegionToID = 2 OR RegionToID = 3 Or RegionToID = 10)) AND (IsParentJob = 0) AND (Truck = 0 OR Truck is NULL OR (Truck = 1 AND VanOK = 1))) or (RemoteJob = 0 AND RegionFromID = 3  AND RegionToID = 3  AND ucjbSize in(0,1) AND (Truck = 0 OR Truck is NULL))";
                    break;
                case "Trucks":
                    whereToUse = "(ucjbSpeed IN (45,109) OR Truck = 1) AND IsParentJob = 0";
                    break;
                case "All":
                    break;
            }

            var s = channel == "All" ? $"select * from DES_qrySupportEvents_CustomerAndCourier order by {orderToUse}" : $"select * from DES_qrySupportEvents_CustomerAndCourier where {whereToUse} order by {orderToUse}";

            var events = _context.DesQrySupportEventsCustomerAndCouriers.FromSql(s).ToList();
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
            var support = await _context.TucEvents.FindAsync(id);
            return support;
        }

        public async Task<int> UpdateSupportEvent(TucEvent supportEvent)
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

            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {

                await _context.LoadStoredProc("DES_stpJob_AutoDespatchChildJobs")
                .WithSqlParam("@JobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();

            }

        }

        public async Task ReDispatchSelectedJobs(int courierId, int dispId, string jobIds)
        {

            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {

                await _context.LoadStoredProc("uspRestoreJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();

            }

            await DispatchSelectedJobs(courierId, dispId, jobIds);
        }

        public async Task ReSendSelectedJobs(string jobIds)
        {

            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {

                await _context.LoadStoredProc("uspReDespatchJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();

            }


        }

        public async Task TransferJob(int jobId, int courierId, int dispId)
        {
            await _context.LoadStoredProc("DESWEB_stpJob_TransferJob")
                    .WithSqlParam("@JobID", jobId)
                    .WithSqlParam("@CourierID", courierId)
                    .WithSqlParam("@DispID", dispId)
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

            return (Int32)outputMaxParam.Value;
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

            return (Int32)outputMaxParam.Value;
        }

        public async Task ResetLateEvent(int jobId, int eventType)
        {
            await _context.LoadStoredProc("DES_qdfLateCall_Reset")
              .WithSqlParam("@JobID", jobId)
              .WithSqlParam("@Type", eventType)
              .ExecuteStoredNonQueryAsync();
        }

        public async Task LatePickup(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher, bool calculationRequired)
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

        public async Task LateDelivery(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher, bool calculationRequired)
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
            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {
                await _context.LoadStoredProc("DES_stpJob_SplitJobRestore")
                .WithSqlParam("@JobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
            }
        }

        public async Task RestoreJobs(string jobIds)
        {
            foreach (var jid in jobIds.Split(",").ToList().Where(x => !string.IsNullOrWhiteSpace(x)))
            {
                await _context.LoadStoredProc("uspRestoreJob")
                .WithSqlParam("@intJobID", int.Parse(jid))
                .ExecuteStoredNonQueryAsync();
            }
        }

        public async Task VoidJob(int jobId)
        {
            await _context.LoadStoredProc("DES_stpJob_Void")
                .WithSqlParam("@JobID", jobId)
                .ExecuteStoredNonQueryAsync();
        }

        public async Task SplitJob(int jobId, string user)
        {
            await _context.LoadStoredProc("DES_stpJob_SplitJob")
               .WithSqlParam("@JobID", jobId)
               .WithSqlParam("@PreBookJob", false)
               .WithSqlParam("@UserName", user)
               .ExecuteStoredNonQueryAsync();
        }

        public async Task UpdateSplitJobAddress(int jobId, int toSuburbId, string address, decimal deliveryLat, decimal deliveryLng)
        {
            await _context.LoadStoredProc("DESWEB_stpUpdateSplitJobMeetingAddress")
               .WithSqlParam("@JobID", jobId)
               .WithSqlParam("@Suburb", toSuburbId)
               .WithSqlParam("@Address", address)
               .WithSqlParam("@DeliveryLatitude", deliveryLat)
               .WithSqlParam("@DeliveryLongitude", deliveryLng)
               .ExecuteStoredNonQueryAsync();
        }

        public async Task ReRateSplitJob(int jobId)
        {
            await _context.LoadStoredProc("DES_stpJob_SplitJob_ReRate")
               .WithSqlParam("@ParentJobID", jobId)
               .WithSqlParam("@PreBookJob", false)
               .ExecuteStoredNonQueryAsync();
        }

        public List<SuburbLookup> Suburbs()
        {
            var data = (from s in _context.TucSuburbs
                        select s).Select(x => new SuburbLookup() { ID = x.UcsuId, Text = x.UcsuName, Alias = x.GoogleSuburbAlias });
            return data.ToList();
        }

        public List<Speed> Speeds()
        {
            var data = (from s in _context.DesQryAllJobTypes
                        select s).Select(x => new Speed() { ID = x.JobTypeId, Text = x.Name });
            return data.ToList();
        }

        public async Task<decimal> RateTruckJob(int clientId, int fromId, int toId, double weight, int size, int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems,
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

        public async Task<decimal> RateJob(int clientId, int fromId, int toId, int speed, bool pedal, bool van, bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId,
                                            string ourRef, string refA, string refB, int quantity, DateTime booked)
        {
            DbParameter outputRateParam = null;

            await _context.LoadStoredProc("sp_RateJob2")
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

        public async Task<TruckItemsSummary> TruckJobItems(int jobId, int truckWeightLimit)
        {
            var result = new List<TruckItemsSummary>();
            await _context.LoadStoredProc("qry_tucJobItems")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@TruckWeightLimit", truckWeightLimit)
                .ExecuteStoredProcAsync(handle => { result = handle.ReadToList<TruckItemsSummary>().ToList(); });
            return result.FirstOrDefault();
        }

        public async Task UpdateDeliveryAddress(int jobId, int toSuburbId, string address, decimal deliveryLat, decimal deliveryLng, bool cbd, decimal rate)
        {
            await _context.LoadStoredProc("DESWEB_stpUpdateJobDeliveryAddress")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@ToSuburb", toSuburbId)
                .WithSqlParam("@Address", address)
                .WithSqlParam("@DeliveryLatitude", deliveryLat)
                .WithSqlParam("@DeliveryLongitude", deliveryLng)
                .WithSqlParam("@CBD", cbd)
                .WithSqlParam("@Rate", rate)
                .ExecuteStoredNonQueryAsync();

        }

        public async Task UpdatePickupAddress(int jobId, int fromSuburbId, string address, decimal pickupLat, decimal pickupLng, bool cbd, decimal rate)
        {
            await _context.LoadStoredProc("DESWEB_stpUpdateJobPickupAddress")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@FromSuburb", fromSuburbId)
                .WithSqlParam("@Address", address)
                .WithSqlParam("@PickupLatitude", pickupLat)
                .WithSqlParam("@PickupLongitude", pickupLng)
                .WithSqlParam("@CBD", cbd)
                .WithSqlParam("@Rate", rate)
                .ExecuteStoredNonQueryAsync();

        }

        public async Task UpdateJob(int jobId, string field, string value, decimal? rate, string despatcher, int staffId)
        {
            await _context.LoadStoredProc("DESWEB_stpUpdateJob")
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
            await _context.LoadStoredProc("DES_stpJob_AddNotes")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@Notes", note)
                .WithSqlParam("@Username", despatcher)
                .ExecuteStoredNonQueryAsync();
        }
    }
}
