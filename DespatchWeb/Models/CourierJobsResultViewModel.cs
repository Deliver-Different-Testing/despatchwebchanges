using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Newtonsoft.Json;


namespace DespatchWeb.Models
{
    

    public class Welcome
    {
        [JsonProperty("ucjbClientID")]
        public int UcjbClientId { get; set; }

        [JsonProperty("ucjbNumber")]
        public string UcjbNumber { get; set; }

        [JsonProperty("ucjbDispTime")]
        public string UcjbDispTime { get; set; }

        [JsonProperty("ucjbTime")]
        public DateTime UcjbTime { get; set; }

        [JsonProperty("ucjbID")]
        public int UcjbId { get; set; }

        [JsonProperty("ucjbCourierID")]
        public int UcjbCourierId { get; set; }

        [JsonProperty("CourierCode")]
        public string CourierCode { get; set; }

        [JsonProperty("SuburbFrom")]
        public string SuburbFrom { get; set; }

        [JsonProperty("SuburbTo")]
        public string SuburbTo { get; set; }

        [JsonProperty("ucjbSpeed")]
        public int UcjbSpeed { get; set; }

        [JsonProperty("ucjbComplTime")]
        public DateTime UcjbComplTime { get; set; }

        [JsonProperty("ucjbDispID")]
        public int UcjbDispId { get; set; }

        [JsonProperty("ucjbAttention")]
        public int UcjbAttention { get; set; }

        [JsonProperty("ucjbPickUpFrom")]
        public int UcjbPickUpFrom { get; set; }

        [JsonProperty("RegionFromID")]
        public int RegionFromId { get; set; }

        [JsonProperty("RegionToID")]
        public int RegionToId { get; set; }

        [JsonProperty("ucjbJobDone")]
        public bool UcjbJobDone { get; set; }

        [JsonProperty("ucjbPaged")]
        public bool UcjbPaged { get; set; }

        [JsonProperty("ucjbPagedTime")]
        public DateTime UcjbPagedTime { get; set; }

        [JsonProperty("ucjbLatePick")]
        public string UcjbLatePick { get; set; }

        [JsonProperty("ucjbLateDel")]
        public string UcjbLateDel { get; set; }

        [JsonProperty("ucjbContact")]
        public string UcjbContact { get; set; }

        [JsonProperty("ucjbToAddr")]
        public string UcjbToAddr { get; set; }

        [JsonProperty("ucjbType")]
        public int UcjbType { get; set; }

        [JsonProperty("ucjbVoid")]
        public string UcjbVoid { get; set; }

        [JsonProperty("ucjbVan")]
        public string UcjbVan { get; set; }

        [JsonProperty("ucjbReturn")]
        public string UcjbReturn { get; set; }

        [JsonProperty("ucjbDispDate")]
        public string UcjbDispDate { get; set; }

        [JsonProperty("ucjbSize")]
        public int UcjbSize { get; set; }

        [JsonProperty("ucjbStatus")]
        public int UcjbStatus { get; set; }

        [JsonProperty("ucjbDate")]
        public string UcjbDate { get; set; }

        [JsonProperty("ucclCode")]
        public string UcclCode { get; set; }

        [JsonProperty("ucjbToSpecial")]
        public string UcjbToSpecial { get; set; }

        [JsonProperty("ucjsCode")]
        public string UcjsCode { get; set; }

        [JsonProperty("SaturdayDelivery")]
        public string SaturdayDelivery { get; set; }

        [JsonProperty("EmailForJobFU")]
        public string EmailForJobFu { get; set; }

        [JsonProperty("PickupRemain")]
        public string PickupRemain { get; set; }

        [JsonProperty("Remain")]
        public int Remain { get; set; }

        [JsonProperty("RemainTime")]
        public int RemainTime { get; set; }

        [JsonProperty("RemoteJob")]
        public string RemoteJob { get; set; }

        [JsonProperty("SpeedShortName")]
        public string SpeedShortName { get; set; }

        [JsonProperty("Minutes")]
        public int Minutes { get; set; }

        [JsonProperty("PickupTime")]
        public int PickupTime { get; set; }

        [JsonProperty("DeliveryTime")]
        public int DeliveryTime { get; set; }

        [JsonProperty("AlertLatePickUp")]
        public int AlertLatePickUp { get; set; }

        [JsonProperty("AlertLateDelivery")]
        public int AlertLateDelivery { get; set; }

        [JsonProperty("OriginalSpeed")]
        public string OriginalSpeed { get; set; }

        [JsonProperty("ucjbPODName")]
        public string UcjbPodName { get; set; }

        [JsonProperty("NotifiedSpeed")]
        public string NotifiedSpeed { get; set; }

        [JsonProperty("Direct")]
        public string Direct { get; set; }

        [JsonProperty("FirstJob")]
        public string FirstJob { get; set; }

        [JsonProperty("NotifiedJobTypeID")]
        public int NotifiedJobTypeId { get; set; }

        [JsonProperty("IsParentJob")]
        public int IsParentJob { get; set; }

        [JsonProperty("RootParentID")]
        public int RootParentId { get; set; }

        [JsonProperty("DisplaySplitJobDetail")]
        public int DisplaySplitJobDetail { get; set; }

        [JsonProperty("DisplayReturnJobDetail")]
        public int DisplayReturnJobDetail { get; set; }

        [JsonProperty("DisplayMultiJobDetail")]
        public int DisplayMultiJobDetail { get; set; }

        [JsonProperty("IsChildJob")]
        public int IsChildJob { get; set; }

        [JsonProperty("AllowSplit")]
        public string AllowSplit { get; set; }

        [JsonProperty("ChildNotes")]
        public string ChildNotes { get; set; }

        [JsonProperty("AllowDespatch")]
        public string AllowDespatch { get; set; }

        [JsonProperty("ClosestCourierID")]
        public string ClosestCourierId { get; set; }

        [JsonProperty("JobRelationshipTypeID")]
        public int JobRelationshipTypeId { get; set; }

        [JsonProperty("ucclAccountStatus")]
        public int UcclAccountStatus { get; set; }

        [JsonProperty("CDT")]
        public int Cdt { get; set; }

        [JsonProperty("PickRunOrder")]
        public int PickRunOrder { get; set; }

        [JsonProperty("DropRunOrder")]
        public int DropRunOrder { get; set; }

        [JsonProperty("ucjbMobileSend")]
        public string UcjbMobileSend { get; set; }

        [JsonProperty("SendJobsViaSMS")]
        public string SendJobsViaSms { get; set; }

        [JsonProperty("ucjbFromAddr")]
        public string UcjbFromAddr { get; set; }

        [JsonProperty("Truck")]
        public string Truck { get; set; }

        [JsonProperty("InternalStatus")]
        public string InternalStatus { get; set; }

        [JsonProperty("FollowupTime")]
        public string FollowupTime { get; set; }

        [JsonProperty("Reprice")]
        public string Reprice { get; set; }

        [JsonProperty("SiteID")]
        public int SiteId { get; set; }

        [JsonProperty("PickupAmount")]
        public string PickupAmount { get; set; }

        [JsonProperty("DropoffAmount")]
        public string DropoffAmount { get; set; }

        [JsonProperty("BulletFreight")]
        public string BulletFreight { get; set; }

        [JsonProperty("VanOK")]
        public string VanOk { get; set; }

        [JsonProperty("DGClass")]
        public string DgClass { get; set; }

        [JsonProperty("InternalAccount")]
        public string InternalAccount { get; set; }

        [JsonProperty("FromArea")]
        public int FromArea { get; set; }

        [JsonProperty("ToArea")]
        public int ToArea { get; set; }

        [JsonProperty("FromSuburbID")]
        public int FromSuburbId { get; set; }

        [JsonProperty("ToSuburbID")]
        public int ToSuburbId { get; set; }

        [JsonProperty("DesCheck")]
        public string DesCheck { get; set; }

        [JsonProperty("FDCourierID")]
        public string FdCourierId { get; set; }

        [JsonProperty("FDCourierCode")]
        public string FdCourierCode { get; set; }

        [JsonProperty("HasGeoLocation")]
        public int HasGeoLocation { get; set; }

        [JsonProperty("Code")]
        public int Code { get; set; }

        [JsonProperty("intAddress")]
        public string intAddress { get; set; }

        [JsonProperty("intAddressFrom")]
        public string intAddressFrom { get; set; }
    }


}

