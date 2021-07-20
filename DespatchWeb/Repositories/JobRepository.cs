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

namespace DespatchWeb.Repositories
{
    public class JobRepository
    {
        private readonly DespatchWebDataContext _context;

        public JobRepository(DespatchWebDataContext context)
        {
            _context = context;
        }

        public List<JobViewModel> CurrentJobList(Int32 courierId, bool done)
        {
            var jobs= _context.DeswebQryDespatches.FromSql($"exec [DESWeb_qryCourierJobs] {courierId}, {done}").ToList();
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

        public List<JobViewModel> JobList(string status, string area, string order, string ascending)
        {
            var orderToUse = "";
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

            var areas = new List<string>() {"city", "truck", "main1", "main2", "central", "shore", "west", "deep shore", "shallow shore", "east mid", "deep west", "shallow west", "west mid", "other", "mangere", "deep south", "deep east", "parnell", "eden terrace", "regional"};
            var selectedAreas = area.Split(',').ToList();

            var filter = 
                _context.TblDespatchViews.Where(v =>
                    (v.ShowOnAssistDespatch ?? false) == true && (area != "all" && selectedAreas.Contains(v.Name)) || ( area == "all" && areas.Contains(v.Name))).ToList();
            var whereToUse = "";
            foreach (var w in filter)
            {
                if (!string.IsNullOrEmpty(whereToUse))
                {
                    whereToUse += " OR ";
                }
                whereToUse += $" ({w.WhereCondition}) ";
            }

            whereToUse = $"({whereToUse})";

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
                        label = j.UcjbVan ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (int) (j.UcjbSize ?? 2))
                    },
                    Client = j.UcclCode,
                    ClientID = j.UcjbClientId,
                    ClientName = j.ClientName,
                    JobType = (int)j.UcjbType,
                    From = j.SuburbFrom,
                    FromSuburbID = j.FromSuburbId,
                    fromSuburbName = j.FromSuburbName,
                    FromAddress = j.UcjbFromAddr,
                    To = j.SuburbTo,
                    ToSuburbID = j.ToSuburbId,
                    ToSuburbName = j.ToSuburbName,
                    ToAddress = j.UcjbToAddr,
                    Courier = j.CourierCode,
                    Remain = j.RemainTime,
                    StatusID =  j.UcjbStatus,
                    Status = j.UcjsCode,
                    LP = j.UcjbLatePick,
                    LD = j.UcjbLateDel,
                    ContactName = j.UcjbContact,
                    Phone =  j.UcjbContactPhone,
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
                    DispatchTime =j.UcjbDispTime, 
                    PUTime = j.Putime,
                    ClientNotes = j.ClientNotes,
                    InternalNotes = j.JobNotes,
                    ChildNotes = j.ChildNotes,
                    PickUpLatitude = j.PickUpLatitude,
                    PickUpLongitude = j.PickUpLongitude,
                    DeliveryLatitude = j.DeliveryLatitude,
                    DeliveryLongitude = j.DeliveryLongitude,
                    PalletInfo = (
                        from pa in pallets.Where(p=>p.JobId == j.UcjbId)
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
                    DeliverToContact= j.DeliverToContact,
                    PODPhoto = j.DeliveryPhoto



                }).ToList();

            return list;

        }

        public async Task DispatchSelectedJobs(int courierId, int dispId, string jobIds)
        {
            await _context.LoadStoredProc("DESWEB_stpJob_AutoDespatchSelectedJobs")
              .WithSqlParam("@JobIDs", jobIds)
              .WithSqlParam("@CourierID", courierId)
              .WithSqlParam("@DispID", dispId)
              .ExecuteStoredNonQueryAsync();
            
            foreach (var jid in jobIds.Split(",").ToList().Where(x=>!string.IsNullOrWhiteSpace(x)))
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

        public async Task LatePickup(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher)
        {
            await _context.LoadStoredProc("DESWEB_stpUpdateJobPickupLateCall")
              .WithSqlParam("@JobID", jobId)
              .WithSqlParam("@BookedSpeed", bookedSpeed)
              .WithSqlParam("@NotifiedSpeed", notifiedSpeed)
              .WithSqlParam("@Late", late)
              .WithSqlParam("@Despatcher", despatcher)
              .ExecuteStoredNonQueryAsync();
        }

        public async Task LateDelivery(int jobId, string bookedSpeed, string notifiedSpeed, int late, string despatcher)
        {
            await _context.LoadStoredProc("DESWEB_stpUpdateJobDeliveryLateCall")
              .WithSqlParam("@JobID", jobId)
              .WithSqlParam("@BookedSpeed", bookedSpeed)
              .WithSqlParam("@NotifiedSpeed", notifiedSpeed)
              .WithSqlParam("@Late", late)
              .WithSqlParam("@Despatcher", despatcher)
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

        public List<SuburbLookup> Suburbs() {
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

        public async Task<decimal> RateTruckJob (int clientId, int fromId, int toId, double weight, int size, int speed, int qty, DateTime bookedDate, int pickUp, int dropOff, bool privateRes, int oversizeItems, 
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

        public async Task<decimal> RateJob (int clientId, int fromId, int toId, int speed, bool pedal, bool van, bool returnJob, int weight, int size, bool includeFuelSurcharge, bool direct, int acceptedJobTypeId, 
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

        public async Task<TruckItemsSummary> TruckJobItems (int jobId, int truckWeightLimit)
        {
            var result = new List<TruckItemsSummary>();
            await _context.LoadStoredProc("qry_tucJobItems")
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@TruckWeightLimit", truckWeightLimit)
                .ExecuteStoredProcAsync(handle => { result = handle.ReadToList<TruckItemsSummary>().ToList(); });
            return result.FirstOrDefault();
        }

        public async Task UpdateDeliveryAddress (int jobId, int toSuburbId, string address, decimal deliveryLat, decimal deliveryLng, bool cbd, decimal rate)
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

        public async Task UpdateJob (int jobId, string field, string value, decimal? rate, string despatcher, int staffId )
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
