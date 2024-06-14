using System;
using System.Collections.Generic;

namespace DespatchWeb.Models
{

    public class JobViewModel
    {
        public int ID { get; set; }
        public int? RootParentID { get; set; }
        public DateTime? Time { get; set; }
        public DateTime? BookedDate { get; set; }
        public bool Direct { get; set; }
        public bool Van { get; set; }
        public int? JobRelationshipTypeID { get; set; }
        public bool? VanOK { get; set; }
        public bool? Done { get; set; }
        public bool Void { get; set; }
        public bool? Truck { get; set; }
        public bool SaturdayDelivery { get; set; }
        public bool Return { get; set; }
        public bool? Pedal { get; set; }
        public bool? Reprice { get; set; }
        public bool Attention { get; set; }
        public short? PickupFrom { get; set; }
        public string JobNo { get; set; }
        public string Speed { get; set; }
        public string SpeedName { get; set; }

        public string Source { get; set;  }
        public string NotifiedName { get; set; }
        public string AcceptedName { get; set; }
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
        public string FromPostCode { get; set; }
        public string FromAddress { get; set; }
        public string To { get; set; }
        public int? ToSuburbID { get; set; }
        public string ToSuburbName { get; set;  }
        public string ToPostCode { get; set; }
        public string ToAddress { get; set; }
        public string ToCity { get; set; }
        public string Courier { get; set; }
        public decimal? GstRate { get; set; }
        public int? Remain { get; set; }
        public int? PickupTime { get; set; }
        public int? DeliveryTime { get; set; }
        public int AlertLatePickup { get; set; }
        public int AlertLateDelivery { get; set; }
        public int? Minutes { get; set; }
        public int? StatusID { get; set; }
        public string Status { get; set; }
        public string StatusName { get; set; }
        public int? LP { get; set; }
        public int? LD { get; set; }
        public string ContactName { get; set; }
        public string LoggedInContactName { get; set; }
        public string DeliverToContact { get; set; }
        public int? TrackingMethod { get; set; }
        public string TrackingMobile { get; set; }
        public string TrackingEmail { get; set; }
        public string UDStatus { get; set; }
        public byte[] PODPhoto { get; set; }
        public byte[] DeliverySignature { get; set; }
        public List<byte[]> PODPhotos { get; set; }
        public string PODName { get; set; }
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
        public DateTime? FollowupTime { get; set; }
        public int? InternalStatusID { get; set; }
        public string ChildNotes { get; set; }
        public bool Locked { get; set; }
        public bool Invoiced { get; set; }
        public decimal? PickUpLongitude { get; set; }
        public decimal? PickUpLatitude { get; set; }
        public decimal? DeliveryLongitude { get; set; }
        public decimal? DeliveryLatitude { get; set; }
        public List<PalletInfo> PalletInfo { get; set; }
        public List<Size> RelatedJobs { get; set; }
        public decimal? CourierLatitude { get; set; }
        public decimal? CourierLongitude { get; set; }
        public int? RunOrder { get; set; }
        public CourierData CourierData { get; set; }
        public bool? AllowDispatch { get; set; }
        public bool? DGDocumentation { get; set;}
        public int? DGClass { get; set; }
        public bool? DisplaySplitJobDetail { get; set; }
        public int? TruckWeightLimit { get; set; }
        public DateTime? TruckStartTime { get; set; }
        public double? TruckHours { get; set; }
        public bool PrivateRes { get; set; }
        public bool? AllowSplit { get; internal set; }
        public DateTime? CompletedTime { get; set; }
        public string FromContactName { get; set;  }
        public string FromContactNumber { get; set; }
        public bool RatedManually { get; set; }
        public short? SizeID { get; set; }
        public bool? Active { get; set; }
        public bool? OneOff { get; set; }
        public string InActiveBy { get; set; }
        public DateTime? InActiveDate { get; set; }
        public DateTime? FirstDue { get; set; }
        public DateTime? NextDue { get; set; }
        public DateTime? LastDone { get; set; }
        public DateTime? StopDate { get; set; }
        public DateTime? RestartDate { get; set; }
        public string Days { get; set; }
        public bool PreBook { get; set; }
        public bool BulkJob { get; set; }
        public string RunName { get; set; }

        public string ScheduleName { get; set; }
        public string ConNote { get; set; }
        public bool? AirportOnly { get; set; }
        public bool HasNationwide { get; set; }
        public string? DispatcherName { get; set; }
        public DateTime? CreatedDate { get; set; }
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

    public class PalletInfo
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
        public int ItemID { get; set; }
    }


}
