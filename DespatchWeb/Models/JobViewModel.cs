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
        public string JobNo { get; set; }
        public string Speed { get; set; }
        public string Notify { get; set; }
        public Vehicle Vehicle { get; set; }
        public string Client { get; set; }
        public string From { get; set; }
        public string FromAddress { get; set; }
        public string To { get; set; }
        public string ToAddress { get; set; }
        public string Courier { get; set; }
        public int? Remain { get; set; }
        public int? StatusID { get; set; }
        public string Status { get; set; }
        public int? LP { get; set; }
        public int? LD { get; set; }
        public string ContactName { get; set; }
        public string Phone { get; set; }
        public string SpeedAccepted { get; set; }
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
        public DateTime? PUTime { get; set; }
        public string ClientNotes { get; set; }
        public string InternalNotes { get; set; }
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
