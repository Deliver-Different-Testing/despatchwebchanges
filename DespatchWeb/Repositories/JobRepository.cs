using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;
using System.Linq.Dynamic.Core;
using Microsoft.EntityFrameworkCore;
using Remotion.Linq.Clauses;

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
            var jobs = _context.DeswebQryDespatches.FromSql($"exec [DESWeb_qryCourierJobs] {courierId}, {done}").ToList();
            var list = 
                (from j in jobs
                    select new JobViewModel()
                    {
                        ID = j.UcjbId,
                        Time = j.UcjbTime,
                        Direct = j.Direct,
                        JobNo = j.UcjbNumber,
                        Speed = j.SpeedShortName,
                        Notify = j.NotifiedSpeed,
                        Vehicle = new Vehicle()
                        {
                            id = j.UcjbSize,
                            label = Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                        },
                        Client = j.UcclCode,
                        From = j.SuburbFrom,
                        FromAddress = j.UcjbFromAddr,
                        To = j.SuburbTo,
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
                            id = j.UcjbSize,
                            label = Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                        },
                        Weight = j.UcjbWeight,
                        Items = j.UcjbQty,
                        RefA = j.UcjbClientRefa,
                        RefB = j.UcjbClientRefb,
                        OurRef = j.UcjbOurRef,
                        SigNotRequired = j.SigNotRequired,
                        Charge = $"{j.UcjbAmount:C}",
                        Date = j.UcjbDate.ToString("dd/MM/yyyy"),
                        DispatchTime = j.UcjbDispTime,
                        PUTime = j.Putime,
                        ClientNotes = j.ClientNotes,
                        InternalNotes = j.InternalNotes,
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
                        }

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
                    orderToUse = $"NotifySpeed {ascending}";
                    break;
                case "lp":
                    orderToUse = $"ucjbLatePick {ascending}";
                    break;
                case "ld":
                    orderToUse = $"ucjbLateDel {ascending}";
                    break;

                default:
                    orderToUse = $"RemainTime {ascending}";
                    break;
            }

            var areas = new List<string>() {"city", "truck", "main1", "main2", "central", "shore", "west"};

            var filter = 
                _context.TblDespatchViews.Where(v =>
                    (v.ShowOnAssistDespatch ?? false) == true && (area != "all" && v.Name == area) || ( area == "all" && areas.Contains(v.Name))).ToList();
            var whereToUse = "";
            foreach (var w in filter)
            {
                if (!string.IsNullOrEmpty(whereToUse))
                {
                    whereToUse += " OR ";
                }
                whereToUse += $" ({w.WhereCondition}) ";
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
            var s = $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {whereToUse} order by {orderToUse}";

            var jobs = _context.DeswebQryDespatches.FromSql(s).ToList();
            var pallets = _context.TucJobItems.ToList();


            var list = (from j in jobs
                select new JobViewModel()
                {
                    ID = j.UcjbId,
                    Time = j.UcjbTime,
                    Direct = j.Direct,
                    JobNo = j.UcjbNumber,
                    Speed = j.SpeedShortName,
                    Notify = j.NotifiedSpeed,
                    Vehicle = new Vehicle()
                    {
                        id = j.UcjbSize,
                        label = Enum.GetName(typeof(Enums.Vehicle), (int) (j.UcjbSize ?? 2))
                    },
                    Client = j.UcclCode,
                    From = j.SuburbFrom,
                    FromAddress = j.UcjbFromAddr,
                    To = j.SuburbTo,
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
                        id = j.UcjbSize,
                        label = Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                    },
                    Weight = j.UcjbWeight,
                    Items = j.UcjbQty,
                    RefA = j.UcjbClientRefa,
                    RefB = j.UcjbClientRefb,
                    OurRef = j.UcjbOurRef,
                    SigNotRequired = j.SigNotRequired,
                    Charge = $"{j.UcjbAmount:C}",
                    Date = j.UcjbDate.ToString("dd/MM/yyyy"),
                    DispatchTime =j.UcjbDispTime, 
                    PUTime = j.Putime,
                    ClientNotes = j.ClientNotes,
                    InternalNotes = j.InternalNotes,
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
                    }


                }).ToList();

            return list;

        }
    }
}
