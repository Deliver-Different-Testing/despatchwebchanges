using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DespatchWeb.Models
{

    public class JobViewModel
    {
        public int ID { get; set; }
        public DateTime? Time { get; set; }
        public bool Direct { get; set; }
        public bool Van { get; set; }
        public bool? Truck { get; set; }
        public bool SaturdayDelivery { get; set; }
        public bool Return { get; set; }
        public short? PickupFrom { get; set; }
        public string JobNo { get; set; }
        public string Speed { get; set; }
        public int? SpeedID { get; set; }
        public string Notify { get; set; }
        public Vehicle Vehicle { get; set; }
        public int? ClientID { get; set; }
        public int JobType { get; set; }
        public string Client { get; set; }
        public string ClientName { get; set; }
        public string From { get; set; }
        public int? FromSuburbID { get; set; }
        public string fromSuburbName { get; set; }
        public string FromAddress { get; set; }
        public string To { get; set; }
        public int? ToSuburbID { get; set; }
        public string ToSuburbName { get; set;  }
        public string ToAddress { get; set; }
        public string Courier { get; set; }
        public int? Remain { get; set; }
        public int? PickupTime { get; set; }
        public int? DeliveryTime { get; set; }
        public int AlertLatePickup { get; set; }
        public int AlertLateDelivery { get; set; }
        public int? Minutes { get; set; }
        public int? StatusID { get; set; }
        public string Status { get; set; }
        public int? LP { get; set; }
        public int? LD { get; set; }
        public string ContactName { get; set; }
        public string DeliverToContact { get; set; }
        public byte[] PODPhoto { get; set; }
        public string Phone { get; set; }
        public string SpeedAccepted { get; set; }
        public int? AcceptedJobTypeID { get; set; }
        public int? NotifiedJobTypeID { get; set; }
        public Vehicle Size { get; set; }
        public double? Weight { get; set; }
        public short? Items { get; set; }
        public string RefA { get; set; }
        public string RefB { get; set; }
        public string OurRef { get; set; }
        public string SigNotRequired { get; set; }
        public string Charge { get; set; }
        public string Date { get; set; }
        public DateTime? DispatchTime { get; set; }
        public DateTime Booked { get; set; }
        public DateTime? PUTime { get; set; }
        public string ClientNotes { get; set; }
        public string InternalNotes { get; set; }
        public string ChildNotes { get; set; }
        public decimal? PickUpLongitude { get; set; }
        public decimal? PickUpLatitude { get; set; }
        public decimal? DeliveryLongitude { get; set; }
        public decimal? DeliveryLatitude { get; set; }
        public List<Palletinfo> PalletInfo { get; set; }
        public decimal? CourierLatitude { get; set; }
        public decimal? CourierLongitude { get; set; }
        public int? RunOrder { get; set; }
        public CourierData CourierData { get; set; }
        public bool? AllowDispatch { get; set; }
        public int? DGClass { get; set; }
        public bool? DisplaySplitJobDetail { get; set; }
        public int? TruckWeightLimit { get; set; }
        public DateTime? TruckStartTime { get; set; }
        public double? TruckHours { get; set; }
        public bool PrivateRes { get; set; }
        public bool? AllowSplit { get; internal set; }
    }

    public class Vehicle
    {
        public short? id { get; set; }
        public string label { get; set; }
    }


    public class Size
    {
        public int id { get; set; }
        public string label { get; set; }
    }

    public class Palletinfo
    {
        public int ID { get; set; }
        public int Quantity { get; set; }
        public double Weight { get; set; }
        public double Length { get; set; }
        public double Depth { get; set; }
        public double Height { get; set; }
        public bool? PU { get; set; }
        public bool? DO { get; set; }
        public int? DGClass { get; set; }
        public string Notes { get; set; }
    }


}
